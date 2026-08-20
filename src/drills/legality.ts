/**
 * Drill 2 — Ask legality (SPEC.md §8.2). Pure generator + scorer.
 *
 * Each item shows your hand (seat 0, your turn, phase 'playing') plus a
 * proposed ask; you call Valid / Invalid against a 4 s clock. The generator
 * mixes legal asks with every illegal category of RULES.md §2 that a
 * hand+ask can exhibit, each constructed as a SINGLE violation (every other
 * legality condition holds) so the engine's first-failing-check error code is
 * exactly the labeled one — tests cross-check via `itemState` + reduce().
 */
import type { Card, GameState, Seat } from '../../lib/engine/index.ts'
import {
  ALL_BOOKS,
  ALL_CARDS,
  cardBook,
  dealHands,
  defaultConfig,
  randInt,
  rngFromSeed,
  shuffle,
} from '../../lib/engine/index.ts'

export const LEGALITY_ITEMS_PER_ROUND = 12
export const LEGALITY_ITEM_MS = 4000
/** Answering faster than this earns the speed bonus point. */
export const LEGALITY_FAST_MS = 2000

/** The five RULES.md §2 violations a shown hand + ask can exhibit. */
export type LegalityViolation =
  | 'TARGET_TEAMMATE'
  | 'ASKING_OWN_CARD'
  | 'NO_CARD_OF_BOOK'
  | 'TARGET_OUT'
  | 'INVALID_CARD'

export const LEGALITY_VIOLATIONS: readonly LegalityViolation[] = [
  'TARGET_TEAMMATE',
  'ASKING_OWN_CARD',
  'NO_CARD_OF_BOOK',
  'TARGET_OUT',
  'INVALID_CARD',
]

export interface LegalityItem {
  /** All six hands (you = seat 0) — lets tests rebuild the exact engine state. */
  hands: Card[][]
  /** Your hand (== hands[0]). */
  hand: Card[]
  counts: number[]
  target: Seat
  /** The asked card as text — a real Card except INVALID_CARD items (an 8). */
  cardText: string
  verdict: 'valid' | 'invalid'
  violation: LegalityViolation | null
  /** The rule read-back revealed after answering. */
  rule: string
}

export interface LegalityRound {
  seed: string
  items: LegalityItem[]
}

const OPPONENTS: readonly Seat[] = [1, 3, 5]
const TEAMMATES: readonly Seat[] = [2, 4]

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[randInt(rng, list.length)]
}

/** Cards that would be fully legal to ask holding `hand` (book held, card not). */
function legalAskCards(hand: readonly Card[]): Card[] {
  const held = new Set(hand)
  const myBooks = new Set(hand.map(cardBook))
  return ALL_CARDS.filter((c) => myBooks.has(cardBook(c)) && !held.has(c))
}

interface Built {
  hands: Card[][]
  counts: number[]
  target: Seat
  cardText: string
  rule: string
}

function buildItem(kind: LegalityViolation | 'legal', itemSeed: string): Built {
  // Retry with fresh deals until the category is constructible (only
  // NO_CARD_OF_BOOK can fail, when 8 cards happen to span all 8 books).
  for (let attempt = 0; ; attempt++) {
    const rng = rngFromSeed(`${itemSeed}:a${attempt}`)
    const hands = dealHands(`${itemSeed}:deal${attempt}`)
    const hand = hands[0]
    const counts = hands.map((h) => h.length)
    const askable = legalAskCards(hand)
    const opponent = pick(rng, OPPONENTS)
    switch (kind) {
      case 'legal': {
        const card = pick(rng, askable)
        return {
          hands,
          counts,
          target: opponent,
          cardText: card,
          rule: `Legal: you hold another ${bookName(card)} card, you do not hold ${cardName(card)}, and P${opponent} is an opponent with cards.`,
        }
      }
      case 'TARGET_TEAMMATE': {
        const card = pick(rng, askable)
        const mate = pick(rng, TEAMMATES)
        return {
          hands,
          counts,
          target: mate,
          cardText: card,
          rule: `P${mate} is your teammate — asks may only target opponents (seats 1 · 3 · 5). RULES §1 row 5.`,
        }
      }
      case 'ASKING_OWN_CARD': {
        const card = pick(rng, hand)
        return {
          hands,
          counts,
          target: opponent,
          cardText: card,
          rule: `You hold ${cardName(card)} yourself — you may never ask for a card in your own hand. RULES §1 row 7.`,
        }
      }
      case 'NO_CARD_OF_BOOK': {
        const myBooks = new Set(hand.map(cardBook))
        const missing = ALL_BOOKS.filter((b) => !myBooks.has(b))
        if (missing.length === 0) continue // rare: hand spans all 8 books — redeal
        const book = pick(rng, missing)
        const card = pick(
          rng,
          ALL_CARDS.filter((c) => cardBook(c) === book),
        )
        return {
          hands,
          counts,
          target: opponent,
          cardText: card,
          rule: `You hold no ${bookName(card)} card — every ask must come from a half-suit you hold. RULES §1 row 6.`,
        }
      }
      case 'TARGET_OUT': {
        // Empty one opponent's hand, redistributing to the other two opponents
        // so all 48 cards stay in play and team totals are untouched.
        const others = OPPONENTS.filter((s) => s !== opponent)
        const moved = hands[opponent]
        moved.forEach((c, i) => hands[others[i % 2]].push(c))
        hands[opponent] = []
        const card = pick(rng, askable)
        return {
          hands,
          counts: hands.map((h) => h.length),
          target: opponent,
          cardText: card,
          rule: `P${opponent} has no cards left — a cardless player cannot be asked. RULES §1 row 8.`,
        }
      }
      case 'INVALID_CARD': {
        const suit = pick(rng, ['C', 'D', 'H', 'S'] as const)
        return {
          hands,
          counts,
          target: opponent,
          cardText: `8${suit}`,
          rule: `8${suitGlyph(suit)} is not in this deck — the four 8s are removed; 48 cards only. RULES §1 row 2.`,
        }
      }
    }
  }
}

