/**
 * The one fetch wrapper — PROTOCOL.md §1/§3.
 * Always same-origin `/api/*`; carries the public anon key headers; all bodies
 * JSON. Every call resolves to an ApiResult — network failures never throw.
 */
import type {
  ApiErrorInfo,
  ApiResult,
  ClientAction,
  CreateRoomResponse,
  HeartbeatResponse,
  JoinResponse,
  StateResponse,
} from './types.ts'

const ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY

function headers(): Record<string, string> {
  return {
    'content-type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  }
}

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    return { ok: false, error: { code: 'NETWORK', message: 'Could not reach the table.' } }
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: { code: 'BAD_RESPONSE', message: 'The server sent an unreadable reply.' } }
  }
  const parsed = body as { ok?: boolean; error?: ApiErrorInfo } & T
  if (parsed && parsed.ok === true) {
    return { ok: true, data: parsed }
  }
  const error = parsed?.error
  if (error && typeof error.code === 'string') {
    return { ok: false, error: { code: error.code, message: error.message ?? '' } }
  }
  return { ok: false, error: { code: 'BAD_RESPONSE', message: `Unexpected reply (HTTP ${res.status}).` } }
}

function post<T>(path: string, body: object): Promise<ApiResult<T>> {
  return request<T>(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
}

const MALFORMED: ApiErrorInfo = { code: 'BAD_RESPONSE', message: 'The server reply was missing fields.' }

/** Guard a success payload's shape — a stale/foreign server must not crash the app. */
function ensure<T>(result: ApiResult<T>, valid: (data: T) => boolean): ApiResult<T> {
  if (result.ok && !valid(result.data)) return { ok: false, error: MALFORMED }
  return result
}

export async function apiCreateRoom(name: string): Promise<ApiResult<CreateRoomResponse>> {
  const result = await post<CreateRoomResponse>('/create-room', name.trim() ? { name: name.trim() } : {})
  return ensure(result, (d) => typeof d.code === 'string' && typeof d.playerToken === 'string')
}

/** Practice rooms (PROTOCOL §3): fill seats 1..fillBots with bots at a difficulty. */
export async function apiCreateRoomWithBots(
  name: string,
  fillBots: number,
  botDifficulty: 'easy' | 'medium' | 'hard',
): Promise<ApiResult<CreateRoomResponse>> {
  const body: Record<string, unknown> = { fillBots, botDifficulty }
  if (name.trim()) body.name = name.trim()
  const result = await post<CreateRoomResponse>('/create-room', body)
  return ensure(result, (d) => typeof d.code === 'string' && typeof d.playerToken === 'string')
}

export async function apiJoin(code: string, name: string, token?: string | null): Promise<ApiResult<JoinResponse>> {
  const body: Record<string, string> = { code }
  if (name.trim()) body.name = name.trim()
  if (token) body.token = token
  const result = await post<JoinResponse>('/join', body)
  return ensure(result, (d) => typeof d.playerToken === 'string' && typeof d.seat === 'number')
}

export async function apiState(code: string, token: string): Promise<ApiResult<StateResponse>> {
  const qs = new URLSearchParams({ code, token })
  const result = await request<StateResponse>(`/state?${qs.toString()}`, { method: 'GET', headers: headers() })
  return ensure(
    result,
    (d) =>
      typeof d.room === 'object' &&
      d.room !== null &&
      typeof d.room.version === 'number' &&
      Array.isArray(d.hand) &&
      typeof d.you === 'object' &&
      d.you !== null &&
      typeof d.you.seat === 'number',
  )
}

export function apiLobbySwap(code: string, token: string, a: number, b: number): Promise<ApiResult<object>> {
  return post('/lobby-swap', { code, token, a, b })
}

export function apiStart(code: string, token: string): Promise<ApiResult<object>> {
  return post('/start', { code, token })
}

export function apiAction(code: string, token: string, action: ClientAction): Promise<ApiResult<object>> {
  return post('/action', { code, token, action })
}

export function apiHeartbeat(code: string, token: string): Promise<ApiResult<HeartbeatResponse>> {
  return post('/heartbeat', { code, token })
}

export function apiVoteBot(
  code: string,
  token: string,
  targetSeat: number,
  vote: boolean,
): Promise<ApiResult<object>> {
  return post('/vote-bot', { code, token, targetSeat, vote })
}

/** Friendly copy for every error code a player can hit — never a raw stack or JSON. */
const FRIENDLY: Record<string, string> = {
  NETWORK: 'Could not reach the table. Check your connection and try again.',
  BAD_RESPONSE: 'The table sent a garbled reply. Try again in a moment.',
  ROOM_NOT_FOUND: 'That room does not exist — it may have expired.',
  ROOM_FULL: 'That room is already full.',
  ALREADY_STARTED: 'That game already started. You can only rejoin a seat you already held.',
  BAD_TOKEN: 'Your seat token was not recognized. Join again to take a seat.',
  NOT_HOST: 'Only the host can start the game.',
  NOT_FULL: 'All six seats must be filled before the game can start.',
  RATE_LIMITED: 'Easy there — too many requests. Wait a moment and try again.',
  CONFLICT: 'The table was busy. Try that again.',
  PAUSED: 'The game is paused while a player is disconnected.',
  VOTE_INVALID: 'That vote is not open — the player may be back, or has not been gone long enough (90 seconds).',
  WRONG_PHASE: 'That move is not available right now.',
  NOT_YOUR_TURN: 'It is not your turn.',
  ASKER_OUT: 'You are out of cards and cannot ask.',
  TARGET_TEAMMATE: 'You can only ask opponents.',
  TARGET_SELF: 'You cannot ask yourself.',
  TARGET_OUT: 'That player has no cards left.',
  NO_CARD_OF_BOOK: 'You must hold a card of that half-suit to ask for it.',
  ASKING_OWN_CARD: 'You already hold that card.',
  INVALID_CARD: 'That is not a card in this deck.',
  BOOK_RESOLVED: 'That half-suit has already been resolved.',
  BAD_ASSIGNMENTS: 'A claim must place all six cards of the half-suit.',
  ASSIGN_OPPONENT: 'Claims may only place cards with your own team.',
  PASS_TARGET_OUT: 'That teammate has no cards — pick another.',
  PASS_TARGET_NOT_TEAMMATE: 'You can only pass to a teammate.',
  DESIGNATE_TARGET_INVALID: 'Pick an opponent who still has cards.',
  INVALID_ACTION: 'That move is not legal right now.',
}

export function friendlyMessage(error: ApiErrorInfo): string {
  return FRIENDLY[error.code] ?? (error.message || 'Something went wrong. Try again.')
}
