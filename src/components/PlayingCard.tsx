/**
 * A rendered playing card — warm off-white face, serif rank, unicode suit.
 * Sizes per the tokens' card ladder; large cards use corner glyphs.
 */
import type { Card } from '../../lib/engine/index.ts'
import { SUIT_GLYPH, cardRank, cardSuit, isRedSuit, rankLabel } from '../viewmodels/format.ts'
import styles from './PlayingCard.module.css'

export type CardSize = 'lg' | 'md' | 'sm' | 'xs'

interface PlayingCardProps {
  card: Card
  size?: CardSize
  className?: string
}

const SIZE_CLASS: Record<CardSize, string> = {
  lg: styles.lg,
  md: styles.md,
  sm: styles.sm,
  xs: styles.xs,
}

/** Presentational card face (wrap in a <button> for interactive uses). */
export function PlayingCard({ card, size = 'md', className }: PlayingCardProps) {
  const suit = cardSuit(card)
  const rank = rankLabel(cardRank(card))
  const glyph = SUIT_GLYPH[suit]
  const color = isRedSuit(suit) ? styles.red : ''
  const cls = [styles.card, SIZE_CLASS[size], color, className ?? ''].filter(Boolean).join(' ')
  if (size === 'lg' || size === 'md') {
    return (
      <span className={cls} aria-hidden="true">
        <span className={styles.cornerRank}>{rank}</span>
        <span className={styles.cornerSuit}>{glyph}</span>
        <span className={styles.bigSuit}>{glyph}</span>
      </span>
    )
  }
  return (
    <span className={cls} aria-hidden="true">
      <span className={styles.centerRank}>{rank}</span>
      <span className={styles.centerSuit}>{glyph}</span>
    </span>
  )
}
