import { describe, expect, it } from 'vitest'
import {
  legalAsks,
  legalAsksFromView,
  newGame,
  reduce,
  rngFromSeed,
  seatView,
} from '../../lib/engine/index.ts'
import type { Seat } from '../../lib/engine/index.ts'
import { policyAction } from './policy.ts'

const SEATS: readonly Seat[] = [0, 1, 2, 3, 4, 5]

describe('legalAsksFromView', () => {
  it('matches legalAsks exactly (same list, same order) across 200+ seeded random game positions', () => {
    let positions = 0
    for (let g = 0; g < 30 && positions < 250; g++) {
      let state = newGame(`lafv-game-${g}`)
      const rng = rngFromSeed(`lafv-policy-${g}`)
      let guard = 0
      while (state.phase !== 'finished' && positions < 250 && guard++ < 400) {
        positions++
        for (const seat of SEATS) {
          const view = seatView(state, seat)
          expect(legalAsksFromView(view)).toEqual(legalAsks(state, seat))
        }
        const r = reduce(state, policyAction(state, rng))
        if (!r.ok) throw new Error(`policy produced illegal action: ${r.error.code}`)
        state = r.state
      }
      // Also compare on the terminal state when a game finished.
      for (const seat of SEATS) {
        expect(legalAsksFromView(seatView(state, seat))).toEqual(legalAsks(state, seat))
      }
    }
    expect(positions).toBeGreaterThanOrEqual(200)
  })

  it('returns [] off-turn and outside playing, from view data alone', () => {
    const g = newGame('lafv-edges')
    expect(legalAsksFromView(seatView(g, 3))).toEqual([])
    expect(legalAsksFromView(seatView({ ...g, phase: 'endgame' }, 0))).toEqual([])
    expect(legalAsksFromView(seatView({ ...g, phase: 'awaitPass' }, 0))).toEqual([])
    expect(legalAsksFromView(seatView({ ...g, phase: 'finished' }, 0))).toEqual([])
    // An emptied viewer has no asks even on their turn.
    const emptied = { ...g, hands: g.hands.map((h, i) => (i === 0 ? [] : h)) }
    expect(legalAsksFromView(seatView(emptied, 0))).toEqual([])
  })
})
