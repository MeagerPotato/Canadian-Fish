import { describe, expect, it } from 'vitest'
import { MemDeps } from './memdeps.ts'
import { get, post, sixHumans } from './util.ts'

function errCode(body: Record<string, unknown>): string {
  return (body.error as { code: string }).code
}

describe('rate limits (PROTOCOL §6)', () => {
  it('create-room: 21st create from one IP within the hour is 429', async () => {
    const deps = new MemDeps()
    for (let i = 0; i < 20; i++) {
      const r = await post(deps, '/api/create-room', {}, { ip: '9.9.9.9' })
      expect(r.status).toBe(200)
    }
    const over = await post(deps, '/api/create-room', {}, { ip: '9.9.9.9' })
    expect(over.status).toBe(429)
    expect(errCode(over.body)).toBe('RATE_LIMITED')
    // A different IP is unaffected.
    const other = await post(deps, '/api/create-room', {}, { ip: '8.8.8.8' })
    expect(other.status).toBe(200)
  })

  it('join: 121st join attempt from one IP within the hour is 429', async () => {
    const deps = new MemDeps()
    for (let i = 0; i < 120; i++) {
      const r = await post(deps, '/api/join', { code: 'ZZZZZZ' }, { ip: '7.7.7.7' })
      expect(r.status).toBe(404) // attempts against a missing room still count
    }
    const over = await post(deps, '/api/join', { code: 'ZZZZZZ' }, { ip: '7.7.7.7' })
    expect(over.status).toBe(429)
    expect(errCode(over.body)).toBe('RATE_LIMITED')
  })

  it('action: 31st action for one token within a 10 s window is 429', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })
    // Illegal actions (wrong phase for pass) still consume the budget.
    for (let i = 0; i < 30; i++) {
      const r = await post(deps, '/api/action', { code, token: tokens[1], action: { type: 'pass', to: 3 } })
      expect(r.status).toBe(400)
    }
    const over = await post(deps, '/api/action', { code, token: tokens[1], action: { type: 'pass', to: 3 } })
    expect(over.status).toBe(429)
    expect(errCode(over.body)).toBe('RATE_LIMITED')
    // A new 10 s window resets the budget; other tokens were never limited.
    deps.advance(10_000)
    const fresh = await post(deps, '/api/action', { code, token: tokens[1], action: { type: 'pass', to: 3 } })
    expect(fresh.status).toBe(400)
    const otherToken = await post(deps, '/api/action', { code, token: tokens[2], action: { type: 'pass', to: 0 } })
    expect(otherToken.status).toBe(400)
  })
})

describe('CAS conflicts (PROTOCOL §2)', () => {
  it('retries after conflicts and succeeds', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    const calls = deps.saveCalls
    deps.failNextSaves = 2
    const r = await post(deps, '/api/heartbeat', { code, token: tokens[0] })
    expect(r.status).toBe(200)
    expect(deps.saveCalls - calls).toBe(3) // 2 conflicted attempts + 1 success
  })

  it('gives up with 409 CONFLICT after 4 attempts', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    const calls = deps.saveCalls
    deps.failNextSaves = 99
    const r = await post(deps, '/api/heartbeat', { code, token: tokens[0] })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('CONFLICT')
    expect(deps.saveCalls - calls).toBe(4)
    deps.failNextSaves = 0
  })
})

