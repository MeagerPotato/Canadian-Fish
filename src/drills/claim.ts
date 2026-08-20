/**
 * Drill 4 — Claim trainer (SPEC.md §8.4). Pure generator + scorer.
 *
 * The generator simulates a seeded medium-bot game until, from YOUR seat view
 * (seat 0: public log + own hand), some unresolved book is fully locatable
 * via buildKnowledge — every one of its six cards has a certain holder — and
 * all six sit on your team (so the claim is winnable and a wrong seat voids
 * it, RULES.md §3). You then place all six cards on the 3-seat team matrix.
 *
 * Scoring per claim: +1 per correct assignment; 6/6 adds a +4 "claim won"
 * bonus (max 10). Engine semantics: with all six cards on team 0, the claim
 * scores for team 0 iff every assignment is right, else the book is VOID —
 * gradeClaim mirrors that exactly (cross-checked against reduce in tests).
 */
import type { BookId, Card, GameState, PublicEvent, Seat } from '../../lib/engine/index.ts'
import {
  ALL_BOOKS,
  ALL_CARDS,
  bookCards,
  buildKnowledge,
  defaultConfig,
  holderOf,
  seatTeam,
  seatView,
  sortHand,
} from '../../lib/engine/index.ts'
import { simulate } from './sim.ts'

export const CLAIMS_PER_ROUND = 2
export const CLAIM_WON_BONUS = 4

export interface ClaimPuzzle {
  gameSeed: string
  /** The public log at the frozen position. */
  log: PublicEvent[]
  counts: number[]
  /** Your hand (seat 0) at the position. */
  hand: Card[]
  /** The fully locatable book you must claim. */
  book: BookId
  /** Ground-truth holders of the book's six cards (all on team 0). */
  truth: Record<Card, Seat>
  /** The three legal seats to assign (your team): 0, 2, 4. */
  teamSeats: readonly Seat[]
}

export interface ClaimRound {
  seed: string
  puzzles: ClaimPuzzle[]
}

const MY_SEAT: Seat = 0
const MY_TEAM_SEATS: readonly Seat[] = [0, 2, 4]

/**
 * From seat 0's view, the first unresolved book whose six cards are all
 * certainly located on team 0. `minHidden` demands that many of them sit
 * OUTSIDE your own hand (so the deduction is non-trivial).
 */
function locatableBook(state: GameState, minHidden: number): BookId | null {
  const k = buildKnowledge(seatView(state, MY_SEAT))
  const myHand = new Set(state.hands[MY_SEAT])
  for (const b of ALL_BOOKS) {
    if (state.books[b]) continue
    let hidden = 0
    let ok = true
    for (const c of bookCards(b)) {
      const h = holderOf(k, c)
      if (h === null || seatTeam(h) !== 0) {
        ok = false
        break
      }
      if (!myHand.has(c)) hidden++
    }
    if (ok && hidden >= minHidden) return b
  }
  return null
}

function puzzleFromState(gameSeed: string, state: GameState, book: BookId): ClaimPuzzle {
  const truth = {} as Record<Card, Seat>
  for (const c of bookCards(book)) {
    truth[c] = state.hands.findIndex((h) => h.includes(c)) as Seat
  }
  return {
    gameSeed,
    log: [...state.log],
    counts: state.hands.map((h) => h.length),
    hand: sortHand(state.hands[MY_SEAT]),
    book,
    truth,
    teamSeats: MY_TEAM_SEATS,
  }
}

/**
 * Guaranteed synthetic fallback (deterministic; probability ~0 of use): a
 * fresh deal rearranged so one whole book sits in your hand — trivially but
 * genuinely locatable.
 */
function syntheticPuzzle(gameSeed: string): ClaimPuzzle {
  const book = ALL_BOOKS[0]
  const bookSet = new Set(bookCards(book))
  const pool = ALL_CARDS.filter((c) => !bookSet.has(c)) // 42 cards
  const hands: Card[][] = [[], [], [], [], [], []]
  hands[0] = [...bookCards(book), pool[0], pool[1]]
  let i = 2
  for (let s = 1; s < 6; s++) {
    hands[s] = pool.slice(i, i + 8)
    i += 8
  }
  const state: GameState = {
    config: defaultConfig,
    seed: gameSeed,
    phase: 'playing',
    turn: MY_SEAT,
    hands: hands.map(sortHand),
    books: {},
    score: [0, 0],
    log: [{ type: 'game_started', startingSeat: MY_SEAT }],
    moveIndex: 0,
  }
  return puzzleFromState(gameSeed, state, book)
}

export function generateClaimRound(seed: string, puzzleCount = CLAIMS_PER_ROUND): ClaimRound {
  const puzzles: ClaimPuzzle[] = []
  for (let p = 0; p < puzzleCount; p++) {
    let made: ClaimPuzzle | null = null
    // Relaxation ladder: prefer >= 2 cards outside your hand, then >= 0.
    for (const minHidden of [2, 0]) {
      for (let attempt = 0; attempt < 12 && made === null; attempt++) {
        const gameSeed = `${seed}:p${p}:h${minHidden}:t${attempt}`
        const found = simulateUntilLocatable(gameSeed, minHidden)
        if (found !== null) made = puzzleFromState(gameSeed, found.state, found.book)
      }
      if (made !== null) break
    }
    puzzles.push(made ?? syntheticPuzzle(`${seed}:p${p}:synthetic`))
  }
  return { seed, puzzles }
}

function simulateUntilLocatable(
  gameSeed: string,
  minHidden: number,
): { state: GameState; book: BookId } | null {
  let found: BookId | null = null
  const { state } = simulate(
    gameSeed,
    (s) => {
      // Only freeze 'playing' positions with a real mid-game log, so the
      // depicted claim would be legal on your turn (RULES row 11).
      if (s.phase !== 'playing' || s.moveIndex < 6) return false
      found = locatableBook(s, minHidden)
      return found !== null
    },
    400,
  )
  return found !== null && state.phase === 'playing' ? { state, book: found } : null
}

/* --------------------------------------------------------------- scoring --- */

export interface ClaimGrade {
  perCard: { card: Card; picked: Seat; actual: Seat; correct: boolean }[]
  correct: number
  /** 6/6 — the claim would score for your team. */
  won: boolean
  /** Engine outcome for this claim: 'team0' when won, else 'void' (row 15). */
  outcome: 'team0' | 'void'
  /** correct + (won ? CLAIM_WON_BONUS : 0). */
  score: number
}

export function gradeClaim(puzzle: ClaimPuzzle, picks: Record<Card, Seat>): ClaimGrade {
  const perCard = bookCards(puzzle.book).map((card) => {
    const picked = picks[card]
    const actual = puzzle.truth[card]
    return { card, picked, actual, correct: picked === actual }
  })
  const correct = perCard.filter((r) => r.correct).length
  const won = correct === 6
  return {
    perCard,
    correct,
    won,
    outcome: won ? 'team0' : 'void',
    score: correct + (won ? CLAIM_WON_BONUS : 0),
  }
}
