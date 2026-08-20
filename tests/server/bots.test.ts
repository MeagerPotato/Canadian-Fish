import { describe, expect, it } from 'vitest'
import { bookCards, legalAsks, newGame, seatView, sortHand } from '../../lib/engine/index.ts'
import type { Card, GameState, Seat } from '../../lib/engine/index.ts'
import { decide } from '../../server/bots.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { broadcastCardViolations, get, post } from './util.ts'

describe('bots.decide (placeholder policy)', () => {
  it('is deterministic for a given view and seed', () => {
    const g = newGame('bot-determinism')
    const view = seatView(g, 0)
    const a = decide(view, 'medium', 12345)
    const b = decide(seatView(g, 0), 'medium', 12345)
    expect(a).toEqual(b)
    expect(a.type).toBe('ask') // fresh deal: no complete book in hand
  })

  it('claims a fully-held book correctly and takes first legal pass/designate', () => {
    const g = newGame('bot-claim')
    const hands: Card[][] = [
      sortHand([...bookCards('LOW-H'), '2C', '3C']),
      ...g.hands.slice(1).map((h) => h.slice(0, 6)),
    ]
    const s: GameState = { ...g, hands }
    const claim = decide(seatView(s, 0), 'hard', 1)
    expect(claim).toEqual({
      type: 'claim',
      seat: 0,
      book: 'LOW-H',
      assignments: Object.fromEntries(bookCards('LOW-H').map((c) => [c, 0])),
    })

    const passView = seatView({ ...g, phase: 'awaitPass', turn: 2, hands: g.hands.map((h, i) => (i === 2 ? [] : h)) }, 2)
    expect(decide(passView, 'easy', 7)).toEqual({ type: 'pass', seat: 2, to: 0 })

    const desView = seatView({ ...g, phase: 'awaitDesignate', turn: 1 }, 1)
    expect(decide(desView, 'easy', 7)).toEqual({ type: 'designate', seat: 1, to: 0 })
  })
})

/**
 * A hand layout where every possible ask misses forever: team A (bot seats 2,4)
 * holds ALL the LOW cards, team B (bot seats 1,3,5) ALL the HIGH cards, no seat
 * holds a complete book, and the human seat 0 is out of cards (so bots can
 * never hand the turn to a human). The bot chain must hit the 60-step cap.
 */
function endlessMissHands(): Card[][] {
  const h: Card[][] = [
    [],
    ['9C', 'TC', 'JC', 'QC', 'KC', '9D', 'TD', 'JD'],
    ['2C', '3C', '4C', '5C', '6C', '2D', '3D', '4D', '5D', '6D', '3H', '7S'],
    ['AC', 'QD', 'KD', 'AD', '9H', 'TH', 'JH', 'AS'],
    ['7C', '7D', '2H', '4H', '5H', '6H', '7H', '2S', '3S', '4S', '5S', '6S'],
    ['QH', 'KH', 'AH', '9S', 'TS', 'JS', 'QS', 'KS'],
  ] as Card[][]
  return h.map(sortHand)
}

async function botRoom(deps: MemDeps): Promise<{ code: string; token: string }> {
  const created = await post(deps, '/api/create-room', { name: 'Solo', fillBots: 5 })
  expect(created.status).toBe(200)
  const code = created.body.code as string
  const token = created.body.playerToken as string
  const started = await post(deps, '/api/start', { code, token })
  expect(started.status).toBe(200)
  return { code, token }
}

