import { describe, expect, it } from 'vitest'
import { bookCards, checkInvariants, reduce } from '../../lib/engine/index.ts'
import type { Card, GameAction, GameState, Seat } from '../../lib/engine/index.ts'
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

/** RULES.md §7.1-7.3 base: Team A holds LOW-H at 0:{2H,3H}, 2:{4H,5H}, 4:{6H,7H}. */
function vectorState(): GameState {
  return forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }), { turn: 0 })
}
const vectorAssignments = () =>
  asg([
    ['2H', 0],
    ['3H', 0],
    ['4H', 2],
    ['5H', 2],
    ['6H', 4],
    ['7H', 4],
  ])

describe('claim resolution (RULES.md §3, §7 vectors 1-3)', () => {
  it('§7.1 correct claim: all six located -> claiming team scores, turn continues', () => {
    const s = vectorState()
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() })
    expect(r.events[0]).toEqual({
      type: 'claim',
      claimer: 0,
      book: 'LOW-H',
      assignments: vectorAssignments(),
      actualHolders: vectorAssignments(),
      outcome: 'team0',
    })
    expect(r.state.score).toEqual([1, 0])
    expect(r.state.turn).toBe(0)
    expect(r.state.phase).toBe('playing')
    expect(r.state.books['LOW-H']?.outcome).toBe('team0')
    for (const c of bookCards('LOW-H')) expect(r.state.hands.some((h) => h.includes(c))).toBe(false)
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('§7.2 opponent holds one: opposing team scores regardless of other locations', () => {
    const s = forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H'], 1: ['7H'] }), { turn: 0 })
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() })
    if (r.state.books['LOW-H'] === undefined) throw new Error('book missing')
    expect(r.state.books['LOW-H'].outcome).toBe('team1')
    expect(r.state.books['LOW-H'].actualHolders['7H']).toBe(1)
    expect(r.state.score).toEqual([0, 1])
    expect(r.state.turn).toBe(0)
    expect(r.state.phase).toBe('playing')
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('§7.3 misattribution: own team holds all six, one location wrong -> void, turn continues', () => {
    const s = vectorState()
    const swapped = asg([
      ['2H', 0],
      ['3H', 0],
      ['4H', 4], // actually at 2
      ['5H', 2],
      ['6H', 2], // actually at 4
      ['7H', 4],
    ])
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: swapped })
    if (r.state.books['LOW-H'] === undefined) throw new Error('book missing')
    expect(r.state.books['LOW-H'].outcome).toBe('void')
    expect(r.state.score).toEqual([0, 0])
    expect(r.state.turn).toBe(0)
    expect(r.state.phase).toBe('playing')
    // Void books are resolved: cards removed from play, book cannot be claimed again.
    for (const c of bookCards('LOW-H')) expect(r.state.hands.some((h) => h.includes(c))).toBe(false)
    expect(fail(r.state, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() }).code).toBe(
      'BOOK_RESOLVED',
    )
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('claiming a book while holding none of its cards is legal (row 16)', () => {
    // Teammates 2 and 4 hold all of LOW-H; claimer 0 holds none of it.
    const s = forceState(distribute({ 2: ['2H', '3H', '4H'], 4: ['5H', '6H', '7H'] }), { turn: 0 })
    expect(s.hands[0].some((c) => bookCards('LOW-H').includes(c))).toBe(false)
    const good = asg([
      ['2H', 2],
      ['3H', 2],
      ['4H', 2],
      ['5H', 4],
      ['6H', 4],
      ['7H', 4],
    ])
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: good })
    expect(r.state.books['LOW-H']?.outcome).toBe('team0')
    expect(r.state.score).toEqual([1, 0])
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('actualHolders always records the true pre-removal holders', () => {
    const s = forceState(distribute({ 0: ['2H'], 1: ['3H', '4H'], 3: ['5H'], 5: ['6H', '7H'] }), { turn: 0 })
    const wild = asg([
      ['2H', 0],
      ['3H', 2],
      ['4H', 2],
      ['5H', 4],
      ['6H', 4],
      ['7H', 0],
    ])
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: wild })
    if (r.state.books['LOW-H'] === undefined) throw new Error('book missing')
    expect(r.state.books['LOW-H'].actualHolders).toEqual(
      asg([
        ['2H', 0],
        ['3H', 1],
        ['4H', 1],
        ['5H', 3],
        ['6H', 5],
        ['7H', 5],
      ]),
    )
    expect(r.state.books['LOW-H'].outcome).toBe('team1')
    expect(checkInvariants(r.state)).toEqual([])
  })
})