describe('transport guards', () => {
  it('unknown routes are 404 NOT_FOUND (with CORS headers)', async () => {
    const deps = new MemDeps()
    const g = await get(deps, '/api/nope')
    expect(g.status).toBe(404)
    expect(g.body.ok).toBe(false)
    expect(errCode(g.body)).toBe('NOT_FOUND')
    expect(g.headers.get('access-control-allow-origin')).toBe('*')
    const p = await post(deps, '/api/definitely-not-a-route', {})
    expect(p.status).toBe(404)
    expect(errCode(p.body)).toBe('NOT_FOUND')
    // Wrong method on a POST route is also unmatched.
    const wrongMethod = await get(deps, '/api/action')
    expect(wrongMethod.status).toBe(404)
  })

  it('OPTIONS answers 204 with permissive CORS headers', async () => {
    const deps = new MemDeps()
    const { route } = await import('../../server/handlers.ts')
    const res = await route(new Request('http://test/api/action', { method: 'OPTIONS' }), deps)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-headers')).toBe('authorization,apikey,content-type')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET,POST,OPTIONS')
  })

  it('malformed and oversized bodies are 400 BAD_REQUEST without throwing', async () => {
    const deps = new MemDeps()
    const notJson = await post(deps, '/api/join', null, { rawBody: 'this is not json {' })
    expect(notJson.status).toBe(400)
    expect(errCode(notJson.body)).toBe('BAD_REQUEST')

    const arrayBody = await post(deps, '/api/join', null, { rawBody: '[1,2,3]' })
    expect(arrayBody.status).toBe(400)

    const big = await post(deps, '/api/action', null, {
      rawBody: JSON.stringify({ code: 'ABCDEF', token: 'x'.repeat(64), pad: 'y'.repeat(33 * 1024) }),
    })
    expect(big.status).toBe(400)
    expect(errCode(big.body)).toBe('BAD_REQUEST')
    expect(big.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('validates field types and ranges before touching state', async () => {
    const deps = new MemDeps()
    expect((await post(deps, '/api/create-room', { fillBots: 7 })).status).toBe(400)
    expect((await post(deps, '/api/create-room', { fillBots: 1.5 })).status).toBe(400)
    expect((await post(deps, '/api/create-room', { botDifficulty: 'impossible' })).status).toBe(400)
    expect((await post(deps, '/api/join', {})).status).toBe(400) // code missing
    expect((await post(deps, '/api/join', { code: 42 })).status).toBe(400)
    expect((await post(deps, '/api/state', {})).status).toBe(404) // /state is GET only

    const { code, tokens } = await sixHumans(deps)
    expect((await post(deps, '/api/lobby-swap', { code, token: tokens[0], a: 1, b: 1 })).status).toBe(400)
    expect((await post(deps, '/api/lobby-swap', { code, token: tokens[0], a: -1, b: 2 })).status).toBe(400)
    expect((await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 9, vote: true })).status).toBe(400)
    expect((await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 1, vote: 'yes' })).status).toBe(400)
    expect((await post(deps, '/api/action', { code, token: tokens[0], action: { type: 'warp' } })).status).toBe(400)
    expect((await post(deps, '/api/action', { code, token: tokens[0], action: { type: 'ask', target: 6, card: '2H' } })).status).toBe(400)
    expect((await post(deps, '/api/action', { code, token: tokens[0], action: 'ask' })).status).toBe(400)
    expect((await post(deps, '/api/heartbeat', { code })).status).toBe(400) // token missing

    // A client-sent seat field is ignored: the seat comes from the token.
    // It is seat 0's turn; seat 1 spoofs `seat: 0` and is still judged as seat 1.
    await post(deps, '/api/start', { code, token: tokens[0] })
    const spoofed = await post(deps, '/api/action', {
      code,
      token: tokens[1],
      action: { type: 'ask', target: 3, card: '2H', seat: 0 },
    })
    expect(spoofed.status).toBe(400)
    expect(errCode(spoofed.body)).toBe('NOT_YOUR_TURN')
  })

  it('GET /state validates its query and GET /health reports rooms', async () => {
    const deps = new MemDeps()
    expect((await get(deps, '/api/state')).status).toBe(400)
    expect((await get(deps, '/api/state?code=NOPE12&token=abc')).status).toBe(404)
    const { code } = await sixHumans(deps)
    const badToken = await get(deps, `/api/state?code=${code}&token=${'0'.repeat(64)}`)
    expect(badToken.status).toBe(401)
    expect(errCode(badToken.body)).toBe('BAD_TOKEN')

    const health = await get(deps, '/api/health')
    expect(health.status).toBe(200)
    expect(health.body.ok).toBe(true)
    expect(health.body.rooms).toBe(1)
    expect(typeof health.body.ts).toBe('number')
  })
})
