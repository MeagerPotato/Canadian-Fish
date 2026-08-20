/**
 * Coach overlay viewmodel (SPEC.md §8.6) — computed CLIENT-SIDE from the
 * viewer's own SeatView (public log + own hand; no hidden info exists on the
 * client and none is introduced here). Pure and unit-testable.
 */
import type { BookId, Card, Seat, SeatView } from '../../lib/engine/index.ts'
import {
  ALL_BOOKS,
  bookCards,
  buildKnowledge,
  holderOf,
  rankAsksWith,
  refinedHitProbability,
  seatTeam,
} from '../../lib/engine/index.ts'

export interface CoachAsk {
  target: Seat
  card: Card
  /** Ranked score from the bots' ask evaluator. */
  score: number
  /** Constraint-refined hit probability, 0-100. */
  pct: number
  /** The evaluator's own justification, shown verbatim. */
  reason: string
}

export interface CoachAdvice {
  /** Top asks (up to 3) when it is the viewer's turn in 'playing'. */
  asks: CoachAsk[]
  /**
   * A book whose six cards are all certainly located on the viewer's team
   * (own hand included) — the same certainty the bots' certainClaim uses.
   */
  certainBook: BookId | null
}

export function buildCoachAdvice(view: SeatView): CoachAdvice {
  const k = buildKnowledge(view)
  const myTeam = seatTeam(view.seat)

  let certainBook: BookId | null = null
  for (const b of ALL_BOOKS) {
    if (view.books[b]) continue
    let all = true
    for (const c of bookCards(b)) {
      const h = holderOf(k, c)
      if (h === null || seatTeam(h) !== myTeam) {
        all = false
        break
      }
    }
    if (all) {
      certainBook = b
      break
    }
  }

  const asks: CoachAsk[] =
    view.phase === 'playing' && view.turn === view.seat
      ? rankAsksWith(view, k)
          .slice(0, 3)
          .map((r) => ({
            target: r.target,
            card: r.card,
            score: r.score,
            pct: Math.round(100 * refinedHitProbability(k, r.card, r.target)),
            reason: r.reason,
          }))
      : []

  return { asks, certainBook }
}
