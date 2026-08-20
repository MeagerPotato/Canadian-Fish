/**
 * Determinism and legality of decide() across seeded random positions in all
 * phases, plus the decide-latency budget (< 5 ms typical; the server chain
 * runs up to 60 per request).
 */
import { describe, expect, it } from 'vitest'
import { decide, hashSeed, reduce, seatView } from '../../lib/engine/index.ts'
import { collectPositions, phaseCounts } from './util.ts'

const DIFFS = ['easy', 'medium', 'hard'] as const

describe('determinism', () => {
  it(
    'same (view, difficulty, seed) => deep-equal action across 100 positions',
    () => {
      const positions = collectPositions(100)
      for (let i = 0; i < positions.length; i++) {
        const state = positions[i]
        const seed = hashSeed(`det-${i}`)()
        for (const diff of DIFFS) {
          const a = decide(seatView(state, state.turn), diff, seed)
          const b = decide(seatView(state, state.turn), diff, seed)
          expect(b).toEqual(a)
        }
      }
    },
    120_000,
  )
})

describe('legality', () => {
  it(
    "decide's action passes reduce() for 500 positions x 3 difficulties across all phases",
    () => {
      const positions = collectPositions(500)
      const phases = phaseCounts(positions)
      // The seeded sample must actually exercise every acting phase.
      expect(phases['playing'] ?? 0).toBeGreaterThan(300)
      expect(phases['endgame'] ?? 0).toBeGreaterThan(10)
      expect(phases['awaitPass'] ?? 0).toBeGreaterThan(10)
      expect(phases['awaitDesignate'] ?? 0).toBeGreaterThan(0)
      for (let i = 0; i < positions.length; i++) {
        const state = positions[i]
        const seed = hashSeed(`legal-${i}`)()
        for (const diff of DIFFS) {
          const action = decide(seatView(state, state.turn), diff, seed)
          const r = reduce(state, action)
          if (!r.ok) {
            throw new Error(
              `position ${i} (${state.phase}) ${diff}: rejected ${r.error.code}: ` +
                JSON.stringify(action),
            )
          }
        }
      }
    },
    180_000,
  )
})

describe('performance', () => {
  it('decide (knowledge rebuild included) stays well under the 5 ms budget', () => {
    const positions = collectPositions(120).filter((p) => p.moveIndex > 40)
    expect(positions.length).toBeGreaterThan(30)
    // Warm up JIT paths first.
    for (const state of positions.slice(0, 10)) decide(seatView(state, state.turn), 'hard', 1)
    const t0 = performance.now()
    let n = 0
    for (const state of positions) {
      for (const diff of DIFFS) {
        decide(seatView(state, state.turn), diff, hashSeed(`perf-${n++}`)())
      }
    }
    const avg = (performance.now() - t0) / n
    expect(avg).toBeLessThan(5)
  }, 120_000)
})
