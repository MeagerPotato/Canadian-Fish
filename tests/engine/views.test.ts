import { describe, expect, it } from 'vitest'
import {
  ALL_BOOKS,
  bookCards,
  cardBook,
  checkInvariants,
  defaultConfig,
  legalActionsSummary,
  legalAsks,
  newGame,
  publicView,
  reduce,
  seatView,
} from '../../lib/engine/index.ts'
import type { RulesConfig, Seat } from '../../lib/engine/index.ts'
import { asg, distribute, forceState } from './util.ts'

const CARD_RE = /[2-79TJQKA][CDHS]/

describe('views', () => {
  it('publicView of a fresh game leaks no card string anywhere', () => {
    const g = newGame('views-fresh')
    const json = JSON.stringify(publicView(g))
    expect(CARD_RE.test(json)).toBe(false)
  })

  it('publicView exposes counts, score, turn, phase, log, moveIndex, config', () => {
    const g = newGame('views-shape')
    const v = publicView(g)
    expect(v.counts).toEqual([8, 8, 8, 8, 8, 8])
    expect(v.phase).toBe('playing')
    expect(v.turn).toBe(0)
    expect(v.score).toEqual([0, 0])
    expect(v.books).toEqual({})
    expect(v.moveIndex).toBe(0)
    expect(v.config).toEqual(defaultConfig)
    expect(v.log).toEqual([{ type: 'game_started', startingSeat: 0 }])
  })

  it('seatView contains exactly that seat\'s hand plus the public state', () => {
    const g = newGame('views-seat')
    for (const seat of [0, 1, 2, 3, 4, 5] as Seat[]) {
      const v = seatView(g, seat)
      expect(v.seat).toBe(seat)
      expect(v.hand).toEqual(g.hands[seat])
      expect(v.hand).not.toBe(g.hands[seat]) // a copy, not the live array
      for (const other of [0, 1, 2, 3, 4, 5] as Seat[]) {
        if (other === seat) continue
        const json = JSON.stringify(v)
        for (const c of g.hands[other]) {
          if (g.hands[seat].includes(c)) continue
          expect(json.includes(`"${c}"`)).toBe(false)
        }
      }
    }
  })

  it('resolved books (public reveals) appear in publicView; unresolved hands never do', () => {
    const s = forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }), { turn: 0 })
    const r = reduce(s, {
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
    if (!r.ok) throw new Error(r.error.code)
    const json = JSON.stringify(publicView(r.state))
    expect(json).toContain('"2H"') // revealed by the claim — public information
    for (const h of r.state.hands) for (const c of h) expect(json.includes(`"${c}"`)).toBe(false)
  })
})

describe('legalAsks', () => {
  it('returns [] off-turn, in wrong phases, and for cardless seats', () => {
    const g = newGame('la-1')
    expect(legalAsks(g, 1)).toEqual([])
    expect(legalAsks({ ...g, phase: 'endgame' }, 0)).toEqual([])
    expect(legalAsks({ ...g, phase: 'awaitPass' }, 0)).toEqual([])
    const empty = forceState(distribute({}, [1, 2, 3, 4, 5]), { turn: 0 })
    expect(legalAsks(empty, 0)).toEqual([])
  })

  it('enumerates exactly: opponents with cards x unheld cards of held books', () => {
    const s = forceState(distribute({ 0: ['2H', '9C'] }, [1, 2, 3, 5]), { turn: 0 })
    const asks = legalAsks(s, 0)
    // Seat 4 is on our team, never a target; all of 1,3,5 hold cards.
    expect(asks.every((a) => [1, 3, 5].includes(a.target))).toBe(true)
    // Cards: LOW-H and HIGH-C minus the two held = 10 cards, times 3 targets.
    expect(asks).toHaveLength(30)
    const cards = new Set(asks.map((a) => a.card))
    expect(cards.has('2H')).toBe(false)
    expect(cards.has('9C')).toBe(false)
    expect(cards.has('3H')).toBe(true)
    expect(cards.has('TC')).toBe(true)
    expect(cards.has('2C')).toBe(false) // LOW-C not held
    expect([...cards].every((c) => ['LOW-H', 'HIGH-C'].includes(cardBook(c)))).toBe(true)
    // Every enumerated ask is accepted by the reducer.
    for (const a of asks) {
      expect(reduce(s, { type: 'ask', seat: 0, target: a.target, card: a.card }).ok).toBe(true)
    }
  })

  it('excludes emptied opponents as targets', () => {
    const s = forceState(distribute({ 0: ['2H'] }, [0, 1, 3]), { turn: 0 })
    expect(s.hands[5]).toHaveLength(0)
    const asks = legalAsks(s, 0)
    expect(asks.length).toBeGreaterThan(0)
    expect(asks.some((a) => a.target === 5)).toBe(false)
  })

  it('a hand that is a union of complete books yields zero legal asks yet the seat still has cards', () => {
    const s = forceState(distribute({ 0: [...bookCards('LOW-H'), ...bookCards('HIGH-C')] }, [1, 2, 3, 4, 5]), {
      turn: 0,
    })
    expect(s.hands[0]).toHaveLength(12)
    expect(legalAsks(s, 0)).toEqual([])
    const summary = legalActionsSummary(s)
    expect(summary).toEqual({ seat: 0, kinds: ['claim'] })
  })
})

