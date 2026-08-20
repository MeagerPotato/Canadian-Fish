/**
 * Behavioral contracts per tier:
 *  - medium claims exactly when certain (not before, not after),
 *  - hard's EV claim fires in a crafted 5-certain + 1-uncertain-on-team spot,
 *  - easy's 6-event memory forgets facts a full-knowledge bot acts on.
 */
import { describe, expect, it } from 'vitest'
import {
  bookCards,
  checkInvariants,
  decide,
  mulberry32,
  reduce,
  seatView,
} from '../../lib/engine/index.ts'
import type { BookId, Card, GameState, PublicEvent, Seat } from '../../lib/engine/index.ts'
import { asg, distribute, forceState } from '../engine/util.ts'
import { ask, gs, mkView } from './util.ts'

/**
 * Crafted LOW-H position, seat 0 to act with 2H..5H in hand.
 * Log so far: seat 2 asked 7H at seat 5 and missed.
 *  - constraint: seat 2 holds >= 1 of {2H,3H,4H,6H} (5H excluded, and 2H..5H
 *    are provably mine) => elimination pins 6H on seat 2;
 *  - 7H is excluded from {0,2,5} but still open across {1,3,4} — an opponent
 *    could hold it, so the book is NOT certain.
 * Adding seat 4's miss-ask for 6H pins 7H on seat 4 the same way => certain.
 */
function lowHeartsState(certain: boolean): GameState {
  const log: PublicEvent[] = [gs, ask(2, 5, '7H', false)]
  if (certain) log.push(ask(4, 1, '6H', false))
  const hands = distribute(
    {
      0: ['2H', '3H', '4H', '5H', '2C', '3C', '4C', '5C'],
      2: ['6H', '6C', '7C', '2D'],
      4: ['7H', '3D', '4D', '5D'],
    },
    [1, 3, 5],
  )
  return forceState(hands, { log, turn: 0, moveIndex: log.length - 1 })
}

describe('medium claims exactly when certain', () => {
  it('does NOT claim while a card of the book could sit with an opponent', () => {
    const state = lowHeartsState(false)
    expect(checkInvariants(state)).toEqual([])
    const action = decide(seatView(state, 0), 'medium', 42)
    expect(action.type).toBe('ask')
  })

  it('claims the moment every holder is certain and on its team — and the claim scores', () => {
    const state = lowHeartsState(true)
    expect(checkInvariants(state)).toEqual([])
    const action = decide(seatView(state, 0), 'medium', 42)
    expect(action).toEqual({
      type: 'claim',
      seat: 0,
      book: 'LOW-H',
      assignments: asg([
        ['2H', 0],
        ['3H', 0],
        ['4H', 0],
        ['5H', 0],
        ['6H', 2],
        ['7H', 4],
      ]),
    })
    const r = reduce(state, action)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.books['LOW-H']?.outcome).toBe('team0')
  })
})

/**
 * Crafted HIGH-S position for hard's EV claim, seat 0 to act:
 *  - 9S,TS,JS,KS,AS all in seat 0's own hand (five certain-on-team);
 *  - QS excluded from seat 0 (hand), seats 1 and 5 (publicly out of cards)
 *    and seat 3 (holds exactly its two publicly-taken cards — count
 *    exhaustion) => candidates {2,4}: all teammates;
 *  - free slots: seat 2 has 17 unidentified cards, seat 4 has 3
 *    => p(QS@2) = 17/20 = 0.85 >= hard's 0.8 threshold.
 * Three books are already resolved so the position stays card-conserving.
 */
function evClaimState(): { state: GameState; truthQS: Seat } {
  const resolvedBooks: BookId[] = ['HIGH-C', 'HIGH-D', 'LOW-D']
  const books: GameState['books'] = {}
  for (const b of resolvedBooks) {
    const all1 = {} as Record<Card, Seat>
    for (const c of bookCards(b)) all1[c] = 1
    books[b] = { book: b, outcome: 'team1', claimer: 1, assignments: all1, actualHolders: all1 }
  }
  const log: PublicEvent[] = [
    gs,
    ask(3, 2, '2C', true),
    ask(3, 2, '3C', true),
    ask(3, 0, '4C', false), // legal: seat 3 holds 2C,3C; leaves the turn at seat 0
  ]
  const hands = distribute(
    {
      0: ['9S', 'TS', 'JS', 'KS', 'AS', '2S', '3S', '4S'],
      2: ['QS', '5S', '6S', '7S', '4C', '5C', '6C', '9H', 'TH', 'JH', 'QH', 'KH', 'AH', '2H', '3H', '4H', '5H'],
      3: ['2C', '3C'],
      4: ['7C', '6H', '7H'],
      1: [],
      5: [],
    },
    [],
  )
  const state = forceState(hands, {
    log,
    turn: 0,
    books,
    score: [0, 3],
    moveIndex: log.length - 1,
  })
  return { state, truthQS: 2 }
}

describe("hard's EV claim", () => {
  it('claims 5-certain + 1-uncertain-among-teammates at p=0.85, assigning by free slots — and it scores', () => {
    const { state } = evClaimState()
    expect(checkInvariants(state)).toEqual([])
    const action = decide(seatView(state, 0), 'hard', 7)
    expect(action.type).toBe('claim')
    if (action.type !== 'claim') return
    expect(action.book).toBe('HIGH-S')
    expect(action.assignments['QS']).toBe(2) // the candidate teammate with the most unknown cards
    for (const c of ['9S', 'TS', 'JS', 'KS', 'AS'] as Card[]) {
      expect(action.assignments[c]).toBe(0)
    }
    const r = reduce(state, action)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.books['HIGH-S']?.outcome).toBe('team0')
  })

  it('medium never claims that uncertain book — it asks instead', () => {
    const { state } = evClaimState()
    const action = decide(seatView(state, 0), 'medium', 7)
    expect(action.type).toBe('ask')
  })
})

describe('easy forgets: facts older than 6 events do not influence it', () => {
  // Seat 1 publicly took 9H seven events ago; a full-knowledge bot cashes the
  // certain hit. Easy's 6-event window only contains the later padding misses.
  function forgetView() {
    return mkView({
      seat: 0,
      hand: ['TH', '2C', '3C', '4C', '5C', '2D', '3D', '4D'],
      counts: [8, 9, 7, 8, 8, 8],
      log: [
        gs,
        ask(1, 2, '9H', true),
        ask(3, 2, '2S', false),
        ask(5, 2, '3S', false),
        ask(3, 4, '4S', false),
        ask(5, 4, '5S', false),
        ask(3, 2, '6S', false),
        ask(5, 0, '7S', false),
      ],
    })
  }

  it('medium (full log) plays the certain hit', () => {
    const action = decide(forgetView(), 'medium', 1)
    expect(action).toEqual({ type: 'ask', seat: 0, target: 1, card: '9H' })
  })

  it('easy (last 6 events) cannot see the hit and plays something else', () => {
    // Pick a seed whose first roll does NOT trigger easy's 25% error path, so
    // the choice below is its deliberate "best" ask under truncated memory.
    let seed = 0
    while (mulberry32(seed)() < 0.25) seed++
    const action = decide(forgetView(), 'easy', seed)
    expect(action.type).toBe('ask')
    if (action.type !== 'ask') return
    expect(action).not.toEqual({ type: 'ask', seat: 0, target: 1, card: '9H' })
    // Its deliberate pick chases its 4-card club book, not the forgotten hit.
    expect(action.card.endsWith('C')).toBe(true)
  })
})
