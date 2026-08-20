/**
 * room.ts — every room mutation (create/join/swap/start/action/heartbeat/vote)
 * as pure functions over Deps (PROTOCOL.md §3), plus the read paths (/state,
 * /health). Each mutation is load -> validate -> engine -> CAS save (retry <= 3
 * on conflict, then 409 CONFLICT) -> one broadcast call with one PublicRoomState
 * snapshot per engine step, ascending versions (PROTOCOL.md §2/§4).
 */
import { hashSeed, newGame, reduce, seatView } from '../lib/engine/index.ts'
import type { BookId, Card, GameAction, Seat } from '../lib/engine/index.ts'
import type { Deps, PendingVote, RoomRow, RoomState, RoomStatus, SeatMeta } from './deps.ts'
import { decide } from './bots.ts'
import {
  BOT_CHAIN_CAP,
  BOT_LAST_SEEN,
  CODE_ALPHABET,
  FLIP_WINDOW_MS,
  LIMITS,
  VOTE_STALE_MS,
  buildPublicRoomState,
  computePaused,
  connectionKey,
  normalizeCode,
  seatConnected,
  voteTally,
} from './protocol.ts'
import type {
  ActionRequest,
  ActionShape,
  CodeTokenRequest,
  CreateRoomRequest,
  CreateRoomResponse,
  HealthResponse,
  HeartbeatResponse,
  JoinRequest,
  JoinResponse,
  LobbySwapRequest,
  StateResponse,
  VoteBotRequest,
} from './protocol.ts'

/* ----------------------------------------------------------------- shared --- */

export interface ErrorBody {
  code: string
  message: string
}

export type RoomResult<T> =
  | { ok: true; body: T }
  | { ok: false; httpStatus: number; error: ErrorBody }

export type EmptyResponse = Record<string, never>

function failure(httpStatus: number, code: string, message: string): { ok: false; httpStatus: number; error: ErrorBody } {
  return { ok: false, httpStatus, error: { code, message } }
}

export function topic(code: string): string {
  return `room:${code}`
}

/** Seat owned by this tokenHash, or null. */
function seatOf(state: RoomState, tokenHash: string): Seat | null {
  for (let i = 0; i < state.seats.length; i++) {
    const m = state.seats[i]
    if (m !== null && m.tokenHash === tokenHash) return i as Seat
  }
  return null
}

/** One broadcast snapshot: room content at version = loadedVersion + offset. */
interface BroadcastEntry {
  status: RoomStatus
  state: RoomState
  offset: number
}

type MutOutcome<T> =
  | {
      ok: true
      status: RoomStatus
      state: RoomState
      /** version delta for the CAS write: 1 (the base write) + bot steps. */
      increment: number
      entries: BroadcastEntry[]
      response: T
    }
  | { ok: false; httpStatus: number; error: ErrorBody }

/** 1 initial attempt + up to 3 reload-and-retry passes on CAS conflict (§2). */
const MAX_CAS_ATTEMPTS = 4

async function mutateRoom<T>(
  deps: Deps,
  code: string,
  fn: (room: RoomRow, now: number) => MutOutcome<T> | Promise<MutOutcome<T>>,
): Promise<RoomResult<T>> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const room = await deps.loadRoomByCode(code)
    if (room === null) return failure(404, 'ROOM_NOT_FOUND', `no room with code ${code}`)
    const now = deps.now()
    const out = await fn(room, now)
    if (!out.ok) return { ok: false, httpStatus: out.httpStatus, error: out.error }
    const saved = await deps.saveRoomCAS(
      room.id,
      room.version,
      out.status,
      out.state,
      room.version + out.increment,
    )
    if (saved) {
      if (out.entries.length > 0) {
        await deps.broadcast(
          topic(room.code),
          out.entries.map((e) =>
            buildPublicRoomState(room.code, e.status, e.state, room.version + e.offset, now),
          ),
        )
      }
      return { ok: true, body: out.response }
    }
  }
  return failure(409, 'CONFLICT', 'the room changed concurrently — retry')
}

/* -------------------------------------------------------------- bot chain --- */

