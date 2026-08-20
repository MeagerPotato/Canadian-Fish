/**
 * Drill 3 — Deduction (SPEC.md §8.3). Pure generator + scorer.
 *
 * Each question replays the public log of a seeded medium-bot game prefix,
 * then asks who holds a specific card — one whose holder is CERTAIN from the
 * public record alone (no hand). Question tiers, hardest preferred:
 *   'constraint' — certainty needs the ask set-constraints ("they asked into
 *                  that book, so they were dealt one of it") propagated;
 *   'direct'     — certain from direct facts (miss eliminations + public
 *                  count exhaustion), never revealed by a hit;
 *   'hit'        — the card publicly changed hands (last resort).
 * Later questions replay longer prefixes (harder).
 */
import type { Card, GameState, PublicEvent, PublicState, Seat } from '../../lib/engine/index.ts'
import {
  ALL_CARDS,
  buildKnowledge,
  cardBook,
  holderOf,
  newGame,
  randInt,
  reduce,
  rngFromSeed,
} from '../../lib/engine/index.ts'
import type { Knowledge } from '../../lib/engine/index.ts'
import { bookLabel, cardLabel } from '../viewmodels/format.ts'
import { botAction, simulate } from './sim.ts'

export const DEDUCTION_QUESTIONS_PER_ROUND = 3
/** Bot actions replayed per question — later questions are longer/harder. */
export const DEDUCTION_PREFIX_STEPS: readonly number[] = [10, 16, 24]

export type DeductionTier = 'constraint' | 'direct' | 'hit'

/**
 * Knowledge derivable from PUBLIC information alone — log + counts, no hand.
 *
 * buildKnowledge wants a SeatView; a real seat with an empty hand would be a
 * lie (the builder would inject "seat s holds nothing" facts). Seat 6 is a
 * phantom observer: every bitmask in the builder covers seats 0-5 only
 * (FULL_MASK = 0b111111), so clearing/fixing "seat 6" is a structural no-op
 * and the propagation loops (which iterate seats 0-5) never touch it. The
 * result is exactly the fixpoint over the public facts. Soundness is pinned
 * by tests/drills/deduction.test.ts against ground truth over 50 seeds.
 */
export function publicKnowledge(pub: PublicState): Knowledge {
  const observer = 6 as unknown as Seat
  return buildKnowledge({ ...pub, seat: observer, hand: [] })
}

function publicKnowledgeDirect(pub: PublicState): Knowledge {
  const observer = 6 as unknown as Seat
  return buildKnowledge({ ...pub, seat: observer, hand: [] }, { useConstraints: false })
}

export interface DeductionQuestion {
  /** Sub-seed of the simulated game (deterministic replay). */
  gameSeed: string
  /** The public log shown to the player. */
  log: PublicEvent[]
  /** Public hand sizes at the quiz position. */
  counts: number[]
  card: Card
  /** True holder — always equal to the publicly-certain holder. */
  answer: Seat
  tier: DeductionTier
  /** Templated "why" lines shown after answering. */
  explanation: string[]
}

export interface DeductionRound {
  seed: string
  questions: DeductionQuestion[]
}

/** Points per correct answer, by how deep the inference had to go. */
export function deductionPoints(tier: DeductionTier): number {
  switch (tier) {
    case 'constraint':
      return 3
    case 'direct':
      return 2
    case 'hit':
      return 1
  }
}

interface Candidate {
  card: Card
  holder: Seat
  tier: DeductionTier
}

const TIER_RANK: Record<DeductionTier, number> = { constraint: 0, direct: 1, hit: 2 }

/** Cards that ever publicly changed hands via a hit (trivially locatable). */
function hitRevealedCards(log: readonly PublicEvent[]): Set<Card> {
  const out = new Set<Card>()
  for (const ev of log) if (ev.type === 'ask' && ev.hit) out.add(ev.card)
  return out
}

