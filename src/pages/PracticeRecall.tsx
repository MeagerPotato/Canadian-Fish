/**
 * /practice/recall — Book recall drill (SPEC.md §8.1).
 * Five hands: 3 s flash → keyboard answer (1-8 picks a book, then 0-6 sets
 * its count) → per-hand reveal. Generator + scorer live in src/drills/recall.
 */
import { useEffect, useMemo, useState } from 'react'
import type { BookId } from '../../lib/engine/index.ts'
import { ALL_BOOKS } from '../../lib/engine/index.ts'
import { PlayingCard } from '../components/PlayingCard.tsx'
import c from '../components/controls.module.css'
import { requireDrill } from '../drills/index.ts'
import {
  RECALL_ANSWER_MS,
  RECALL_FLASH_MS,
  gradeRecall,
  generateRecallRound,
  type RecallAnswer,
  type RecallGrade,
} from '../drills/recall.ts'
import { bookLabel } from '../viewmodels/format.ts'
import { useLatest, useStartedAt } from './PracticeHooks.ts'
import { PracticeShell, type DrillRunProps } from './PracticeShell.tsx'
import styles from './PracticeRecall.module.css'

const META = requireDrill('recall')

export default function PracticeRecall() {
  return (
    <PracticeShell
      drill={META}
      scoring="+1 per book spotted · +1 per exact count · −1 per wrong pick — five hands"
      unit="hand"
      howTo={[
        'Eight cards flash for three seconds, then vanish.',
        'Press 1-8 to pick a half-suit (LOW ♣ through HIGH ♠), then 0-6 to say how many of its cards you saw (0 clears it).',
        'Enter submits the hand — or the eight-second clock submits for you. Five hands per round.',
        'Everything is clickable too; Esc stops the round.',
      ]}
      renderRun={(p) => <RecallRun {...p} />}
    />
  )
}

type Phase = 'flash' | 'answer' | 'reveal'

