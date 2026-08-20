/**
 * Display formatting helpers — pure, shared by viewmodels and components.
 */
import type { BookId, Card, Rank, Seat, Suit, Team } from '../../lib/engine/index.ts'
import { cardBook, seatTeam } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'

export const SUIT_GLYPH: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }

export function cardRank(card: Card): Rank {
  return card[0] as Rank
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

/** Rank as printed on the card face ('T' renders as '10'). */
export function rankLabel(rank: Rank): string {
  return rank === 'T' ? '10' : rank
}

/** Compact card label for log lines and pickers, e.g. "9♥" or "10♦". */
export function cardLabel(card: Card): string {
  return `${rankLabel(cardRank(card))}${SUIT_GLYPH[cardSuit(card)]}`
}

/** Book label, e.g. "LOW ♥". */
export function bookLabel(book: BookId): string {
  const [half, suit] = book.split('-') as [string, Suit]
  return `${half} ${SUIT_GLYPH[suit]}`
}

/** Which book a card belongs to, as its label. */
export function cardBookLabel(card: Card): string {
  return bookLabel(cardBook(card))
}

export function teamLetter(team: Team): 'A' | 'B' {
  return team === 0 ? 'A' : 'B'
}

export function seatTeamLetter(seat: Seat): 'A' | 'B' {
  return teamLetter(seatTeam(seat))
}

/** Display name for a seat: the seated player's name, else "P{n}". */
export function seatName(room: Pick<PublicRoomState, 'seats'> | null, seat: Seat): string {
  const entry = room?.seats[seat]
  if (entry && entry.filled && entry.name) return entry.name
  return `P${seat}`
}

/** A name-lookup closure for the log humanizer. */
export function namesFrom(room: Pick<PublicRoomState, 'seats'> | null): (seat: Seat) => string {
  return (seat) => seatName(room, seat)
}
