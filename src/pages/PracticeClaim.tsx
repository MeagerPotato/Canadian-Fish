/**
 * /practice/claim — Claim trainer (SPEC.md §8.4).
 * A mid-game public log + your hand prove where a whole half-suit sits; you
 * place all six cards on the team matrix (ClaimSheet's pattern). 6/6 wins the
 * claim; any miss voids the book — dramatically.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Seat } from '../../lib/engine/index.ts'
import { bookCards } from '../../lib/engine/index.ts'
import { PlayingCard } from '../components/PlayingCard.tsx'
import c from '../components/controls.module.css'
import { generateClaimRound, gradeClaim, type ClaimGrade, type ClaimPuzzle } from '../drills/claim.ts'
import { requireDrill } from '../drills/index.ts'
import { bookLabel, cardLabel } from '../viewmodels/format.ts'
import { humanizeLog } from '../viewmodels/log.ts'
import { useLatest, useStartedAt } from './PracticeHooks.ts'
import { PracticeShell, type DrillRunProps } from './PracticeShell.tsx'
import styles from './PracticeClaim.module.css'

const META = requireDrill('claim')

export default function PracticeClaim() {
  return (
    <PracticeShell
      drill={META}
      scoring="+1 per correct card · +4 when all six land (claim won) — two claims"
      unit="card"
      howTo={[
        'You are seat 0. The public log plus your own hand pin down every card of one half-suit — it is fully locatable.',
        'Place each of its six cards with a teammate: keys 1 / 2 / 3 put the active card with P0, P2 or P4; ↑ ↓ change card.',
        'Your own cards come pre-placed. Enter submits once all six are set.',
        'All six right wins the claim; a single wrong seat voids the book. Esc stops the round.',
      ]}
      renderRun={(p) => <ClaimRun {...p} />}
    />
  )
}

function ClaimRun({ seed, onFinish }: DrillRunProps) {
  const round = useMemo(() => generateClaimRound(seed), [seed])
  const startedAt = useStartedAt()
  const [pIdx, setPIdx] = useState(0)
  const [grades, setGrades] = useState<ClaimGrade[]>([])

  const done = (grade: ClaimGrade) => {
    const all = [...grades, grade]
    setGrades(all)
    if (pIdx === round.puzzles.length - 1) {
      let streak = 0
      let bestStreak = 0
      for (const g of all) {
        streak = g.won ? streak + 1 : 0
        if (streak > bestStreak) bestStreak = streak
      }
      onFinish({
        score: all.reduce((n, g) => n + g.score, 0),
        correct: all.reduce((n, g) => n + g.correct, 0),
        total: round.puzzles.length * 6,
        items: round.puzzles.length,
        bestStreak,
        durationMs: Date.now() - startedAt.current,
      })
      return
    }
    setPIdx((i) => i + 1)
  }

  const runningScore = grades.reduce((n, g) => n + g.score, 0)

  return (
    <ClaimPuzzleView
      key={pIdx}
      puzzle={round.puzzles[pIdx]}
      index={pIdx}
      count={round.puzzles.length}
      runningScore={runningScore}
      onDone={done}
    />
  )
}

interface PuzzleProps {
  puzzle: ClaimPuzzle
  index: number
  count: number
  runningScore: number
  onDone: (grade: ClaimGrade) => void
}

function ClaimPuzzleView({ puzzle, index, count, runningScore, onDone }: PuzzleProps) {
  const cards = useMemo(() => [...bookCards(puzzle.book)], [puzzle.book])
  const own = useMemo(() => new Set(puzzle.hand), [puzzle.hand])
  const [picks, setPicks] = useState<Partial<Record<Card, Seat>>>(() => {
    const preset: Partial<Record<Card, Seat>> = {}
    for (const card of cards) if (own.has(card)) preset[card] = 0
    return preset
  })
  const [row, setRow] = useState(() => {
    const first = cards.findIndex((card) => !own.has(card))
    return first === -1 ? 0 : first
  })
  const [grade, setGrade] = useState<ClaimGrade | null>(null)
  const logBoxRef = useRef<HTMLDivElement>(null)
  const rowRef = useLatest(row)

  const lines = useMemo(() => humanizeLog(puzzle.log, (s) => `P${s}`).reverse(), [puzzle.log])
  const complete = cards.every((card) => picks[card] !== undefined)

  const assign = (card: Card, seat: Seat) => {
    if (grade !== null) return
    const next = { ...picks, [card]: seat }
    setPicks(next)
    // Advance to the next unplaced card (after this one, wrapping).
    const i = cards.indexOf(card)
    for (let step = 1; step <= cards.length; step++) {
      const j = (i + step) % cards.length
      if (next[cards[j]] === undefined) {
        setRow(j)
        break
      }
    }
  }
  const assignRef = useLatest(assign)

  const submit = () => {
    if (grade !== null || !complete) return
    setGrade(gradeClaim(puzzle, picks as Record<Card, Seat>))
  }
  const submitRef = useLatest(submit)

  const gradeRef = useLatest(grade)
  const onDoneRef = useLatest(onDone)

  useEffect(() => {
    const el = logBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [puzzle])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // shell owns exit
      const t = e.target as HTMLElement | null
      if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (gradeRef.current !== null) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDoneRef.current(gradeRef.current)
        }
        return
      }
      if (/^[1-3]$/.test(e.key)) {
        e.preventDefault()
        assignRef.current(cards[rowRef.current], puzzle.teamSeats[Number(e.key) - 1])
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setRow((r) => (r + 1) % cards.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setRow((r) => (r + cards.length - 1) % cards.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submitRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cards, puzzle.teamSeats, gradeRef, onDoneRef, assignRef, rowRef, submitRef])

  return (
    <div className={styles.run}>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          claim {index + 1} / {count}
        </span>
        <span className={styles.metaItem}>score {runningScore}</span>
        <span className={styles.metaBook}>{bookLabel(puzzle.book)} is fully locatable</span>
      </div>

      <div className={styles.columns}>
        <div className={styles.evidence}>
          <span className={c.fieldLabel}>Public record</span>
          <div className={styles.logBox} ref={logBoxRef}>
            {lines.length === 0 ? <div className={styles.logRow}>Fresh deal — your own hand is the evidence.</div> : null}
            {lines.map((line) => (
              <div key={line.key} className={`${styles.logRow} ${line.kind === 'ask-hit' ? styles.logHit : ''}`}>
                {line.text}
              </div>
            ))}
          </div>
          <span className={c.fieldLabel}>Your hand · P0</span>
          <div className={styles.hand}>
            {puzzle.hand.map((card) => (
              <PlayingCard key={card} card={card} size="sm" />
            ))}
          </div>
        </div>

        <div className={styles.matrixWrap}>
          <span className={c.fieldLabel}>
            Place all six {bookLabel(puzzle.book)} cards — team A only
          </span>
          <div className={styles.matrix} role="group" aria-label="Claim assignments">
            {cards.map((card, i) => {
              const active = grade === null && i === row
              const result = grade !== null ? grade.perCard[i] : null
              return (
                <div
                  key={card}
                  className={[
                    styles.matrixRow,
                    active ? styles.rowActive : '',
                    result !== null ? (result.correct ? styles.rowRight : styles.rowWrong) : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className={styles.rowCard}
                    onClick={() => grade === null && setRow(i)}
                    aria-label={`Select ${cardLabel(card)}`}
                  >
                    <PlayingCard card={card} size="xs" />
                    <span className={styles.rowLabel}>{cardLabel(card)}</span>
                  </button>
                  <div className={styles.rowSeats}>
                    {puzzle.teamSeats.map((seat, k) => {
                      const picked = picks[card] === seat
                      return (
                        <button
                          key={seat}
                          type="button"
                          aria-pressed={picked}
                          className={`${styles.seatPick} ${picked ? styles.seatPicked : ''}`}
                          onClick={() => {
                            setRow(i)
                            assignRef.current(card, seat)
                          }}
                        >
                          <span className={styles.seatKeyHint}>{k + 1}</span>P{seat}
                          {seat === 0 ? <span className={styles.you}>you</span> : null}
                        </button>
                      )
                    })}
                  </div>
                  {result !== null ? (
                    <span className={styles.rowVerdict}>
                      {result.correct ? '✓' : `→ P${result.actual}`}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>

          {grade === null ? (
            <div className={styles.submitRow}>
              <span className={styles.hint}>
                {complete ? 'All six placed — claims are final.' : `${cards.filter((card) => picks[card] === undefined).length} still to place`}
              </span>
              <button
                type="button"
                className={`${c.btn} ${c.btnTall} ${c.primary}`}
                disabled={!complete}
                onClick={() => submitRef.current()}
              >
                Call the claim · Enter
              </button>
            </div>
          ) : (
            <div className={`${styles.verdict} ${grade.won ? styles.verdictWon : styles.verdictVoid}`}>
              <span className={styles.verdictWord}>{grade.won ? 'Claimed' : 'Void'}</span>
              <span className={styles.verdictDetail}>
                {grade.won
                  ? `All six placed true — ${bookLabel(puzzle.book)} scores for your team.`
                  : `${grade.correct}/6 right. Right team, wrong seats — the book is dead and nobody scores.`}
              </span>
              <button type="button" className={`${c.btn} ${c.btnTall} ${grade.won ? c.primary : c.secondary}`} onClick={() => onDoneRef.current(grade)}>
                {index + 1 === count ? 'Finish · Enter' : 'Next claim · Enter'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">
        {grade !== null ? (grade.won ? 'Claim won.' : `Claim void. ${grade.correct} of six were right.`) : ''}
      </div>
    </div>
  )
}