describe('legalActionsSummary', () => {
  it('reports ask+claim in playing, pass/designate/claim in their phases, nothing when finished', () => {
    const g = newGame('las-1')
    expect(legalActionsSummary(g)).toEqual({ seat: 0, kinds: ['ask', 'claim'] })
    expect(legalActionsSummary({ ...g, phase: 'awaitPass', turn: 3 })).toEqual({ seat: 3, kinds: ['pass'] })
    expect(legalActionsSummary({ ...g, phase: 'awaitDesignate', turn: 2 })).toEqual({ seat: 2, kinds: ['designate'] })
    expect(legalActionsSummary({ ...g, phase: 'endgame', turn: 5 })).toEqual({ seat: 5, kinds: ['claim'] })
    expect(legalActionsSummary({ ...g, phase: 'finished' })).toEqual({ seat: 0, kinds: [] })
  })
})

describe('config toggles (engine-level ones)', () => {
  const withToggle = (patch: Partial<RulesConfig['toggles']>): RulesConfig => ({
    playerCount: 6,
    toggles: { ...defaultConfig.toggles, ...patch },
  })

  it('askOwnCardAllowed permits bluff asks for a held card', () => {
    const config = withToggle({ askOwnCardAllowed: true })
    const hands = distribute({ 0: ['2H', '3H'] }, [1, 2, 3, 4, 5])
    const s = { ...forceState(hands, { turn: 0 }), config }
    const r = reduce(s, { type: 'ask', seat: 0, target: 1, card: '2H' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.events[0]).toEqual({ type: 'ask', asker: 0, target: 1, card: '2H', hit: false })
    expect(legalAsks(s, 0).some((a) => a.card === '2H')).toBe(true)
  })

  it('highBooksDouble scores HIGH books as 2 points', () => {
    const config = withToggle({ highBooksDouble: true })
    const hands = distribute({ 0: [...bookCards('HIGH-S')] })
    const s = { ...forceState(hands, { turn: 0 }), config }
    const all0 = asg(bookCards('HIGH-S').map((c) => [c, 0 as Seat]))
    const r = reduce(s, { type: 'claim', seat: 0, book: 'HIGH-S', assignments: all0 })
    if (!r.ok) throw new Error(r.error.code)
    expect(r.state.score).toEqual([2, 0])
    expect(checkInvariants(r.state)).toEqual([])
  })
})

describe('invariants self-check', () => {
  it('accepts fresh games and rejects corrupted states', () => {
    const g = newGame('inv-1')
    expect(checkInvariants(g)).toEqual([])
    const dupe = { ...g, hands: g.hands.map((h, i) => (i === 1 ? [...h, g.hands[0][0]] : h)) }
    expect(checkInvariants(dupe).length).toBeGreaterThan(0)
    const missing = { ...g, hands: g.hands.map((h, i) => (i === 0 ? h.slice(1) : h)) }
    expect(checkInvariants(missing).some((m) => m.includes('conservation'))).toBe(true)
    const badPhase = { ...g, phase: 'finished' as const }
    expect(checkInvariants(badPhase).length).toBeGreaterThan(0)
    const badScore = { ...g, score: [1, 0] as [number, number] }
    expect(checkInvariants(badScore).length).toBeGreaterThan(0)
    const unsorted = { ...g, hands: g.hands.map((h, i) => (i === 2 ? [...h].reverse() : h)) }
    expect(checkInvariants(unsorted).some((m) => m.includes('sorted'))).toBe(true)
  })

  it('counts void books as resolved for conservation', () => {
    const s = forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }), { turn: 0 })
    const wrong = asg([
      ['2H', 0],
      ['3H', 0],
      ['4H', 4],
      ['5H', 2],
      ['6H', 2],
      ['7H', 4],
    ])
    const r = reduce(s, { type: 'claim', seat: 0, book: 'LOW-H', assignments: wrong })
    if (!r.ok) throw new Error(r.error.code)
    expect(r.state.books['LOW-H']?.outcome).toBe('void')
    expect(checkInvariants(r.state)).toEqual([])
    expect(ALL_BOOKS.filter((b) => r.state.books[b])).toEqual(['LOW-H'])
  })
})
