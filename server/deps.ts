/**
 * Deps — the injected IO boundary for the room server (PROTOCOL.md §8).
 *
 * Everything impure (database, realtime, clock, randomness, hashing) lives behind
 * this interface. server/ code is pure Web-standard TypeScript over Deps; the Deno
 * entry (supabase/functions/api/index.ts) provides the real Supabase-backed
 * implementation and tests/server/ provides a deterministic in-memory one.
 */
import type { GameState } from '../lib/engine/index.ts'

export type RoomStatus = 'lobby' | 'playing' | 'finished'
export type BotDifficulty = 'easy' | 'medium' | 'hard'

/** Per-seat metadata (PROTOCOL.md §2). Server-internal — never sent to clients. */
export interface SeatMeta {
  name: string
  /** sha256 hex of the playerToken; bots: null unless substituted-from-human. */
  tokenHash: string | null
  isBot: boolean
  botDifficulty: BotDifficulty | null
  /** ms epoch; bots use BOT_LAST_SEEN (Infinity-equivalent, JSON-safe). */
  lastSeen: number
}

export interface PendingVote {
  targetSeat: number
  /** voterSeat -> latest vote. JSON round-trips keys as strings; index numerically. */
  votes: Record<number, boolean>
  startedAt: number
}

/** rooms.state jsonb (PROTOCOL.md §2). */
export interface RoomState {
  /** length 6, index = seat */
  seats: (SeatMeta | null)[]
  /** lib/engine state, null in lobby */
  game: GameState | null
  roomSeed: string
  hostSeat: number
  createdAt: number
  pendingVote: PendingVote | null
}

/** One row of the rooms table (created_at / last_activity stay storage-side). */
export interface RoomRow {
  id: string
  code: string
  status: RoomStatus
  state: RoomState
  version: number
}

export interface Deps {
  loadRoomByCode(code: string): Promise<RoomRow | null>
  /** Insert a fresh room at version 0. Fails with DUPLICATE_CODE on a code collision. */
  insertRoom(row: {
    code: string
    status: RoomStatus
    state: RoomState
  }): Promise<{ ok: true; id: string } | { ok: false; reason: 'DUPLICATE_CODE' }>
  /**
   * Compare-and-set save: update guarded on id + expectedVersion, writing status,
   * state, version=newVersion and bumping last_activity. True iff exactly one row
   * was updated (PROTOCOL.md §2).
   */
  saveRoomCAS(
    id: string,
    expectedVersion: number,
    status: RoomStatus,
    state: RoomState,
    newVersion: number,
  ): Promise<boolean>
  /** Increment the bucket's counter, returning the new count (PROTOCOL.md §6). */
  bumpRateLimit(bucket: string): Promise<number>
  /**
   * Realtime broadcast: ONE call per mutation; each payload becomes one messages[]
   * entry (event 'room') on the topic, in order (PROTOCOL.md §4).
   */
  broadcast(topic: string, payloads: unknown[]): Promise<void>
  /** Total number of rooms (GET /health). */
  countRooms(): Promise<number>
  /** ms epoch clock. */
  now(): number
  /** 32 bytes of crypto randomness as 64 lowercase hex chars. */
  randomToken(): string
  sha256hex(input: string): Promise<string>
}
