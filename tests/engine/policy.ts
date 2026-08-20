/**
 * Random-play policy shared by the fuzz and determinism tests.
 * It may read the true state to build actions (the tests' assertions use only
 * engine results), and it only ever emits legal actions.
 */
import {
  ALL_BOOKS,
  bookCards,
  legalAsks,
  randInt,
  seatTeam,
  teamSeats,
} from '../../lib/engine/index.ts'
import type { Card, GameAction, GameState, Seat } from '../../lib/engine/index.ts'

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[randInt(rng, items.length)]
}

function randomClaim(state: GameState, rng: () => number): GameAction {
  const seat = state.turn
  const unresolved = ALL_BOOKS.filter((b) => !state.books[b])
  const book = pick(unresolved, rng)
  const team = teamSeats(seatTeam(seat))
  // 50% informed (true holders for own-team cards -> correct/opponent outcomes),
  // 50% uniform over the claimer's team (-> exercises voids).
  const informed = rng() < 0.5
  const assignments = {} as Record<Card, Seat>
  for (const c of bookCards(book)) {
    if (informed) {
      const holder = state.hands.findIndex((h) => h.includes(c)) as Seat
      assignments[c] = seatTeam(holder) === seatTeam(seat) ? holder : pick(team, rng)
    } else {
      assignments[c] = pick(team, rng)
    }
  }
  return { type: 'claim', seat, book, assignments }
}

/** One legal action for the current state under the random policy. */
export function policyAction(state: GameState, rng: () => number): GameAction {
  const seat = state.turn
  switch (state.phase) {
    case 'awaitPass': {
      const targets = teamSeats(seatTeam(seat)).filter((t) => state.hands[t].length > 0)
      return { type: 'pass', seat, to: pick(targets, rng) }
    }
    case 'awaitDesignate': {
      const opponents = teamSeats(seatTeam(seat) === 0 ? 1 : 0).filter((t) => state.hands[t].length > 0)
      return { type: 'designate', seat, to: pick(opponents, rng) }
    }
    case 'endgame':
      return randomClaim(state, rng)
    case 'playing': {
      const asks = legalAsks(state, seat)
      const p = Math.min(0.02 + state.moveIndex / 1500, 0.6)
      if (asks.length === 0 || rng() < p) return randomClaim(state, rng)
      const a = pick(asks, rng)
      return { type: 'ask', seat, target: a.target, card: a.card }
    }
    case 'finished':
      throw new Error('policyAction called on a finished game')
  }
}