const GLYPH: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }

function suitGlyph(s: string): string {
  return GLYPH[s] ?? s
}

function cardName(c: string): string {
  const rank = c[0] === 'T' ? '10' : c[0]
  return `${rank}${suitGlyph(c[1])}`
}

function bookName(c: string): string {
  const book = cardBook(c as Card)
  const [half, suit] = book.split('-')
  return `${half} ${suitGlyph(suit)}`
}

export function generateLegalityRound(seed: string, count = LEGALITY_ITEMS_PER_ROUND): LegalityRound {
  // Category schedule: every violation at least once, ~5/12 legal, rest
  // seeded-random violations; seeded shuffle for order.
  const rng = rngFromSeed(`${seed}:schedule`)
  const kinds: (LegalityViolation | 'legal')[] = [...LEGALITY_VIOLATIONS]
  const legalCount = Math.max(1, Math.round(count * 0.42))
  for (let i = 0; i < legalCount; i++) kinds.push('legal')
  while (kinds.length < count) kinds.push(pick(rng, LEGALITY_VIOLATIONS))
  const schedule = shuffle(kinds.slice(0, count), rng)

  const items: LegalityItem[] = schedule.map((kind, idx) => {
    const built = buildItem(kind, `${seed}:i${idx}:${kind}`)
    return {
      hands: built.hands,
      hand: built.hands[0],
      counts: built.counts,
      target: built.target,
      cardText: built.cardText,
      verdict: kind === 'legal' ? 'valid' : 'invalid',
      violation: kind === 'legal' ? null : kind,
      rule: built.rule,
    }
  })
  return { seed, items }
}

/**
 * The exact GameState an item depicts (seat 0 to act, fresh log) — used by
 * tests to cross-check each label against the engine's reduce() error code.
 */
export function itemState(item: LegalityItem): GameState {
  return {
    config: defaultConfig,
    seed: 'legality-drill',
    phase: 'playing',
    turn: 0,
    hands: item.hands.map((h) => [...h]),
    books: {},
    score: [0, 0],
    log: [{ type: 'game_started', startingSeat: 0 }],
    moveIndex: 0,
  }
}

export interface LegalityAnswer {
  /** true = called Valid, false = called Invalid, null = clock ran out. */
  saidValid: boolean | null
  ms: number
}

export interface LegalityScore {
  /** correct − wrong + speedBonus (timeouts lose the point but subtract nothing). */
  score: number
  correct: number
  wrong: number
  missed: number
  speedBonus: number
  bestStreak: number
}

export function scoreLegality(items: readonly LegalityItem[], answers: readonly LegalityAnswer[]): LegalityScore {
  let correct = 0
  let wrong = 0
  let missed = 0
  let speedBonus = 0
  let streak = 0
  let bestStreak = 0
  items.forEach((item, i) => {
    const a = answers[i]
    if (!a || a.saidValid === null) {
      missed++
      streak = 0
      return
    }
    const right = a.saidValid === (item.verdict === 'valid')
    if (right) {
      correct++
      if (a.ms < LEGALITY_FAST_MS) speedBonus++
      streak++
      if (streak > bestStreak) bestStreak = streak
    } else {
      wrong++
      streak = 0
    }
  })
  return { score: correct - wrong + speedBonus, correct, wrong, missed, speedBonus, bestStreak }
}
