/**
 * protocol.ts — wire types, constants, validation/sanitization, and the
 * PublicRoomState builder (PROTOCOL.md §3/§4/§6). Pure functions only.
 */
import { publicView } from '../lib/engine/index.ts'
import type { Card, Phase, PublicState, Seat } from '../lib/engine/index.ts'
import type { BotDifficulty, RoomState, RoomStatus, SeatMeta } from './deps.ts'

/* ------------------------------------------------------------- constants --- */

/** A seat counts as connected while now - lastSeen < 45 s (bots: always). */
export const CONNECTED_MS = 45_000
/** A human seat becomes vote-bot-eligible once lastSeen is >= 90 s old. */
export const VOTE_STALE_MS = 90_000
/** lastSeen value for bots — Infinity-equivalent that survives JSON (max Date). */
export const BOT_LAST_SEEN = 8_640_000_000_000_000
/**
 * Heartbeat pause-onset detection window: comfortably over the 20 s client
 * heartbeat cadence, so the first heartbeat after a purely time-driven
 * connected/paused flip notices and broadcasts it (see room.ts heartbeat).
 * Redundant re-broadcasts within the window are idempotent and harmless.
 */
export const FLIP_WINDOW_MS = 30_000
/** Bot chain cap per request; heartbeats resume a capped chain (PROTOCOL §3). */
export const BOT_CHAIN_CAP = 60
/** Max request body size in bytes. */
export const MAX_BODY_BYTES = 32 * 1024

export const LIMITS = {
  createPerHour: 20,
  joinPerHour: 120,
  actionsPer10s: 30,
} as const

/** Room-code alphabet (PROTOCOL §3): no 0/O/1/I/L/8. 31 symbols. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const MAX_NAME_LEN = 20
export const DEFAULT_NAME = 'Player'

/* ---------------------------------------------------------- public shape --- */

export interface RoomSeatInfo {
  seat: number
  filled: boolean
  name: string | null
  isBot: boolean
  connected: boolean
}

export interface PublicPendingVote {
  targetSeat: number
  yes: number
  needed: number
}

/**
 * A bot chain that stopped because `reduce` **refused** the bot's action (room.ts `runBotChain`).
 *
 * This must never happen: the bot module's contract is that it only ever emits actions the
 * reducer accepts. When it does happen the room is genuinely stuck — the seat that must act is a
 * bot, and that bot cannot move — so the failure has to be *visible* rather than the silent
 * `if (!r.ok) break` it used to be.
 *
 * **Privacy**: this rides on the public broadcast, so it names only the *kind* of action and the
 * engine's error code. The refused action's cards/assignments were never publicly announced (the
 * move was rejected), so putting them here would leak a bot's hidden hand to every client. The
 * full action goes to the server-side `console.error` instead, which only the operator reads.
 */
export interface BotChainFault {
  /** Only `'refused'` today; the field exists so a future loud stop reason stays parseable. */
  reason: 'refused'
  /** The seat that had to act — the turn-holder. */
  seat: Seat
  phase: Phase
  moveIndex: number
  /** `GameAction['type']` of the refused action. Never its payload — see above. */
  actionType: string
  /** The `ErrorCode` reduce answered with, e.g. `NOT_YOUR_TURN`. */
  code: string
}

/**
 * Full public snapshot broadcast on `room:{CODE}` and embedded in GET /state.
 *
 * `botFault` is **absent** (not `null`) on every healthy snapshot, so a room that is working
 * normally serializes byte-identically to what it did before this field existed and the
 * documented wire shape is unchanged (PROTOCOL.md §4, tests/server/protocol-shape.test.ts).
 */
export interface PublicRoomState {
  code: string
  status: RoomStatus
  hostSeat: number
  seats: RoomSeatInfo[]
  paused: boolean
  pendingVote: PublicPendingVote | null
  game: PublicState | null
  version: number
  botFault?: BotChainFault
}

export function seatConnected(meta: SeatMeta | null, now: number): boolean {
  if (!meta) return false
  if (meta.isBot) return true
  return now - meta.lastSeen < CONNECTED_MS
}

/** paused = playing && some filled human seat disconnected. Computed, never stored. */
export function computePaused(status: RoomStatus, state: RoomState, now: number): boolean {
  if (status !== 'playing') return false
  return state.seats.some((m) => m !== null && !m.isBot && !seatConnected(m, now))
}

/**
 * Public tally of the pending vote: yes-votes from currently connected humans
 * other than the target, and the majority threshold over those voters.
 */
