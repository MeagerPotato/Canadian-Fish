/**
 * The table screen — mobile-first stack: sticky status strip, your-turn
 * banner, felt, books, action CTAs, fanned hand, public log. Desktop gets the
 * two-column shell for free (table left, record right).
 */
import { useMemo, useState } from 'react'
import type { Card, PublicState, Seat } from '../../lib/engine/index.ts'
import { ALL_BOOKS, seatTeam } from '../../lib/engine/index.ts'
import type { ClientAction, PublicRoomState } from '../api/types.ts'
import type { ActOutcome } from '../hooks/useRoom.ts'
import { buildAskOptions } from '../viewmodels/ask.ts'
import { canOpenClaim } from '../viewmodels/claim.ts'
import { bookLabel, namesFrom, teamLetter } from '../viewmodels/format.ts'
import { latestLine } from '../viewmodels/log.ts'
import { mustAct, turnPrompt } from '../viewmodels/table.ts'
import { AskSheet } from './AskSheet.tsx'
import { ClaimSheet } from './ClaimSheet.tsx'
import { CoachPanel } from './CoachPanel.tsx'
import { GameOver } from './GameOver.tsx'
import { HandFan } from './HandFan.tsx'
import { LogPanel } from './LogPanel.tsx'
import { PassSheet } from './PassSheet.tsx'
import { TableFelt } from './TableFelt.tsx'
import c from './controls.module.css'
import styles from './TableView.module.css'

interface TableViewProps {
  room: PublicRoomState
  game: PublicState
  you: { seat: Seat; name: string }
  hand: readonly Card[]
  act: (action: ClientAction) => Promise<ActOutcome>
  /** ?coach=1 practice overlay (SPEC §8.6) — additive, off by default. */
  coach?: boolean
}

