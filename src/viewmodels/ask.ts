/**
 * Ask-flow options — legality comes from the engine's own
 * `legalAsksFromView` (public info + own hand, mirrors RULES.md §2); this
 * module shapes that into target/book/card picker structures for the sheet.
 */
import type { BookId, Card, PublicState, Seat } from '../../lib/engine/index.ts'
import { ALL_SEATS, bookCards, cardBook, legalAsksFromView, seatTeam, sortHand } from '../../lib/engine/index.ts'
import { bookLabel } from './format.ts'

export interface AskTargetOption {
  seat: Seat
  /** Opponents only appear in the list; disabled when they hold no cards. */
  enabled: boolean
  count: number
}

export interface AskBookOption {
  book: BookId
  label: string
  /** Cards of this book I hold (shown as context in the picker). */
  held: Card[]
  /** Disabled when the book has no askable card (I hold all six). */
  enabled: boolean
}

export interface AskOptions {
  /** False unless at least one legal ask exists right now (RULES.md §2). */
  canAsk: boolean
  reason: string | null
  targets: AskTargetOption[]
  books: AskBookOption[]
  /** Askable cards of each listed book (excludes cards I hold, per rules). */
  cardsByBook: Partial<Record<BookId, Card[]>>
}

export function buildAskOptions(game: PublicState, mySeat: Seat, hand: readonly Card[]): AskOptions {
  const empty: AskOptions = { canAsk: false, reason: null, targets: [], books: [], cardsByBook: {} }
  if (game.phase !== 'playing') return { ...empty, reason: 'Asking is only possible during play.' }
  if (game.turn !== mySeat) return { ...empty, reason: 'Wait for your turn.' }
  if (hand.length === 0) return { ...empty, reason: 'You are out of cards.' }

  const legal = legalAsksFromView({
    seat: mySeat,
    hand,
    counts: game.counts,
    phase: game.phase,
    turn: game.turn,
    config: game.config,
  })

  const myTeam = seatTeam(mySeat)
  const targets: AskTargetOption[] = ALL_SEATS.filter((s) => seatTeam(s) !== myTeam).map((seat) => ({
    seat,
    enabled: (game.counts[seat] ?? 0) > 0,
    count: game.counts[seat] ?? 0,
  }))

  const held = new Set(hand)
  const allowOwn = game.config.toggles.askOwnCardAllowed
  const myBooks: BookId[] = []
  for (const card of sortHand(hand)) {
    const book = cardBook(card)
    if (!myBooks.includes(book)) myBooks.push(book)
  }

  const cardsByBook: Partial<Record<BookId, Card[]>> = {}
  const books: AskBookOption[] = myBooks.map((book) => {
    const askable = bookCards(book).filter((c) => allowOwn || !held.has(c))
    cardsByBook[book] = askable
    return {
      book,
      label: bookLabel(book),
      held: bookCards(book).filter((c) => held.has(c)),
      enabled: askable.length > 0,
    }
  })

  if (legal.length > 0) return { canAsk: true, reason: null, targets, books, cardsByBook }
  const reason = targets.some((t) => t.enabled)
    ? 'You hold complete half-suits only — nothing left to ask for. Claim instead.'
    : 'No opponent has any cards left.'
  return { canAsk: false, reason, targets, books, cardsByBook }
}
