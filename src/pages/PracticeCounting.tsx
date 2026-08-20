/**
 * /practice/counting — Card counting drill (SPEC.md §8.5).
 * Fifteen asks stream past (pausable); every hit moves one card. Then name
 * all six final hand sizes from memory — digits, arrows, Enter.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import c from '../components/controls.module.css'
import {
  COUNTING_STREAM_MS,
  generateCountingRound,
  scoreCounting,
  type CountingScore,
} from '../drills/counting.ts'
import { requireDrill } from '../drills/index.ts'
import { cardLabel } from '../viewmodels/format.ts'
import { useLatest, useStartedAt } from './PracticeHooks.ts'
import { PracticeShell, type DrillRunProps } from './PracticeShell.tsx'
import styles from './PracticeCounting.module.css'

const META = requireDrill('counting')

export default function PracticeCounting() {
  return (
    <PracticeShell
      drill={META}
      scoring="+1 per exact hand size — six seats, counts always sum to 48"
      unit="seat"
      howTo={[
        'Everyone starts with eight cards. About fifteen asks stream past, one every 1.2 seconds — each hit moves exactly one card.',
        'Space pauses and resumes the stream. No counts are shown; the tally is yours to keep.',
        'Afterwards, enter every seat’s final hand size: type digits, ← → to change seat, Backspace to fix, Enter to submit.',
        'One point per exact seat. Esc stops the round.',
      ]}
      renderRun={(p) => <CountingRun {...p} />}
    />
  )
}

type Phase = 'stream' | 'entry' | 'reveal'
const SEAT_IDS = [0, 1, 2, 3, 4, 5] as const

function CountingRun({ seed, onFinish }: DrillRunProps) {
  const round = useMemo(() => generateCountingRound(seed), [seed])
  const startedAt = useStartedAt()
  const [phase, setPhase] = useState<Phase>('stream')
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [guesses, setGuesses] = useState<string[]>(['', '', '', '', '', ''])
  const [cur, setCur] = useState(0)
  const [result, setResult] = useState<CountingScore | null>(null)
  const logBoxRef = useRef<HTMLDivElement>(null)

  const total = round.events.length

  const submit = () => {
    if (result !== null) return
    if (guesses.some((g) => g === '')) return
    const numeric = guesses.map((g) => Number(g))
    const r = scoreCounting(round.finalCounts, numeric)
    setResult(r)
    setPhase('reveal')
  }
  const submitRef = useLatest(submit)

  const finish = () => {
    if (result === null) return
    onFinish({
      score: result.score,
      correct: result.correct,
      total: 6,
      items: 6,
      bestStreak: result.bestStreak,
      durationMs: Date.now() - startedAt.current,
    })
  }
  const finishRef = useLatest(finish)

  // The stream: one event per 1.2 s while playing.
  useEffect(() => {
    if (phase !== 'stream' || !playing) return
    const t = window.setInterval(() => setPos((p) => Math.min(p + 1, total)), COUNTING_STREAM_MS)
    return () => window.clearInterval(t)
  }, [phase, playing, total])

  useEffect(() => {
    if (phase !== 'stream' || pos < total || total === 0) return
    const t = window.setTimeout(() => setPhase('entry'), COUNTING_STREAM_MS)
    return () => window.clearTimeout(t)
  }, [phase, pos, total])

  useEffect(() => {
    const el = logBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [pos])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // shell owns exit
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (phase === 'stream') {
        if (e.key === ' ') {
          e.preventDefault()
          setPlaying((p) => !p)
        }
        return
      }
      if (phase === 'entry') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          setGuesses((g) => {
            const next = [...g]
            const v = next[cur].length >= 2 ? e.key : next[cur] + e.key
            next[cur] = String(Math.min(Number(v), 48))
            return next
          })
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          setGuesses((g) => {
            const next = [...g]
            next[cur] = next[cur].slice(0, -1)
            return next
          })
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setCur((i) => (i + 1) % 6)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setCur((i) => (i + 5) % 6)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          submitRef.current()
        }
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        finishRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, cur, submitRef, finishRef])

  const allFilled = guesses.every((g) => g !== '')

  return (
    <div className={styles.run}>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          {phase === 'stream' ? `event ${pos} / ${total}` : `${total} events shown`}
        </span>
        {phase === 'stream' ? (
          <span className={styles.metaItem}>{playing ? 'streaming' : 'paused'}</span>
        ) : null}
      </div>

      <div className={styles.panel}>
        {phase === 'stream' ? (
          <>
            <div className={styles.logBox} ref={logBoxRef} aria-label="Ask stream">
              {round.events.slice(0, pos).map((ev, i) => (
                <div key={i} className={`${styles.logRow} ${ev.hit ? styles.logHit : ''}`}>
                  P{ev.asker} asked P{ev.target} for {cardLabel(ev.card)} — {ev.hit ? 'hit' : 'no'}
                </div>
              ))}
              {pos === 0 ? <div className={styles.logRow}>Eight cards each. Watch the hits…</div> : null}
            </div>
            <div className={styles.controls}>
              <button type="button" className={`${c.btn} ${c.secondary}`} onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause · Space' : 'Resume · Space'}
              </button>
              <span className={styles.hint}>hits move a card · misses only move the turn</span>
            </div>
          </>
        ) : (
          <>
            <span className={c.fieldLabel}>
              {phase === 'entry' ? 'Final hand sizes — they must sum to 48' : 'The truth'}
            </span>
            <div className={styles.seats} role="group" aria-label="Hand sizes per seat">
              {SEAT_IDS.map((s) => {
                const right = result !== null ? result.perSeat[s] : null
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={phase === 'reveal'}
                    className={[
                      styles.seatTile,
                      phase === 'entry' && cur === s ? styles.seatCur : '',
                      right === true ? styles.seatRight : '',
                      right === false ? styles.seatWrong : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setCur(s)}
                  >
                    <span className={styles.seatLabel}>P{s}</span>
                    <span className={styles.seatValue}>{guesses[s] === '' ? '·' : guesses[s]}</span>
                    {result !== null && right === false ? (
                      <span className={styles.seatTruth}>→ {round.finalCounts[s]}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {phase === 'entry' ? (
              <>
                <div className={styles.pad} role="group" aria-label="Digits">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={styles.padBtn}
                      onClick={() =>
                        setGuesses((g) => {
                          const next = [...g]
                          const v = next[cur].length >= 2 ? String(d) : next[cur] + String(d)
                          next[cur] = String(Math.min(Number(v), 48))
                          return next
                        })
                      }
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.padBtn}
                    aria-label="Delete digit"
                    onClick={() =>
                      setGuesses((g) => {
                        const next = [...g]
                        next[cur] = next[cur].slice(0, -1)
                        return next
                      })
                    }
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className={styles.padBtn}
                    aria-label="Next seat"
                    onClick={() => setCur((i) => (i + 1) % 6)}
                  >
                    →
                  </button>
                </div>
                <div className={styles.submitRow}>
                  <span className={styles.hint}>
                    {allFilled
                      ? `sum ${guesses.reduce((n, g) => n + Number(g || 0), 0)} — 48 means consistent`
                      : 'fill all six seats'}
                  </span>
                  <button
                    type="button"
                    className={`${c.btn} ${c.btnTall} ${c.primary}`}
                    disabled={!allFilled}
                    onClick={() => submitRef.current()}
                  >
                    Submit counts · Enter
                  </button>
                </div>
              </>
            ) : null}
            {phase === 'reveal' && result !== null ? (
              <div className={`${styles.verdict} ${result.correct === 6 ? styles.verdictWon : styles.verdictPart}`}>
                <span className={styles.verdictWord}>
                  {result.correct} / 6 exact
                </span>
                <button type="button" className={`${c.btn} ${c.btnTall} ${c.primary}`} onClick={() => finishRef.current()}>
                  Finish · Enter
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="visually-hidden" aria-live="polite">
        {phase === 'entry' ? 'Stream over. Enter every seat’s final count.' : phase === 'reveal' && result ? `${result.correct} of six exact.` : ''}
      </div>
    </div>
  )
}
