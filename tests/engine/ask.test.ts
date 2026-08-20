import { describe, expect, it } from 'vitest'
import { checkInvariants, newGame, reduce, sortHand } from '../../lib/engine/index.ts'
import type { Card, GameAction, GameState, Seat } from '../../lib/engine/index.ts'
import { distribute, forceState } from './util.ts'

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

describe('ask legality (RULES.md §2 error codes)', () => {
  it('WRONG_PHASE: asks are illegal outside playing', () => {
    for (const phase of ['awaitPass', 'awaitDesignate', 'endgame', 'finished'] as const) {
      const s = forceState(distribute({}), { phase })
      expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '2C' }).code).toBe('WRONG_PHASE')
    }
  })

  it('NOT_YOUR_TURN: only the turn seat may ask', () => {
    const s = newGame('ask-turn')
    expect(s.turn).toBe(0)
    expect(fail(s, { type: 'ask', seat: 1, target: 0, card: '2C' }).code).toBe('NOT_YOUR_TURN')
    expect(fail(s, { type: 'ask', seat: 2, target: 1, card: '2C' }).code).toBe('NOT_YOUR_TURN')
  })

  it('ASKER_OUT: a cardless asker cannot ask even on their turn', () => {
    const s = forceState(distribute({}, [1, 2, 3, 4, 5]), { turn: 0 })
    expect(s.hands[0]).toHaveLength(0)
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '2C' }).code).toBe('ASKER_OUT')
  })

  it('TARGET_TEAMMATE: teammates may never be asked', () => {
    const s = newGame('ask-teammate')
    expect(fail(s, { type: 'ask', seat: 0, target: 2, card: '2C' }).code).toBe('TARGET_TEAMMATE')
    expect(fail(s, { type: 'ask', seat: 0, target: 4, card: '2C' }).code).toBe('TARGET_TEAMMATE')
  })

  it('TARGET_SELF: asking yourself is its own error', () => {
    const s = newGame('ask-self')
    expect(fail(s, { type: 'ask', seat: 0, target: 0, card: '2C' }).code).toBe('TARGET_SELF')
  })

  it('TARGET_OUT: an emptied opponent cannot be asked', () => {
    const s = forceState(distribute({}, [0, 2, 3, 4, 5]), { turn: 0 })
    expect(s.hands[1]).toHaveLength(0)
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '2C' }).code).toBe('TARGET_OUT')
  })

  it('NO_CARD_OF_BOOK: asker must hold a card of the asked book', () => {
    const s = forceState(distribute({ 0: ['2C', '3C'] }, [1, 2, 3, 4, 5]), { turn: 0 })
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '9H' }).code).toBe('NO_CARD_OF_BOOK')
  })

  it('ASKING_OWN_CARD: may not ask for a card you hold', () => {
    const s = forceState(distribute({ 0: ['2C', '3C'] }, [1, 2, 3, 4, 5]), { turn: 0 })
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '2C' }).code).toBe('ASKING_OWN_CARD')
  })

  it('INVALID_CARD: fake cards (including any 8) are rejected', () => {
    const s = newGame('ask-invalid')
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '8H' as unknown as Card }).code).toBe('INVALID_CARD')
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: 'ZZ' as unknown as Card }).code).toBe('INVALID_CARD')
    expect(fail(s, { type: 'ask', seat: 0, target: 1, card: '' as unknown as Card }).code).toBe('INVALID_CARD')
  })

  it('INVALID_ACTION: unknown action types and non-seat targets never throw', () => {
    const s = newGame('ask-garbage')
    expect(fail(s, { type: 'shout' } as unknown as GameAction).code).toBe('INVALID_ACTION')
    expect(fail(s, { type: 'ask', seat: 0, target: 9 as unknown as Seat, card: '2C' }).code).toBe('INVALID_ACTION')
  })

  it('error checks run in the RULES.md §2 order', () => {
    // Wrong phase beats wrong turn; wrong turn beats teammate target; teammate beats card checks.
    const s = forceState(distribute({}), { phase: 'endgame' })
    expect(fail(s, { type: 'ask', seat: 1, target: 3, card: '8H' as unknown as Card }).code).toBe('WRONG_PHASE')
    const p = forceState(distribute({}), { turn: 0 })
    expect(fail(p, { type: 'ask', seat: 1, target: 3, card: '8H' as unknown as Card }).code).toBe('NOT_YOUR_TURN')
    expect(fail(p, { type: 'ask', seat: 0, target: 2, card: '8H' as unknown as Card }).code).toBe('TARGET_TEAMMATE')
  })
})

