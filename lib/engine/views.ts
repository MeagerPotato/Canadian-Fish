/**
 * Read-only projections. publicView never exposes any hand card identity;
 * seatView adds exactly the viewer's own hand.
 */
import type { Card, GameState, PublicState, Seat } from './types.ts'

/** The shared public table state: counts, score, resolved books, log — no hands. */
export function publicView(s: GameState): PublicState {
  return {
    phase: s.phase,
    turn: s.turn,
    counts: s.hands.map((h) => h.length),
    score: [s.score[0], s.score[1]],
    books: s.books,
    log: s.log,
    moveIndex: s.moveIndex,
    config: s.config,
  }
}

/** Public state plus the viewing seat's own hand (a copy). */
export function seatView(s: GameState, seat: Seat): PublicState & { seat: Seat; hand: Card[] } {
  return {
    ...publicView(s),
    seat,
    hand: [...s.hands[seat]],
  }
}
