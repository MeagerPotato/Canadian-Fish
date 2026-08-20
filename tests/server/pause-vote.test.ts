import { describe, expect, it } from 'vitest'
import { legalAsks } from '../../lib/engine/index.ts'
import type { GameState, Seat } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { get, post, sixHumans } from './util.ts'

function errCode(body: Record<string, unknown>): string {
  return (body.error as { code: string }).code
}

async function askFor(deps: MemDeps, code: string, tokens: string[]): Promise<{ token: string; action: unknown }> {
  const game = deps.rowByCode(code).state.game as GameState
  const asks = legalAsks(game, game.turn)
  expect(asks.length).toBeGreaterThan(0)
  return {
    token: tokens[game.turn],
    action: { type: 'ask', target: asks[0].target, card: asks[0].card },
  }
}

describe('pause', () => {
  it('pauses when a human seat goes stale, rejects actions with PAUSED, unpauses on heartbeat', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })

    // 46 s of silence: every seat is stale, the game is paused.
    deps.advance(46_000)
    const { token, action } = await askFor(deps, code, tokens)
    let r = await post(deps, '/api/action', { code, token, action })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('PAUSED')

    // Everyone but seat 3 heartbeats: still paused, and the flip is broadcast.
    for (const seat of [0, 1, 2, 4, 5]) {
      await post(deps, '/api/heartbeat', { code, token: tokens[seat] })
    }
    const st = await get(deps, `/api/state?code=${code}&token=${tokens[0]}`)
    const room = st.body.room as PublicRoomState
    expect(room.paused).toBe(true)
    expect(room.seats[3].connected).toBe(false)
    expect(room.seats[0].connected).toBe(true)
    const pausedBroadcast = deps.payloadsFor(code).some((p) => (p as PublicRoomState).paused === true)
    expect(pausedBroadcast).toBe(true)

    r = await post(deps, '/api/action', { code, token, action })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('PAUSED')

    // The missing player's heartbeat unpauses; the flip is broadcast.
    const hb = await post(deps, '/api/heartbeat', { code, token: tokens[3] })
    expect(hb.status).toBe(200)
    const payloads = deps.payloadsFor(code) as PublicRoomState[]
    const last = payloads[payloads.length - 1]
    expect(last.paused).toBe(false)
    expect(last.seats.every((s) => s.connected)).toBe(true)

    r = await post(deps, '/api/action', { code, token, action })
    expect(r.status).toBe(200)
  })
})

