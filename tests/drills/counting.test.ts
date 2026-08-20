/**
 * Card counting — event streams conserve counts (cross-checked by replaying
 * the generator's actions through the engine), and the scorer counts exact
 * seats only.
 */
import { describe, expect, it } from 'vitest'
import { newGame, reduce } from '../../lib/engine/index.ts'
import { COUNTING_ASKS_PER_ROUND, countsFromEvents, generateCountingRound, scoreCounting } from '../../src/drills/counting.ts'

const SEED_COUNT = 20

describe('drills/counting generator', () => {
  it('is deterministic per seed', () => {
    expect(generateCountingRound('CT-D')).toEqual(generateCountingRound('CT-D'))
  })

  it(
    'streams exactly 15 asks (no claims) that conserve the 48 cards',
    { timeout: 120_000 },
    () => {
      for (let i = 0; i < SEED_COUNT; i++) {
        const round = generateCountingRound(`CT-${i}`)
        expect(round.events).toHaveLength(COUNTING_ASKS_PER_ROUND)
        expect(round.actions).toHaveLength(round.events.length)
        for (const a of round.actions) expect(a.type).toBe('ask')
        // A healthy mix keeps the drill honest.
        const hits = round.events.filter((e) => e.hit).length
        expect(hits).toBeGreaterThanOrEqual(3)
        expect(round.events.length - hits).toBeGreaterThanOrEqual(3)
        // Conservation from the events alone: 8 each ± hits, summing to 48.
        expect(countsFromEvents(round.events)).toEqual(round.finalCounts)
        expect(round.finalCounts.reduce((n, v) => n + v, 0)).toBe(48)
        // Engine replay cross-check: applying the recorded actions to the
        // seeded game reproduces the events and the final counts exactly.
        let state = newGame(round.gameSeed)
        for (const action of round.actions) {
          const r = reduce(state, action)
          expect(r.ok).toBe(true)
          if (r.ok) state = r.state
        }
        expect(state.hands.map((h) => h.length)).toEqual(round.finalCounts)
        const askEvents = state.log.filter((ev) => ev.type === 'ask')
        expect(askEvents).toEqual(round.events)
      }
    },
  )
})

describe('drills/counting scoring', () => {
  const finalCounts = [9, 7, 8, 8, 6, 10]

  it('one point per exact seat', () => {
    const s = scoreCounting(finalCounts, [9, 7, 8, 8, 6, 10])
    expect(s.score).toBe(6)
    expect(s.correct).toBe(6)
    expect(s.bestStreak).toBe(6)
  })

  it('near misses and blanks earn nothing', () => {
    const s = scoreCounting(finalCounts, [8, 7, 8, null, 6, 11])
    expect(s.perSeat).toEqual([false, true, true, false, true, false])
    expect(s.score).toBe(3)
    expect(s.bestStreak).toBe(2)
  })

  it('all wrong is zero', () => {
    const s = scoreCounting(finalCounts, [0, 0, 0, 0, 0, 0])
    expect(s.score).toBe(0)
    expect(s.bestStreak).toBe(0)
  })
})
