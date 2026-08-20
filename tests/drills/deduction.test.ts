/**
 * Deduction — over 50 seeds, every generated question asks a card whose
 * holder is certain from PUBLIC information alone, and the accepted answer
 * equals the true holder in the underlying engine state (ground truth via a
 * deterministic replay of the same sim).
 */
import { describe, expect, it } from 'vitest'
import { holderOf, newGame, publicView, reduce } from '../../lib/engine/index.ts'
import type { GameState } from '../../lib/engine/index.ts'
import {
  deductionPoints,
  generateDeductionRound,
  publicKnowledge,
  type DeductionQuestion,
} from '../../src/drills/deduction.ts'
import { botAction } from '../../src/drills/sim.ts'

/** Replay the question's game to the exact position its log snapshots. */
function replay(q: DeductionQuestion): GameState {
  let state = newGame(q.gameSeed)
  for (let i = 0; i < 1000 && state.log.length < q.log.length; i++) {
    const a = botAction(state)
    if (a === null) break
    const r = reduce(state, a)
    if (!r.ok) throw new Error(`replay rejected: ${r.error.code}`)
    state = r.state
  }
  return state
}

describe('drills/deduction', () => {
  it('is deterministic per seed', () => {
    expect(generateDeductionRound('DED-D')).toEqual(generateDeductionRound('DED-D'))
  })

  it(
    'over 50 seeds: only certainly-deducible cards, answer = true holder',
    { timeout: 300_000 },
    () => {
      let constraintTier = 0
      for (let i = 0; i < 50; i++) {
        const round = generateDeductionRound(`DED-${i}`)
        expect(round.questions).toHaveLength(3)
        for (const q of round.questions) {
          const state = replay(q)
          // The snapshot is the replayed position.
          expect(state.log).toEqual(q.log)
          expect(state.hands.map((h) => h.length)).toEqual(q.counts)
          // Ground truth: the accepted answer seat really holds the card.
          expect(state.hands[q.answer]).toContain(q.card)
          // Public-only certainty: knowledge built with NO hand pins it too.
          const k = publicKnowledge(publicView(state))
          expect(holderOf(k, q.card)).toBe(q.answer)
          // The question is presentable.
          expect(q.explanation.length).toBeGreaterThan(0)
          expect(q.counts).toHaveLength(6)
          if (q.tier === 'constraint') constraintTier++
        }
      }
      // The tier preference should regularly surface multi-step inferences.
      expect(constraintTier).toBeGreaterThan(0)
    },
  )

  it('scores by inference depth', () => {
    expect(deductionPoints('constraint')).toBe(3)
    expect(deductionPoints('direct')).toBe(2)
    expect(deductionPoints('hit')).toBe(1)
  })
})
