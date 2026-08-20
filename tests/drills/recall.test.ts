/**
 * Book recall — generator validity/determinism and the scoring math
 * (+1 book, +1 exact count, −1 wrong pick).
 */
import { describe, expect, it } from 'vitest'
import { cardBook, isCard } from '../../lib/engine/index.ts'
import type { BookId } from '../../lib/engine/index.ts'
import { generateRecallRound, gradeRecall, type RecallAnswer } from '../../src/drills/recall.ts'

describe('drills/recall generator', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generateRecallRound('SEED-A')
    const b = generateRecallRound('SEED-A')
    const c = generateRecallRound('SEED-B')
    expect(a).toEqual(b)
    expect(JSON.stringify(a.hands)).not.toEqual(JSON.stringify(c.hands))
  })

  it('deals 5 hands of 8 distinct real cards whose truth matches a recount', () => {
    for (const seed of ['R1', 'R2', 'R3']) {
      const round = generateRecallRound(seed)
      expect(round.hands).toHaveLength(5)
      for (const hand of round.hands) {
        expect(hand.cards).toHaveLength(8)
        expect(new Set(hand.cards).size).toBe(8)
        for (const card of hand.cards) expect(isCard(card)).toBe(true)
        const recount: Partial<Record<BookId, number>> = {}
        for (const card of hand.cards) {
          const b = cardBook(card)
          recount[b] = (recount[b] ?? 0) + 1
        }
        expect(hand.truth).toEqual(recount)
        const total = Object.values(hand.truth).reduce<number>((n, v) => n + (v ?? 0), 0)
        expect(total).toBe(8)
      }
    }
  })
})

describe('drills/recall scoring', () => {
  const hand = generateRecallRound('SCORE').hands[0]
  const present = Object.keys(hand.truth) as BookId[]

  it('perfect answer earns 2 points per present book', () => {
    const answer: RecallAnswer = { ...hand.truth }
    const g = gradeRecall(hand, answer)
    expect(g.points).toBe(2 * present.length)
    expect(g.maxPoints).toBe(2 * present.length)
    expect(g.correctBooks).toBe(present.length)
    expect(g.exactCounts).toBe(present.length)
    expect(g.wrongPicks).toBe(0)
    expect(g.perfect).toBe(true)
  })

  it('an empty answer scores zero without penalties', () => {
    const g = gradeRecall(hand, {})
    expect(g.points).toBe(0)
    expect(g.wrongPicks).toBe(0)
    expect(g.perfect).toBe(false)
  })

  it('a right book with a wrong count earns only the book point', () => {
    const book = present[0]
    const truthCount = hand.truth[book] ?? 0
    const wrongCount = truthCount === 1 ? 2 : 1
    const g = gradeRecall(hand, { [book]: wrongCount })
    expect(g.points).toBe(1)
    expect(g.correctBooks).toBe(1)
    expect(g.exactCounts).toBe(0)
  })

  it('naming an absent book subtracts one', () => {
    const absent = (['LOW-C', 'LOW-D', 'LOW-H', 'LOW-S', 'HIGH-C', 'HIGH-D', 'HIGH-H', 'HIGH-S'] as BookId[]).find(
      (b) => hand.truth[b] === undefined,
    )
    expect(absent).toBeDefined()
    const answer: RecallAnswer = { ...hand.truth, [absent as BookId]: 2 }
    const g = gradeRecall(hand, answer)
    expect(g.wrongPicks).toBe(1)
    expect(g.points).toBe(2 * present.length - 1)
    expect(g.perfect).toBe(false)
  })
})
