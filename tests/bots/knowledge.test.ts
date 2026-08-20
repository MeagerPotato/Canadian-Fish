/**
 * Knowledge-engine correctness: scripted inference scenarios plus a
 * ground-truth soundness sweep over 300 full medium-bot games (the TEST reads
 * true state; the bots never do).
 */
import { describe, expect, it } from 'vitest'
import {
  buildKnowledge,
  candidates,
  certainCards,
  decide,
  hashSeed,
  holderOf,
  newGame,
  reduce,
  seatView,
} from '../../lib/engine/index.ts'
import type { BookId, Card, GameState, PublicEvent, Seat } from '../../lib/engine/index.ts'
import { ask, gs, mkView } from './util.ts'

describe('knowledge: scripted scenarios', () => {
  it('a hit fixes the holder (public transfer)', () => {
    const view = mkView({
      seat: 0,
      hand: ['2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D'],
      counts: [8, 9, 7, 8, 8, 8],
      log: [gs, ask(1, 2, '9H', true)],
    })
    const k = buildKnowledge(view)
    expect(holderOf(k, '9H')).toBe(1)
    expect(candidates(k, '9H')).toEqual([1])
    expect(certainCards(k, 1)).toContain('9H')
  })

  it('a miss excludes both the asker and the target', () => {
    const view = mkView({
      seat: 0,
      hand: ['2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D'],
      counts: [8, 8, 8, 8, 8, 8],
      log: [gs, ask(1, 2, '9H', false)],
    })
    const k = buildKnowledge(view)
    const cand = candidates(k, '9H')
    expect(cand).not.toContain(1)
    expect(cand).not.toContain(2)
    expect(cand).not.toContain(0) // own hand: not mine either
    expect(cand.sort()).toEqual([3, 4, 5])
  })

  it('an ask implies an asker-holds-book constraint that later collapses to certainty', () => {
    // Seat 1 asks for 5H => holds >= 1 of {2H,3H,4H,6H,7H}. Subsequent misses
    // rule seat 1 out of 2H/3H/4H/6H, so elimination forces 7H onto seat 1.
    const view = mkView({
      seat: 0,
      hand: ['2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D'],
      counts: [8, 8, 8, 8, 8, 8],
      log: [
        gs,
        ask(1, 0, '5H', false),
        ask(2, 1, '2H', false),
        ask(4, 1, '3H', false),
        ask(2, 1, '4H', false),
        ask(4, 1, '6H', false),
      ],
    })
    const k = buildKnowledge(view)
    expect(holderOf(k, '7H')).toBe(1)
    expect(candidates(k, '7H')).toEqual([1])
    // The collapsed constraint is gone from the surviving list.
    expect(k.constraints.every((c) => !(c.seat === 1 && c.cards.includes('7H')))).toBe(true)
  })

  it('a claim reveal marks all six cards out of play', () => {
    const book: BookId = 'LOW-H'
    const actualHolders = {
      '2H': 1,
      '3H': 1,
      '4H': 3,
      '5H': 3,
      '6H': 5,
      '7H': 5,
    } as Record<Card, Seat>
    const claim: PublicEvent = {
      type: 'claim',
      claimer: 1,
      book,
      assignments: actualHolders,
      actualHolders,
      outcome: 'team1',
    }
    const view = mkView({
      seat: 0,
      hand: ['2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D'],
      counts: [8, 6, 8, 6, 8, 6],
      log: [gs, claim],
      books: {
        [book]: { book, outcome: 'team1', claimer: 1, assignments: actualHolders, actualHolders },
      },
      score: [0, 1],
    })
    const k = buildKnowledge(view)
    for (const c of ['2H', '3H', '4H', '5H', '6H', '7H'] as Card[]) {
      expect(holderOf(k, c)).toBeNull()
      expect(candidates(k, c)).toEqual([])
      expect(k.gone).toContain(c)
    }
  })

  it('count exhaustion: a seat with k cards and k known cards holds nothing else', () => {
    // Seat 3 publicly took 9C and TC and now holds exactly 2 cards.
    const view = mkView({
      seat: 0,
      hand: ['2C', '3C', '4C', '5C', '6C', '7C', '2D', '3D'],
      counts: [8, 8, 6, 2, 8, 8],
      log: [gs, ask(3, 2, '9C', true), ask(3, 2, 'TC', true)],
    })
    const k = buildKnowledge(view)
    expect(holderOf(k, '9C')).toBe(3)
    expect(holderOf(k, 'TC')).toBe(3)
    expect(certainCards(k, 3)).toEqual(['9C', 'TC'])
    expect(k.unknownSlots[3]).toBe(0)
    for (const c of ['AH', 'QS', '4D', 'JC'] as Card[]) {
      expect(candidates(k, c)).not.toContain(3)
    }
  })

  it('own hand is fully known: YES for me, NO elsewhere', () => {
    const view = mkView({
      seat: 2,
      hand: ['9H', 'TH', 'JH'],
      counts: [8, 8, 3, 8, 8, 8],
      log: [gs],
      turn: 2,
    })
    const k = buildKnowledge(view)
    expect(certainCards(k, 2)).toEqual(['9H', 'TH', 'JH'])
    expect(candidates(k, 'QH')).not.toContain(2) // not in my hand => not mine
    expect(holderOf(k, '9H')).toBe(2)
  })
})

