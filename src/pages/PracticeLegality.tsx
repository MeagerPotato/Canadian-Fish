/**
 * /practice/legality — Ask legality drill (SPEC.md §8.2).
 * Twelve propositions against a 4 s clock: V / ← calls valid, I / → calls
 * invalid; the governing rule is revealed after every answer.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../lib/engine/index.ts'
import { seatTeam } from '../../lib/engine/index.ts'
import { PlayingCard } from '../components/PlayingCard.tsx'
import c from '../components/controls.module.css'
import { requireDrill } from '../drills/index.ts'
import {
  LEGALITY_ITEM_MS,
  generateLegalityRound,
  scoreLegality,
  type LegalityAnswer,
} from '../drills/legality.ts'
import { teamLetter } from '../viewmodels/format.ts'
import { useLatest, useStartedAt } from './PracticeHooks.ts'
import { PracticeShell, type DrillRunProps } from './PracticeShell.tsx'
import styles from './PracticeLegality.module.css'

const META = requireDrill('legality')

export default function PracticeLegality() {
  return (
    <PracticeShell
      drill={META}
      scoring="+1 correct · −1 wrong · +1 speed bonus under 2 s — twelve asks"
      unit="item"
      howTo={[
        'You sit at seat 0 (Team A, with seats 2 and 4). A proposed ask appears beside your hand.',
        'Press V or ← if the ask is legal, I or → if it breaks a rule. Four seconds per item.',
        'After each call the governing rule is shown — every illegal category from RULES §2 is in the mix.',
        'A timeout scores nothing and breaks your streak. Esc stops the round.',
      ]}
      renderRun={(p) => <LegalityRun {...p} />}
    />
  )
}

type Phase = 'ask' | 'reveal'

function LegalityRun({ seed, onFinish }: DrillRunProps) {
  const round = useMemo(() => generateLegalityRound(seed), [seed])
  const startedAt = useStartedAt()
  const shownAt = useRef(0)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ask')
  const [answers, setAnswers] = useState<LegalityAnswer[]>([])

  const item = round.items[idx]
  const last = idx === round.items.length - 1

  const answer = (saidValid: boolean | null) => {
    if (phase !== 'ask') return
    setAnswers((a) => [...a, { saidValid, ms: Date.now() - shownAt.current }])
    setPhase('reveal')
  }
  const answerRef = useLatest(answer)

  const advance = () => {
    if (phase !== 'reveal') return
    if (last) {
      const s = scoreLegality(round.items, answers)
      onFinish({
        score: s.score,
        correct: s.correct,
        total: round.items.length,
        items: round.items.length,
        bestStreak: s.bestStreak,
        durationMs: Date.now() - startedAt.current,
      })
      return
    }
    setIdx((i) => i + 1)
    setPhase('ask')
  }
  const advanceRef = useLatest(advance)

  useEffect(() => {
    if (phase === 'ask') shownAt.current = Date.now()
    const ms = phase === 'ask' ? LEGALITY_ITEM_MS : 1800
    const t = window.setTimeout(() => {
      if (phase === 'ask') answerRef.current(null)
      else advanceRef.current()
    }, ms)
    return () => window.clearTimeout(t)
    // ask → reveal → ask alternates, so `phase` re-arms every period.
  }, [phase, answerRef, advanceRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // shell owns exit
      if (phase === 'ask') {
        if (e.key === 'v' || e.key === 'V' || e.key === 'ArrowLeft') {
          e.preventDefault()
          answerRef.current(true)
        } else if (e.key === 'i' || e.key === 'I' || e.key === 'ArrowRight') {
          e.preventDefault()
          answerRef.current(false)
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advanceRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, answerRef, advanceRef])

  const given = answers[idx]
  const right = given !== undefined && given.saidValid !== null && given.saidValid === (item.verdict === 'valid')
  const timedOut = given !== undefined && given.saidValid === null

  return (
    <div className={styles.run}>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          item {idx + 1} / {round.items.length}
        </span>
        <span className={styles.metaItem}>
          score {answers.length > 0 ? scoreLegality(round.items, answers).score : 0}
        </span>
      </div>

      <div className={styles.panel}>
        {phase === 'ask' ? (
          <div className={styles.clock} aria-hidden="true">
            <div className={styles.clockFill} style={{ animationDuration: `${LEGALITY_ITEM_MS}ms` }} />
          </div>
        ) : null}

        <div className={styles.prop}>
          <span className={styles.propLead}>You ask</span>
          <span className={styles.propTarget}>
            P{item.target} · {teamLetter(seatTeam(item.target))} · {item.counts[item.target]}{' '}
            {item.counts[item.target] === 1 ? 'card' : 'cards'}
          </span>
          <span className={styles.propFor}>for</span>
          {/* The one fake-card category ('8♣'…) renders fine: pure string ops. */}
          <PlayingCard card={item.cardText as Card} size="md" />
        </div>

        <div className={styles.hand}>
          <span className={c.fieldLabel}>Your hand · seat 0 · team A</span>
          <div className={styles.handCards}>
            {item.hand.map((card) => (
              <PlayingCard key={card} card={card} size="sm" />
            ))}
          </div>
        </div>

        {phase === 'ask' ? (
          <div className={styles.answers}>
            <button type="button" className={`${styles.callBtn} ${styles.callValid}`} onClick={() => answerRef.current(true)}>
              Valid <kbd className={styles.kbd}>V / ←</kbd>
            </button>
            <button type="button" className={`${styles.callBtn} ${styles.callInvalid}`} onClick={() => answerRef.current(false)}>
              Invalid <kbd className={styles.kbd}>I / →</kbd>
            </button>
          </div>
        ) : (
          <div className={`${styles.reveal} ${right ? styles.revealRight : styles.revealWrong}`}>
            <span className={styles.revealWord}>{right ? 'Right' : timedOut ? 'Too slow' : 'Wrong'}</span>
            <span className={styles.revealVerdict}>
              This ask is {item.verdict === 'valid' ? 'valid' : 'invalid'}
              {item.violation !== null ? ` — ${item.violation.replaceAll('_', ' ').toLowerCase()}` : ''}
            </span>
            <span className={styles.revealRule}>{item.rule}</span>
            <button type="button" className={`${c.btn} ${c.secondary}`} onClick={() => advanceRef.current()}>
              {last ? 'Finish · Enter' : 'Next · Enter'}
            </button>
          </div>
        )}
      </div>

      <div className="visually-hidden" aria-live="polite">
        {phase === 'reveal' ? `${right ? 'Right.' : timedOut ? 'Too slow.' : 'Wrong.'} ${item.rule}` : ''}
      </div>
    </div>
  )
}
