/**
 * Coach overlay (SPEC.md §8.6) — rendered only when the room URL carries
 * ?coach=1 and it is the viewer's turn in a playing phase. Top 3 ranked asks
 * (reasons + refined hit %) and a "certain claim available" banner, computed
 * CLIENT-SIDE from the viewer's own seat view (public log + own hand only).
 * Purely additive: docks below the log; collapsed by default on mobile.
 */
import { useMemo, useState } from 'react'
import type { Card, PublicState, Seat, SeatView } from '../../lib/engine/index.ts'
import { buildCoachAdvice } from '../drills/coach.ts'
import { bookLabel, cardLabel } from '../viewmodels/format.ts'
import styles from './CoachPanel.module.css'

interface CoachPanelProps {
  game: PublicState
  mySeat: Seat
  hand: readonly Card[]
  nameOf: (seat: Seat) => string
}

export function CoachPanel({ game, mySeat, hand, nameOf }: CoachPanelProps) {
  // Collapsed by default on mobile (stacked layout), open on desktop.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
    return window.matchMedia('(min-width: 1024px)').matches
  })

  const advice = useMemo(() => {
    const view: SeatView = { ...game, seat: mySeat, hand: [...hand] }
    return buildCoachAdvice(view)
  }, [game, mySeat, hand])

  return (
    <section className={styles.panel} data-testid="coach-panel">
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.headWord}>Coach</span>
        <span className={styles.headSub}>from your view only</span>
        <span className={styles.chevron} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div className={styles.body}>
          {advice.certainBook !== null ? (
            <p className={styles.claimBanner}>
              Certain claim available: <b>{bookLabel(advice.certainBook)}</b> — every card is placed on your team.
            </p>
          ) : null}
          {advice.asks.length > 0 ? (
            <ol className={styles.asks}>
              {advice.asks.map((a, i) => (
                <li key={`${a.card}-${a.target}`} className={styles.ask}>
                  <span className={styles.askRank}>{i + 1}</span>
                  <span className={styles.askMain}>
                    <span className={styles.askLine}>
                      Ask {nameOf(a.target)} (P{a.target}) for {cardLabel(a.card)}
                      <span className={styles.askPct}>{a.pct}%</span>
                    </span>
                    <span className={styles.askReason}>{a.reason}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : advice.certainBook === null ? (
            <p className={styles.none}>No asks to rank right now — claiming is the move.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
