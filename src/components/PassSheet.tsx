/**
 * Mandatory turn-routing panels: pass (awaitPass) and designate
 * (awaitDesignate). Non-dismissable — the game cannot continue otherwise.
 */
import { useState } from 'react'
import type { PublicState, Seat } from '../../lib/engine/index.ts'
import type { ClientAction } from '../api/types.ts'
import type { ActOutcome } from '../hooks/useRoom.ts'
import { designateTargets, passTargets } from '../viewmodels/table.ts'
import { seatTeamLetter } from '../viewmodels/format.ts'
import { Sheet } from './Sheet.tsx'
import styles from './PassSheet.module.css'

interface PassSheetProps {
  mode: 'pass' | 'designate'
  game: PublicState
  mySeat: Seat
  nameOf: (seat: Seat) => string
  paused: boolean
  act: (action: ClientAction) => Promise<ActOutcome>
}

export function PassSheet({ mode, game, mySeat, nameOf, paused, act }: PassSheetProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const targets = mode === 'pass' ? passTargets(game, mySeat) : designateTargets(game, mySeat)

  const send = async (to: Seat) => {
    if (busy || paused) return
    setBusy(true)
    setError(null)
    const outcome = await act(mode === 'pass' ? { type: 'pass', to } : { type: 'designate', to })
    setBusy(false)
    if (!outcome.ok) setError(outcome.message ?? 'That was refused.')
  }

  return (
    <Sheet
      title={mode === 'pass' ? 'Pass the' : 'Designate a'}
      titleAccent={mode === 'pass' ? 'turn' : 'claimer'}
    >
      <p className={styles.why}>
        {mode === 'pass'
          ? 'Your claim used your last card. Hand the turn to a teammate who still holds cards.'
          : 'Your whole team is out of cards. Choose the opponent who must claim everything that remains.'}
      </p>
      <div className={styles.targets}>
        {targets.map((seat) => (
          <button
            key={seat}
            type="button"
            data-testid={mode === 'pass' ? `pass-to-${seat}` : `designate-${seat}`}
            disabled={busy || paused}
            className={styles.target}
            onClick={() => void send(seat)}
          >
            <span className={styles.targetName}>{nameOf(seat)}</span>
            <span className={styles.targetMeta}>
              P{seat} · Team {seatTeamLetter(seat)} · {game.counts[seat]} cards
            </span>
          </button>
        ))}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {paused ? <p className={styles.why}>Paused — resumes when everyone is back.</p> : null}
    </Sheet>
  )
}
