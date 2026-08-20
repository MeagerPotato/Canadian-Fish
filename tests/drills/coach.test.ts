/**
 * Coach overlay viewmodel — certain-claim detection (same certainty shape as
 * the bots' certainClaim) and the top-3 ranked asks with refined hit %.
 */
import { describe, expect, it } from 'vitest'
import { defaultConfig, seatTeam } from '../../lib/engine/index.ts'
import type { Card, Seat, SeatView } from '../../lib/engine/index.ts'
import { buildCoachAdvice } from '../../src/drills/coach.ts'

function view(v: Partial<SeatView> & { seat: Seat; hand: Card[] }): SeatView {
  return {
    phase: 'playing',
    turn: v.seat,
    counts: [8, 8, 8, 8, 8, 8],
    score: [0, 0],
    books: {},
    log: [{ type: 'game_started', startingSeat: 0 }],
    moveIndex: 0,
    config: defaultConfig,
    ...v,
  }
}

describe('drills/coach', () => {
  it('flags a certain claim when a whole book sits in my own hand', () => {
    const hand: Card[] = ['2C', '3C', '4C', '5C', '6C', '7C', '9H', 'TH']
    const advice = buildCoachAdvice(view({ seat: 0, hand }))
    expect(advice.certainBook).toBe('LOW-C')
  })

  it('finds no certain claim on a fresh scattered hand', () => {
    const hand: Card[] = ['2C', '3D', '4H', '5S', '9C', 'TD', 'JH', 'QS']
    const advice = buildCoachAdvice(view({ seat: 0, hand }))
    expect(advice.certainBook).toBeNull()
  })

  it('ranks at most 3 asks on my turn, opponents only, with sane percentages', () => {
    const hand: Card[] = ['2C', '3C', '4H', '5S', '9C', 'TD', 'JH', 'QS']
    const advice = buildCoachAdvice(view({ seat: 0, hand }))
    expect(advice.asks.length).toBeGreaterThan(0)
    expect(advice.asks.length).toBeLessThanOrEqual(3)
    for (const a of advice.asks) {
      expect(seatTeam(a.target)).toBe(1) // seat 0 asks only team 1
      expect(hand).not.toContain(a.card)
      expect(a.pct).toBeGreaterThanOrEqual(0)
      expect(a.pct).toBeLessThanOrEqual(100)
      expect(a.reason.length).toBeGreaterThan(0)
    }
    // Sorted by the evaluator's score, best first.
    for (let i = 1; i < advice.asks.length; i++) {
      expect(advice.asks[i - 1].score).toBeGreaterThanOrEqual(advice.asks[i].score)
    }
  })

  it('offers no asks when it is not my turn', () => {
    const hand: Card[] = ['2C', '3C', '4H', '5S', '9C', 'TD', 'JH', 'QS']
    const advice = buildCoachAdvice(view({ seat: 0, hand, turn: 3 as Seat }))
    expect(advice.asks).toEqual([])
  })
})