/** All publicly-certain live cards at this state, tiered. */
function scanCandidates(state: GameState): Candidate[] {
  const pub = statePublic(state)
  const k = publicKnowledge(pub)
  const kDirect = publicKnowledgeDirect(pub)
  const hits = hitRevealedCards(pub.log)
  const out: Candidate[] = []
  for (const card of ALL_CARDS) {
    const holder = holderOf(k, card)
    if (holder === null) continue
    // Ground-truth guard: only ever ask a card the engine agrees about.
    if (!state.hands[holder].includes(card)) continue
    const tier: DeductionTier =
      holderOf(kDirect, card) === null ? 'constraint' : hits.has(card) ? 'hit' : 'direct'
    out.push({ card, holder, tier })
  }
  return out
}

function statePublic(state: GameState): PublicState {
  // publicView shape without importing views (keep the dependency light):
  return {
    phase: state.phase,
    turn: state.turn,
    counts: state.hands.map((h) => h.length),
    score: [state.score[0], state.score[1]],
    books: state.books,
    log: state.log,
    moveIndex: state.moveIndex,
    config: state.config,
  }
}

function bestTier(cands: readonly Candidate[]): Candidate[] {
  if (cands.length === 0) return []
  let best = 3
  for (const c of cands) best = Math.min(best, TIER_RANK[c.tier])
  return cands.filter((c) => TIER_RANK[c.tier] === best)
}

/** Deterministic guaranteed-hit fallback (probability ~0 of being needed). */
function fallbackQuestion(gameSeed: string): { state: GameState; pick: Candidate } | null {
  const { state } = simulate(gameSeed, () => false, 4)
  const cands = scanCandidates(state)
  if (cands.length > 0) return { state, pick: cands[0] }
  // Force one public hit by replaying until the first hit lands.
  let s = state
  for (let i = 0; i < 200; i++) {
    const a = botAction(s)
    if (a === null) break
    const r = reduce(s, a)
    if (!r.ok) break
    s = r.state
    const cs = scanCandidates(s)
    if (cs.length > 0) return { state: s, pick: cs[0] }
  }
  return null
}

/** How far past the target prefix a search may extend hunting for depth. */
const SEARCH_EXTRA_STEPS = 48
const SEARCH_ATTEMPTS = 8

interface SearchHit {
  gameSeed: string
  state: GameState
  /** Top-tier candidates at that position. */
  top: Candidate[]
  tierRank: number
}

/**
 * Walk one seeded game to `target` actions, then keep stepping (up to
 * SEARCH_EXTRA_STEPS) scanning every position: return the deepest-inference
 * question available — the first 'constraint' position, else the first
 * 'direct', else the first 'hit'.
 */
function searchGame(gameSeed: string, target: number): SearchHit | null {
  let state = newGame(gameSeed)
  for (let i = 0; i < target && state.phase !== 'finished'; i++) {
    const a = botAction(state)
    if (a === null) break
    const r = reduce(state, a)
    if (!r.ok) break
    state = r.state
  }
  let best: SearchHit | null = null
  for (let ext = 0; ext <= SEARCH_EXTRA_STEPS; ext++) {
    const cands = scanCandidates(state)
    if (cands.length > 0) {
      const top = bestTier(cands)
      const tierRank = TIER_RANK[top[0].tier]
      if (tierRank === 0) return { gameSeed, state, top, tierRank } // constraint: done
      if (best === null || tierRank < best.tierRank) best = { gameSeed, state, top, tierRank }
    }
    if (state.phase === 'finished') break
    const a = botAction(state)
    if (a === null) break
    const r = reduce(state, a)
    if (!r.ok) break
    state = r.state
  }
  return best
}

