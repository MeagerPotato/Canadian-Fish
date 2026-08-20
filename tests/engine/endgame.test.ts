import { describe, expect, it } from 'vitest'
import { ALL_BOOKS, bookCards, checkInvariants, reduce, seatTeam } from '../../lib/engine/index.ts'
import type { BookId, Card, GameAction, GameState, Seat } from '../../lib/engine/index.ts'
import { asg, distribute, forceState } from './util.ts'

function fail(state: GameState, action: GameAction) {
  const r = reduce(state, action)
  expect(r.ok).toBe(false)
  if (r.ok) throw new Error('expected failure')
  return r.error
}

function pass(state: GameState, action: GameAction) {
  const r = reduce(state, action)
  if (!r.ok) throw new Error(`expected success, got ${r.error.code}: ${r.error.message}`)
  return r
}

/** Assignments naming the true holder of every card (holders must be on `seat`'s team). */
function trueAssignments(state: GameState, book: BookId): Record<Card, Seat> {
  return asg(
    bookCards(book).map((c) => {
      const holder = state.hands.findIndex((h) => h.includes(c)) as Seat
      return [c, holder]
    }),
  )
}

describe('§7.4 claim-out pass flow', () => {
  function claimOutState() {
    // Seat 0's last 2 cards are 2H,3H; seat 4's last 2 are 6H,7H; seat 2 keeps extras.
    const s = forceState(
      distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }, [1, 2, 3, 5]),
      { turn: 0 },
    )
    return pass(s, {
      type: 'claim',
      seat: 0,
      book: 'LOW-H',
      assignments: asg([
        ['2H', 0],
        ['3H', 0],
        ['4H', 2],
        ['5H', 2],
        ['6H', 4],
        ['7H', 4],
      ]),
    })
  }

  it('a correct claim using your last cards forces awaitPass; you keep the (pending) turn', () => {
    const r = claimOutState()
    expect(r.state.phase).toBe('awaitPass')
    expect(r.state.turn).toBe(0)
    expect(r.state.score).toEqual([1, 0])
    expect(r.events).toContainEqual({ type: 'player_out', seat: 0 })
    expect(r.events).toContainEqual({ type: 'player_out', seat: 4 })
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('only pass is legal while the pass is pending', () => {
    const { state } = claimOutState()
    expect(fail(state, { type: 'ask', seat: 0, target: 1, card: '2C' }).code).toBe('WRONG_PHASE')
    expect(fail(state, { type: 'claim', seat: 0, book: 'LOW-C', assignments: asg([]) }).code).toBe('WRONG_PHASE')
    expect(fail(state, { type: 'designate', seat: 0, to: 1 }).code).toBe('WRONG_PHASE')
  })

  it('PASS_TARGET_OUT: passing to a cardless teammate is illegal', () => {
    const { state } = claimOutState()
    expect(fail(state, { type: 'pass', seat: 0, to: 4 }).code).toBe('PASS_TARGET_OUT')
    expect(fail(state, { type: 'pass', seat: 0, to: 0 }).code).toBe('PASS_TARGET_OUT')
  })

  it('PASS_TARGET_NOT_TEAMMATE: the pass must go to your own team', () => {
    const { state } = claimOutState()
    expect(fail(state, { type: 'pass', seat: 0, to: 1 }).code).toBe('PASS_TARGET_NOT_TEAMMATE')
    expect(fail(state, { type: 'pass', seat: 0, to: 9 as unknown as Seat }).code).toBe('PASS_TARGET_NOT_TEAMMATE')
  })

  it('NOT_YOUR_TURN / WRONG_PHASE guards on pass', () => {
    const { state } = claimOutState()
    expect(fail(state, { type: 'pass', seat: 2, to: 0 }).code).toBe('NOT_YOUR_TURN')
    const playing = forceState(distribute({}), { turn: 0 })
    expect(fail(playing, { type: 'pass', seat: 0, to: 2 }).code).toBe('WRONG_PHASE')
  })

  it('passing to a teammate with cards resumes play with them', () => {
    const { state } = claimOutState()
    const r = pass(state, { type: 'pass', seat: 0, to: 2 })
    expect(r.events).toEqual([{ type: 'pass', from: 0, to: 2 }])
    expect(r.state.phase).toBe('playing')
    expect(r.state.turn).toBe(2)
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('if the claim also emptied the opponents, the endgame starts after the pass (turn = passee)', () => {
    // Seat 0 claims LOW-H held mostly by the opponents' last cards: team 1 scores it,
    // seat 0 and every opponent empty out, teammates 2,4 keep cards.
    const s = forceState(
      distribute({ 0: ['2H', '3H'], 1: ['4H', '5H'], 3: ['6H'], 5: ['7H'] }, [2, 4]),
      { turn: 0 },
    )
    const all0 = asg(bookCards('LOW-H').map((c) => [c, 0]))
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: all0 })
    expect(r.state.books['LOW-H']?.outcome).toBe('team1')
    expect(r.state.phase).toBe('awaitPass')
    expect(r.state.turn).toBe(0)
    expect(checkInvariants(r.state)).toEqual([])
    const r2 = pass(r.state, { type: 'pass', seat: 0, to: 4 })
    expect(r2.events).toEqual([
      { type: 'pass', from: 0, to: 4 },
      { type: 'endgame', claimingTeam: 0 },
    ])
    expect(r2.state.phase).toBe('endgame')
    expect(r2.state.turn).toBe(4)
    expect(checkInvariants(r2.state)).toEqual([])
  })
})

