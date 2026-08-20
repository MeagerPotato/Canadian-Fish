import { describe, expect, it } from 'vitest'
import type { PublicRoomState } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { get, post, sixHumans } from './util.ts'

describe('lobby flow', () => {
  it('create -> 5 joins -> duplicate join when full -> start guards -> start', async () => {
    const deps = new MemDeps()
    const created = await post(deps, '/api/create-room', { name: 'Alice' })
    expect(created.status).toBe(200)
    expect(created.body.ok).toBe(true)
    expect(created.body.seat).toBe(0)
    const code = created.body.code as string
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    const host = created.body.playerToken as string
    expect(host).toMatch(/^[0-9a-f]{64}$/)

    const tokens = [host]
    for (let i = 1; i <= 3; i++) {
      const j = await post(deps, '/api/join', { code, name: `P${i}` }, { ip: `10.0.0.${i}` })
      expect(j.status).toBe(200)
      expect(j.body.seat).toBe(i)
      expect(j.body.rejoined).toBe(false)
      tokens.push(j.body.playerToken as string)
    }

    // Start with only 4 seated: host -> NOT_FULL, non-host -> NOT_HOST.
    const early = await post(deps, '/api/start', { code, token: host })
    expect(early.status).toBe(409)
    expect((early.body.error as { code: string }).code).toBe('NOT_FULL')
    const notHost = await post(deps, '/api/start', { code, token: tokens[1] })
    expect(notHost.status).toBe(403)
    expect((notHost.body.error as { code: string }).code).toBe('NOT_HOST')

    for (let i = 4; i <= 5; i++) {
      const j = await post(deps, '/api/join', { code, name: `P${i}` }, { ip: `10.0.0.${i}` })
      expect(j.status).toBe(200)
      expect(j.body.seat).toBe(i)
      tokens.push(j.body.playerToken as string)
    }

    // 7th fresh join into the full lobby.
    const full = await post(deps, '/api/join', { code, name: 'Late' }, { ip: '10.0.0.99' })
    expect(full.status).toBe(409)
    expect((full.body.error as { code: string }).code).toBe('ROOM_FULL')

    // Lowercase code still joins (rejoin path exercises normalization too).
    const lower = await post(deps, '/api/join', { code: code.toLowerCase(), token: tokens[2] })
    expect(lower.status).toBe(200)
    expect(lower.body.rejoined).toBe(true)
    expect(lower.body.seat).toBe(2)

    const started = await post(deps, '/api/start', { code, token: host })
    expect(started.status).toBe(200)
    const row = deps.rowByCode(code)
    expect(row.status).toBe('playing')
    expect(row.state.game).not.toBeNull()
    expect(row.state.game?.hands.map((h) => h.length)).toEqual([8, 8, 8, 8, 8, 8])

    // Starting again is ALREADY_STARTED; so is a fresh join now.
    const again = await post(deps, '/api/start', { code, token: host })
    expect(again.status).toBe(409)
    expect((again.body.error as { code: string }).code).toBe('ALREADY_STARTED')
    const lateJoin = await post(deps, '/api/join', { code, name: 'Nope' }, { ip: '10.9.9.9' })
    expect(lateJoin.status).toBe(409)
    expect((lateJoin.body.error as { code: string }).code).toBe('ALREADY_STARTED')

    // Broadcast versions on this room are strictly ascending from 0.
    const versions = deps.payloadsFor(code).map((p) => (p as PublicRoomState).version)
    expect(versions.length).toBeGreaterThanOrEqual(8)
    for (let i = 1; i < versions.length; i++) expect(versions[i]).toBeGreaterThan(versions[i - 1])
    expect(versions[0]).toBe(0)
  })

  it('rejoin restores the same seat and hand while playing', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })
    const hands = deps.rowByCode(code).state.game?.hands
    expect(hands).toBeDefined()

    const re = await post(deps, '/api/join', { code, token: tokens[2], name: 'ignored' })
    expect(re.status).toBe(200)
    expect(re.body.rejoined).toBe(true)
    expect(re.body.seat).toBe(2)
    expect(re.body.playerToken).toBe(tokens[2])

    const st = await get(deps, `/api/state?code=${code}&token=${tokens[2]}`)
    expect(st.status).toBe(200)
    const you = st.body.you as { seat: number; name: string }
    expect(you.seat).toBe(2)
    expect(you.name).toBe('P2') // rejoin keeps the stored name
    expect(st.body.hand).toEqual(hands?.[2])
    const room = st.body.room as PublicRoomState
    expect(room.status).toBe('playing')
    expect(room.game?.counts).toEqual([8, 8, 8, 8, 8, 8])
  })

  it('lobby-swap swaps any two seat entries and the host follows their seat', async () => {
    const deps = new MemDeps()
    const created = await post(deps, '/api/create-room', { name: 'Host' })
    const code = created.body.code as string
    const host = created.body.playerToken as string
    const joined = await post(deps, '/api/join', { code, name: 'Bob' }, { ip: '10.0.0.2' })
    const bob = joined.body.playerToken as string

    // Bob (seat 1) swaps himself with the empty seat 4.
    const swap1 = await post(deps, '/api/lobby-swap', { code, token: bob, a: 1, b: 4 })
    expect(swap1.status).toBe(200)
    let st = await get(deps, `/api/state?code=${code}&token=${bob}`)
    expect((st.body.you as { seat: number }).seat).toBe(4)

    // Host swaps seat 0 with (empty) seat 3 — hostSeat follows.
    const swap2 = await post(deps, '/api/lobby-swap', { code, token: host, a: 0, b: 3 })
    expect(swap2.status).toBe(200)
    st = await get(deps, `/api/state?code=${code}&token=${host}`)
    expect((st.body.you as { seat: number }).seat).toBe(3)
    const room = st.body.room as PublicRoomState
    expect(room.hostSeat).toBe(3)
    expect(room.seats.filter((s) => s.filled).map((s) => s.seat)).toEqual([3, 4])

    // Outsider tokens cannot swap; swaps are rejected once the game starts.
    const outsider = await post(deps, '/api/lobby-swap', { code, token: 'f'.repeat(64), a: 0, b: 1 })
    expect(outsider.status).toBe(401)
    expect((outsider.body.error as { code: string }).code).toBe('BAD_TOKEN')

    for (let i = 0; i < 4; i++) {
      await post(deps, '/api/join', { code, name: `F${i}` }, { ip: `10.1.0.${i}` })
    }
    const started = await post(deps, '/api/start', { code, token: host })
    expect(started.status).toBe(200) // host can start from seat 3
    const late = await post(deps, '/api/lobby-swap', { code, token: host, a: 0, b: 1 })
    expect(late.status).toBe(409)
    expect((late.body.error as { code: string }).code).toBe('ALREADY_STARTED')
  })

  it('bot fill: create with fillBots seats bots 1..n with the chosen difficulty', async () => {
    const deps = new MemDeps()
    const created = await post(deps, '/api/create-room', { name: 'Solo', fillBots: 5, botDifficulty: 'easy' })
    expect(created.status).toBe(200)
    const code = created.body.code as string
    const row = deps.rowByCode(code)
    for (let i = 1; i <= 5; i++) {
      const m = row.state.seats[i]
      expect(m?.isBot).toBe(true)
      expect(m?.botDifficulty).toBe('easy')
      expect(m?.tokenHash).toBeNull()
      expect(m?.name).toBe(`Bot ${i}`)
    }
    const st = await get(deps, `/api/state?code=${code}&token=${created.body.playerToken as string}`)
    const room = st.body.room as PublicRoomState
    expect(room.seats.every((s) => s.filled)).toBe(true)
    expect(room.seats.filter((s) => s.isBot).map((s) => s.seat)).toEqual([1, 2, 3, 4, 5])
    expect(room.seats.every((s) => s.connected)).toBe(true) // bots always connected
  })
})

