import { describe, expect, it } from 'vitest'
import { bookCards, checkInvariants, sortHand } from '../../lib/engine/index.ts'
import type { Card, GameState, PublicEvent } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { allTo, broadcastCardViolations, collectCardHits, get, post, sixHumans } from './util.ts'

/**
 * Crafted deal: seat0 LOW-C, seat1 HIGH-D, seat2 HIGH-C, seat3 LOW-H,
 * seat4 LOW-D, seat5 HIGH-H + LOW-S + HIGH-S (18). All 48 accounted for.
 * Script: 0 claims out -> pass 2 -> 2 claims out -> pass 4 -> 4 claims out
 * (team A empty) -> designate 1 -> endgame: 1 claims the remaining 5 books.
 */
function craftedHands(): Card[][] {
  return [
    [...bookCards('LOW-C')],
    [...bookCards('HIGH-D')],
    [...bookCards('HIGH-C')],
    [...bookCards('LOW-H')],
    [...bookCards('LOW-D')],
    [...bookCards('HIGH-H'), ...bookCards('LOW-S'), ...bookCards('HIGH-S')],
  ].map(sortHand)
}

async function craftedRoom(deps: MemDeps): Promise<{ code: string; tokens: string[] }> {
  const { code, tokens } = await sixHumans(deps)
  const started = await post(deps, '/api/start', { code, token: tokens[0] })
  expect(started.status).toBe(200)
  const row = deps.rowByCode(code)
  const game = row.state.game as GameState
  row.state.game = { ...game, hands: craftedHands(), turn: 0 }
  return { code, tokens }
}

async function phaseOf(deps: MemDeps, code: string, token: string): Promise<string | undefined> {
  const st = await get(deps, `/api/state?code=${code}&token=${token}`)
  return (st.body.room as PublicRoomState).game?.phase
}

describe('scripted full game through room.ts', () => {
  it('plays to finished including a claim-out pass and an endgame designation', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await craftedRoom(deps)
    const act = (seat: number, action: unknown) =>
      post(deps, '/api/action', { code, token: tokens[seat], action })

    // Seat 0 claims LOW-C out of their own hand — claim-out => awaitPass.
    let r = await act(0, { type: 'claim', book: 'LOW-C', assignments: allTo('LOW-C', 0) })
    expect(r.status).toBe(200)
    expect(await phaseOf(deps, code, tokens[0])).toBe('awaitPass')

    // Passing to a cardless or opposing seat is rejected with engine codes.
    r = await act(0, { type: 'pass', to: 1 })
    expect(r.status).toBe(400)
    expect((r.body.error as { code: string }).code).toBe('PASS_TARGET_NOT_TEAMMATE')

    r = await act(0, { type: 'pass', to: 2 })
    expect(r.status).toBe(200)
    expect(await phaseOf(deps, code, tokens[0])).toBe('playing')

    r = await act(2, { type: 'claim', book: 'HIGH-C', assignments: allTo('HIGH-C', 2) })
    expect(r.status).toBe(200)
    expect(await phaseOf(deps, code, tokens[2])).toBe('awaitPass')
    r = await act(2, { type: 'pass', to: 4 })
    expect(r.status).toBe(200)

    // Seat 4's claim-out empties ALL of team A -> awaitDesignate.
    r = await act(4, { type: 'claim', book: 'LOW-D', assignments: allTo('LOW-D', 4) })
    expect(r.status).toBe(200)
    expect(await phaseOf(deps, code, tokens[4])).toBe('awaitDesignate')

    r = await act(4, { type: 'designate', to: 1 })
    expect(r.status).toBe(200)
    expect(await phaseOf(deps, code, tokens[4])).toBe('endgame')

    // Designated seat 1 alone claims out the endgame.
    for (const [book, holder] of [
      ['HIGH-D', 1],
      ['LOW-H', 3],
      ['HIGH-H', 5],
      ['LOW-S', 5],
    ] as const) {
      r = await act(1, { type: 'claim', book, assignments: allTo(book, holder) })
      expect(r.status).toBe(200)
    }
    r = await act(1, { type: 'claim', book: 'HIGH-S', assignments: allTo('HIGH-S', 5) })
    expect(r.status).toBe(200)

    const row = deps.rowByCode(code)
    expect(row.status).toBe('finished')
    const game = row.state.game as GameState
    expect(game.phase).toBe('finished')
    expect(game.score).toEqual([3, 5])
    expect(checkInvariants(game)).toEqual([])
    const over = game.log.find((e: PublicEvent) => e.type === 'game_over')
    expect(over).toEqual({ type: 'game_over', score: [3, 5], winner: 1 })
    expect(game.log.some((e) => e.type === 'pass')).toBe(true)
    expect(game.log.some((e) => e.type === 'designate')).toBe(true)

    // Acting on a finished game is rejected.
    r = await act(1, { type: 'claim', book: 'HIGH-S', assignments: allTo('HIGH-S', 5) })
    expect(r.status).toBe(400)
    expect((r.body.error as { code: string }).code).toBe('WRONG_PHASE')

    // Broadcast versions strictly ascend across the whole game.
    const versions = deps.payloadsFor(code).map((p) => (p as PublicRoomState).version)
    for (let i = 1; i < versions.length; i++) expect(versions[i]).toBeGreaterThan(versions[i - 1])
  })
})