interface ChainResult {
  status: RoomStatus
  state: RoomState
  steps: { status: RoomStatus; state: RoomState }[]
}

/**
 * While the game is live, unpaused, and the seat to act is a bot: decide from
 * that bot's SeatView (public data only), seeded by hash(roomSeed, moveIndex),
 * reduce, and record one step. Capped at BOT_CHAIN_CAP per request; heartbeats
 * resume a capped chain (PROTOCOL §3).
 */
function runBotChain(status: RoomStatus, state: RoomState, now: number): ChainResult {
  const steps: { status: RoomStatus; state: RoomState }[] = []
  let curStatus = status
  let cur = state
  if (curStatus === 'playing' && !computePaused(curStatus, cur, now)) {
    while (steps.length < BOT_CHAIN_CAP) {
      const game = cur.game
      if (curStatus !== 'playing' || game === null || game.phase === 'finished') break
      const meta = cur.seats[game.turn]
      if (meta === null || !meta.isBot) break
      const seed = hashSeed(`${cur.roomSeed}:${game.moveIndex}`)()
      const action = decide(seatView(game, game.turn), meta.botDifficulty ?? 'medium', seed)
      const r = reduce(game, action)
      if (!r.ok) break // defensive: the placeholder bot only emits legal actions
      curStatus = r.state.phase === 'finished' ? 'finished' : 'playing'
      cur = { ...cur, game: r.state }
      steps.push({ status: curStatus, state: cur })
    }
  }
  return { status: curStatus, state: cur, steps }
}

function chainEntries(base: BroadcastEntry, steps: { status: RoomStatus; state: RoomState }[]): BroadcastEntry[] {
  return [base, ...steps.map((s, i) => ({ status: s.status, state: s.state, offset: base.offset + 1 + i }))]
}

/* ------------------------------------------------------------ create-room --- */

/** Map crypto-random hex bytes onto the code alphabet by rejection sampling. */
export function codeFromHex(hex: string): string | null {
  let code = ''
  for (let i = 0; i + 2 <= hex.length && code.length < 6; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) return null
    if (byte >= 248) continue // 248 = 8 * 31: reject to keep the draw uniform
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  }
  return code.length === 6 ? code : null
}

export async function createRoom(
  deps: Deps,
  input: CreateRoomRequest & { ip: string },
): Promise<RoomResult<CreateRoomResponse>> {
  const hour = Math.floor(deps.now() / 3_600_000)
  const count = await deps.bumpRateLimit(`c:${input.ip}:${hour}`)
  if (count > LIMITS.createPerHour) {
    return failure(429, 'RATE_LIMITED', 'too many rooms created from this address — try later')
  }
  const playerToken = deps.randomToken()
  const tokenHash = await deps.sha256hex(playerToken)
  const now = deps.now()
  const seats: (SeatMeta | null)[] = [
    { name: input.name, tokenHash, isBot: false, botDifficulty: null, lastSeen: now },
    null,
    null,
    null,
    null,
    null,
  ]
  for (let i = 1; i <= input.fillBots; i++) {
    seats[i] = {
      name: `Bot ${i}`,
      tokenHash: null,
      isBot: true,
      botDifficulty: input.botDifficulty,
      lastSeen: BOT_LAST_SEEN,
    }
  }
  const state: RoomState = {
    seats,
    game: null,
    roomSeed: deps.randomToken(),
    hostSeat: 0,
    createdAt: now,
    pendingVote: null,
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeFromHex(deps.randomToken())
    if (code === null) continue
    const inserted = await deps.insertRoom({ code, status: 'lobby', state })
    if (inserted.ok) {
      await deps.broadcast(topic(code), [buildPublicRoomState(code, 'lobby', state, 0, now)])
      return { ok: true, body: { code, playerToken, seat: 0 } }
    }
  }
  return failure(409, 'CONFLICT', 'could not allocate a unique room code — retry')
}

/* ------------------------------------------------------------------- join --- */

