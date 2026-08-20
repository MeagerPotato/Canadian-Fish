/**
 * Seeded shuffle + deal. RULES.md row 4: all 48 dealt, 8 per player.
 */
import type { Card } from './types.ts'
import { ALL_CARDS, sortHand } from './cards.ts'
import { randInt, rngFromSeed } from './rng.ts'

/** Fisher-Yates shuffle (new array; input untouched). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/**
 * Deal all 48 cards round-robin into 6 hands of 8, each hand canonically sorted.
 * Deterministic: same seed => byte-identical hands.
 */
export function dealHands(seed: string): Card[][] {
  const deck = shuffle(ALL_CARDS, rngFromSeed(seed))
  const hands: Card[][] = [[], [], [], [], [], []]
  deck.forEach((c, i) => hands[i % 6].push(c))
  return hands.map(sortHand)
}