describe('bot chain', () => {
  it('runs after a human action until the turn returns to a human (single batched broadcast)', async () => {
    const deps = new MemDeps()
    const { code, token } = await botRoom(deps)
    const game = deps.rowByCode(code).state.game as GameState

    // Pick a deliberate MISS so the turn moves to a bot and the chain runs.
    const miss = legalAsks(game, 0).find((a) => !game.hands[a.target].includes(a.card))
    expect(miss).toBeDefined()
    const before = deps.broadcasts.length
    const r = await post(deps, '/api/action', {
      code,
      token,
      action: { type: 'ask', target: miss?.target, card: miss?.card },
    })
    expect(r.status).toBe(200)

    // Exactly ONE broadcast call for the whole mutation, batching every step.
    expect(deps.broadcasts.length).toBe(before + 1)
    const payloads = deps.broadcasts[deps.broadcasts.length - 1].payloads as PublicRoomState[]
    expect(payloads.length).toBeGreaterThanOrEqual(2) // human entry + at least one bot step
    for (let i = 1; i < payloads.length; i++) {
      expect(payloads[i].version).toBe(payloads[i - 1].version + 1)
    }
    const last = payloads[payloads.length - 1]
    const steps = payloads.length - 1
    const row = deps.rowByCode(code)
    const g = row.state.game as GameState
    // Chain stopped for a valid reason: human's turn, finished, or the cap.
    expect(
      (row.status === 'playing' && g.turn === 0) || row.status === 'finished' || steps === 60,
    ).toBe(true)
    expect(last.game?.moveIndex).toBe(g.moveIndex)
    // Bot moves were made by bot seats only (seat 0 made only the first move).
    const askers = g.log
      .filter((e) => e.type === 'ask')
      .map((e) => (e.type === 'ask' ? e.asker : -1))
    expect(askers[0]).toBe(0)
    expect(askers.slice(1).every((s) => s >= 1 && s <= 5)).toBe(true)
    // Bot-driven broadcasts stay leak-free (ask cards are public announcements).
    for (const p of payloads) expect(broadcastCardViolations(p, true)).toEqual([])
  })

  it('caps at 60 steps per request and heartbeats resume the chain', async () => {
    const deps = new MemDeps()
    const { code, token } = await botRoom(deps)
    const row = deps.rowByCode(code)
    const game = row.state.game as GameState
    row.state.game = { ...game, hands: endlessMissHands(), turn: 1 as Seat }
    const versionBefore = row.version

    const before = deps.broadcasts.length
    const hb1 = await post(deps, '/api/heartbeat', { code, token })
    expect(hb1.status).toBe(200)
    expect(hb1.body.version).toBe(versionBefore + 61) // 1 heartbeat write + 60 bot steps

    expect(deps.broadcasts.length).toBe(before + 1)
    const payloads = deps.broadcasts[deps.broadcasts.length - 1].payloads as PublicRoomState[]
    expect(payloads.length).toBe(60)
    for (let i = 1; i < payloads.length; i++) {
      expect(payloads[i].version).toBe(payloads[i - 1].version + 1)
    }

    let g = deps.rowByCode(code).state.game as GameState
    expect(g.moveIndex).toBe(60)
    expect(deps.rowByCode(code).status).toBe('playing')
    // Every bot move was an ask that missed; nobody ever asked the empty human.
    for (const e of g.log) {
      if (e.type === 'ask') {
        expect(e.hit).toBe(false)
        expect(e.target).not.toBe(0)
        expect(e.asker).not.toBe(0)
      }
    }

    // A second heartbeat resumes the capped chain for 60 more steps.
    const hb2 = await post(deps, '/api/heartbeat', { code, token })
    expect(hb2.status).toBe(200)
    g = deps.rowByCode(code).state.game as GameState
    expect(g.moveIndex).toBe(120)
    expect(hb2.body.version).toBe(versionBefore + 122)

    // Identical seeds per moveIndex: replaying from the same crafted position
    // yields the identical bot moves (chain determinism).
    const deps2 = new MemDeps()
    const room2 = await botRoom(deps2)
    const row2 = deps2.rowByCode(room2.code)
    row2.state.game = { ...(row2.state.game as GameState), hands: endlessMissHands(), turn: 1 as Seat }
    row2.state.roomSeed = deps.rowByCode(code).state.roomSeed // same seed => same stream
    await post(deps2, '/api/heartbeat', { code: room2.code, token: room2.token })
    const g2 = deps2.rowByCode(room2.code).state.game as GameState
    expect(g2.log.slice(1)).toEqual(g.log.slice(1, g2.log.length))
  })

  it('/state during a bot game never returns another seat\'s cards', async () => {
    const deps = new MemDeps()
    const { code, token } = await botRoom(deps)
    const game = deps.rowByCode(code).state.game as GameState
    const miss = legalAsks(game, 0).find((a) => !game.hands[a.target].includes(a.card))
    await post(deps, '/api/action', { code, token, action: { type: 'ask', target: miss?.target, card: miss?.card } })
    const g = deps.rowByCode(code).state.game as GameState
    const st = await get(deps, `/api/state?code=${code}&token=${token}`)
    expect(st.body.hand).toEqual(g.hands[0])
    const json = JSON.stringify(st.body)
    for (let seat = 1; seat < 6; seat++) {
      if (g.hands[seat].length < 2) continue
      expect(json.includes(JSON.stringify(g.hands[seat]))).toBe(false)
    }
  })
})