describe('name sanitization', () => {
  async function createdName(deps: MemDeps, name: unknown): Promise<{ status: number; stored?: string; errCode?: string }> {
    const res = await post(deps, '/api/create-room', { name }, { ip: '10.7.7.7' })
    if (res.status !== 200) return { status: res.status, errCode: (res.body.error as { code: string }).code }
    const code = res.body.code as string
    const st = await get(deps, `/api/state?code=${code}&token=${res.body.playerToken as string}`)
    return { status: res.status, stored: (st.body.you as { name: string }).name }
  }

  it('strips control chars, collapses whitespace, trims, truncates, defaults', async () => {
    const deps = new MemDeps()
    expect(await createdName(deps, '  Alice  ')).toEqual({ status: 200, stored: 'Alice' })
    expect(await createdName(deps, 'A \t\n  B')).toEqual({ status: 200, stored: 'A B' })
    expect(await createdName(deps, 'x' + String.fromCharCode(0x85) + 'y' + String.fromCharCode(0x9f) + 'z')).toEqual({ status: 200, stored: 'xyz' }) // C1 (NEL, APC) stripped
    expect(await createdName(deps, 'Al' + String.fromCharCode(7) + 'i' + String.fromCharCode(27) + 'ce')).toEqual({ status: 200, stored: 'Alice' }) // C0 (BEL, ESC) stripped
    expect(await createdName(deps, 'A'.repeat(30))).toEqual({ status: 200, stored: 'A'.repeat(20) })
    expect(await createdName(deps, undefined)).toEqual({ status: 200, stored: 'Player' })
    expect(await createdName(deps, '   ')).toEqual({ status: 200, stored: 'Player' })
    expect(await createdName(deps, '')).toEqual({ status: 200, stored: 'Player' })
  })

  it('rejects angle brackets and non-string names with 400', async () => {
    const deps = new MemDeps()
    expect(await createdName(deps, '<script>')).toEqual({ status: 400, errCode: 'BAD_REQUEST' })
    expect(await createdName(deps, 'a>b')).toEqual({ status: 400, errCode: 'BAD_REQUEST' })
    expect(await createdName(deps, 42)).toEqual({ status: 400, errCode: 'BAD_REQUEST' })
    // Same rules on /join.
    const created = await post(deps, '/api/create-room', { name: 'Host' })
    const code = created.body.code as string
    const bad = await post(deps, '/api/join', { code, name: '<img>' })
    expect(bad.status).toBe(400)
    const okJoin = await post(deps, '/api/join', { code, name: '  J oe ' })
    expect(okJoin.status).toBe(200)
    const st = await get(deps, `/api/state?code=${code}&token=${okJoin.body.playerToken as string}`)
    expect((st.body.you as { name: string }).name).toBe('Joe')
  })
})
