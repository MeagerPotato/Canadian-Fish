/**
 * Claim-flow viewmodel — book choices and the 6-card × team-seats matrix.
 * RULES.md §3: assignments cover exactly the six cards, own team only.
 */
import type { BookId, Card, PublicState, Seat } from '../../lib/engine/index.ts'
import { ALL_BOOKS, bookCards, seatTeam, teamSeats } from '../../lib/engine/index.ts'
import { bookLabel } from './format.ts'

export interface ClaimBookOption {
  book: BookId
  label: string
  resolved: boolean
}

/** All 8 books, resolved ones disabled. */
export function claimBookOptions(game: PublicState): ClaimBookOption[] {
  return ALL_BOOKS.map((book) => ({
    book,
    label: bookLabel(book),
    resolved: Boolean(game.books[book]),
  }))
}

/** Claiming is open on my turn in 'playing' or 'endgame' while books remain. */
export function canOpenClaim(game: PublicState, mySeat: Seat): boolean {
  if (game.turn !== mySeat) return false
  if (game.phase !== 'playing' && game.phase !== 'endgame') return false
  return ALL_BOOKS.some((b) => !game.books[b])
}

export interface ClaimMatrixRow {
  card: Card
  /** Preset seat: mine for cards I hold (locked-highlighted but overridable). */
  preset: Seat | null
}

export interface ClaimMatrix {
  book: BookId
  rows: ClaimMatrixRow[]
  /** The three seats of my team — the only legal holders to assign. */
  teamSeats: readonly Seat[]
}

export function buildClaimMatrix(book: BookId, mySeat: Seat, hand: readonly Card[]): ClaimMatrix {
  const held = new Set(hand)
  return {
    book,
    rows: bookCards(book).map((card) => ({ card, preset: held.has(card) ? mySeat : null })),
    teamSeats: teamSeats(seatTeam(mySeat)),
  }
}

export type ClaimAssignments = Partial<Record<Card, Seat>>

/** A claim may be submitted only when every one of the book's 6 cards is assigned. */
export function claimComplete(matrix: ClaimMatrix, assignments: ClaimAssignments): boolean {
  return matrix.rows.every((row) => assignments[row.card] !== undefined)
}

/** Number of still-unassigned cards (for the "N to place" hint). */
export function claimMissingCount(matrix: ClaimMatrix, assignments: ClaimAssignments): number {
  return matrix.rows.filter((row) => assignments[row.card] === undefined).length
}

/** Narrow a complete partial record into the payload the server expects. */
export function toClaimPayload(matrix: ClaimMatrix, assignments: ClaimAssignments): Record<Card, Seat> | null {
  if (!claimComplete(matrix, assignments)) return null
  const out: Partial<Record<Card, Seat>> = {}
  for (const row of matrix.rows) out[row.card] = assignments[row.card]
  return out as Record<Card, Seat>
}
