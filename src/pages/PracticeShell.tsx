/**
 * Shared chrome + state machine for the practice drills: Start screen →
 * timed run → Results, with seed handling, PB persistence (cf:pb:{drill})
 * and the global keyboard contract — Enter starts/retries, Esc always exits
 * cleanly (the run component unmounts, which stops every timer it owns).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import c from '../components/controls.module.css'
import { newSeed, type DrillMeta, type RoundStats } from '../drills/index.ts'
import { loadPB, recordPB } from '../drills/pb.ts'
import styles from './PracticeShell.module.css'

export interface DrillRunProps {
  seed: string
  onFinish: (stats: RoundStats) => void
}

interface PracticeShellProps {
  drill: DrillMeta
  /** Start-screen instruction lines (rules of the drill + its keys). */
  howTo: string[]
  /** One-line scoring formula, shown on start and results. */
  scoring: string
  /** Unit name for the accuracy/speed readout (e.g. "hand", "item"). */
  unit: string
  renderRun: (props: DrillRunProps) => ReactNode
}

type Stage = 'start' | 'run' | 'results'

export function PracticeShell({ drill, howTo, scoring, unit, renderRun }: PracticeShellProps) {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('start')
  const [seed, setSeed] = useState('')
  const [stats, setStats] = useState<RoundStats | null>(null)
  const [pb, setPb] = useState<number | null>(() => loadPB(drill.id))
  const [improved, setImproved] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const begin = useCallback(() => {
    setSeed(newSeed())
    setStats(null)
    setImproved(false)
    setStage('run')
  }, [])

  const finish = useCallback(
    (s: RoundStats) => {
      const rec = recordPB(drill.id, s.score)
      setPb(rec.pb)
      setImproved(rec.improved)
      setStats(s)
      setStage('results')
    },
    [drill.id],
  )

  // Enter starts/retries; Esc exits — run aborts to the start screen (the
  // run subtree unmounts, stopping its timers), start/results go to the hub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (stage === 'run') setStage('start')
        else navigate('/practice')
        return
      }
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Enter' && stage !== 'run') {
        e.preventDefault()
        begin()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [stage, begin, navigate])

  // Keep keyboard flow visible: focus the primary action off-run.
  useEffect(() => {
    if (stage !== 'run') primaryRef.current?.focus()
  }, [stage])

  const accuracy = stats !== null && stats.total > 0 ? Math.round((100 * stats.correct) / stats.total) : 0
  const speed = stats !== null && stats.items > 0 ? (stats.durationMs / 1000 / stats.items).toFixed(1) : '0.0'

  return (
    <AppShell active="practice">
      <div className={styles.head}>
        <h1 className={styles.title}>
          {drill.title[0]} <span className={styles.accent}>{drill.title[1]}</span>
        </h1>
        <div className={styles.headMeta}>
          {stage !== 'start' ? <span className={styles.seedChip}>seed {seed}</span> : null}
          <span className={styles.escHint}>esc · {stage === 'run' ? 'stop round' : 'back to drills'}</span>
        </div>
      </div>

      {stage === 'start' ? (
        <div className={styles.startWrap}>
          <p className={styles.lede}>{drill.blurb}</p>
          <SectionCard title="How it plays" sub={scoring}>
            <ul className={styles.howTo}>
              {howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </SectionCard>
          <div className={styles.startRow}>
            <button
              type="button"
              ref={primaryRef}
              data-testid="drill-start"
              className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.wideBtn}`}
              onClick={begin}
            >
              Start round · Enter
            </button>
            <span className={styles.pbNote}>
              {pb !== null ? `personal best ${pb}` : 'no personal best yet'}
            </span>
          </div>
        </div>
      ) : null}

      {stage === 'run' ? <div className={styles.runWrap}>{renderRun({ seed, onFinish: finish })}</div> : null}

      {stage === 'results' && stats !== null ? (
        <div className={styles.resultsWrap} data-testid="drill-results">
          <div className={styles.verdictRow}>
            <span className={styles.verdictWord}>Round over</span>
            {improved ? <span className={styles.newBest}>New personal best</span> : null}
          </div>
          <div className={styles.tiles}>
            <div className={`${styles.tile} ${styles.tileWin}`}>
              <span className={styles.tileLabel}>Score</span>
              <span className={styles.tileValue} data-testid="drill-score">
                {stats.score}
              </span>
            </div>
            <div className={`${styles.tile} ${improved ? styles.tileWin : styles.tileNeutral}`}>
              <span className={styles.tileLabel}>Best</span>
              <span className={styles.tileValue}>{pb ?? stats.score}</span>
            </div>
            <div className={`${styles.tile} ${styles.tileNeutral}`}>
              <span className={styles.tileLabel}>Accuracy</span>
              <span className={styles.tileValue}>
                {accuracy}
                <span className={styles.tileUnit}>%</span>
              </span>
            </div>
            <div className={`${styles.tile} ${styles.tileNeutral}`}>
              <span className={styles.tileLabel}>Speed</span>
              <span className={styles.tileValue}>
                {speed}
                <span className={styles.tileUnit}>s/{unit}</span>
              </span>
            </div>
            <div className={`${styles.tile} ${styles.tileNeutral}`}>
              <span className={styles.tileLabel}>Best streak</span>
              <span className={styles.tileValue}>{stats.bestStreak}</span>
            </div>
          </div>
          <p className={styles.scoringNote}>{scoring}</p>
          <div className={styles.resultRow}>
            <button
              type="button"
              ref={primaryRef}
              data-testid="drill-retry"
              className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.wideBtn}`}
              onClick={begin}
            >
              Play again · Enter
            </button>
            <button
              type="button"
              className={`${c.btn} ${c.btnTall} ${c.secondary}`}
              onClick={() => navigate('/practice')}
            >
              All drills · Esc
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
