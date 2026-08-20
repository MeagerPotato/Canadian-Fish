/**
 * My hand — fanned 60×85 cards pinned to the bottom, grouped by book with a
 * seam between groups, scrolling within itself when wide (DESIGN_NOTES §5).
 * Every card is a real button (tap to lift/inspect).
 */
import { useMemo, useState } from 'react'
import type { Card } from '../../lib/engine/index.ts'
import { cardBook, sortHand } from '../../lib/engine/index.ts'
import { cardLabel, cardBookLabel } from '../viewmodels/format.ts'
import { PlayingCard } from './PlayingCard.tsx'
import styles from './HandFan.module.css'

interface HandFanProps {
  hand: readonly Card[]
  /** Attention ring while the owner must act. */
  attention: boolean
}

export function HandFan({ hand, attention }: HandFanProps) {
  const [lifted, setLifted] = useState<Card | null>(null)
  const cards = useMemo(() => sortHand(hand), [hand])
  const n = cards.length
  return (
    <div className={`${styles.wrap} ${attention ? styles.attention : ''}`} data-testid="hand">
      <div className={styles.meta}>
        <span className={styles.label}>Your hand</span>
        <span className={styles.count}>
          {n} {n === 1 ? 'card' : 'cards'}
        </span>
      </div>
      {n === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyWord}>No cards</span>
          <span className={styles.emptyHint}>You are out — the table plays on around you.</span>
        </div>
      ) : (
        <div className={styles.scroller}>
          <div className={styles.fan} role="group" aria-label={`Your hand, ${n} cards`}>
            {cards.map((card, i) => {
              const groupStart = i > 0 && cardBook(card) !== cardBook(cards[i - 1])
              const tilt = n <= 9 ? (i - (n - 1) / 2) * 3 : 0
              const isLifted = lifted === card
              return (
                <button
                  key={card}
                  type="button"
                  data-testid={`card-${card}`}
                  aria-label={`${cardLabel(card)} of ${cardBookLabel(card)}`}
                  aria-pressed={isLifted}
                  className={`${styles.cardBtn} ${groupStart ? styles.groupStart : ''} ${isLifted ? styles.lifted : ''}`}
                  style={{ transform: `rotate(${tilt}deg)${isLifted ? ' translateY(-12px)' : ''}` }}
                  onClick={() => setLifted(isLifted ? null : card)}
                >
                  <PlayingCard card={card} size="lg" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
