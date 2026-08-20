/**
 * Lobby viewmodel — team columns, start gating, swap affordances.
 */
import type { Seat } from '../../lib/engine/index.ts'
import { teamSeats } from '../../lib/engine/index.ts'
import type { PublicRoomState } from '../api/types.ts'

export interface LobbySeatVM {
  seat: Seat
  filled: boolean
  name: string | null
  isBot: boolean
  isYou: boolean
  isHost: boolean
  teamLetter: 'A' | 'B'
}

export interface LobbyVM {
  code: string
  teamA: LobbySeatVM[]
  teamB: LobbySeatVM[]
  filledCount: number
  isHost: boolean
  canStart: boolean
  /** Why start-game is disabled (null when enabled). */
  startBlocked: string | null
}

export function buildLobby(room: PublicRoomState, mySeat: Seat | null): LobbyVM {
  const seatVM = (seat: Seat, letter: 'A' | 'B'): LobbySeatVM => {
    const info = room.seats[seat]
    return {
      seat,
      filled: info?.filled ?? false,
      name: info?.filled ? info.name : null,
      isBot: info?.isBot ?? false,
      isYou: mySeat === seat,
      isHost: room.hostSeat === seat,
      teamLetter: letter,
    }
  }
  const teamA = teamSeats(0).map((s) => seatVM(s, 'A'))
  const teamB = teamSeats(1).map((s) => seatVM(s, 'B'))
  const filledCount = room.seats.filter((s) => s?.filled).length
  const isHost = mySeat !== null && room.hostSeat === mySeat
  let startBlocked: string | null = null
  if (filledCount < 6) {
    const missing = 6 - filledCount
    startBlocked = `Waiting for ${missing} more ${missing === 1 ? 'player' : 'players'}`
  } else if (!isHost) {
    startBlocked = 'Only the host can deal'
  }
  return { code: room.code, teamA, teamB, filledCount, isHost, canStart: startBlocked === null, startBlocked }
}
