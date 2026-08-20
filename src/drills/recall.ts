/**
 * Drill 1 — Book recall (SPEC.md §8.1). Pure generator + scorer.
 *
 * A round is 5 seeded random 8-card hands. Each flashes for 3 s, then the
 * player names which books were present and how many cards of each.
 * Scoring per hand: +1 per correctly-named present book, +1 more when its
 * count is exact, −1 per book named that was not there. Missed books score 0.
 */
import type { BookId, Card } from '../../lib/engine/index.ts'
import { ALL_BOOKS, ALL_CARDS, cardBook, rngFromSeed, shuffle, sortHand } from '../../lib/engine/index.ts'

export const RECALL_HANDS_PER_ROUND = 5
export const RECALL_FLASH_MS = 3000
export const RECALL_ANSWER_MS = 8000

export interface RecallHand {
  /** 8 distinct cards, canonically sorted. */
  cards: Card[]
  /** Ground truth: book -> how many of its cards are in the hand (only > 0). */
  truth: Partial<Record<BookId, number>>
}

export interface RecallRound {
  seed: string
  hands: RecallHand[]
}

/** Book -> claimed count (>= 1); books absent from the map were not named. */
export type RecallAnswer = Partial<Record<BookId, number>>

export function generateRecallRound(seed: string, handCount = RECALL_HANDS_PER_ROUND): RecallRound {
  const hands: RecallHand[] = []
  for (let i = 0; i < handCount; i++) {
    const cards = sortHand(shuffle(ALL_CARDS, rngFromSeed(`${seed}:hand${i}`)).slice(0, 8))
    const truth: Partial<Record<BookId, number>> = {}
    for (const c of cards) {
      const b = cardBook(c)
      truth[b] = (truth[b] ?? 0) + 1
    }
    hands.push({ cards, truth })
  }
  return { seed, hands }
}

export interface RecallGrade {
  /** correctBooks + exactCounts − wrongPicks (can go negative on a bad hand). */
  points: number
  /** 2 × number of books actually present (the per-hand ceiling). */
  maxPoints: number
  correctBooks: number
  exactCounts: number
  wrongPicks: number
  /** Every present book named with its exact count and nothing extra. */
  perfect: boolean
}

export function gradeRecall(hand: RecallHand, answer: RecallAnswer): RecallGrade {
  let correctBooks = 0
  let exactCounts = 0
  let wrongPicks = 0
  let present = 0
  for (const b of ALL_BOOKS) {
    const t = hand.truth[b] ?? 0
    const a = answer[b] ?? 0
    if (t > 0) present++
    if (a > 0 && t > 0) {
      correctBooks++
      if (a === t) exactCounts++
    } else if (a > 0 && t === 0) {
      wrongPicks++
    }
  }
  const points = correctBooks + exactCounts - wrongPicks
  const maxPoints = 2 * present
  return {
    points,
    maxPoints,
    correctBooks,
    exactCounts,
    wrongPicks,
    perfect: points === maxPoints && wrongPicks === 0,
  }
}
