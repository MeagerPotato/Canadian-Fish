/**
 * Types for the deterministic knowledge-state inference bots (SPEC.md §5).
 *
 * Everything here is defined over the PUBLIC seat view only. SeatView is
 * declared structurally (PublicState + own seat + own hand) rather than as
 * ReturnType<typeof seatView> so this module never imports a GameState-consuming
 * function — the type is identical to what `seatView(state, seat)` returns and
 * to the payload `GET /api/state` sends a human client.
 */
import type { Card, PublicState, Seat } from '../types.ts'

/** Exactly what a seated player (human client or bot) is allowed to know. */
export type SeatView = PublicState & { seat: Seat; hand: Card[] }

export type BotDifficulty = 'easy' | 'medium' | 'hard'

/**
 * A positive set-constraint over deal-time holdings: `seat` was dealt at least
 * one of `cards`. Constraints are recorded against deal-time card variables
 * (see knowledge.ts), so they never need rewriting when cards later move —
 * a disjunct simply dies when its card is proven dealt elsewhere, and the
 * whole constraint is dropped once satisfied or exhausted.
 */
export interface KnowledgeConstraint {
  seat: Seat
  cards: Card[]
}

/**
 * The rebuilt knowledge state — a plain serializable object queried through
 * the pure functions holderOf / candidates / certainCards (knowledge.ts).
 * All fields describe the CURRENT position (post-log, post-own-hand).
 */
export interface Knowledge {
  /** Perspective seat (the viewer). */
  seat: Seat
  /** Current hand sizes, copied from the public counts. */
  counts: number[]
  /** Live card -> its certainly-known current holder. */
  holders: Partial<Record<Card, Seat>>
  /** Live card -> current candidate holders, ascending (singleton == certain). */
  cands: Partial<Record<Card, Seat[]>>
  /** Cards removed from play by resolved claims (no holder, no candidates). */
  gone: Card[]
  /**
   * Per seat: cards in that hand not yet individually identified
   * (counts[s] minus the certainly-located cards at s), clamped >= 0.
   */
  unknownSlots: number[]
  /** Surviving unsatisfied at-least-one-of constraints (for drills/inspection). */
  constraints: KnowledgeConstraint[]
}

/** Options for buildKnowledge — used by the easy tier's degraded memory. */
export interface KnowledgeOptions {
  /** Only the last N log events are read (easy: 6). Default: whole log. */
  logWindow?: number
  /** Record ask set-constraints. Easy sets false (direct facts only). Default: true. */
  useConstraints?: boolean
}

/** One scored legal ask, for the bot itself and for the Phase-4 coach overlay. */
export interface RankedAsk {
  target: Seat
  card: Card
  /** 0..100-ish; certain hits always outrank everything else. */
  score: number
  /** Human-readable justification (coach overlay displays this verbatim). */
  reason: string
}