describe('§7.5 endgame designation', () => {
  function designateState() {
    // Team A's only cards are LOW-H; seat 5 has no cards; seats 1,3 hold the other 42.
    const s = forceState(
      distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }, [1, 3]),
      { turn: 0 },
    )
    return pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: trueAssignments(s, 'LOW-H') })
  }

  it('a claim that empties the whole claiming team forces awaitDesignate', () => {
    const r = designateState()
    expect(r.state.books['LOW-H']?.outcome).toBe('team0')
    expect(r.state.phase).toBe('awaitDesignate')
    expect(r.state.turn).toBe(0)
    expect(r.events).toContainEqual({ type: 'player_out', seat: 0 })
    expect(r.events).toContainEqual({ type: 'player_out', seat: 2 })
    expect(r.events).toContainEqual({ type: 'player_out', seat: 4 })
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('DESIGNATE_TARGET_INVALID: must name an opponent who still has cards', () => {
    const { state } = designateState()
    expect(fail(state, { type: 'designate', seat: 0, to: 2 }).code).toBe('DESIGNATE_TARGET_INVALID')
    expect(fail(state, { type: 'designate', seat: 0, to: 0 }).code).toBe('DESIGNATE_TARGET_INVALID')
    expect(fail(state, { type: 'designate', seat: 0, to: 5 }).code).toBe('DESIGNATE_TARGET_INVALID')
    expect(fail(state, { type: 'designate', seat: 0, to: 7 as unknown as Seat }).code).toBe(
      'DESIGNATE_TARGET_INVALID',
    )
  })

  it('NOT_YOUR_TURN / WRONG_PHASE guards on designate', () => {
    const { state } = designateState()
    expect(fail(state, { type: 'designate', seat: 1, to: 3 }).code).toBe('NOT_YOUR_TURN')
    const playing = forceState(distribute({}), { turn: 0 })
    expect(fail(playing, { type: 'designate', seat: 0, to: 1 }).code).toBe('WRONG_PHASE')
  })

  it('designating hands the endgame to that opponent, who then claims alone to the finish', () => {
    const { state } = designateState()
    const r = pass(state, { type: 'designate', seat: 0, to: 3 })
    expect(r.events).toEqual([
      { type: 'designate', from: 0, to: 3 },
      { type: 'endgame', claimingTeam: 1 },
    ])
    expect(r.state.phase).toBe('endgame')
    expect(r.state.turn).toBe(3)
    expect(checkInvariants(r.state)).toEqual([])

    // Only seat 3 may act, and only by claiming.
    expect(fail(r.state, { type: 'ask', seat: 3, target: 0, card: '2C' }).code).toBe('WRONG_PHASE')
    expect(fail(r.state, { type: 'pass', seat: 3, to: 1 }).code).toBe('WRONG_PHASE')
    const someBook = ALL_BOOKS.find((b) => !r.state.books[b])
    if (someBook === undefined) throw new Error('no unresolved book')
    expect(
      fail(r.state, { type: 'claim', seat: 1, book: someBook, assignments: trueAssignments(r.state, someBook) })
        .code,
    ).toBe('NOT_YOUR_TURN')

    // Misattribution among teammates still voids in the endgame.
    let cur = r.state
    const wrong = trueAssignments(cur, 'HIGH-H')
    const flip = (x: Seat): Seat => (x === 1 ? 3 : 1)
    wrong['9H'] = flip(wrong['9H'])
    const v = pass(cur, { type: 'claim', seat: 3, book: 'HIGH-H', assignments: wrong })
    expect(v.state.books['HIGH-H']?.outcome).toBe('void')
    expect(v.state.phase).toBe('endgame')
    expect(v.state.turn).toBe(3)
    expect(checkInvariants(v.state)).toEqual([])
    cur = v.state

    // Claim the remaining six books correctly; the eighth resolution finishes the game.
    const remaining = ALL_BOOKS.filter((b) => !cur.books[b])
    expect(remaining).toHaveLength(6)
    for (const b of remaining) {
      const res = pass(cur, { type: 'claim', seat: 3, book: b, assignments: trueAssignments(cur, b) })
      cur = res.state
      expect(checkInvariants(cur)).toEqual([])
    }
    expect(cur.phase).toBe('finished')
    expect(Object.keys(cur.books)).toHaveLength(8)
    expect(cur.score).toEqual([1, 6]) // LOW-H to team 0, HIGH-H void, six books to team 1
    expect(cur.hands.every((h) => h.length === 0)).toBe(true)
    expect(cur.log.at(-1)).toEqual({ type: 'game_over', score: [1, 6], winner: 1 })
    // Nothing is legal after the game is over.
    expect(fail(cur, { type: 'claim', seat: 3, book: 'LOW-H', assignments: asg([]) }).code).toBe('BOOK_RESOLVED')
    expect(fail(cur, { type: 'ask', seat: 3, target: 0, card: '2C' }).code).toBe('WRONG_PHASE')
  })
})