export function voteTally(state: RoomState, now: number): PublicPendingVote | null {
  const pv = state.pendingVote
  if (!pv) return null
  const eligible: number[] = []
  state.seats.forEach((m, i) => {
    if (m !== null && !m.isBot && i !== pv.targetSeat && seatConnected(m, now)) eligible.push(i)
  })
  const yes = eligible.filter((i) => pv.votes[i] === true).length
  const needed = Math.floor(eligible.length / 2) + 1
  return { targetSeat: pv.targetSeat, yes, needed }
}

/** The full idempotent snapshot for one broadcast entry / the /state response. */
export function buildPublicRoomState(
  code: string,
  status: RoomStatus,
  state: RoomState,
  version: number,
  now: number,
  fault: BotChainFault | null = null,
): PublicRoomState {
  return {
    code,
    status,
    hostSeat: state.hostSeat,
    seats: state.seats.map((m, i) => ({
      seat: i,
      filled: m !== null,
      name: m === null ? null : m.name,
      isBot: m === null ? false : m.isBot,
      connected: seatConnected(m, now),
    })),
    paused: computePaused(status, state, now),
    pendingVote: voteTally(state, now),
    game: state.game === null ? null : publicView(state.game),
    version,
    // Spreads *nothing* when healthy, so the snapshot keeps exactly the eight documented keys
    // (PROTOCOL.md §4) and tests/server/protocol-shape.test.ts still holds.
    ...(fault === null ? {} : { botFault: fault }),
  }
}

/**
 * Fingerprint of the connectivity-derived public facts (paused, per-seat
 * connected, vote tally). Heartbeats broadcast only when this changes.
 */
export function connectionKey(status: RoomStatus, state: RoomState, now: number): string {
  return JSON.stringify({
    p: computePaused(status, state, now),
    c: state.seats.map((m) => seatConnected(m, now)),
    v: voteTally(state, now),
  })
}

/* ------------------------------------------------------------ validation --- */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }

function bad(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

export function isSeatNum(x: unknown): x is Seat {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 5
}

/** C0 (0x00-0x1f incl. tab/newline), DEL, and C1 (0x80-0x9f) are stripped. */
function isControlChar(codePoint: number): boolean {
  return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)
}

/**
 * Name rules (PROTOCOL §3): strip C0/C1 control chars, collapse whitespace,
 * trim, reject `<`/`>`, truncate to 20 chars, default "Player".
 */
