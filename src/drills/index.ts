/**
 * Drill registry + shared round types for the /practice suite (SPEC.md §8).
 * Pure data and tiny helpers — generators live in sibling modules (no React
 * anywhere under src/drills/), the UI in src/pages/Practice*.
 */

export type DrillId = 'recall' | 'legality' | 'deduction' | 'claim' | 'counting' | 'game'

export interface DrillMeta {
  id: DrillId
  name: string
  /** Serif-accent split for titles: "Book" + accent "recall". */
  title: [string, string]
  blurb: string
  /** Number key on the hub (1-6). */
  hotkey: string
  /** Drills 1-5 keep a personal best; the full game plays on the live table. */
  hasPB: boolean
}

export const DRILLS: DrillMeta[] = [
  {
    id: 'recall',
    name: 'Book recall',
    title: ['Book', 'recall'],
    blurb: 'Eight cards flash for three seconds. Name every half-suit you saw — and how many of each.',
    hotkey: '1',
    hasPB: true,
  },
  {
    id: 'legality',
    name: 'Ask legality',
    title: ['Ask', 'legality'],
    blurb: 'A hand and a proposed ask. Valid or invalid? Four seconds each, the broken rule revealed after.',
    hotkey: '2',
    hasPB: true,
  },
  {
    id: 'deduction',
    name: 'Deduction',
    title: ['Who holds', 'the 9♥?'],
    blurb: 'Replay a run of public asks, then pin a card to its seat from the record alone.',
    hotkey: '3',
    hasPB: true,
  },
  {
    id: 'claim',
    name: 'Claim trainer',
    title: ['Claim', 'trainer'],
    blurb: 'A mid-game log proves where a whole half-suit sits. Call the claim — one wrong seat voids it.',
    hotkey: '4',
    hasPB: true,
  },
  {
    id: 'counting',
    name: 'Card counting',
    title: ['Card', 'counting'],
    blurb: 'Fifteen asks stream past. Keep the running hand sizes in your head, then name all six counts.',
    hotkey: '5',
    hasPB: true,
  },
  {
    id: 'game',
    name: 'Full game vs bots',
    title: ['Full game', 'vs bots'],
    blurb: 'A real solo room — five house bots at your difficulty, with an optional coach overlay.',
    hotkey: '6',
    hasPB: false,
  },
]

export function drillPath(id: DrillId): string {
  return `/practice/${id}`
}

export function drillMeta(id: string): DrillMeta | null {
  return DRILLS.find((d) => d.id === id) ?? null
}

/** Registry lookup for a known id (drill pages reference their own entry). */
export function requireDrill(id: DrillId): DrillMeta {
  const m = drillMeta(id)
  if (m === null) throw new Error(`unknown drill ${id}`)
  return m
}

/** What a finished round reports to the shell (score, accuracy, speed, streak). */
export interface RoundStats {
  score: number
  /** Accuracy numerator/denominator — drills define the unit. */
  correct: number
  total: number
  /** Paced units in the round (hands/items/questions…) — the speed divisor. */
  items: number
  bestStreak: number
  durationMs: number
}

const SEED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * A readable 6-char round seed. Random on purpose (called from event
 * handlers, never render); everything downstream of the seed is deterministic.
 */
export function newSeed(): string {
  const out: string[] = []
  const cryptoObj = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : null
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(6)
    cryptoObj.getRandomValues(bytes)
    for (const b of bytes) out.push(SEED_ALPHABET[b % SEED_ALPHABET.length])
  } else {
    for (let i = 0; i < 6; i++) out.push(SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)])
  }
  return out.join('')
}