export async function joinRoom(
  deps: Deps,
  input: JoinRequest & { ip: string },
): Promise<RoomResult<JoinResponse>> {
  const hour = Math.floor(deps.now() / 3_600_000)
  const count = await deps.bumpRateLimit(`j:${input.ip}:${hour}`)
  if (count > LIMITS.joinPerHour) {
    return failure(429, 'RATE_LIMITED', 'too many join attempts from this address — try later')
  }
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const tokenIn = input.token
  const providedHash = tokenIn === null ? null : await deps.sha256hex(tokenIn)
  return mutateRoom<JoinResponse>(deps, code, async (room, now) => {
    // Rejoin by token works in ANY status and reclaims a bot-substituted seat.
    if (tokenIn !== null && providedHash !== null) {
      const seat = seatOf(room.state, providedHash)
      if (seat !== null) {
        const prev = room.state.seats[seat]
        if (prev !== null) {
          const seats = room.state.seats.map((m, i) =>
            i === seat ? { ...prev, isBot: false, botDifficulty: null, lastSeen: now } : m,
          )
          const pendingVote =
            room.state.pendingVote !== null && room.state.pendingVote.targetSeat === seat
              ? null
              : room.state.pendingVote
          const state: RoomState = { ...room.state, seats, pendingVote }
          return {
            ok: true,
            status: room.status,
            state,
            increment: 1,
            entries: [{ status: room.status, state, offset: 1 }],
            response: { playerToken: tokenIn, seat, rejoined: true },
          }
        }
      }
    }
    if (room.status !== 'lobby') return failure(409, 'ALREADY_STARTED', 'the game already started')
    const free = room.state.seats.indexOf(null)
    if (free === -1) return failure(409, 'ROOM_FULL', 'all 6 seats are taken')
    const playerToken = deps.randomToken()
    const tokenHash = await deps.sha256hex(playerToken)
    const seats = room.state.seats.map((m, i) =>
      i === free
        ? { name: input.name, tokenHash, isBot: false, botDifficulty: null, lastSeen: now }
        : m,
    )
    const state: RoomState = { ...room.state, seats }
    return {
      ok: true,
      status: room.status,
      state,
      increment: 1,
      entries: [{ status: room.status, state, offset: 1 }],
      response: { playerToken, seat: free, rejoined: false },
    }
  })
}

/* ------------------------------------------------------------------ state --- */

