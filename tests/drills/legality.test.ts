/**
 * Ask legality — the generator produces every violation category, labels
 * every item with exactly the engine's error code (cross-checked by running
 * the depicted ask through reduce()), and the scorer follows
 * correct − wrong + speed bonus.
 */
import { describe, expect, it } from 'vitest'
import { reduce } from '../../lib/engine/index.ts'
import type { Card, Seat } from '../../lib/engine/index.ts'
import {
  LEGALITY_VIOLATIONS,
  generateLegalityRound,
  itemState,
  scoreLegality,
  type LegalityAnswer,
} from '../../src/drills/legality.ts'

const SEEDS = ['LG-1', 'LG-2', 'LG-3', 'LG-4', 'LG-5', 'LG-6']

describe('drills/legality generator', () => {
  it('is deterministic per seed', () => {
    expect(generateLegalityRound('LG-D')).toEqual(generateLegalityRound('LG-D'))
  })

  it('every round mixes legal asks with every illegal category', () => {
    for (const seed of SEEDS) {
      const round = generateLegalityRound(seed)
      expect(round.items).toHaveLength(12)
      const violations = new Set(round.items.map((i) => i.violation).filter((v) => v !== null))
      for (const v of LEGALITY_VIOLATIONS) expect(violations.has(v)).toBe(true)
      expect(round.items.some((i) => i.verdict === 'valid')).toBe(true)
    }
  })

  it('items carry a consistent depiction (hand, counts, 48 cards)', () => {
    for (const seed of SEEDS) {
      for (const item of generateLegalityRound(seed).items) {
        expect(item.hand).toEqual(item.hands[0])
        expect(item.counts).toEqual(item.hands.map((h) => h.length))
        expect(item.hands.flat()).toHaveLength(48)
        expect(new Set(item.hands.flat()).size).toBe(48)
      }
    }
  })

  it('labels match the engine: reduce() accepts valid items and returns the named code otherwise', () => {
    for (const seed of SEEDS) {
      for (const item of generateLegalityRound(seed).items) {
        const state = itemState(item)
        const r = reduce(state, {
          type: 'ask',
          seat: 0 as Seat,
          target: item.target,
          card: item.cardText as Card, // fake-card items are the point
        })
        if (item.verdict === 'valid') {
          expect(r.ok).toBe(true)
        } else {
          expect(r.ok).toBe(false)
          if (!r.ok) expect(r.error.code).toBe(item.violation)
        }
      }
    }
  })
})

describe('drills/legality scoring', () => {
  const round = generateLegalityRound('LG-SCORE')
  const rightFast: LegalityAnswer[] = round.items.map((i) => ({ saidValid: i.verdict === 'valid', ms: 900 }))

  it('all correct and fast: 12 correct + 12 speed bonus', () => {
    const s = scoreLegality(round.items, rightFast)
    expect(s).toEqual({ score: 24, correct: 12, wrong: 0, missed: 0, speedBonus: 12, bestStreak: 12 })
  })

  it('slow answers earn the point but no bonus', () => {
    const slow = rightFast.map((a) => ({ ...a, ms: 3200 }))
    const s = scoreLegality(round.items, slow)
    expect(s.score).toBe(12)
    expect(s.speedBonus).toBe(0)
  })

  it('wrong answers subtract; timeouts only lose the point; streak resets on both', () => {
    const answers: LegalityAnswer[] = round.items.map((i, idx) => {
      if (idx === 3) return { saidValid: null, ms: 4000 } // timeout
      if (idx === 7) return { saidValid: i.verdict !== 'valid', ms: 800 } // wrong
      return { saidValid: i.verdict === 'valid', ms: 2500 }
    })
    const s = scoreLegality(round.items, answers)
    expect(s.correct).toBe(10)
    expect(s.wrong).toBe(1)
    expect(s.missed).toBe(1)
    expect(s.speedBonus).toBe(0) // the only fast answer was the wrong one
    expect(s.score).toBe(9) // 10 − 1 + 0
    expect(s.bestStreak).toBe(4) // items 8..11 after the wrong at 7
  })
})