describe('§7.6 tie and full endgame walkthrough', () => {
  it('4-4 (with voids possible) ends the game as a tie', () => {
    // Seat 0 holds every LOW book; seat 1 holds every HIGH book; everyone else is out.
    const lows = (['LOW-C', 'LOW-D', 'LOW-H', 'LOW-S'] as BookId[]).flatMap((b) => [...bookCards(b)])
    const highs = (['HIGH-C', 'HIGH-D', 'HIGH-H', 'HIGH-S'] as BookId[]).flatMap((b) => [...bookCards(b)])
    let cur = forceState(distribute({ 0: lows, 1: highs }, []), { turn: 0 })
    expect(checkInvariants(cur)).toEqual([])

    for (const b of ['LOW-C', 'LOW-D', 'LOW-H'] as BookId[]) {
      const r = pass(cur, { type: 'claim', seat: 0, book: b, assignments: trueAssignments(cur, b) })
      cur = r.state
      expect(cur.phase).toBe('playing')
      expect(cur.turn).toBe(0)
      expect(checkInvariants(cur)).toEqual([])
    }
    // Fourth LOW claim empties seat 0 — and with it all of team 0 -> awaitDesignate.
    const r4 = pass(cur, { type: 'claim', seat: 0, book: 'LOW-S', assignments: trueAssignments(cur, 'LOW-S') })
    cur = r4.state
    expect(cur.phase).toBe('awaitDesignate')
    expect(r4.events).toContainEqual({ type: 'player_out', seat: 0 })
    expect(checkInvariants(cur)).toEqual([])

    cur = pass(cur, { type: 'designate', seat: 0, to: 1 }).state
    expect(cur.phase).toBe('endgame')
    expect(cur.turn).toBe(1)

    for (const b of ['HIGH-C', 'HIGH-D', 'HIGH-H'] as BookId[]) {
      cur = pass(cur, { type: 'claim', seat: 1, book: b, assignments: trueAssignments(cur, b) }).state
      expect(cur.phase).toBe('endgame')
      expect(cur.turn).toBe(1)
      expect(checkInvariants(cur)).toEqual([])
    }
    const last = pass(cur, { type: 'claim', seat: 1, book: 'HIGH-S', assignments: trueAssignments(cur, 'HIGH-S') })
    cur = last.state
    expect(last.events).toContainEqual({ type: 'player_out', seat: 1 })
    expect(last.events).toContainEqual({ type: 'game_over', score: [4, 4], winner: 'tie' })
    expect(cur.phase).toBe('finished')
    expect(cur.score).toEqual([4, 4])
    expect(cur.hands.every((h) => h.length === 0)).toBe(true)
    expect(Object.values(cur.books).every((b) => b !== undefined)).toBe(true)
    expect(checkInvariants(cur)).toEqual([])
  })

  it('claim that empties the opposing team while the claimer keeps cards starts the endgame at once', () => {
    // Opponents' only cards are LOW-H cards; claimer keeps other cards.
    const s = forceState(distribute({ 0: ['2H'], 1: ['3H', '4H'], 3: ['5H'], 5: ['6H', '7H'] }, [0, 2, 4]), {
      turn: 0,
    })
    const all0 = asg(bookCards('LOW-H').map((c) => [c, 0]))
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: all0 })
    expect(r.state.books['LOW-H']?.outcome).toBe('team1') // opponents held cards of it
    expect(r.state.phase).toBe('endgame')
    expect(r.state.turn).toBe(0)
    expect(r.events).toContainEqual({ type: 'endgame', claimingTeam: 0 })
    for (const seat of [1, 3, 5] as const) expect(r.events).toContainEqual({ type: 'player_out', seat })
    expect(seatTeam(r.state.turn)).toBe(0)
    expect(checkInvariants(r.state)).toEqual([])
  })
})
