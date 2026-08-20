/**
 * handlers.ts — route(req, deps): Web-standard Request -> Response dispatch for
 * every endpoint of PROTOCOL.md §3. No Deno/Node APIs; all IO flows through
 * Deps. Permissive CORS on every response; 404 for unknown routes; malformed or
 * oversized (> 32 KB) JSON answers 400 BAD_REQUEST without throwing.
 */
import type { Deps } from './deps.ts'
import { MAX_BODY_BYTES } from './protocol.ts'
import {
  parseActionRequest,
  parseCreateRoom,
  parseJoin,
  parseLobbySwap,
  parseVoteBot,
  parseCodeToken,
} from './protocol.ts'
import {
  actRoom,
  createRoom,
  getState,
  health,
  heartbeat,
  joinRoom,
  lobbySwap,
  startRoom,
  voteBot,
} from './room.ts'
import type { RoomResult } from './room.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function jsonError(status: number, code: string, message: string): Response {
  return json(status, { ok: false, error: { code, message } })
}

function fromResult<T extends object>(result: RoomResult<T>): Response {
  if (!result.ok) return jsonError(result.httpStatus, result.error.code, result.error.message)
  return json(200, { ok: true, ...result.body })
}

/**
 * Normalize the incoming pathname to the PROTOCOL route (e.g. '/create-room').
 * Accepts '/create-room', '/api/create-room', and '/functions/v1/api/create-room'
 * so the same handler serves the edge function, proxies, and tests.
 */
function routePath(pathname: string): string {
  let p = pathname
  if (p.startsWith('/functions/v1')) p = p.slice('/functions/v1'.length)
  if (p === '/api' || p.startsWith('/api/')) p = p.slice('/api'.length)
  if (p === '') p = '/'
  return p
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd === null) return '?'
  const first = fwd.split(',')[0].trim()
  return first === '' ? '?' : first
}

type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false }

async function readJsonBody(req: Request): Promise<BodyResult> {
  const declared = req.headers.get('content-length')
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) return { ok: false }
  let buf: ArrayBuffer
  try {
    buf = await req.arrayBuffer()
  } catch {
    return { ok: false }
  }
  if (buf.byteLength > MAX_BODY_BYTES) return { ok: false }
  const text = new TextDecoder().decode(buf)
  if (text.trim() === '') return { ok: true, body: {} }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ok: false }
  return { ok: true, body: value as Record<string, unknown> }
}

export async function route(req: Request, deps: Deps): Promise<Response> {
  try {
    return await routeInner(req, deps)
  } catch {
    return jsonError(500, 'INTERNAL', 'internal server error')
  }
}

async function routeInner(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  const url = new URL(req.url)
  const path = routePath(url.pathname)

  if (req.method === 'GET') {
    if (path === '/health') {
      const h = await health(deps)
      return json(200, { ok: true, ...h })
    }
    if (path === '/state') {
      const code = url.searchParams.get('code')
      const token = url.searchParams.get('token')
      if (code === null || token === null || token === '' || token.length > 256) {
        return jsonError(400, 'BAD_REQUEST', 'code and token query parameters are required')
      }
      return fromResult(await getState(deps, { code, token }))
    }
    return jsonError(404, 'NOT_FOUND', `no route for GET ${path}`)
  }

  if (req.method !== 'POST') {
    return jsonError(404, 'NOT_FOUND', `no route for ${req.method} ${path}`)
  }

  const parsed = await readJsonBody(req)
  if (!parsed.ok) {
    return jsonError(400, 'BAD_REQUEST', 'body must be a JSON object of at most 32 KB')
  }
  const body = parsed.body

  switch (path) {
    case '/create-room': {
      const p = parseCreateRoom(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await createRoom(deps, { ...p.value, ip: clientIp(req) }))
    }
    case '/join': {
      const p = parseJoin(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await joinRoom(deps, { ...p.value, ip: clientIp(req) }))
    }
    case '/lobby-swap': {
      const p = parseLobbySwap(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await lobbySwap(deps, p.value))
    }
    case '/start': {
      const p = parseCodeToken(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await startRoom(deps, p.value))
    }
    case '/action': {
      const p = parseActionRequest(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await actRoom(deps, p.value))
    }
    case '/heartbeat': {
      const p = parseCodeToken(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await heartbeat(deps, p.value))
    }
    case '/vote-bot': {
      const p = parseVoteBot(body)
      if (!p.ok) return jsonError(400, 'BAD_REQUEST', p.message)
      return fromResult(await voteBot(deps, p.value))
    }
    default:
      return jsonError(404, 'NOT_FOUND', `no route for POST ${path}`)
  }
}
