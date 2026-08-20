/**
 * /practice — the drill hub (SPEC.md §8). Six cards: name, blurb, personal
 * best. Fully keyboard-driven: keys 1-6 open a drill, tab/enter work as
 * usual; every card is a ≥44px Link.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { DRILLS, drillPath } from '../drills/index.ts'
import { loadPB } from '../drills/pb.ts'
import styles from './Practice.module.css'

export default function Practice() {
  const navigate = useNavigate()
  // PBs are read once per mount — returning from a drill remounts the hub.
  const [bests] = useState<Record<string, number | null>>(() => {
    const out: Record<string, number | null> = {}
    for (const d of DRILLS) out[d.id] = d.hasPB ? loadPB(d.id) : null
    return out
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const drill = DRILLS.find((d) => d.hotkey === e.key)
      if (drill) {
        e.preventDefault()
        navigate(drillPath(drill.id))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <AppShell active="practice">
      <h1 className={styles.title}>
        Practice <span className={styles.accent}>drills</span>
      </h1>
      <p className={styles.lede}>
        Six fast, keyboard-driven exercises — each round under a minute, scored, with a personal best kept on this
        device. Press a drill&rsquo;s number to jump in.
      </p>
      <div className={styles.grid} data-testid="drill-hub">
        {DRILLS.map((d) => {
          const pb = bests[d.id]
          return (
            <Link key={d.id} to={drillPath(d.id)} className={styles.card} data-testid={`drill-${d.id}`}>
              <span className={styles.cardKey}>{d.hotkey}</span>
              <span className={styles.cardBody}>
                <span className={styles.cardName}>{d.name}</span>
                <span className={styles.cardBlurb}>{d.blurb}</span>
              </span>
              <span className={styles.cardBest}>
                {d.hasPB ? (
                  pb !== null ? (
                    <>
                      <span className={styles.bestLabel}>best</span>
                      <span className={styles.bestValue}>{pb}</span>
                    </>
                  ) : (
                    <span className={styles.bestNone}>not played</span>
                  )
                ) : (
                  <span className={styles.bestNone}>live table</span>
                )}
              </span>
            </Link>
          )
        })}
      </div>
      <p className={styles.footNote}>
        Every drill: Enter starts, Esc backs out, number and arrow keys drive the round. Scores live only in this
        browser.
      </p>
    </AppShell>
  )
}