function RecallRun({ seed, onFinish }: DrillRunProps) {
  const round = useMemo(() => generateRecallRound(seed), [seed])
  const startedAt = useStartedAt()
  const [handIdx, setHandIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('flash')
  const [answer, setAnswer] = useState<RecallAnswer>({})
  const [armed, setArmed] = useState<BookId | null>(null)
  const [grades, setGrades] = useState<RecallGrade[]>([])
  const answerRef = useLatest(answer)

  const hand = round.hands[handIdx]
  const last = handIdx === round.hands.length - 1

  const submit = () => {
    if (phase !== 'answer') return // idempotent: clock + Enter can both fire
    setGrades((g) => [...g, gradeRecall(round.hands[handIdx], answerRef.current)])
    setArmed(null)
    setPhase('reveal')
  }
  const submitRef = useLatest(submit)

  const next = () => {
    if (phase !== 'reveal') return
    const all = grades
    if (last) {
      const score = all.reduce((n, g) => n + g.points, 0)
      const correct = all.reduce((n, g) => n + Math.max(0, g.points), 0)
      const total = all.reduce((n, g) => n + g.maxPoints, 0)
      let streak = 0
      let bestStreak = 0
      for (const g of all) {
        streak = g.perfect ? streak + 1 : 0
        if (streak > bestStreak) bestStreak = streak
      }
      onFinish({ score, correct, total, items: round.hands.length, bestStreak, durationMs: Date.now() - startedAt.current })
      return
    }
    setAnswer({})
    setArmed(null)
    setHandIdx((i) => i + 1)
    setPhase('flash')
  }
  const nextRef = useLatest(next)

  // Phase clocks — flash 3 s, answer 8 s (auto-submit), reveal 2.4 s.
  useEffect(() => {
    const ms = phase === 'flash' ? RECALL_FLASH_MS : phase === 'answer' ? RECALL_ANSWER_MS : 2400
    const t = window.setTimeout(() => {
      if (phase === 'flash') setPhase('answer')
      else if (phase === 'answer') submitRef.current()
      else nextRef.current()
    }, ms)
    return () => window.clearTimeout(t)
    // Consecutive phases always differ (flash → answer → reveal → flash), so
    // `phase` alone re-arms the clock for every period.
  }, [phase, submitRef, nextRef])

  // Keyboard: 1-8 arm a book, 0-6 set the armed count, Enter submit/next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // the shell owns exit
      if (phase === 'reveal') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nextRef.current()
        }
        return
      }
      if (phase !== 'answer') return
      if (e.key === 'Enter') {
        e.preventDefault()
        submitRef.current()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setArmed((a) => {
          if (a !== null) setAnswer((prev) => without(prev, a))
          return null
        })
        return
      }
      if (!/^[0-9]$/.test(e.key)) return
      e.preventDefault()
      const n = Number(e.key)
      setArmed((a) => {
        if (a === null || n === 7 || n === 8) {
          return n >= 1 && n <= 8 ? ALL_BOOKS[n - 1] : a
        }
        if (n === 0) {
          setAnswer((prev) => without(prev, a))
          return null
        }
        if (n >= 1 && n <= 6) {
          setAnswer((prev) => ({ ...prev, [a]: n }))
          return null
        }
        return a
      })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, submitRef, nextRef])

  const runningScore = grades.reduce((n, g) => n + g.points, 0)
  const grade = phase === 'reveal' ? grades[grades.length - 1] : null

  return (
    <div className={styles.run}>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          hand {handIdx + 1} / {round.hands.length}
        </span>
        <span className={styles.metaItem}>score {runningScore}</span>
      </div>

      {phase === 'flash' ? (
        <div className={styles.flash}>
          <div className={styles.cards} aria-label="Memorize these eight cards">
            {hand.cards.map((card) => (
              <PlayingCard key={card} card={card} size="lg" />
            ))}
          </div>
          <div className={styles.clock} aria-hidden="true">
            <div className={styles.clockFill} style={{ animationDuration: `${RECALL_FLASH_MS}ms` }} />
          </div>
          <p className={styles.hint}>Memorize the half-suits…</p>
        </div>
      ) : null}

      {phase === 'answer' ? (
        <div className={styles.answer}>
          <div className={styles.clock} aria-hidden="true">
            <div className={styles.clockFill} style={{ animationDuration: `${RECALL_ANSWER_MS}ms` }} />
          </div>
          <span className={c.fieldLabel}>Which half-suits did you see — and how many of each?</span>
          <div className={styles.books} role="group" aria-label="Half-suits">
            {ALL_BOOKS.map((book, i) => {
              const picked = answer[book]
              const isArmed = armed === book
              return (
                <button
                  key={book}
                  type="button"
                  aria-pressed={picked !== undefined}
                  className={[
                    styles.bookBtn,
                    picked !== undefined ? styles.bookOn : '',
                    isArmed ? styles.bookArmed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setArmed((a) => (a === book ? null : book))}
                >
                  <span className={styles.bookKey}>{i + 1}</span>
                  <span className={styles.bookName}>{bookLabel(book)}</span>
                  {picked !== undefined ? <span className={styles.bookCount}>×{picked}</span> : null}
                </button>
              )
            })}
          </div>
          <div className={styles.counts} role="group" aria-label="Card count for the selected half-suit">
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                disabled={armed === null}
                className={styles.countBtn}
                onClick={() => {
                  if (armed === null) return
                  if (n === 0) setAnswer((prev) => without(prev, armed))
                  else setAnswer((prev) => ({ ...prev, [armed]: n }))
                  setArmed(null)
                }}
              >
                {n === 0 ? 'clear' : n}
              </button>
            ))}
          </div>
          <div className={styles.submitRow}>
            <span className={styles.hint}>
              {armed !== null ? `${bookLabel(armed)} — press its count (0 clears)` : 'press 1-8 to pick a half-suit'}
            </span>
            <button type="button" className={`${c.btn} ${c.btnTall} ${c.primary}`} onClick={() => submitRef.current()}>
              Submit · Enter
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'reveal' && grade !== null ? (
        <div className={styles.reveal}>
          <span className={`${styles.revealPoints} ${grade.perfect ? styles.perfect : ''}`}>
            {grade.points >= 0 ? '+' : ''}
            {grade.points} / {grade.maxPoints}
            {grade.perfect ? ' — perfect' : ''}
          </span>
          <div className={styles.truthRow}>
            {ALL_BOOKS.map((book) => {
              const t = hand.truth[book] ?? 0
              const a = answer[book] ?? 0
              if (t === 0 && a === 0) return null
              const cls = t > 0 && a === t ? styles.chipRight : a === 0 ? styles.chipMissed : styles.chipWrong
              return (
                <span key={book} className={`${styles.chip} ${cls}`}>
                  {bookLabel(book)} ×{t}
                  {a !== t ? <em className={styles.chipSaid}>{a === 0 ? 'missed' : `said ${a}`}</em> : null}
                </span>
              )
            })}
          </div>
          <div className={styles.cardsSmall}>
            {hand.cards.map((card) => (
              <PlayingCard key={card} card={card} size="sm" />
            ))}
          </div>
          <button type="button" className={`${c.btn} ${c.secondary}`} onClick={() => nextRef.current()}>
            {last ? 'Finish · Enter' : 'Next hand · Enter'}
          </button>
        </div>
      ) : null}

      <div className="visually-hidden" aria-live="polite">
        {phase === 'answer' ? 'Cards hidden. Enter your answer.' : phase === 'reveal' && grade ? `Scored ${grade.points} of ${grade.maxPoints}.` : ''}
      </div>
    </div>
  )
}

function without(prev: RecallAnswer, book: BookId): RecallAnswer {
  const next = { ...prev }
  delete next[book]
  return next
}
