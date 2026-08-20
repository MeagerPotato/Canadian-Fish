/**
 * Card and book constants + pure helpers. RULES.md rows 1-3.
 */
import type { BookId, Card, Half, Rank, Seat, Suit, Team } from './types.ts'

export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S']
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '9', 'T', 'J', 'Q', 'K', 'A']
export const LOW_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7']
export const HIGH_RANKS: readonly Rank[] = ['9', 'T', 'J', 'Q', 'K', 'A']

/** All 48 cards in canonical order: suit-major (C, D, H, S), then rank (2..7, 9..A). */
export const ALL_CARDS: readonly Card[] = SUITS.flatMap((s) => RANKS.map((r): Card => `${r}${s}`))

/** All 8 books: LOW-C..LOW-S then HIGH-C..HIGH-S. */
export const ALL_BOOKS: readonly BookId[] = (['LOW', 'HIGH'] as const).flatMap((h) =>
  SUITS.map((s): BookId => `${h}-${s}`),
)

const CARD_SET: ReadonlySet<string> = new Set(ALL_CARDS)
const CARD_ORDER: ReadonlyMap<Card, number> = new Map(ALL_CARDS.map((c, i) => [c, i]))

const BOOK_CARDS: ReadonlyMap<BookId, readonly Card[]> = new Map(
  ALL_BOOKS.map((b) => {
    const half = b.startsWith('LOW') ? LOW_RANKS : HIGH_RANKS
    const suit = b.slice(-1) as Suit
    return [b, half.map((r): Card => `${r}${suit}`)]
  }),
)

/** Runtime guard: is this string one of the 48 real cards? */
export function isCard(x: string): x is Card {
  return CARD_SET.has(x)
}

/** The book (half-suit) a card belongs to. */
export function cardBook(c: Card): BookId {
  const half: Half = LOW_RANKS.includes(c[0] as Rank) ? 'LOW' : 'HIGH'
  return `${half}-${c[1] as Suit}`
}

/** The six cards of a book, in canonical rank order. Unknown ids yield []. */
export function bookCards(b: BookId): readonly Card[] {
  return BOOK_CARDS.get(b) ?? []
}

/** Canonical comparison: suit-major, then rank — used to keep hands deterministically sorted. */
export function cardCompare(a: Card, b: Card): number {
  return (CARD_ORDER.get(a) ?? -1) - (CARD_ORDER.get(b) ?? -1)
}

/** Return a new array of the hand in canonical sorted order. */
export function sortHand(hand: readonly Card[]): Card[] {
  return [...hand].sort(cardCompare)
}

/** Teams alternate by seat: 0,2,4 = team 0; 1,3,5 = team 1 (RULES.md row 1). */
export function seatTeam(s: Seat): Team {
  return (s % 2) as Team
}

export const ALL_SEATS: readonly Seat[] = [0, 1, 2, 3, 4, 5]

/** The three seats of a team, ascending. */
export function teamSeats(t: Team): readonly Seat[] {
  return t === 0 ? [0, 2, 4] : [1, 3, 5]
}