export function TableView({ room, game, you, hand, act, coach = false }: TableViewProps) {
  // A sheet request is pinned to the move it was opened on: any engine action
  // (moveIndex bump) or a lost precondition silently retires it — no effects.
  const [sheetReq, setSheetReq] = useState<{ kind: 'ask' | 'claim'; moveIndex: number } | null>(null)
  const nameOf = useMemo(() => namesFrom(room), [room])
  const mySeat = you.seat
  const myTurn = game.turn === mySeat
  const acting = mustAct(game, mySeat)
  const finished = game.phase === 'finished' || room.status === 'finished'
  const paused = room.paused
  const latest = latestLine(game.log, nameOf)
  const askOptions = useMemo(() => buildAskOptions(game, mySeat, hand), [game, mySeat, hand])
  const claimable = canOpenClaim(game, mySeat)
  const showAskCta = game.phase === 'playing' && myTurn
  const showClaimCta = claimable

  const askValid = myTurn && game.phase === 'playing'
  const sheet: 'ask' | 'claim' | null =
    sheetReq !== null && sheetReq.moveIndex === game.moveIndex
      ? sheetReq.kind === 'ask' && askValid
        ? 'ask'
        : sheetReq.kind === 'claim' && claimable
          ? 'claim'
          : null
      : null
  const openSheet = (kind: 'ask' | 'claim') => setSheetReq({ kind, moveIndex: game.moveIndex })
  const closeSheet = () => setSheetReq(null)

  const mandatory = acting && (game.phase === 'awaitPass' || game.phase === 'awaitDesignate')

  return (
    <div className={styles.view}>
      <div className={styles.strip}>
        <span
          className={`${styles.dot} ${acting ? styles.dotTurn : ''}`}
          aria-hidden="true"
        />
        <span className={styles.stripText}>
          {latest ? latest.text : 'Cards in the air…'}
        </span>
        <span className={styles.stripMeta}>
          <span className={styles.metaKey}>phase</span>{' '}
          <span data-testid="phase" className={styles.metaVal}>
            {game.phase}
          </span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaKey}>turn</span>{' '}
          <span data-testid="turn-seat" className={styles.metaVal}>
            {game.turn}
          </span>
        </span>
      </div>

      <div className={styles.columns}>
        <div className={styles.left}>
          {acting ? (
            <div className={styles.yourTurn} data-testid="your-turn">
              <span className={styles.yourTurnWord}>Your turn</span>
              <span className={styles.yourTurnHint}>{turnPrompt(game)}</span>
            </div>
          ) : game.phase !== 'finished' ? (
            <p className={styles.waiting}>
              Waiting for <b>{nameOf(game.turn)}</b>
              {game.phase === 'awaitPass'
                ? ' to pass the turn'
                : game.phase === 'awaitDesignate'
                  ? ' to designate a claimer'
                  : game.phase === 'endgame'
                    ? ' to claim the remaining half-suits'
                    : '…'}
            </p>
          ) : null}

          <TableFelt room={room} game={game} mySeat={mySeat} />

          <div className={styles.booksRow} aria-label="Half-suit results">
            {ALL_BOOKS.map((book) => {
              const result = game.books[book]
              const outcome = result ? (result.outcome === 'void' ? 'Ø' : result.outcome === 'team0' ? 'A' : 'B') : null
              return (
                <span
                  key={book}
                  className={[
                    styles.bookPlaque,
                    outcome === 'A' ? styles.bookA : '',
                    outcome === 'B' ? styles.bookB : '',
                    outcome === 'Ø' ? styles.bookVoid : '',
                    outcome === null ? styles.bookOpen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {bookLabel(book)}
                  {outcome ? <b className={styles.bookOutcome}>{outcome}</b> : null}
                </span>
              )
            })}
          </div>

          {(showAskCta || showClaimCta) && !finished ? (
            <div className={styles.actions}>
              {showAskCta ? (
                <button
                  type="button"
                  data-testid="ask-open"
                  className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.actionBtn}`}
                  disabled={!askOptions.canAsk || paused}
                  onClick={() => openSheet('ask')}
                >
                  Ask for a card
                </button>
              ) : null}
              {showClaimCta ? (
                <button
                  type="button"
                  data-testid="claim-open"
                  className={`${c.btn} ${c.btnTall} ${game.phase === 'endgame' ? c.primary : c.secondary} ${styles.actionBtn}`}
                  disabled={paused}
                  onClick={() => openSheet('claim')}
                >
                  Claim a half-suit
                </button>
              ) : null}
            </div>
          ) : null}
          {showAskCta && !askOptions.canAsk && askOptions.reason ? (
            <p className={styles.actionNote}>{askOptions.reason}</p>
          ) : null}

          <HandFan hand={hand} attention={acting && !finished} />
        </div>

        <div className={styles.right}>
          <LogPanel log={game.log} nameOf={nameOf} />
          {coach && !finished && myTurn && (game.phase === 'playing' || game.phase === 'endgame') ? (
            <CoachPanel game={game} mySeat={mySeat} hand={hand} nameOf={nameOf} />
          ) : null}
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">
        {finished ? 'Game over.' : acting ? `Your turn. ${turnPrompt(game)}` : latest?.text ?? ''}
      </div>

      {sheet === 'ask' && !finished ? (
        <AskSheet
          game={game}
          mySeat={mySeat}
          hand={hand}
          nameOf={nameOf}
          paused={paused}
          onClose={closeSheet}
          act={act}
        />
      ) : null}
      {sheet === 'claim' && !finished ? (
        <ClaimSheet
          game={game}
          mySeat={mySeat}
          hand={hand}
          nameOf={nameOf}
          paused={paused}
          onClose={closeSheet}
          act={act}
        />
      ) : null}
      {mandatory && !finished ? (
        <PassSheet
          mode={game.phase === 'awaitPass' ? 'pass' : 'designate'}
          game={game}
          mySeat={mySeat}
          nameOf={nameOf}
          paused={paused}
          act={act}
        />
      ) : null}
      {finished ? <GameOver game={game} myTeamLetter={teamLetter(seatTeam(mySeat))} /> : null}
    </div>
  )
}
