/**
 * /practice/game — Full game vs bots (SPEC.md §8.6).
 * Creates a REAL server-side solo room (5 bots at the chosen difficulty) and
 * navigates to the existing table at /r/{code} — with ?coach=1 when the coach
 * overlay is enabled. Keys: 1/2/3 difficulty, C coach, Enter start, Esc back.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BotDifficulty } from '../../lib/engine/index.ts'
import { apiCreateRoomWithBots, friendlyMessage } from '../api/client.ts'
import { loadName, saveToken } from '../api/storage.ts'
import { AppShell } from '../components/AppShell.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import c from '../components/controls.module.css'
import { requireDrill } from '../drills/index.ts'
import { useLatest } from './PracticeHooks.ts'
import styles from './PracticeGame.module.css'

const META = requireDrill('game')
const LEVELS: { id: BotDifficulty; key: string; label: string; note: string }[] = [
  { id: 'easy', key: '1', label: 'Easy', note: 'short memory, loose asks' },
  { id: 'medium', key: '2', label: 'Medium', note: 'full deduction, certain claims' },
  { id: 'hard', key: '3', label: 'Hard', note: 'EV claims, signalling, endgame counting' },
]

export default function PracticeGame() {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium')
  const [coach, setCoach] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const start = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    const result = await apiCreateRoomWithBots(loadName(), 5, difficulty)
    busyRef.current = false
    setBusy(false)
    if (result.ok) {
      saveToken(result.data.code, result.data.playerToken)
      navigate(`/r/${result.data.code}${coach ? '?coach=1' : ''}`)
    } else {
      setError(friendlyMessage(result.error))
    }
  }
  const startRef = useLatest(start)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/practice')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        void startRef.current()
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setCoach((v) => !v)
      } else {
        const lvl = LEVELS.find((l) => l.key === e.key)
        if (lvl) {
          e.preventDefault()
          setDifficulty(lvl.id)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, startRef])

  return (
    <AppShell active="practice">
      <h1 className={styles.title}>
        {META.title[0]} <span className={styles.accent}>{META.title[1]}</span>
      </h1>
      <p className={styles.lede}>
        A real room on the live server — you at seat 0, five deterministic house bots around you. They see only what
        you see: the public log, the counts, their own hands. Leave any time; the room expires on its own.
      </p>

      <SectionCard title="Table setup" sub="1 / 2 / 3 difficulty · C coach · Enter deal">
        <div className={styles.field}>
          <span className={c.fieldLabel}>Bot difficulty</span>
          <div className={styles.levels} role="group" aria-label="Bot difficulty">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={difficulty === l.id}
                data-testid={`game-difficulty-${l.id}`}
                className={`${styles.level} ${difficulty === l.id ? styles.levelOn : ''}`}
                onClick={() => setDifficulty(l.id)}
              >
                <span className={styles.levelKey}>{l.key}</span>
                <span className={styles.levelLabel}>{l.label}</span>
                <span className={styles.levelNote}>{l.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={c.fieldLabel}>Coach overlay</span>
          <button
            type="button"
            role="switch"
            aria-checked={coach}
            data-testid="game-coach-toggle"
            className={`${styles.coach} ${coach ? styles.coachOn : ''}`}
            onClick={() => setCoach((v) => !v)}
          >
            <span className={styles.coachThumb} aria-hidden="true" />
            <span className={styles.coachText}>
              {coach ? 'On — top asks + certain claims, from your own view only' : 'Off — no hints at the table'}
            </span>
          </button>
        </div>

        {error !== null ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.startRow}>
          <button
            type="button"
            data-testid="game-start"
            className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.startBtn}`}
            disabled={busy}
            onClick={() => void startRef.current()}
          >
            {busy ? 'Opening the room…' : 'Deal me in · Enter'}
          </button>
          <span className={styles.hint}>esc · back to drills</span>
        </div>
      </SectionCard>

      <p className={styles.foot}>
        The coach reads only your seat view — the public record plus your own hand. No hidden information exists on
        this side of the table, and none is added.
      </p>
    </AppShell>
  )
}