describe('knowledge: ground-truth soundness (300 medium games)', () => {
  it(
    'certainty NEVER contradicts the true state; the true holder is always a candidate',
    () => {
      const GAMES = 300
      let checkedStates = 0
      let certaintyChecks = 0
      for (let g = 0; g < GAMES; g++) {
        const seed = `ktruth-${g}`
        let state = newGame(seed, undefined, (g % 6) as Seat)
        let steps = 0
        while (state.phase !== 'finished' && steps < 5000) {
          const action = decide(seatView(state, state.turn), 'medium', hashSeed(`${seed}:${state.moveIndex}`)())
          const r = reduce(state, action)
          if (!r.ok) throw new Error(`${seed} step ${steps}: medium bot illegal (${r.error.code})`)
          state = r.state
          steps++
          // Verify the acting seat's knowledge every step; all six seats
          // periodically (broader coverage at bounded cost).
          const seats: Seat[] =
            steps % 25 === 0 ? [0, 1, 2, 3, 4, 5] : [state.turn]
          for (const seat of seats) {
            const k = buildKnowledge(seatView(state, seat))
            checkedStates++
            assertSound(k, state, seed, steps, seat)
            certaintyChecks += Object.keys(k.holders).length
          }
        }
        if (state.phase !== 'finished') throw new Error(`${seed}: did not finish (${state.phase})`)
      }
      expect(checkedStates).toBeGreaterThan(10_000)
      expect(certaintyChecks).toBeGreaterThan(50_000)
    },
    300_000,
  )
})

function assertSound(
  k: ReturnType<typeof buildKnowledge>,
  state: GameState,
  seed: string,
  step: number,
  seat: Seat,
): void {
  const trueHolder = new Map<Card, Seat>()
  for (let s = 0; s < 6; s++) {
    for (const c of state.hands[s]) trueHolder.set(c, s as Seat)
  }
  for (const [card, holder] of Object.entries(k.holders) as [Card, Seat][]) {
    if (trueHolder.get(card) !== holder) {
      throw new Error(
        `${seed} step ${step} seat ${seat}: claims ${card}@${holder}, truth ${card}@${String(trueHolder.get(card))}`,
      )
    }
  }
  for (const [card, actual] of trueHolder) {
    const cand = k.cands[card]
    if (!cand || !cand.includes(actual)) {
      throw new Error(
        `${seed} step ${step} seat ${seat}: true holder ${actual} of ${card} excluded (cand ${JSON.stringify(cand)})`,
      )
    }
  }
  // Gone cards are exactly the resolved books' cards.
  for (const c of k.gone) {
    if (trueHolder.has(c)) {
      throw new Error(`${seed} step ${step} seat ${seat}: ${c} marked gone but still in a hand`)
    }
  }
  // Certain cards never exceed the public count.
  for (let s = 0; s < 6; s++) {
    const certain = certainCards(k, s as Seat).length
    if (certain > state.hands[s].length) {
      throw new Error(`${seed} step ${step} seat ${seat}: ${certain} certain > count ${state.hands[s].length} at seat ${s}`)
    }
  }
}