describe('ask flow: hit, miss, eliminations', () => {
  it('hit: card moves target->asker (sorted), turn unchanged, public event recorded', () => {
    const s = forceState(distribute({ 0: ['2H', 'AC'], 1: ['3H'] }, [0, 1, 2, 3, 4, 5]), { turn: 0 })
    const before0 = s.hands[0].length
    const r = pass(s, { type: 'ask', seat: 0, target: 1, card: '3H' })
    expect(r.events).toEqual([{ type: 'ask', asker: 0, target: 1, card: '3H', hit: true }])
    expect(r.state.turn).toBe(0)
    expect(r.state.phase).toBe('playing')
    expect(r.state.hands[0]).toContain('3H')
    expect(r.state.hands[0]).toHaveLength(before0 + 1)
    expect(r.state.hands[1]).not.toContain('3H')
    expect(r.state.hands[0]).toEqual(sortHand(r.state.hands[0]))
    expect(r.state.moveIndex).toBe(s.moveIndex + 1)
    expect(r.state.log.at(-1)).toEqual(r.events[0])
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('miss: turn passes to the asked player, no cards move', () => {
    const s = forceState(distribute({ 0: ['2H'], 3: ['4H'] }, [0, 1, 2, 3, 4, 5]), { turn: 0 })
    const r = pass(s, { type: 'ask', seat: 0, target: 1, card: '4H' })
    expect(r.events).toEqual([{ type: 'ask', asker: 0, target: 1, card: '4H', hit: false }])
    expect(r.state.turn).toBe(1)
    expect(r.state.phase).toBe('playing')
    expect(r.state.hands).toEqual(s.hands)
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('hit that empties the target eliminates them: player_out, then unaskable', () => {
    const s = forceState(distribute({ 0: ['2H'], 1: ['3H'] }, [0, 2, 3, 4, 5]), { turn: 0 })
    expect(s.hands[1]).toEqual(['3H'])
    const r = pass(s, { type: 'ask', seat: 0, target: 1, card: '3H' })
    expect(r.events).toEqual([
      { type: 'ask', asker: 0, target: 1, card: '3H', hit: true },
      { type: 'player_out', seat: 1 },
    ])
    expect(r.state.phase).toBe('playing') // teammates 3,5 still hold cards
    expect(r.state.turn).toBe(0)
    expect(fail(r.state, { type: 'ask', seat: 0, target: 1, card: '4H' }).code).toBe('TARGET_OUT')
    expect(checkInvariants(r.state)).toEqual([])
  })

  it('hit that empties the whole opposing team starts the endgame with the asker', () => {
    const s = forceState(distribute({ 0: ['2H'], 1: ['3H'] }, [0, 2, 4]), { turn: 0 })
    expect(s.hands[1]).toEqual(['3H'])
    expect(s.hands[3]).toEqual([])
    expect(s.hands[5]).toEqual([])
    const r = pass(s, { type: 'ask', seat: 0, target: 1, card: '3H' })
    expect(r.events).toEqual([
      { type: 'ask', asker: 0, target: 1, card: '3H', hit: true },
      { type: 'player_out', seat: 1 },
      { type: 'endgame', claimingTeam: 0 },
    ])
    expect(r.state.phase).toBe('endgame')
    expect(r.state.turn).toBe(0)
    expect(fail(r.state, { type: 'ask', seat: 0, target: 1, card: '4H' }).code).toBe('WRONG_PHASE')
    expect(checkInvariants(r.state)).toEqual([])
  })
})