describe('payload privacy at a mid-game position', () => {
  async function midGame(deps: MemDeps): Promise<{ code: string; tokens: string[]; hands: Card[][] }> {
    const { code, tokens } = await craftedRoom(deps)
    const act = (seat: number, action: unknown) =>
      post(deps, '/api/action', { code, token: tokens[seat], action })
    await act(0, { type: 'claim', book: 'LOW-C', assignments: allTo('LOW-C', 0) })
    await act(0, { type: 'pass', to: 2 })
    await act(2, { type: 'claim', book: 'HIGH-C', assignments: allTo('HIGH-C', 2) })
    await act(2, { type: 'pass', to: 4 })
    const game = deps.rowByCode(code).state.game as GameState
    return { code, tokens, hands: game.hands.map((h) => [...h]) }
  }

  it('/state for each token returns exactly that seat\'s hand and no other card arrays', async () => {
    const deps = new MemDeps()
    const { code, tokens, hands } = await midGame(deps)
    for (let seat = 0; seat < 6; seat++) {
      const st = await get(deps, `/api/state?code=${code}&token=${tokens[seat]}`)
      expect(st.status).toBe(200)
      expect(st.body.hand).toEqual(hands[seat])
      // Every card string in the response sits in `hand` or in the public
      // claim reveals (books/log) of the embedded room snapshot.
      const room = st.body.room as PublicRoomState
      const offenders = collectCardHits(st.body).filter((hit) => {
        if (hit.path[0] === 'hand') return false
        if (hit.path[0] === 'room' && hit.path[1] === 'game') {
          const segs = hit.path.slice(2)
          if (segs[0] === 'books' && (segs[2] === 'assignments' || segs[2] === 'actualHolders')) return false
          if (segs[0] === 'log') {
            const entry = room.game?.log[Number(segs[1])]
            if (entry?.type === 'claim' && (segs[2] === 'assignments' || segs[2] === 'actualHolders')) return false
          }
        }
        return true
      })
      expect(offenders).toEqual([])
      // No OTHER seat's full hand array is serialized anywhere in the response.
      const json = JSON.stringify(st.body)
      for (let other = 0; other < 6; other++) {
        if (other === seat || hands[other].length === 0) continue
        expect(json.includes(JSON.stringify(hands[other]))).toBe(false)
      }
    }
  })

  it('broadcast payloads contain card strings only in books assignments/actualHolders and log claim entries', async () => {
    const deps = new MemDeps()
    const { code } = await midGame(deps)
    const payloads = deps.payloadsFor(code) as PublicRoomState[]
    expect(payloads.length).toBeGreaterThanOrEqual(11) // create + 5 joins + start + 4 actions
    let sawCards = false
    for (const payload of payloads) {
      // This room's log has no ask entries, so the strict allowed set applies.
      expect(payload.game?.log.every((e) => e.type !== 'ask') ?? true).toBe(true)
      expect(broadcastCardViolations(payload, false)).toEqual([])
      if (collectCardHits(payload).length > 0) sawCards = true
    }
    expect(sawCards).toBe(true) // claim reveals ARE public — the walker saw them
  })

  it('no broadcast payload contains any seat\'s hand array', async () => {
    const deps = new MemDeps()
    const { code, hands } = await midGame(deps)
    for (const payload of deps.payloadsFor(code)) {
      const json = JSON.stringify(payload)
      for (let seat = 0; seat < 6; seat++) {
        if (hands[seat].length === 0) continue
        expect(json.includes(JSON.stringify(hands[seat]))).toBe(false)
      }
      // Structural guarantee: a broadcast payload has no `hand`/`hands` key at all.
      expect(json.includes('"hand"')).toBe(false)
      expect(json.includes('"hands"')).toBe(false)
    }
  })
})
