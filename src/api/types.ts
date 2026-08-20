/**
 * Client-side protocol types — PROTOCOL.md §3/§4 exactly.
 * Engine types are imported from lib/engine (never redeclared).
 */
import type { BookId, Card, PublicState, Seat } from '../../lib/engine/index.ts'

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface RoomSeatInfo {
  seat: number
  filled: boolean
  name: string | null
  isBot: boolean
  connected: boolean
}

export interface PendingVote {
  targetSeat: number
  yes: number
  needed: number
}

/** Full public snapshot broadcast on `room:{CODE}` and returned by GET /state. */
export interface PublicRoomState {
  code: string
  status: RoomStatus
  hostSeat: number
  seats: RoomSeatInfo[]
  paused: boolean
  pendingVote: PendingVote | null
  game: PublicState | null
  version: number
}

/** Action bodies for POST /action — the server derives the acting seat from the token. */
export type ClientAction =
  | { type: 'ask'; target: Seat; card: Card }
  | { type: 'claim'; book: BookId; assignments: Record<Card, Seat> }
  | { type: 'pass'; to: Seat }
  | { type: 'designate'; to: Seat }

export interface ApiErrorInfo {
  code: string
  message: string
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorInfo }

export interface CreateRoomResponse {
  code: string
  playerToken: string
  seat: number
}

export interface JoinResponse {
  playerToken: string
  seat: number
  rejoined: boolean
}

export interface StateResponse {
  you: { seat: Seat; name: string }
  hand: Card[]
  room: PublicRoomState
}

export interface HeartbeatResponse {
  version: number
}