describe('claim legality error codes', () => {
  it('BOOK_RESOLVED (checked first, even in a non-claim phase)', () => {
    const s = vectorState()
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() })
    expect(fail(r.state, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() }).code).toBe(
      'BOOK_RESOLVED',
    )
    const paused = { ...r.state, phase: 'awaitPass' as const }
    expect(fail(paused, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() }).code).toBe(
      'BOOK_RESOLVED',
    )
  })

  it('WRONG_PHASE: claims only in playing and endgame', () => {
    for (const phase of ['awaitPass', 'awaitDesignate', 'finished'] as const) {
      const s = forceState(distribute({}), { phase })
      expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() }).code).toBe(
        'WRONG_PHASE',
      )
    }
  })

  it('NOT_YOUR_TURN: only the turn seat may claim', () => {
    const s = vectorState()
    expect(fail(s, { type: 'claim', seat: 2, book: 'LOW-H', assignments: vectorAssignments() }).code).toBe(
      'NOT_YOUR_TURN',
    )
  })

  it('BAD_ASSIGNMENTS: must cover exactly the 6 cards of the claimed book', () => {
    const s = vectorState()
    const five = vectorAssignments()
    delete (five as Partial<Record<Card, Seat>>)['7H']
    expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: five }).code).toBe('BAD_ASSIGNMENTS')
    const wrongCard = { ...vectorAssignments() } as Partial<Record<Card, Seat>>
    delete wrongCard['7H']
    wrongCard['9H'] = 0 // right count, wrong card
    expect(
      fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: wrongCard as Record<Card, Seat> }).code,
    ).toBe('BAD_ASSIGNMENTS')
    const extra = { ...vectorAssignments(), '9H': 0 } as Record<Card, Seat>
    expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: extra }).code).toBe('BAD_ASSIGNMENTS')
    expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: asg([]) }).code).toBe('BAD_ASSIGNMENTS')
  })

  it('ASSIGN_OPPONENT: every assigned seat must be on the claimant team', () => {
    const s = vectorState()
    const toOpponent = { ...vectorAssignments(), '7H': 1 as Seat }
    expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: toOpponent }).code).toBe('ASSIGN_OPPONENT')
    const toNowhere = { ...vectorAssignments(), '7H': 8 as unknown as Seat }
    expect(fail(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: toNowhere }).code).toBe('ASSIGN_OPPONENT')
  })

  it('INVALID_ACTION: claiming a non-book never throws', () => {
    const s = vectorState()
    const bogus = { type: 'claim', seat: 0, book: 'MID-H', assignments: vectorAssignments() }
    expect(fail(s, bogus as unknown as GameAction).code).toBe('INVALID_ACTION')
  })
})

describe('post-claim cascade in plain play', () => {
  it('claim that empties a non-claimer seat emits player_out; play continues', () => {
    // Seat 2's only cards are part of the claimed book.
    const s = forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }, [0, 1, 3, 4, 5]), {
      turn: 0,
    })
    expect(s.hands[2]).toEqual(['4H', '5H'])
    const r = pass(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: vectorAssignments() })
    expect(r.events).toContainEqual({ type: 'player_out', seat: 2 })
    expect(r.state.phase).toBe('playing')
    expect(r.state.turn).toBe(0)
    expect(checkInvariants(r.state)).toEqual([])
  })
})
