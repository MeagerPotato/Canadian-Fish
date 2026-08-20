/**
 * /practice/deduction — Deduction drill (SPEC.md §8.3).
 * Replays a bot-game public log at readable pace (pause / step / scrub),
 * then asks who holds a card the record alone pins down. Answer with 1-6.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Seat } from '../../lib/engine/index.ts'
import { seatTeam } from '../../lib/engine/index.ts'
import { PlayingCard } from '../components/PlayingCard.tsx'
import c from '../components/controls.module.css'
import {
  DEDUCTION_QUESTIONS_PER_ROUND,
  deductionPoints,
  generateDeductionRound,
  type DeductionQuestion,
} from '../drills/deduction.ts'
import { requireDrill } from '../drills/index.ts'
import { cardLabel, teamLetter } from '../viewmodels/format.ts'
import { humanizeLog } from '../viewmodels/log.ts'
import { useLatest, useStartedAt } from './PracticeHooks.ts'
import { PracticeShell, type DrillRunProps } from './PracticeShell.tsx'
import styles from './PracticeDeduction.module.css'

const META = requireDrill('deduction')
const SEATS: readonly Seat[] = [0, 1, 2, 3, 4, 5]

export default function PracticeDeduction() {
  return (
    <PracticeShell
      drill={META}
      scoring="+3 constraint chain · +2 direct deduction · +1 public transfer — three questions"
      unit="question"
      howTo={[
        'A run of public asks replays line by line. Space pauses, ← → step, the slider scrubs, End jumps ahead.',
        'Then: who holds the named card? The answer is always certain from the public record alone — no hands shown.',
        'Press 1-6 to pick a seat (P0-P5). After answering you get the why: the chain of misses, counts and forced cards.',
        'Later questions replay longer prefixes. Esc stops the round.',
      ]}
      renderRun={(p) => <DeductionRun {...p} />}
    />
  )
}

type Phase = 'replay' | 'question' | 'reveal'

function DeductionRun({ seed, onFinish }: DrillRunProps) {
  const round = useMemo(() => generateDeductionRound(seed), [seed])
  const startedAt = useStartedAt()
  const [qIdx, setQIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('replay')
  const [pos, setPos] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [picked, setPicked] = useState<Seat | null>(null)
  const [results, setResults] = useState<{ right: boolean; points: number }[]>([])
  const logBoxRef = useRef<HTMLDivElement>(null)

  const q: DeductionQuestion | undefined = round.questions[qIdx]
  const total = q !== undefined ? q.log.length : 0
  // Readable pace for short logs; longer records stream faster (scrub/step
  // and "to the question" keep the round inside the minute either way).
  const tick = total <= 20 ? 700 : total <= 40 ? 450 : 300
  const lines = useMemo(
    () => (q !== undefined ? humanizeLog(q.log, (s) => `P${s}`).reverse() : []),
    [q],
  )
  const last = qIdx >= round.questions.length - 1

  const finish = () => {
    let streak = 0
    let bestStreak = 0
    for (const r of results) {
      streak = r.right ? streak + 1 : 0
      if (streak > bestStreak) bestStreak = streak
    }
    const total = Math.max(round.questions.length, DEDUCTION_QUESTIONS_PER_ROUND)
    onFinish({
      score: results.reduce((n, r) => n + r.points, 0),
      correct: results.filter((r) => r.right).length,
      total,
      items: total,
      bestStreak,
      durationMs: Date.now() - startedAt.current,
    })
  }
  const finishRef = useLatest(finish)

  const answerSeat = (s: Seat) => {
    if (phase !== 'question' || q === undefined) return
    const right = s === q.answer
    setResults((r) => [...r, { right, points: right ? deductionPoints(q.tier) : 0 }])
    setPicked(s)
    setPhase('reveal')
  }
  const answerRef = useLatest(answerSeat)

  const advance = () => {
    if (phase !== 'reveal') return
    if (last) {
      finishRef.current()
      return
    }
    setQIdx((i) => i + 1)
    setPos(1)
    setPlaying(true)
    setPicked(null)
    setPhase('replay')
  }
  const advanceRef = useLatest(advance)

  // Guard: generation could not build any question (practically impossible).
  useEffect(() => {
    if (q === undefined) finishRef.current()
  }, [q, finishRef])

  // Replay ticker.
  useEffect(() => {
    if (phase !== 'replay' || !playing) return
    const t = window.setInterval(() => setPos((p) => Math.min(p + 1, total)), tick)
    return () => window.clearInterval(t)
  }, [phase, playing, total, tick])

  // Full log shown → move on to the question after a beat.
  useEffect(() => {
    if (phase !== 'replay' || pos < total || total === 0) return
    const t = window.setTimeout(() => setPhase('question'), playing ? 700 : 200)
    return () => window.clearTimeout(t)
  }, [phase, pos, total, playing])

  // Keep the newest replay line in view.
  useEffect(() => {
    const el = logBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [pos])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // shell owns exit
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (phase === 'replay') {
        if (e.key === ' ') {
          e.preventDefault()
          setPlaying((p) => !p)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setPlaying(false)
          setPos((p) => Math.min(p + 1, total))
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setPlaying(false)
          setPos((p) => Math.max(p - 1, 1))
        } else if (e.key === 'End' || e.key === 'Enter') {
          e.preventDefault()
          setPos(total)
          setPhase('question')
        }
      } else if (phase === 'question') {
        if (/^[1-6]$/.test(e.key)) {
          e.preventDefault()
          answerRef.current((Number(e.key) - 1) as Seat)
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advanceRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, total, answerRef, advanceRef])

  if (q === undefined) return null
  const lastResult = results[results.length - 1]

  return (
    <div className={styles.run}>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          question {qIdx + 1} / {round.questions.length}
        </span>
        <span className={styles.metaItem}>score {results.reduce((n, r) => n + r.points, 0)}</span>
        <span className={styles.metaTier}>
          {q.tier === 'constraint' ? '3 pts · constraint chain' : q.tier === 'direct' ? '2 pts · direct deduction' : '1 pt · public transfer'}
        </span>
      </div>

      <div className={styles.panel}>
        <div className={styles.logBox} ref={logBoxRef} aria-label="Public record replay">
          {lines.slice(0, phase === 'replay' ? pos : total).map((line) => (
            <div key={line.key} className={`${styles.logRow} ${line.kind === 'ask-hit' ? styles.logHit : ''}`}>
              {line.text}
            </div>
          ))}
        </div>

        {phase === 'replay' ? (
          <div className={styles.controls}>
            <button type="button" className={`${c.btn} ${c.secondary}`} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause · Space' : 'Play · Space'}
            </button>
            <button
              type="button"
              className={`${c.btn} ${c.secondary}`}
              onClick={() => {
                setPlaying(false)
                setPos((p) => Math.max(p - 1, 1))
              }}
            >
              ‹ Step
            </button>
            <button
              type="button"
              className={`${c.btn} ${c.secondary}`}
              onClick={() => {
                setPlaying(false)
                setPos((p) => Math.min(p + 1, total))
              }}
            >
              Step ›
            </button>
            <input
              type="range"
              className={styles.scrub}
              min={1}
              max={total}
              value={pos}
              aria-label="Scrub the replay"
              onChange={(e) => {
                setPlaying(false)
                setPos(Number(e.target.value))
              }}
            />
            <span className={styles.scrubPos}>
              {pos} / {total}
            </span>
            <button
              type="button"
              className={`${c.btn} ${c.primary}`}
              onClick={() => {
                setPos(total)
                setPhase('question')
              }}
            >
              To the question · Enter
            </button>
          </div>
        ) : null}

        {phase !== 'replay' ? (
          <div className={styles.question}>
            <div className={styles.qHead}>
              <span className={styles.qWord}>Who holds</span>
              <PlayingCard card={q.card} size="md" />
              <span className={styles.qWord}>{cardLabel(q.card)}?</span>
            </div>
            {phase === 'question' ? (
              <div className={styles.seats} role="group" aria-label="Pick a seat">
                {SEATS.map((s) => (
                  <button key={s} type="button" className={styles.seatBtn} onClick={() => answerRef.current(s)}>
                    <span className={styles.seatKey}>{s + 1}</span>
                    <span className={styles.seatName}>P{s}</span>
                    <span className={styles.seatSub}>
                      {teamLetter(seatTeam(s))} · {q.counts[s]} {q.counts[s] === 1 ? 'card' : 'cards'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={`${styles.reveal} ${lastResult !== undefined && lastResult.right ? styles.revealRight : styles.revealWrong}`}
              >
                <span className={styles.revealWord}>
                  {lastResult !== undefined && lastResult.right
                    ? `Right — P${q.answer} holds ${cardLabel(q.card)}`
                    : `No — you said P${picked ?? '?'}; it is P${q.answer}`}
                </span>
                <ul className={styles.why}>
                  {q.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <button type="button" className={`${c.btn} ${c.secondary}`} onClick={() => advanceRef.current()}>
                  {last ? 'Finish · Enter' : 'Next question · Enter'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="visually-hidden" aria-live="polite">
        {phase === 'question' ? `Who holds ${cardLabel(q.card)}? Press 1 through 6.` : ''}
      </div>
    </div>
  )
}
