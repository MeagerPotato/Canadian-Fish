/**
 * Ask flow — opponent → half-suit → card → submit (PROTOCOL §7 testids).
 * Options are filtered to legal moves only (RULES.md §2); server errors are
 * still surfaced inline just in case.
 */
import { useState } from 'react'
import type { BookId, Card, PublicState, Seat } from '../../lib/engine/index.ts'
import type { ClientAction } from '../api/types.ts'
import type { ActOutcome } from '../hooks/useRoom.ts'
import { buildAskOptions } from '../viewmodels/ask.ts'
import { cardLabel } from '../viewmodels/format.ts'
import { PlayingCard } from './PlayingCard.tsx'
import { Sheet } from './Sheet.tsx'
import c from './controls.module.css'
import styles from './AskSheet.module.css'

interface AskSheetProps {
  game: PublicState
  mySeat: Seat
  hand: readonly Card[]
  nameOf: (seat: Seat) => string
  paused: boolean
  onClose: () => void
  act: (action: ClientAction) => Promise<ActOutcome>
}

export function AskSheet({ game, mySeat, hand, nameOf, paused, onClose, act }: AskSheetProps) {
  const options = buildAskOptions(game, mySeat, hand)
  const [target, setTarget] = useState<Seat | null>(null)
  const [book, setBook] = useState<BookId | null>(null)
  const [card, setCard] = useState<Card | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cards = book ? (options.cardsByBook[book] ?? []) : []
  const ready = target !== null && card !== null && !busy && !paused

  const pickBook = (b: BookId) => {
    setBook(b)
    setCard(null)
  }

  const submit = async () => {
    if (target === null || card === null || busy) return
    setBusy(true)
    setError(null)
    const outcome = await act({ type: 'ask', target, card })
    setBusy(false)
    if (outcome.ok) onClose()
    else setError(outcome.message ?? 'That ask was refused.')
  }

  return (
    <Sheet title="Ask for a" titleAccent="card" onClose={onClose}>
      {!options.canAsk && options.reason ? <p className={styles.blocked}>{options.reason}</p> : null}

      <div className={styles.step}>
        <span className={c.fieldLabel}>1 · Which opponent</span>
        <div className={styles.targets}>
          {options.targets.map((t) => (
            <button
              key={t.seat}
              type="button"
              data-testid={`ask-target-${t.seat}`}
              disabled={!t.enabled || !options.canAsk}
              aria-pressed={target === t.seat}
              className={`${styles.target} ${target === t.seat ? styles.picked : ''}`}
              onClick={() => setTarget(t.seat)}
            >
              <span className={styles.targetName}>{nameOf(t.seat)}</span>
              <span className={styles.targetCount}>{t.count} cards</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.step}>
        <span className={c.fieldLabel}>2 · Which half-suit (you must hold one of it)</span>
        <div className={styles.books}>
          {options.books.map((b) => (
            <button
              key={b.book}
              type="button"
              data-testid={`ask-book-${b.book}`}
              disabled={!b.enabled || !options.canAsk}
              aria-pressed={book === b.book}
              className={`${styles.book} ${book === b.book ? styles.picked : ''}`}
              onClick={() => pickBook(b.book)}
            >
              <span className={styles.bookLabel}>{b.label}</span>
              <span className={styles.bookHeld}>{b.enabled ? `${b.held.length} held` : 'all six held'}</span>
            </button>
          ))}
        </div>
      </div>

      {book !== null ? (
        <div className={styles.step}>
          <span className={c.fieldLabel}>3 · Which card (ones you do not hold)</span>
          <div className={styles.cards}>
            {cards.map((cd) => (
              <button
                key={cd}
                type="button"
                data-testid={`ask-card-${cd}`}
                disabled={!options.canAsk}
                aria-pressed={card === cd}
                aria-label={`Ask for ${cardLabel(cd)}`}
                className={`${styles.cardPick} ${card === cd ? styles.picked : ''}`}
                onClick={() => setCard(cd)}
              >
                <PlayingCard card={cd} size="md" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {paused ? <p className={styles.blocked}>Paused — asks resume when everyone is back.</p> : null}

      <button
        type="button"
        data-testid="ask-submit"
        className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.submit}`}
        disabled={!ready}
        onClick={() => void submit()}
      >
        {target !== null && card !== null
          ? `Ask ${nameOf(target)} for ${cardLabel(card)}`
          : 'Pick an opponent, a half-suit, a card'}
      </button>
    </Sheet>
  )
}