describe('vote-bot', () => {
  async function staleSeat3Room(deps: MemDeps): Promise<{ code: string; tokens: string[] }> {
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })
    // Make it seat 3's turn so the substitution immediately runs the bot chain.
    const row = deps.rowByCode(code)
    row.state.game = { ...(row.state.game as GameState), turn: 3 as Seat }
    // Keep 0,1,2,4,5 fresh while 3 goes silent.
    deps.advance(40_000)
    for (const seat of [0, 1, 2, 4, 5]) await post(deps, '/api/heartbeat', { code, token: tokens[seat] })
    deps.advance(40_000)
    for (const seat of [0, 1, 2, 4, 5]) await post(deps, '/api/heartbeat', { code, token: tokens[seat] })
    return { code, tokens }
  }

  it('rejects votes before 90 s, in the lobby, and for connected or bot targets', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await staleSeat3Room(deps)

    // Seat 3 is 80 s stale: not yet votable.
    let r = await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 3, vote: true })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('VOTE_INVALID')

    // A connected target is never votable.
    r = await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 2, vote: true })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('VOTE_INVALID')

    // Lobby rooms cannot vote at all.
    const lobby = await post(deps, '/api/create-room', { name: 'L' }, { ip: '10.5.5.5' })
    r = await post(deps, '/api/vote-bot', {
      code: lobby.body.code as string,
      token: lobby.body.playerToken as string,
      targetSeat: 1,
      vote: true,
    })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('VOTE_INVALID')

    // vote:false with no vote in progress is meaningless.
    deps.advance(15_000) // seat 3 now 95 s stale
    r = await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 3, vote: false })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('VOTE_INVALID')
  })

  it('majority of connected humans substitutes a bot, runs the chain, and rejoin reclaims', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await staleSeat3Room(deps)
    deps.advance(15_000) // seat 3: 95 s stale; others: 15 s fresh
    const tokenHash3 = deps.rowByCode(code).state.seats[3]?.tokenHash
    expect(tokenHash3).toBeTruthy()

    // 5 eligible voters (connected humans other than the target) => needed 3.
    let r = await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 3, vote: true })
    expect(r.status).toBe(200)
    let payloads = deps.payloadsFor(code) as PublicRoomState[]
    expect(payloads[payloads.length - 1].pendingVote).toEqual({ targetSeat: 3, yes: 1, needed: 3 })

    r = await post(deps, '/api/vote-bot', { code, token: tokens[1], targetSeat: 3, vote: true })
    expect(r.status).toBe(200)
    r = await post(deps, '/api/vote-bot', { code, token: tokens[1], targetSeat: 3, vote: true })
    expect(r.status).toBe(200) // re-voting is idempotent
    r = await post(deps, '/api/vote-bot', { code, token: tokens[2], targetSeat: 3, vote: false })
    expect(r.status).toBe(200) // a no-vote does not count toward yes
    payloads = deps.payloadsFor(code) as PublicRoomState[]
    expect(payloads[payloads.length - 1].pendingVote).toEqual({ targetSeat: 3, yes: 2, needed: 3 })
    expect(deps.rowByCode(code).state.seats[3]?.isBot).toBe(false)

    // Third yes reaches the majority: substitution flips isBot and keeps the hash.
    r = await post(deps, '/api/vote-bot', { code, token: tokens[4], targetSeat: 3, vote: true })
    expect(r.status).toBe(200)
    const row = deps.rowByCode(code)
    const meta = row.state.seats[3]
    expect(meta?.isBot).toBe(true)
    expect(meta?.botDifficulty).toBe('medium')
    expect(meta?.tokenHash).toBe(tokenHash3)
    expect(row.state.pendingVote).toBeNull()

    // It was seat 3's turn, the room unpaused => the bot chain ran.
    const game = row.state.game as GameState
    expect(game.moveIndex).toBeGreaterThanOrEqual(1)
    payloads = deps.payloadsFor(code) as PublicRoomState[]
    const last = payloads[payloads.length - 1]
    expect(last.seats[3].isBot).toBe(true)
    expect(last.seats[3].connected).toBe(true)
    expect(last.pendingVote).toBeNull()
    expect(last.paused).toBe(false)

    // Voting about the (now bot) seat is invalid again.
    r = await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 3, vote: true })
    expect(r.status).toBe(409)
    expect(errCode(r.body)).toBe('VOTE_INVALID')

    // The human rejoins with their original token and reclaims the seat.
    const re = await post(deps, '/api/join', { code, token: tokens[3] })
    expect(re.status).toBe(200)
    expect(re.body).toMatchObject({ ok: true, seat: 3, rejoined: true, playerToken: tokens[3] })
    const after = deps.rowByCode(code)
    expect(after.state.seats[3]?.isBot).toBe(false)
    expect(after.state.seats[3]?.botDifficulty).toBeNull()
    expect(after.state.seats[3]?.tokenHash).toBe(tokenHash3)
    const hand = (deps.rowByCode(code).state.game as GameState).hands[3]
    const st = await get(deps, `/api/state?code=${code}&token=${tokens[3]}`)
    expect(st.body.hand).toEqual(hand)
  })

  it('a pending vote dies when the target heartbeats back in', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await staleSeat3Room(deps)
    deps.advance(15_000)
    await post(deps, '/api/vote-bot', { code, token: tokens[0], targetSeat: 3, vote: true })
    expect(deps.rowByCode(code).state.pendingVote).not.toBeNull()
    const hb = await post(deps, '/api/heartbeat', { code, token: tokens[3] })
    expect(hb.status).toBe(200)
    expect(deps.rowByCode(code).state.pendingVote).toBeNull()
    const payloads = deps.payloadsFor(code) as PublicRoomState[]
    expect(payloads[payloads.length - 1].pendingVote).toBeNull()
    expect(payloads[payloads.length - 1].seats[3].connected).toBe(true)
  })
})
