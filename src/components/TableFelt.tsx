/**
 * The 6-seat felt — fixed 360×300 design size, transform-scaled to fit
 * (DESIGN_NOTES §2 "transform-scale trick"). My seat pinned bottom-center,
 * others spaced 60° apart around the ellipse. Center: the score pill.
 */
import { useEffect, useRef, useState } from 'react'
import type { PublicState, Seat } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'
import { buildTableSeats } from '../viewmodels/table.ts'
import c from './controls.module.css'
import styles from './TableFelt.module.css'

const DESIGN_W = 360
const DESIGN_H = 300

function useTableScale() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    // ResizeObserver fires once on observe(), delivering the initial width.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setScale(Math.min(1, width / DESIGN_W))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { hostRef, scale }
}

interface TableFeltProps {
  room: PublicRoomState
  game: PublicState
  mySeat: Seat
}

export function TableFelt({ room, game, mySeat }: TableFeltProps) {
  const { hostRef, scale } = useTableScale()
  const seats = buildTableSeats(room, game, mySeat)
  return (
    <div ref={hostRef} className={styles.host} style={{ height: `${Math.round(DESIGN_H * scale)}px` }}>
      <div
        className={styles.box}
        style={{ width: `${DESIGN_W}px`, height: `${DESIGN_H}px`, transform: `scale(${scale})` }}
      >
        <div className={styles.rail}>
          <div className={styles.felt}>
            <div className={styles.ring} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.scorePill}>
          <span className={styles.scoreEyebrow}>Books</span>
          <span className={styles.scoreLine}>
            <span className={styles.scoreTeamA}>A</span>
            <span className={styles.scoreValue} data-testid="score-a">
              {game.score[0]}
            </span>
            <span className={styles.scoreDash}>—</span>
            <span className={styles.scoreValue} data-testid="score-b">
              {game.score[1]}
            </span>
            <span className={styles.scoreTeamB}>B</span>
          </span>
        </div>

        {seats.map((s) => (
          <div
            key={s.seat}
            className={[
              styles.chip,
              s.teamLetter === 'A' ? styles.chipA : styles.chipB,
              s.isYou ? styles.chipYou : '',
              !s.connected && !s.isBot && s.filled ? styles.chipGone : '',
              s.out ? styles.chipOut : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${s.leftPct}%`, top: `${s.topPct}%` }}
          >
            {s.isTurn ? <span className={styles.turnRing} aria-hidden="true" /> : null}
            <span className={styles.chipTop}>
              <span className={c.plaque}>
                P{s.seat} · {s.teamLetter}
              </span>
              {s.isBot ? <span className={styles.tag}>bot</span> : null}
              {!s.connected && !s.isBot && s.filled ? <span className={styles.tagGone}>offline</span> : null}
            </span>
            <span className={styles.chipName}>
              {s.name}
              {s.isYou ? <span className={styles.you}> · you</span> : null}
            </span>
            <span className={styles.chipMeta}>
              {s.count > 0 ? (
                <span className={styles.backs} aria-hidden="true">
                  <i className={styles.back1} />
                  <i className={styles.back2} />
                </span>
              ) : (
                <span className={styles.outWord}>out</span>
              )}
              <span className={styles.count}>
                <span data-testid={`count-${s.seat}`}>{s.count}</span>
                <span className={styles.countUnit}> cards</span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
