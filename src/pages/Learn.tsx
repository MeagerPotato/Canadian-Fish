/**
 * /learn — interactive onboarding: a scripted, annotated real game replayed
 * step by step through the pure engine (src/learn/script.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { PlayingCard } from '../components/PlayingCard.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import c from '../components/controls.module.css'
import { buildLearnGame } from '../learn/script.ts'
import type { LearnFrame } from '../learn/script.ts'
import { actionLine, bookChips, claimMatrix, relevantHands, ringSeats } from '../learn/viewmodels.ts'
import { cardLabel } from '../viewmodels/format.ts'
import styles from './Learn.module.css'

const OUTCOME_WORD = { team0: 'TEAM A', team1: 'TEAM B', void: 'VOID', open: 'OPEN' } as const

function SeatRing({ frame }: { frame: LearnFrame }) {
  const seats = ringSeats(frame)
  const [a, b] = frame.before.score
  return (
    <div className={styles.ring} role="img" aria-label={`Table before the move. Score Team A ${a}, Team B ${b}.`}>
      {seats.map((s) => (
        <div
          key={s.seat}
          className={[
            styles.seat,
            s.team === 'A' ? styles.seatA : styles.seatB,
            s.active ? styles.seatActive : '',
            s.target ? styles.seatTarget : '',
            s.out ? styles.seatOut : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
        >
          <span className={c.plaque}>
            P{s.seat} · {s.team}
          </span>
          <span className={styles.seatCount}>{s.out ? 'OUT' : `${s.count} CARDS`}</span>
        </div>
      ))}
      <div className={styles.ringCenter}>
        <span className={styles.scoreValue}>
          A {a} — {b} B
        </span>
        <span className={styles.scoreLabel}>BOOKS</span>
      </div>
    </div>
  )
}

function StepSlide({ frame }: { frame: LearnFrame }) {
  const matrix = claimMatrix(frame)
  const hands = relevantHands(frame)
  const phase = frame.after.phase
  return (
    <div className={styles.slide}>
      <SeatRing frame={frame} />
      <div className={styles.actionStrip}>
        <span className={styles.actionLine}>{actionLine(frame)}</span>
        {phase !== 'playing' ? <span className={c.badge}>{phase.toUpperCase()}</span> : null}
      </div>
      <div className={styles.annotation}>
        <h2 className={styles.annTitle}>{frame.step.annotation.title}</h2>
        <p className={styles.annBody}>{frame.step.annotation.body}</p>
      </div>
      {matrix !== null ? (
        <div className={styles.matrix}>
          <div className={styles.matrixHead}>
            <span>
              THE CLAIM · {matrix.bookLabel} → {OUTCOME_WORD[matrix.outcome]}
            </span>
          </div>
          {matrix.rows.map((row) => (
            <div key={row.card} className={styles.matrixRow}>
              <PlayingCard card={row.card} size="xs" />
              <span className={styles.matrixSaid}>SAID P{row.said}</span>
              <span className={styles.matrixArrow} aria-hidden="true">
                →
              </span>
              <span className={row.opponent ? styles.matrixOpp : styles.matrixActual}>HELD P{row.actual}</span>
              <span
                className={row.right ? styles.matrixRight : styles.matrixWrong}
                aria-label={row.right ? 'placed correctly' : 'placed wrong'}
              >
                {row.right ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {hands.map((h) => (
        <div key={h.seat} className={styles.hand}>
          <span className={`${styles.handLabel} ${h.team === 'A' ? styles.handLabelA : styles.handLabelB}`}>
            {h.label}
          </span>
          <div className={styles.handCards}>
            {h.cards.length === 0 ? (
              <span className={styles.handEmpty}>NO CARDS</span>
            ) : (
              h.cards.map((card) => (
                <span key={card} className={h.marked.has(card) ? styles.cardMarked : styles.cardPlain}>
                  <PlayingCard card={card} size="xs" />
                  <span className="visually-hidden">{cardLabel(card)}</span>
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function IntroSlide({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.slide}>
      <h1 className={styles.title}>
        Learn the <span className={styles.accent}>game</span>
      </h1>
      <p className={styles.lede}>
        Canadian Fish (also called Literature) is a partnership memory game for six players. This walkthrough replays a
        real game one move at a time — every hand is face up, because the point is to see how the machine works.
      </p>
      <SectionCard title="The shape of it" sub="48 CARDS · 8 HALF-SUITS · 2 TEAMS">
        <ul className={styles.list}>
          <li>
            <b>The goal:</b> win more books than the other team. A book is a half-suit of six cards, and it is won by
            claiming it — naming exactly who holds every one of its cards.
          </li>
          <li>
            <b>Teams:</b> six players in two teams of three, seated alternating — P0, P2, P4 are Team A; P1, P3, P5 are
            Team B.
          </li>
          <li>
            <b>The deck:</b> a standard deck with the four 8s removed, 48 cards, all dealt — eight to each player.
          </li>
          <li>
            <b>The books:</b> each suit splits into LOW (2 3 4 5 6 7) and HIGH (9 10 J Q K A) — eight books of six.
          </li>
          <li>
            <b>The engine of play:</b> on your turn you ask one specific opponent for one specific card. Have it — they
            hand it over and you ask again. Don't — the turn becomes theirs.
          </li>
        </ul>
      </SectionCard>
      <div className={styles.ctaRow}>
        <button type="button" className={`${c.btn} ${c.btnTall} ${c.primary}`} onClick={onStart}>
          Start the walkthrough
        </button>
        <Link to="/learn/rules-card" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
          Printable rules card
        </Link>
      </div>
    </div>
  )
}

function FinaleSlide({ frames }: { frames: LearnFrame[] }) {
  const final = frames[frames.length - 1].after
  const chips = bookChips(final)
  return (
    <div className={styles.slide}>
      <h1 className={styles.title}>
        You know the <span className={styles.accent}>whole game</span>
      </h1>
      <p className={styles.lede}>
        Team A wins {final.score[0]}–{final.score[1]}. You have now seen every rule in motion: hits, misses, the three
        claim outcomes, the claim-out pass, and the endgame. The rest — memory, deduction, and nerve — is practice.
      </p>
      <SectionCard title="The final ledger" sub="EIGHT BOOKS, SCORED OR VOID">
        <div className={styles.bookGrid}>
          {chips.map((chip) => (
            <span
              key={chip.book}
              className={`${styles.bookChip} ${
                chip.state === 'team0' ? styles.bookA : chip.state === 'team1' ? styles.bookB : styles.bookVoid
              }`}
            >
              {chip.label} · {OUTCOME_WORD[chip.state]}
            </span>
          ))}
        </div>
      </SectionCard>
      <div className={styles.ctaRow}>
        <Link to="/practice/game" className={`${c.btn} ${c.btnTall} ${c.primary}`}>
          Play a game vs bots
        </Link>
        <Link to="/strategy" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
          Strategy notes
        </Link>
        <Link to="/" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
          Back to the table
        </Link>
      </div>
    </div>
  )
}

export default function Learn() {
  const { frames } = useMemo(() => buildLearnGame(), [])
  const total = frames.length + 2
  const [index, setIndex] = useState(0)

  const goto = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(total - 1, i)))
    },
    [total],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(total - 1, i + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const stepFrame = index >= 1 && index <= frames.length ? frames[index - 1] : null
  const announce =
    index === 0
      ? 'Introduction'
      : stepFrame !== null
        ? `Step ${index} of ${frames.length}: ${stepFrame.step.annotation.title}`
        : 'Finale'

  return (
    <AppShell active="learn">
      <div className={styles.header}>
        <span className={c.eyebrow}>Interactive walkthrough</span>
        <span className={styles.counter}>
          {index === 0 ? 'INTRO' : index === total - 1 ? 'FINALE' : `STEP ${index} / ${frames.length}`}
        </span>
      </div>
      <div className="visually-hidden" aria-live="polite">
        {announce}
      </div>
      <div key={index} className={styles.slideWrap}>
        {index === 0 ? (
          <IntroSlide onStart={() => goto(1)} />
        ) : index === total - 1 ? (
          <FinaleSlide frames={frames} />
        ) : stepFrame !== null ? (
          <StepSlide frame={stepFrame} />
        ) : null}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={`${c.btn} ${c.btnTall} ${c.secondary}`}
          onClick={() => goto(index - 1)}
          disabled={index === 0}
        >
          ← Back
        </button>
        <button
          type="button"
          className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.nextBtn}`}
          onClick={() => goto(index + 1)}
          disabled={index === total - 1}
        >
          Next →
        </button>
      </div>
      <div className={styles.dots} role="tablist" aria-label="Walkthrough steps">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={i === 0 ? 'Introduction' : i === total - 1 ? 'Finale' : `Step ${i}`}
            className={`${styles.dot} ${i === index ? styles.dotActive : i < index ? styles.dotDone : ''}`}
            onClick={() => goto(i)}
          />
        ))}
      </div>
      <p className={styles.kbHint}>Tip: the ← and → keys step through the game.</p>
    </AppShell>
  )
}