export function sanitizeName(raw: unknown): Parsed<string> {
  if (raw === undefined || raw === null) return { ok: true, value: DEFAULT_NAME }
  if (typeof raw !== 'string') return bad('name must be a string')
  let s = ''
  for (const ch of raw) {
    const cp = ch.codePointAt(0) ?? 0
    if (!isControlChar(cp)) s += ch
  }
  s = s.replace(/\s+/g, ' ').trim()
  if (s.includes('<') || s.includes('>')) return bad('name must not contain < or >')
  s = s.slice(0, MAX_NAME_LEN).trim()
  return { ok: true, value: s === '' ? DEFAULT_NAME : s }
}

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`)

/**
 * Normalize a room code (trim + uppercase). Returns null when the string can
 * never name a room — callers answer ROOM_NOT_FOUND without touching storage.
 */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return CODE_RE.test(code) ? code : null
}

function parseCodeField(body: Record<string, unknown>): Parsed<string> {
  if (typeof body.code !== 'string') return bad('code must be a string')
  if (body.code.length > 64) return bad('code too long')
  return { ok: true, value: body.code }
}

function parseTokenField(body: Record<string, unknown>): Parsed<string> {
  const t = body.token
  if (typeof t !== 'string' || t.length === 0 || t.length > 256) {
    return bad('token must be a non-empty string')
  }
  return { ok: true, value: t }
}

export interface CreateRoomRequest {
  name: string
  fillBots: number
  botDifficulty: BotDifficulty
}

export function parseCreateRoom(body: Record<string, unknown>): Parsed<CreateRoomRequest> {
  const name = sanitizeName(body.name)
  if (!name.ok) return name
  const fillBots = body.fillBots ?? 0
  if (typeof fillBots !== 'number' || !Number.isInteger(fillBots) || fillBots < 0 || fillBots > 5) {
    return bad('fillBots must be an integer 0-5')
  }
  const botDifficulty = body.botDifficulty ?? 'medium'
  if (botDifficulty !== 'easy' && botDifficulty !== 'medium' && botDifficulty !== 'hard') {
    return bad("botDifficulty must be 'easy' | 'medium' | 'hard'")
  }
  return { ok: true, value: { name: name.value, fillBots, botDifficulty } }
}

export interface JoinRequest {
  code: string
  name: string
  token: string | null
}

export function parseJoin(body: Record<string, unknown>): Parsed<JoinRequest> {
  const code = parseCodeField(body)
  if (!code.ok) return code
  const name = sanitizeName(body.name)
  if (!name.ok) return name
  let token: string | null = null
  if (body.token !== undefined && body.token !== null) {
    const t = parseTokenField(body)
    if (!t.ok) return t
    token = t.value
  }
  return { ok: true, value: { code: code.value, name: name.value, token } }
}

export interface CodeTokenRequest {
  code: string
  token: string
}

export function parseCodeToken(body: Record<string, unknown>): Parsed<CodeTokenRequest> {
  const code = parseCodeField(body)
  if (!code.ok) return code
  const token = parseTokenField(body)
  if (!token.ok) return token
  return { ok: true, value: { code: code.value, token: token.value } }
}

export interface LobbySwapRequest extends CodeTokenRequest {
  a: number
  b: number
}

export function parseLobbySwap(body: Record<string, unknown>): Parsed<LobbySwapRequest> {
  const base = parseCodeToken(body)
  if (!base.ok) return base
  if (!isSeatNum(body.a) || !isSeatNum(body.b)) return bad('a and b must be seats 0-5')
  if (body.a === body.b) return bad('a and b must differ')
  return { ok: true, value: { ...base.value, a: body.a, b: body.b } }
}

export interface VoteBotRequest extends CodeTokenRequest {
  targetSeat: number
  vote: boolean
}

export function parseVoteBot(body: Record<string, unknown>): Parsed<VoteBotRequest> {
  const base = parseCodeToken(body)
  if (!base.ok) return base
  if (!isSeatNum(body.targetSeat)) return bad('targetSeat must be a seat 0-5')
  if (typeof body.vote !== 'boolean') return bad('vote must be a boolean')
  return { ok: true, value: { ...base.value, targetSeat: body.targetSeat, vote: body.vote } }
}

/**
 * A validated action body WITHOUT a seat — the server always derives the acting
 * seat from the token and discards anything seat-like the client sent.
 */
export type ActionShape =
  | { type: 'ask'; target: Seat; card: string }
  | { type: 'claim'; book: string; assignments: Record<string, Seat> }
  | { type: 'pass'; to: Seat }
  | { type: 'designate'; to: Seat }

export interface ActionRequest extends CodeTokenRequest {
  action: ActionShape
}

export function parseActionRequest(body: Record<string, unknown>): Parsed<ActionRequest> {
  const base = parseCodeToken(body)
  if (!base.ok) return base
  const raw = body.action
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return bad('action must be an object')
  }
  const a = raw as Record<string, unknown>
  let action: ActionShape
  switch (a.type) {
    case 'ask': {
      if (!isSeatNum(a.target)) return bad('ask.target must be a seat 0-5')
      if (typeof a.card !== 'string' || a.card.length === 0 || a.card.length > 8) {
        return bad('ask.card must be a short string')
      }
      action = { type: 'ask', target: a.target, card: a.card }
      break
    }
    case 'claim': {
      if (typeof a.book !== 'string' || a.book.length === 0 || a.book.length > 8) {
        return bad('claim.book must be a short string')
      }
      const rawAsg = a.assignments
      if (rawAsg === null || typeof rawAsg !== 'object' || Array.isArray(rawAsg)) {
        return bad('claim.assignments must be an object')
      }
      const entries = Object.entries(rawAsg as Record<string, unknown>)
      if (entries.length > 48) return bad('claim.assignments has too many entries')
      const assignments: Record<string, Seat> = {}
      for (const [card, seat] of entries) {
        if (card.length === 0 || card.length > 8) return bad('claim.assignments has a bad card key')
        if (!isSeatNum(seat)) return bad('claim.assignments values must be seats 0-5')
        assignments[card] = seat
      }
      action = { type: 'claim', book: a.book, assignments }
      break
    }
    case 'pass': {
      if (!isSeatNum(a.to)) return bad('pass.to must be a seat 0-5')
      action = { type: 'pass', to: a.to }
      break
    }
    case 'designate': {
      if (!isSeatNum(a.to)) return bad('designate.to must be a seat 0-5')
      action = { type: 'designate', to: a.to }
      break
    }
    default:
      return bad('action.type must be ask | claim | pass | designate')
  }
  return { ok: true, value: { ...base.value, action } }
}

/* ------------------------------------------------------ response payloads --- */

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

export interface HealthResponse {
  rooms: number
  ts: number
}
