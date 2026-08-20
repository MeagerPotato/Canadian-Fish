/**
 * Lobby — room code + copy link, two team columns of seats (tap two to swap),
 * host-gated start. Testids per PROTOCOL §7.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Seat } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'
import { buildLobby, type LobbySeatVM } from '../viewmodels/lobby.ts'
import c from './controls.module.css'
import styles from './LobbyView.module.css'

interface LobbyViewProps {
  room: PublicRoomState
  mySeat: Seat | null
  onSwap: (a: number, b: number) => void
  onStart: () => void
}

export function LobbyView({ room, mySeat, onSwap, onStart }: LobbyViewProps) {
  const vm = buildLobby(room, mySeat)
  const [picked, setPicked] = useState<Seat | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(t)
  }, [copied])

  const tapSeat = (seat: Seat) => {
    if (picked === null) {
      setPicked(seat)
    } else if (picked === seat) {
      setPicked(null)
    } else {
      onSwap(picked, seat)
      setPicked(null)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const seatButton = (seat: LobbySeatVM) => (
    <button
      key={seat.seat}
      type="button"
      data-testid={`seat-${seat.seat}`}
      data-filled={seat.filled ? 'true' : 'false'}
      data-team={seat.teamLetter}
      aria-pressed={picked === seat.seat}
      className={[
        styles.seat,
        seat.teamLetter === 'A' ? styles.seatA : styles.seatB,
        seat.filled ? '' : styles.seatEmpty,
        picked === seat.seat ? styles.seatPicked : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => tapSeat(seat.seat)}
    >
      <span className={c.plaque}>
        P{seat.seat} · {seat.teamLetter}
      </span>
      <span data-testid={`seat-name-${seat.seat}`} className={seat.filled ? styles.seatName : styles.seatWaiting}>
        {seat.filled ? seat.name : 'waiting…'}
      </span>
      <span className={styles.seatTags}>
        {seat.isYou ? <span className={styles.tagYou}>you</span> : null}
        {seat.isHost ? <span className={styles.tagHost}>host</span> : null}
        {seat.isBot ? <span className={styles.tagHost}>bot</span> : null}
      </span>
    </button>
  )

  return (
    <div className={styles.lobby}>
      <div className={styles.codeCard}>
        <span className={c.eyebrow}>Room code</span>
        <div className={styles.codeRow}>
          <span className={styles.code} data-testid="room-code">
            {vm.code}
          </span>
          <button type="button" className={`${c.btn} ${c.btnTall} ${c.secondary}`} onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p className={styles.codeHint}>Share the code or the link — six seats, first come first seated.</p>
      </div>

      <div className={styles.teams}>
        <div className={styles.teamCol}>
          <h2 className={`${styles.teamTitle} ${styles.teamTitleA}`}>Team A</h2>
          {vm.teamA.map(seatButton)}
        </div>
        <div className={styles.teamCol}>
          <h2 className={`${styles.teamTitle} ${styles.teamTitleB}`}>Team B</h2>
          {vm.teamB.map(seatButton)}
        </div>
      </div>

      <p className={styles.swapHint}>
        {picked !== null ? `Now tap the seat to trade P${picked} with.` : 'Tap two seats to swap them — anyone can rearrange before the deal.'}
      </p>

      <div className={styles.startRow}>
        <button
          type="button"
          data-testid="start-game"
          className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.startBtn}`}
          disabled={!vm.canStart}
          onClick={onStart}
        >
          Deal the cards
        </button>
        <span className={styles.startNote}>
          {vm.startBlocked ?? 'All six seated — the host may deal.'} · {vm.filledCount}/6 seated
        </span>
      </div>

      <p className={styles.botHint}>
        Short a few players? Start a solo table against bots from <Link to="/practice/game">Practice</Link>.
      </p>
    </div>
  )
}
