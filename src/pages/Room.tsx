/**
 * /r/:code — the room. Token in storage → straight to /state and render
 * (lobby or table by status). No token → join form. Handles not-found,
 * loading skeletons, banners, and the vote UI (PROTOCOL §5).
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadName } from '../api/storage.ts'
import { useRoom } from '../hooks/useRoom.ts'
import { DisconnectedBanner, ErrorBanner, PausedBanner, VoteBanner } from '../components/Banners.tsx'
import { LobbyView } from '../components/LobbyView.tsx'
import { TableView } from '../components/TableView.tsx'
import { Wordmark } from '../components/AppShell.tsx'
import c from '../components/controls.module.css'
import styles from './Room.module.css'

const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

export default function Room() {
  const params = useParams()
  const code = (params.code ?? '').toUpperCase()
  if (!CODE_RE.test(code)) {
    return <RoomNotFound code={code} />
  }
  // Keyed by code: per-room hook state resets by remounting (never in effects).
  return <RoomInner key={code} code={code} />
}

function RoomInner({ code }: { code: string }) {
  const {
    stage,
    room,
    you,
    hand,
    banner,
    dismissBanner,
    realtimeDown,
    joinBusy,
    joinError,
    join,
    retry,
    act,
    swapSeats,
    startGame,
    voteBot,
  } = useRoom(code)

  const mySeat = you?.seat ?? null
  const showPaused = room !== null && room.paused
  const showVoteOnly = room !== null && !room.paused && room.pendingVote !== null

  const body = useMemo(() => {
    switch (stage) {
      case 'loading':
        return <Skeleton />
      case 'notFound':
        return <RoomNotFoundBody code={code} />
      case 'error':
        return (
          <div className={styles.centerCard}>
            <h2 className={styles.centerTitle}>Could not reach the table</h2>
            <p className={styles.centerText}>The room may still be there — try again.</p>
            <button type="button" className={`${c.btn} ${c.btnTall} ${c.primary}`} onClick={retry}>
              Retry
            </button>
          </div>
        )
      case 'join':
        return <JoinForm code={code} busy={joinBusy} error={joinError} room={room} onJoin={(name) => void join(name)} />
      case 'ready': {
        if (!room) return <Skeleton />
        if (room.status === 'lobby' || !room.game || !you) {
          return <LobbyView room={room} mySeat={mySeat} onSwap={(a, b) => void swapSeats(a, b)} onStart={() => void startGame()} />
        }
        return <TableView room={room} game={room.game} you={you} hand={hand} act={act} />
      }
    }
  }, [stage, code, room, you, hand, mySeat, joinBusy, joinError, join, retry, act, swapSeats, startGame])

  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.top}>
          <Link to="/" className={styles.brand}>
            <Wordmark />
          </Link>
          {room ? <span className={styles.codeChip}>{room.code}</span> : null}
        </header>
        {banner ? <ErrorBanner message={banner} onDismiss={dismissBanner} /> : null}
        {realtimeDown && stage === 'ready' ? <DisconnectedBanner /> : null}
        {showPaused ? <PausedBanner room={room} mySeat={mySeat} onVote={(seat) => void voteBot(seat)} /> : null}
        {showVoteOnly ? <VoteBanner room={room} onVote={(seat) => void voteBot(seat)} /> : null}
        {body}
      </div>
    </div>
  )
}

function JoinForm({
  code,
  busy,
  error,
  room,
  onJoin,
}: {
  code: string
  busy: boolean
  error: string | null
  room: { seats: { filled: boolean }[]; status: string } | null
  onJoin: (name: string) => void
}) {
  const [name, setName] = useState(loadName())
  const filled = room ? room.seats.filter((s) => s.filled).length : null
  return (
    <div className={styles.centerCard}>
      <span className={c.eyebrow}>Room {code}</span>
      <h2 className={styles.centerTitle}>Take a seat</h2>
      {filled !== null ? (
        <p className={styles.centerText}>
          {filled}/6 seated{room?.status !== 'lobby' ? ' — game in progress (rejoin only)' : ''}
        </p>
      ) : (
        <p className={styles.centerText}>Six seats, two teams, no notes allowed.</p>
      )}
      <form
        className={styles.joinForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy) onJoin(name)
        }}
      >
        <label className={c.fieldLabel} htmlFor="room-join-name">
          Your name
        </label>
        <input
          id="room-join-name"
          data-testid="join-name"
          className={c.input}
          value={name}
          maxLength={20}
          placeholder="Player"
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" data-testid="join-room" className={`${c.btn} ${c.btnTall} ${c.primary}`} disabled={busy}>
          {busy ? 'Joining…' : 'Join the table'}
        </button>
      </form>
      {error ? <p className={styles.joinError}>{error}</p> : null}
      <Link to="/" className={styles.backLink}>
        Back to the front door
      </Link>
    </div>
  )
}

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skelStrip} />
      <div className={styles.skelTable} />
      <div className={styles.skelRow} />
      <div className={styles.skelHand} />
    </div>
  )
}

function RoomNotFoundBody({ code }: { code: string }) {
  return (
    <div className={styles.centerCard}>
      <h2 className={styles.centerTitle}>No table here</h2>
      <p className={styles.centerText}>
        Room {code || '—'} does not exist, or it expired after sitting idle. Rooms are swept six hours after the last
        move.
      </p>
      <Link to="/" className={`${c.btn} ${c.btnTall} ${c.primary}`}>
        Start a new room
      </Link>
    </div>
  )
}

function RoomNotFound({ code }: { code: string }) {
  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.top}>
          <Link to="/" className={styles.brand}>
            <Wordmark />
          </Link>
        </header>
        <RoomNotFoundBody code={code} />
      </div>
    </div>
  )
}
