/**
 * Test-only helpers for crafting exact game states.
 * The engine never force-sets hands; only tests do, via these utilities.
 */
import type { Card, GameState, Seat } from '../../lib/engine/index.ts'
import { ALL_CARDS, newGame, sortHand } from '../../lib/engine/index.ts'

/** Build a claim-assignments record from pairs (Record<Card, Seat> without exhaustive-key friction). */
export function asg(pairs: [Card, Seat][]): Record<Card, Seat> {
  return Object.fromEntries(pairs) as Record<Card, Seat>
}

/**
 * Distribute all 48 cards: the named cards go to their seats, every remaining card
 * goes round-robin over `rest` (pass fewer seats to leave the others exactly as specified).
 */
export function distribute(spec: Partial<Record<Seat, Card[]>>, rest: readonly Seat[] = [0, 1, 2, 3, 4, 5]): Card[][] {
  const hands: Card[][] = [[], [], [], [], [], []]
  const placed = new Set<Card>()
  for (const [seatStr, cards] of Object.entries(spec)) {
    const seat = Number(seatStr) as Seat
    for (const c of cards ?? []) {
      hands[seat].push(c)
      placed.add(c)
    }
  }
  let i = 0
  for (const c of ALL_CARDS) {
    if (placed.has(c)) continue
    if (rest.length > 0) hands[rest[i % rest.length]].push(c)
    i++
  }
  return hands.map(sortHand)
}

/** A fresh game with force-set hands (canonically sorted) and any extra field overrides. */
export function forceState(hands: Card[][], patch: Partial<GameState> = {}): GameState {
  const base = newGame('crafted-test-state')
  return { ...base, hands: hands.map(sortHand), ...patch }
}

/** Recursively freeze a state so any attempted mutation inside reduce would throw. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}
