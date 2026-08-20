/**
 * Claim flow — pick a half-suit, then place all six cards with your team
 * (your own cards preset to you, overridable). One tap on claim-submit sends
 * the claim; the "Claims are final" warning sits beside it the whole time.
 */
import { useState } from 'react'
import type { BookId, Card, PublicState, Seat } from '../../lib/engine/index.ts'
import type { ClientAction } from '../api/types.ts'
import type { ActOutcome } from '../hooks/useRoom.ts'
import {
  buildClaimMatrix,
  claimBookOptions,
  claimComplete,
  claimMissingCount,
  toClaimPayload,
  type ClaimAssignments,
  type ClaimMatrix,
} from '../viewmodels/claim.ts'
import { bookLabel, cardLabel } from '../viewmodels/format.ts'
import { PlayingCard } from './PlayingCard.tsx'
import { Sheet } from './Sheet.tsx'
import c from './controls.module.css'
import styles from './ClaimSheet.module.css'

interface ClaimSheetProps {
  game: PublicState
  mySeat: Seat
  hand: readonly Card[]
  nameOf: (seat: Seat) => string
  paused: boolean
  onClose: () => void
  act: (action: ClientAction) => Promise<ActOutcome>
}

export function ClaimSheet({ game, mySeat, hand, nameOf, paused, onClose, act }: ClaimSheetProps) {
  const books = claimBookOptions(game)
  const [matrix, setMatrix] = useState<ClaimMatrix | null>(null)
  const [assignments, setAssignments] = useState<ClaimAssignments>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickBook = (book: BookId) => {
    const m = buildClaimMatrix(book, mySeat, hand)
    const preset: ClaimAssignments = {}
    for (const row of m.rows) {
      if (row.preset !== null) preset[row.card] = row.preset
    }
    setMatrix(m)
    setAssignments(preset)
    setError(null)
  }

  const assign = (card: Card, seat: Seat) => {
    setAssignments((prev) => ({ ...prev, [card]: seat }))
  }

  const complete = matrix !== null && claimComplete(matrix, assignments)
  const missing = matrix !== null ? claimMissingCount(matrix, assignments) : 6

  const submit = async () => {
    if (!matrix || busy) return
    const payload = toClaimPayload(matrix, assignments)
    if (!payload) return
    setBusy(true)
    setError(null)
    const outcome = await act({ type: 'claim', book: matrix.book, assignments: payload })
    setBusy(false)
    if (outcome.ok) onClose()
    else setError(outcome.message ?? 'That claim was refused.')
  }

  return (
    <Sheet title="Claim a" titleAccent="half-suit" onClose={onClose}>
      <div className={styles.step}>
        <span className={c.fieldLabel}>1 · Which half-suit</span>
        <div className={styles.books}>
          {books.map((b) => (
            <button
              key={b.book}
              type="button"
              data-testid={`claim-book-${b.book}`}
              disabled={b.resolved}
              aria-pressed={matrix?.book === b.book}
              className={`${styles.book} ${matrix?.book === b.book ? styles.picked : ''}`}
              onClick={() => pickBook(b.book)}
            >
              <span className={styles.bookLabel}>{b.label}</span>
              <span className={styles.bookState}>{b.resolved ? 'resolved' : 'open'}</span>
            </button>
          ))}
        </div>
      </div>

      {matrix !== null ? (
        <div className={styles.step}>
          <span className={c.fieldLabel}>2 · Who holds each card ({bookLabel(matrix.book)})</span>
          <p className={styles.warning}>
            All six must sit with your team, exactly where you say. A single miss forfeits the book. Claims are final.
          </p>
          <div className={styles.matrix}>
            {matrix.rows.map((row) => (
              <div key={row.card} className={styles.row}>
                <span className={styles.rowCard}>
                  <PlayingCard card={row.card} size="xs" />
                  <span className={styles.rowLabel}>{cardLabel(row.card)}</span>
                </span>
                <div className={styles.rowSeats}>
                  {matrix.teamSeats.map((seat) => {
                    const selected = assignments[row.card] === seat
                    const isPresetSelf = row.preset === seat && seat === mySeat
                    return (
                      <button
                        key={seat}
                        type="button"
                        data-testid={`claim-card-${row.card}-seat-${seat}`}
                        aria-pressed={selected}
                        className={[
                          styles.seatPick,
                          selected ? styles.seatPicked : '',
                          selected && isPresetSelf ? styles.seatLocked : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => assign(row.card, seat)}
                      >
                        <span className={styles.seatWho}>{seat === mySeat ? 'you' : nameOf(seat)}</span>
                        <span className={styles.seatNo}>P{seat}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {paused ? <p className={styles.warning}>Paused — claims resume when everyone is back.</p> : null}

      <div className={styles.submitRow}>
        <span className={styles.finalNote}>{complete ? 'Claims are final.' : matrix ? `${missing} still to place` : 'Pick a half-suit first'}</span>
        <button
          type="button"
          data-testid="claim-submit"
          className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.submit}`}
          disabled={!complete || busy || paused}
          onClick={() => void submit()}
        >
          {matrix ? `Claim ${bookLabel(matrix.book)} — final` : 'Claim'}
        </button>
      </div>
    </Sheet>
  )
}
