/**
 * bots.ts — Phase-2 placeholder bot (PROTOCOL.md §8).
 *
 * Phase 3 replaces the internals with the inference engine but keeps the
 * signature: decide(view, difficulty, seed) -> GameAction. The bot sees ONLY a
 * SeatView (public state + its own hand) — hidden hands are unreachable by
 * construction — and is fully deterministic via a mulberry32 PRNG over `seed`.
 */
import {
  ALL_BOOKS,
  bookCards,
  legalAsksFromView,
  mulberry32,
  randInt,
  seatTeam,
  teamSeats,
} from '../lib/engine/index.ts'
import type { Card, GameAction, PublicState, Seat } from '../lib/engine/index.ts'
import type { BotDifficulty } from './deps.ts'

/** What a seated player (human client or bot) is allowed to know. */
export type SeatView = PublicState & { seat: Seat; hand: Card[] }

/** All-cards-to-me claim of `book` by `seat`. */
function claimAllSelf(seat: Seat, book: (typeof ALL_BOOKS)[number]): GameAction {
  const assignments = {} as Record<Card, Seat>
  for (const c of bookCards(book)) assignments[c] = seat
  return { type: 'claim', seat, book, assignments }
}

/**
 * Deterministic placeholder policy:
 * - awaitPass / awaitDesignate: first legal choice.
 * - endgame: claim a seeded-random unresolved book, all cards assigned to self.
 * - playing: claim a book fully contained in own hand if any (correctly, all to
 *   self); else a seeded-random legal ask; if no legal ask exists, claim the
 *   book we hold the most cards of — own cards to self, missing cards to a
 *   seeded-random teammate.
 */
export function decide(view: SeatView, difficulty: BotDifficulty, seed: number): GameAction {
  void difficulty // Phase-2 placeholder plays one policy; Phase 3 branches on it.
  const rng = mulberry32(seed >>> 0)
  const seat = view.seat
  const team = seatTeam(seat)
  switch (view.phase) {
    case 'awaitPass': {
      const mates = teamSeats(team).filter((s) => s !== seat)
      const to = mates.find((s) => view.counts[s] > 0) ?? mates[0]
      return { type: 'pass', seat, to }
    }
    case 'awaitDesignate': {
      const opponents = teamSeats(team === 0 ? 1 : 0)
      const to = opponents.find((s) => view.counts[s] > 0) ?? opponents[0]
      return { type: 'designate', seat, to }
    }
    case 'endgame': {
      const unresolved = ALL_BOOKS.filter((b) => !view.books[b])
      return claimAllSelf(seat, unresolved[randInt(rng, unresolved.length)])
    }
    case 'playing': {
      const held = new Set(view.hand)
      const complete = ALL_BOOKS.find(
        (b) => !view.books[b] && bookCards(b).every((c) => held.has(c)),
      )
      if (complete !== undefined) return claimAllSelf(seat, complete)
      const asks = legalAsksFromView(view)
      if (asks.length > 0) {
        const a = asks[randInt(rng, asks.length)]
        return { type: 'ask', seat, target: a.target, card: a.card }
      }
      // Hand is a union of partial books with no askable card: claim the book we
      // hold the most of, guessing missing cards onto seeded-random teammates.
      const unresolved = ALL_BOOKS.filter((b) => !view.books[b])
      let best = unresolved[0]
      let bestHeld = -1
      for (const b of unresolved) {
        const n = bookCards(b).filter((c) => held.has(c)).length
        if (n > bestHeld) {
          best = b
          bestHeld = n
        }
      }
      const mates = teamSeats(team).filter((s) => s !== seat)
      const assignments = {} as Record<Card, Seat>
      for (const c of bookCards(best)) {
        assignments[c] = held.has(c) ? seat : mates[randInt(rng, mates.length)]
      }
      return { type: 'claim', seat, book: best, assignments }
    }
    case 'finished':
      // Unreachable through the bot chain (it never runs on a finished game);
      // return an action the reducer will reject rather than throwing.
      return { type: 'pass', seat, to: seat }
  }
}
