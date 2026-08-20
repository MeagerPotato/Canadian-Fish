/**
 * Shared helpers for the server test-suite: HTTP wrappers around route(), room
 * setup shortcuts, and the card-leak walker used by the payload-privacy tests.
 */
import { ALL_CARDS, bookCards } from '../../lib/engine/index.ts'
import type { BookId, Card, Seat } from '../../lib/engine/index.ts'
import { route } from '../../server/handlers.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import type { MemDeps } from './memdeps.ts'

export interface HttpResult {
  status: number
  body: Record<string, unknown>
  headers: Headers
}

export async function post(
  deps: MemDeps,
  path: string,
  body: unknown,
  opts: { ip?: string; rawBody?: string } = {},
): Promise<HttpResult> {
  const res = await route(
    new Request(`http://test${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': opts.ip ?? '1.2.3.4',
      },
      body: opts.rawBody ?? JSON.stringify(body),
    }),
    deps,
  )
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers }
}

export async function get(deps: MemDeps, path: string): Promise<HttpResult> {
  const res = await route(new Request(`http://test${path}`, { method: 'GET' }), deps)
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers }
}

/** Create a room and fill all 6 seats with humans. tokens[i] belongs to seat i. */
export async function sixHumans(
  deps: MemDeps,
  names: string[] = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'],
): Promise<{ code: string; tokens: string[] }> {
  const created = await post(deps, '/api/create-room', { name: names[0] })
  if (created.status !== 200) throw new Error(`create failed: ${JSON.stringify(created.body)}`)
  const code = created.body.code as string
  const tokens: string[] = [created.body.playerToken as string]
  for (let i = 1; i < 6; i++) {
    const joined = await post(deps, '/api/join', { code, name: names[i] }, { ip: `10.0.0.${i}` })
    if (joined.status !== 200) throw new Error(`join ${i} failed: ${JSON.stringify(joined.body)}`)
    tokens.push(joined.body.playerToken as string)
  }
  return { code, tokens }
}

/** Assignments record putting every card of `book` on `seat`. */
export function allTo(book: BookId, seat: Seat): Record<Card, Seat> {
  return Object.fromEntries(bookCards(book).map((c) => [c, seat])) as Record<Card, Seat>
}

/* ------------------------------------------------------- card-leak walker --- */

const CARD_STRINGS: ReadonlySet<string> = new Set(ALL_CARDS)

export interface CardHit {
  /** JSON path segments from the walked root to the card occurrence. */
  path: string[]
  kind: 'value' | 'key'
}

/** Every card-code occurrence (string value or object key) with its JSON path. */
export function collectCardHits(node: unknown, path: string[] = [], out: CardHit[] = []): CardHit[] {
  if (typeof node === 'string') {
    if (CARD_STRINGS.has(node)) out.push({ path, kind: 'value' })
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectCardHits(v, [...path, String(i)], out))
    return out
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (CARD_STRINGS.has(k)) out.push({ path: [...path, k], kind: 'key' })
      collectCardHits(v, [...path, k], out)
    }
  }
  return out
}

interface LogEntryLike {
  type?: unknown
}

/**
 * True iff a card occurrence inside a game projection is public by contract:
 * books[*].assignments / books[*].actualHolders, and log claim entries
 * (their assignments/actualHolders). With allowAskCards, the publicly announced
 * `card` of an ask log entry is also accepted.
 */
export function isAllowedGameCardPath(
  segs: string[],
  game: { log?: unknown[] } | null | undefined,
  allowAskCards: boolean,
): boolean {
  if (segs[0] === 'books' && (segs[2] === 'assignments' || segs[2] === 'actualHolders')) return true
  if (segs[0] === 'log' && game && Array.isArray(game.log)) {
    const entry = game.log[Number(segs[1])] as LogEntryLike | undefined
    if (entry?.type === 'claim' && (segs[2] === 'assignments' || segs[2] === 'actualHolders')) return true
    if (allowAskCards && entry?.type === 'ask' && segs[2] === 'card') return true
  }
  return false
}

/** Assert-style check over one broadcast payload; returns the violating hits. */
export function broadcastCardViolations(payload: PublicRoomState, allowAskCards: boolean): CardHit[] {
  return collectCardHits(payload).filter((hit) => {
    if (hit.path[0] !== 'game') return true
    return !isAllowedGameCardPath(hit.path.slice(1), payload.game, allowAskCards)
  })
}