export function generateDeductionRound(seed: string, questionCount = DEDUCTION_QUESTIONS_PER_ROUND): DeductionRound {
  const questions: DeductionQuestion[] = []
  for (let q = 0; q < questionCount; q++) {
    const target = DEDUCTION_PREFIX_STEPS[Math.min(q, DEDUCTION_PREFIX_STEPS.length - 1)]
    // Prefer the deepest inference reachable across a few seeded games.
    let best: SearchHit | null = null
    for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt++) {
      const found = searchGame(`${seed}:q${q}:t${attempt}`, target)
      if (found !== null && (best === null || found.tierRank < best.tierRank)) best = found
      if (best !== null && best.tierRank === 0) break // constraint tier found
    }
    let made: DeductionQuestion | null = null
    if (best !== null) {
      const rng = rngFromSeed(`${best.gameSeed}:pick`)
      const pick = best.top[randInt(rng, best.top.length)]
      made = toQuestion(best.gameSeed, best.state, pick)
    } else {
      const fb = fallbackQuestion(`${seed}:q${q}:fb`)
      if (fb !== null) made = toQuestion(`${seed}:q${q}:fb`, fb.state, fb.pick)
    }
    if (made !== null) questions.push(made)
  }
  return { seed, questions }
}

function toQuestion(gameSeed: string, state: GameState, pick: Candidate): DeductionQuestion {
  const pub = statePublic(state)
  return {
    gameSeed,
    log: [...pub.log],
    counts: [...pub.counts],
    card: pick.card,
    answer: pick.holder,
    tier: pick.tier,
    explanation: explainCertainty(pub, pick.card, pick.holder, pick.tier),
  }
}

/* ------------------------------------------------------------ explanation --- */

/**
 * A short templated "why" from the public facts (SPEC allows a simple
 * templated explanation from the final Knowledge object).
 */
export function explainCertainty(pub: PublicState, card: Card, holder: Seat, tier: DeductionTier): string[] {
  const lines: string[] = []
  const label = cardLabel(card)

  if (tier === 'hit') {
    let last: { asker: Seat; target: Seat } | null = null
    for (const ev of pub.log) {
      if (ev.type === 'ask' && ev.hit && ev.card === card) last = { asker: ev.asker, target: ev.target }
    }
    if (last !== null) {
      lines.push(`P${last.asker} took ${label} from P${last.target} with a hit — public, and it never moved again.`)
      lines.push(`So ${label} sits with P${holder}.`)
      return lines
    }
  }

  // Direct miss facts about this card (most recent two).
  const misses: string[] = []
  for (const ev of pub.log) {
    if (ev.type === 'ask' && !ev.hit && ev.card === card) {
      misses.push(`P${ev.asker} asked P${ev.target} for ${label} — no: at that moment neither of them held it.`)
    }
  }
  lines.push(...misses.slice(-2))

  if (tier === 'constraint') {
    const book = cardBook(card)
    let proof: { asker: Seat; card: Card } | null = null
    for (const ev of pub.log) {
      if (ev.type === 'ask' && ev.asker === holder && ev.card !== card && cardBook(ev.card) === book) {
        proof = { asker: ev.asker, card: ev.card }
      }
    }
    if (proof !== null) {
      lines.push(`P${holder} asked for ${cardLabel(proof.card)} — proof they were dealt another ${bookLabel(book)} card.`)
      lines.push(`Every other ${bookLabel(book)} card P${holder} could hold is placed elsewhere — the one left is ${label}.`)
    }
  }

  // Public count exhaustion: seats whose whole hand is accounted for.
  const k = publicKnowledge(pub)
  const exhausted: number[] = []
  for (let s = 0; s < 6; s++) {
    if (s !== holder && (pub.counts[s] ?? 0) > 0 && k.unknownSlots[s] === 0) exhausted.push(s)
  }
  if (exhausted.length > 0) {
    lines.push(`Every card in ${exhausted.map((s) => `P${s}`).join(' and ')}'s hand is publicly accounted for.`)
  }

  lines.push(`The public record rules out every other seat — ${label} must be with P${holder}.`)
  return lines.slice(0, 5)
}
