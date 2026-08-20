/**
 * Status banners: dismissible error, paused (with reconnect votes), realtime
 * disconnected. Testids per PROTOCOL §7: error-banner, paused-banner,
 * disconnected-banner, vote-bot-{n}.
 */
import type { Seat } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'
import { seatName } from '../viewmodels/format.ts'
import styles from './Banners.module.css'

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className={styles.error} data-testid="error-banner" role="alert">
      <span className={styles.errorText}>{message}</span>
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

export function DisconnectedBanner() {
  return (
    <div className={styles.disconnected} data-testid="disconnected-banner" role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Live updates dropped — reconnecting…</span>
    </div>
  )
}

interface PausedBannerProps {
  room: PublicRoomState
  mySeat: Seat | null
  onVote: (seat: number) => void
}

/** Paused strip: names the missing players and hosts the vote-bot controls. */
export function PausedBanner({ room, mySeat, onVote }: PausedBannerProps) {
  const gone = room.seats.filter((s) => s.filled && !s.isBot && !s.connected && s.seat !== mySeat)
  const vote = room.pendingVote
  return (
    <div className={styles.paused} data-testid="paused-banner" role="status">
      <div className={styles.pausedHead}>
        <span className={styles.pausedWord}>Paused</span>
        <span className={styles.pausedWhy}>
          {gone.length > 0
            ? `waiting for ${gone.map((s) => s.name ?? `P${s.seat}`).join(', ')} to reconnect`
            : 'waiting for a player to reconnect'}
        </span>
      </div>
      {gone.map((s) => (
        <div key={s.seat} className={styles.voteRow}>
          <span className={styles.voteLabel}>
            {vote && vote.targetSeat === s.seat
              ? `Replace ${s.name ?? `P${s.seat}`} with a bot? ${vote.yes}/${vote.needed} votes`
              : `Gone too long? The table can vote to hand ${s.name ?? `P${s.seat}`}'s seat to a bot.`}
          </span>
          <button type="button" className={styles.voteBtn} data-testid={`vote-bot-${s.seat}`} onClick={() => onVote(s.seat)}>
            Vote bot
          </button>
        </div>
      ))}
      <p className={styles.pausedNote}>Their seat is saved — reopening the room link restores it. Votes open after 90 seconds away.</p>
    </div>
  )
}

/** Non-blocking notice that a vote is running while the room is not paused. */
export function VoteBanner({ room, onVote }: { room: PublicRoomState; onVote: (seat: number) => void }) {
  const vote = room.pendingVote
  if (!vote) return null
  const name = seatName(room, vote.targetSeat as Seat)
  return (
    <div className={styles.paused} role="status">
      <div className={styles.voteRow}>
        <span className={styles.voteLabel}>
          Replace {name} with a bot? {vote.yes}/{vote.needed} votes
        </span>
        <button
          type="button"
          className={styles.voteBtn}
          data-testid={`vote-bot-${vote.targetSeat}`}
          onClick={() => onVote(vote.targetSeat)}
        >
          Vote bot
        </button>
      </div>
    </div>
  )
}