export async function getState(
  deps: Deps,
  input: CodeTokenRequest,
): Promise<RoomResult<StateResponse>> {
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const room = await deps.loadRoomByCode(code)
  if (room === null) return failure(404, 'ROOM_NOT_FOUND', `no room with code ${code}`)
  const hash = await deps.sha256hex(input.token)
  const seat = seatOf(room.state, hash)
  if (seat === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
  const meta = room.state.seats[seat]
  if (meta === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
  const hand: Card[] = room.state.game === null ? [] : [...room.state.game.hands[seat]]
  return {
    ok: true,
    body: {
      you: { seat, name: meta.name },
      hand,
      room: buildPublicRoomState(code, room.status, room.state, room.version, deps.now()),
    },
  }
}

/* ------------------------------------------------------------- lobby-swap --- */

export async function lobbySwap(
  deps: Deps,
  input: LobbySwapRequest,
): Promise<RoomResult<EmptyResponse>> {
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const hash = await deps.sha256hex(input.token)
  return mutateRoom<EmptyResponse>(deps, code, (room) => {
    const seat = seatOf(room.state, hash)
    if (seat === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
    if (room.status !== 'lobby') return failure(409, 'ALREADY_STARTED', 'seats can only be swapped in the lobby')
    const seats = [...room.state.seats]
    const tmp = seats[input.a]
    seats[input.a] = seats[input.b]
    seats[input.b] = tmp
    let hostSeat = room.state.hostSeat
    if (hostSeat === input.a) hostSeat = input.b
    else if (hostSeat === input.b) hostSeat = input.a
    const state: RoomState = { ...room.state, seats, hostSeat }
    return {
      ok: true,
      status: room.status,
      state,
      increment: 1,
      entries: [{ status: room.status, state, offset: 1 }],
      response: {},
    }
  })
}

/* ------------------------------------------------------------------ start --- */

export async function startRoom(
  deps: Deps,
  input: CodeTokenRequest,
): Promise<RoomResult<EmptyResponse>> {
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const hash = await deps.sha256hex(input.token)
  return mutateRoom<EmptyResponse>(deps, code, (room, now) => {
    const seat = seatOf(room.state, hash)
    if (seat === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
    if (seat !== room.state.hostSeat) return failure(403, 'NOT_HOST', 'only the host can start the game')
    if (room.status !== 'lobby') return failure(409, 'ALREADY_STARTED', 'the game already started')
    if (room.state.seats.some((m) => m === null)) {
      return failure(409, 'NOT_FULL', 'all 6 seats must be filled to start')
    }
    const started: RoomState = { ...room.state, game: newGame(room.state.roomSeed) }
    const chain = runBotChain('playing', started, now)
    return {
      ok: true,
      status: chain.status,
      state: chain.state,
      increment: 1 + chain.steps.length,
      entries: chainEntries({ status: 'playing', state: started, offset: 1 }, chain.steps),
      response: {},
    }
  })
}

/* ----------------------------------------------------------------- action --- */

/** Rebuild the engine action from the validated shape with the token's seat. */
function toGameAction(shape: ActionShape, seat: Seat): GameAction {
  switch (shape.type) {
    case 'ask':
      return { type: 'ask', seat, target: shape.target, card: shape.card as Card }
    case 'claim':
      return { type: 'claim', seat, book: shape.book as BookId, assignments: shape.assignments as Record<Card, Seat> }
    case 'pass':
      return { type: 'pass', seat, to: shape.to }
    case 'designate':
      return { type: 'designate', seat, to: shape.to }
  }
}

export async function actRoom(
  deps: Deps,
  input: ActionRequest,
): Promise<RoomResult<EmptyResponse>> {
  const tokenHash = await deps.sha256hex(input.token)
  const win = Math.floor(deps.now() / 10_000)
  const count = await deps.bumpRateLimit(`a:${tokenHash.slice(0, 8)}:${win}`)
  if (count > LIMITS.actionsPer10s) {
    return failure(429, 'RATE_LIMITED', 'too many actions — slow down')
  }
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  return mutateRoom<EmptyResponse>(deps, code, (room, now) => {
    const seat = seatOf(room.state, tokenHash)
    if (seat === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
    if (room.status !== 'playing' || room.state.game === null) {
      return failure(400, 'WRONG_PHASE', 'the game is not in progress')
    }
    if (computePaused(room.status, room.state, now)) {
      return failure(409, 'PAUSED', 'the game is paused while a player is disconnected')
    }
    const r = reduce(room.state.game, toGameAction(input.action, seat))
    if (!r.ok) return failure(400, r.error.code, r.error.message)
    const statusAfter: RoomStatus = r.state.phase === 'finished' ? 'finished' : 'playing'
    const afterHuman: RoomState = { ...room.state, game: r.state }
    const chain = runBotChain(statusAfter, afterHuman, now)
    return {
      ok: true,
      status: chain.status,
      state: chain.state,
      increment: 1 + chain.steps.length,
      entries: chainEntries({ status: statusAfter, state: afterHuman, offset: 1 }, chain.steps),
      response: {},
    }
  })
}

/* -------------------------------------------------------------- heartbeat --- */

export async function heartbeat(
  deps: Deps,
  input: CodeTokenRequest,
): Promise<RoomResult<HeartbeatResponse>> {
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const hash = await deps.sha256hex(input.token)
  return mutateRoom<HeartbeatResponse>(deps, code, (room, now) => {
    const seat = seatOf(room.state, hash)
    if (seat === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
    // Connectivity facts as clients could last have seen them: with the stored
    // lastSeen values, both right now and one heartbeat-window ago (the latter
    // catches flips caused purely by time passing since the last broadcast).
    const preKeyNow = connectionKey(room.status, room.state, now)
    const preKeyPast = connectionKey(room.status, room.state, now - FLIP_WINDOW_MS)
    const seats = room.state.seats.map((m, i) =>
      i === seat && m !== null && !m.isBot ? { ...m, lastSeen: now } : m,
    )
    let state: RoomState = { ...room.state, seats }
    // A pending vote dies the moment its target proves alive again.
    if (state.pendingVote !== null && state.pendingVote.targetSeat === seat) {
      const meta = state.seats[seat]
      if (meta !== null && !meta.isBot) state = { ...state, pendingVote: null }
    }
    const chain = runBotChain(room.status, state, now)
    const postKey = connectionKey(chain.status, chain.state, now)
    const publicChanged = postKey !== preKeyNow || preKeyNow !== preKeyPast
    const base: BroadcastEntry = { status: room.status, state, offset: 1 }
    const entries = publicChanged
      ? chainEntries(base, chain.steps)
      : chain.steps.map((s, i) => ({ status: s.status, state: s.state, offset: 2 + i }))
    const increment = 1 + chain.steps.length
    return {
      ok: true,
      status: chain.status,
      state: chain.state,
      increment,
      entries,
      response: { version: room.version + increment },
    }
  })
}

/* --------------------------------------------------------------- vote-bot --- */

export async function voteBot(
  deps: Deps,
  input: VoteBotRequest,
): Promise<RoomResult<EmptyResponse>> {
  const code = normalizeCode(input.code)
  if (code === null) return failure(404, 'ROOM_NOT_FOUND', 'no such room')
  const hash = await deps.sha256hex(input.token)
  return mutateRoom<EmptyResponse>(deps, code, (room, now) => {
    const voter = seatOf(room.state, hash)
    if (voter === null) return failure(401, 'BAD_TOKEN', 'token does not belong to this room')
    if (room.status !== 'playing') {
      return failure(409, 'VOTE_INVALID', 'votes are only valid while playing')
    }
    const target = room.state.seats[input.targetSeat]
    if (target === null || target.isBot || target.tokenHash === null) {
      return failure(409, 'VOTE_INVALID', 'target seat is not a connected-record human')
    }
    if (now - target.lastSeen < VOTE_STALE_MS) {
      return failure(409, 'VOTE_INVALID', 'target seat has not been gone for 90 s yet')
    }
    const voterMeta = room.state.seats[voter]
    if (
      voterMeta === null ||
      voterMeta.isBot ||
      voter === input.targetSeat ||
      !seatConnected(voterMeta, now)
    ) {
      return failure(409, 'VOTE_INVALID', 'voter is not an eligible connected human')
    }
    if (room.state.pendingVote !== null && room.state.pendingVote.targetSeat !== input.targetSeat) {
      return failure(409, 'VOTE_INVALID', 'another vote is already in progress')
    }
    let pendingVote: PendingVote | null
    if (room.state.pendingVote === null) {
      if (!input.vote) return failure(409, 'VOTE_INVALID', 'no vote in progress to decline')
      pendingVote = { targetSeat: input.targetSeat, votes: { [voter]: true }, startedAt: now }
    } else {
      pendingVote = {
        ...room.state.pendingVote,
        votes: { ...room.state.pendingVote.votes, [voter]: input.vote },
      }
    }
    let state: RoomState = { ...room.state, pendingVote }
    const tally = voteTally(state, now)
    let substituted = false
    if (tally !== null && tally.yes >= tally.needed) {
      substituted = true
      const seats = state.seats.map((m, i) =>
        i === input.targetSeat && m !== null
          ? { ...m, isBot: true, botDifficulty: 'medium' as const, lastSeen: BOT_LAST_SEEN }
          : m,
      )
      state = { ...state, seats, pendingVote: null }
    }
    const chain = substituted
      ? runBotChain(room.status, state, now)
      : { status: room.status, state, steps: [] }
    return {
      ok: true,
      status: chain.status,
      state: chain.state,
      increment: 1 + chain.steps.length,
      entries: chainEntries({ status: room.status, state, offset: 1 }, chain.steps),
      response: {},
    }
  })
}

/* ----------------------------------------------------------------- health --- */

export async function health(deps: Deps): Promise<HealthResponse> {
  return { rooms: await deps.countRooms(), ts: deps.now() }
}
