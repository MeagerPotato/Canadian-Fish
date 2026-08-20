/**
 * Table viewmodel — the seat ring rotated so MY seat sits bottom-center,
 * plus per-seat display state. Pure functions over public state.
 */
import type { PublicState, Seat } from '../../lib/engine/index.ts'
import { ALL_SEATS, seatTeam } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'
import { seatName, seatTeamLetter } from './format.ts'

export interface SeatPosition {
  seat: Seat
  /** 0 = bottom center (me), 1..5 clockwise around the felt. */
  ring: number
  /** Percentage coordinates inside the fixed-size table box. */
  leftPct: number
  topPct: number
}

/**
 * Ring order starting from `mySeat` (always ring 0, pinned bottom-center at
 * angle 90° in screen coordinates where +y is down); the other five seats are
 * spaced evenly (60°) clockwise around the ellipse. DESIGN_NOTES §2/§5.
 */
export function seatRing(mySeat: Seat): SeatPosition[] {
  return ALL_SEATS.map((_, ring) => {
    const seat = ((mySeat + ring) % 6) as Seat
    const angle = ((90 + 60 * ring) * Math.PI) / 180
    return {
      seat,
      ring,
      leftPct: round2(50 + 41 * Math.cos(angle)),
      topPct: round2(44 + 38 * Math.sin(angle)),
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface TableSeatVM extends SeatPosition {
  name: string
  teamLetter: 'A' | 'B'
  isYou: boolean
  isTurn: boolean
  count: number
  filled: boolean
  isBot: boolean
  connected: boolean
  out: boolean
}

/** Build all six seat chips in ring order (index 0 = me at the bottom). */
export function buildTableSeats(room: PublicRoomState, game: PublicState, mySeat: Seat): TableSeatVM[] {
  return seatRing(mySeat).map((pos) => {
    const info = room.seats[pos.seat]
    const count = game.counts[pos.seat] ?? 0
    return {
      ...pos,
      name: seatName(room, pos.seat),
      teamLetter: seatTeamLetter(pos.seat),
      isYou: pos.seat === mySeat,
      isTurn: game.phase !== 'finished' && game.turn === pos.seat,
      count,
      filled: info?.filled ?? false,
      isBot: info?.isBot ?? false,
      connected: info?.connected ?? true,
      out: count === 0,
    }
  })
}

/** True when the viewer must act right now (drives the `your-turn` banner). */
export function mustAct(game: PublicState | null, mySeat: Seat | null): boolean {
  if (!game || mySeat === null) return false
  if (game.turn !== mySeat) return false
  return game.phase === 'playing' || game.phase === 'endgame' || game.phase === 'awaitPass' || game.phase === 'awaitDesignate'
}

/** Short instruction shown in the your-turn banner. */
export function turnPrompt(game: PublicState): string {
  switch (game.phase) {
    case 'playing':
      return 'Your turn — ask an opponent or claim a half-suit'
    case 'endgame':
      return 'Your turn — claim the remaining half-suits'
    case 'awaitPass':
      return 'You claimed yourself empty — pass the turn to a teammate'
    case 'awaitDesignate':
      return 'Your team is out of cards — designate an opponent to claim'
    default:
      return ''
  }
}

/** Teammates of `seat` holding at least one card (legal pass targets). */
export function passTargets(game: PublicState, seat: Seat): Seat[] {
  const team = seatTeam(seat)
  return ALL_SEATS.filter((s) => s !== seat && seatTeam(s) === team && (game.counts[s] ?? 0) > 0)
}

/** Opponents of `seat` holding at least one card (legal designate targets). */
export function designateTargets(game: PublicState, seat: Seat): Seat[] {
  const team = seatTeam(seat)
  return ALL_SEATS.filter((s) => seatTeam(s) !== team && (game.counts[s] ?? 0) > 0)
}

export type WinnerText = 'A' | 'B' | 'tie'

/** Final verdict from the score (only meaningful when the game is finished). */
export function winnerText(score: readonly [number, number]): WinnerText {
  if (score[0] > score[1]) return 'A'
  if (score[1] > score[0]) return 'B'
  return 'tie'
}
