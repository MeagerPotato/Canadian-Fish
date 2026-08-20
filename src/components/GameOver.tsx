/**
 * Game-over overlay — verdict word, final books as a hairline grid, score,
 * play-again link home. Testids: game-over, winner (text exactly A/B/tie).
 */
import { Link } from 'react-router-dom'
import type { PublicState } from '../../lib/engine/index.ts'
import { ALL_BOOKS } from '../../lib/engine/index.ts'
import { bookLabel } from '../viewmodels/format.ts'
import { winnerText } from '../viewmodels/table.ts'
import c from './controls.module.css'
import styles from './GameOver.module.css'

interface GameOverProps {
  game: PublicState
  myTeamLetter: 'A' | 'B' | null
}

export function GameOver({ game, myTeamLetter }: GameOverProps) {
  const winner = winnerText(game.score)
  const won = myTeamLetter !== null && winner === myTeamLetter
  const verdict =
    winner === 'tie' ? (
      <>
        A dead <span data-testid="winner">tie</span>
      </>
    ) : (
      <>
        Team <span data-testid="winner">{winner}</span> takes it
      </>
    )
  return (
    <div className={styles.overlay} data-testid="game-over" role="dialog" aria-modal="true" aria-label="Game over">
      <div className={styles.panel}>
        <span className={c.eyebrow}>Game over</span>
        <h2 className={`${styles.verdict} ${winner === 'tie' ? styles.tie : won ? styles.won : styles.lost}`}>{verdict}</h2>
        <p className={styles.scoreLine}>
          <span className={styles.scoreA}>A · {game.score[0]}</span>
          <span className={styles.scoreSep}>—</span>
          <span className={styles.scoreB}>{game.score[1]} · B</span>
        </p>
        <div className={styles.grid}>
          {ALL_BOOKS.map((book) => {
            const result = game.books[book]
            const outcome = result ? (result.outcome === 'team0' ? 'A' : result.outcome === 'team1' ? 'B' : 'void') : '—'
            return (
              <div key={book} className={styles.cell}>
                <span className={styles.cellKey}>{bookLabel(book)}</span>
                <span
                  className={`${styles.cellVal} ${outcome === 'A' ? styles.valA : outcome === 'B' ? styles.valB : styles.valVoid}`}
                >
                  {outcome}
                </span>
              </div>
            )
          })}
        </div>
        <Link to="/" className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.again}`}>
          Play again
        </Link>
      </div>
    </div>
  )
}
