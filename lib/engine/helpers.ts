/**
 * Legal-move enumeration helpers (used by UI, bots, and the fuzzer's policy).
 */
import type { Card, GameState, Phase, RulesConfig, Seat } from './types.ts'
import { ALL_BOOKS, ALL_CARDS, ALL_SEATS, cardBook, seatTeam } from './cards.ts'

/**
 * Every legal ask for `seat`: [] unless it is that seat's turn in 'playing'.
 * A seat can legally hold cards yet have zero legal asks (hand is a union of
 * complete books) — this simply returns [] in that case.
 */
export function legalAsks(s: GameState, seat: Seat): { target: Seat; card: Card }[] {
  if (s.phase !== 'playing' || s.turn !== seat) return []
  const hand = s.hands[seat]
  if (hand.length === 0) return []
  const myBooks = new Set(hand.map(cardBook))
  const held = new Set(hand)
  const allowOwn = s.config.toggles.askOwnCardAllowed
  const askable = ALL_CARDS.filter((c) => myBooks.has(cardBook(c)) && (allowOwn || !held.has(c)))
  const out: { target: Seat; card: Card }[] = []
  for (const target of ALL_SEATS) {
    if (seatTeam(target) === seatTeam(seat) || s.hands[target].length === 0) continue
    for (const card of askable) out.push({ target, card })
  }
  return out
}

/**
 * The public-data subset a viewer needs to enumerate its own legal asks.
 * `seatView(state, seat)` satisfies this structurally.
 */
export interface AskableView {
  seat: Seat
  hand: readonly Card[]
  counts: readonly number[]
  phase: Phase
  turn: Seat
  config: RulesConfig
}

/**
 * legalAsks computed from a seat view alone (own hand + public counts/phase/turn).
 * Produces exactly the same list, in the same order, as `legalAsks(state, seat)`
 * for the state the view was projected from — a bot holding only a SeatView can
 * therefore enumerate asks without ever touching hidden hands.
 */
export function legalAsksFromView(v: AskableView): { target: Seat; card: Card }[] {
  if (v.phase !== 'playing' || v.turn !== v.seat) return []
  if (v.hand.length === 0) return []
  const myBooks = new Set(v.hand.map(cardBook))
  const held = new Set(v.hand)
  const allowOwn = v.config.toggles.askOwnCardAllowed
  const askable = ALL_CARDS.filter((c) => myBooks.has(cardBook(c)) && (allowOwn || !held.has(c)))
  const out: { target: Seat; card: Card }[] = []
  for (const target of ALL_SEATS) {
    if (seatTeam(target) === seatTeam(v.seat) || v.counts[target] === 0) continue
    for (const card of askable) out.push({ target, card })
  }
  return out
}

/**
 * Which action kinds are available to the seat whose move it is.
 * In 'playing', 'ask' appears only when at least one legal ask exists;
 * 'claim' appears whenever an unresolved book remains (always, pre-finish).
 */
export function legalActionsSummary(s: GameState): { seat: Seat; kinds: ('ask' | 'claim' | 'pass' | 'designate')[] } {
  const seat = s.turn
  const kinds: ('ask' | 'claim' | 'pass' | 'designate')[] = []
  switch (s.phase) {
    case 'playing': {
      if (legalAsks(s, seat).length > 0) kinds.push('ask')
      if (ALL_BOOKS.some((b) => !s.books[b])) kinds.push('claim')
      break
    }
    case 'endgame':
      kinds.push('claim')
      break
    case 'awaitPass':
      kinds.push('pass')
      break
    case 'awaitDesignate':
      kinds.push('designate')
      break
    case 'finished':
      break
  }
  return { seat, kinds }
}
