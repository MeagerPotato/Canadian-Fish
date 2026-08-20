# PROTOCOL.md — client ⇄ server contract (Phase 2)

Single source of truth for the room protocol. The server implements it exactly; the client consumes
it exactly; the Playwright gate drives the UI against it. Engine types come from `lib/engine`
(import — do not redeclare).

## 1. Transport & auth

- The client always calls **its own origin** `/api/*`. Routing to the real server:
  - Vite dev: `server.proxy` `/api` → `https://fnandjtzwhihgefkfwzj.supabase.co/functions/v1/api`
    (changeOrigin, path rewrite `/api` → `/functions/v1/api`).
  - Local harness (`scripts/harness.mjs`): serves `dist/` with SPA fallback + same proxy.
  - Production: `vercel.json` rewrite `/api/:path*` → same destination.
- Every request carries headers `apikey: <VITE_SUPABASE_ANON_KEY>` and
  `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>` (the edge function has verify_jwt on; the anon
  key is public by design). One client fetch wrapper owns this.
- All bodies JSON. Responses: `{ ok: true, ...payload }` or
  `{ ok: false, error: { code: string, message: string } }` with a matching HTTP status
  (400 validation, 401 bad token, 403 forbidden, 404 not found, 409 conflict, 429 rate limited).
- The server derives the acting **seat from the token** — the client NEVER sends a seat number for
  itself, and any seat field in an action body is ignored/overwritten server-side.

## 2. Persistence shape (server-internal, never sent to clients)

One row in `rooms` per room: `{ id, code, status: 'lobby'|'playing'|'finished', state, version,
created_at, last_activity }`. `state` jsonb:

```ts
interface SeatMeta { name: string; tokenHash: string | null;   // sha256 hex of playerToken; bots: null unless substituted-from-human
                     isBot: boolean; botDifficulty: 'easy'|'medium'|'hard'|null;
                     lastSeen: number }                        // ms epoch; bots: Infinity-equivalent (use 8640000000000000)
interface RoomState { seats: (SeatMeta|null)[];                // length 6, index = seat
                      game: GameState | null;                  // lib/engine state, null in lobby
                      roomSeed: string; hostSeat: number; createdAt: number;
                      pendingVote: { targetSeat: number; votes: Record<number, boolean>; startedAt: number } | null }
```

Every mutation: load row → validate → engine → `saveRoomCAS(id, expectedVersion, …, version+1)`
(update guarded on id+version; on conflict reload and retry ≤ 3, then 409 `CONFLICT`). Every
mutation also bumps `last_activity` (the 6 h hard-delete cron keys off it).

## 3. Endpoints (paths relative to `/api`)

### POST /create-room  `{ name?: string, fillBots?: number, botDifficulty?: 'easy'|'medium'|'hard' }`
→ `{ ok, code, playerToken, seat: 0 }`. Creator takes seat 0 and is `hostSeat`. `fillBots` (0–5,
default 0) fills seats 1..fillBots with bots (practice rooms). Name rules (everywhere): trim,
strip C0/C1 control chars, collapse whitespace, max 20 chars, default `"Player"`; stored verbatim
otherwise (React escaping handles display; server additionally rejects `<` and `>`).
Room code: 6 chars from alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` via crypto randomness; retry on
unique-violation. Errors: `RATE_LIMITED`.

### POST /join  `{ code, name?: string, token?: string }`
→ `{ ok, playerToken, seat, rejoined: boolean }`.
- If `token` matches a seat's `tokenHash` → rejoin that seat in ANY status (`rejoined: true`,
  same token returned). If that seat was bot-substituted, the human reclaims it
  (`isBot=false`, unpauses if applicable) — broadcast follows.
- Else requires `status='lobby'` and a free seat: lowest-index free seat, fresh 32-byte-hex token.
- Errors: `ROOM_NOT_FOUND` (404), `ROOM_FULL` (409), `ALREADY_STARTED` (409), `RATE_LIMITED`.

### GET /state?code=…&token=…
→ `{ ok, you: { seat, name }, hand: Card[], room: PublicRoomState }`. `hand` is `[]` in lobby.
This is the ONLY place a hand ever appears, and only the token owner's own hand.
Errors: `ROOM_NOT_FOUND`, `BAD_TOKEN` (401).

### POST /lobby-swap  `{ code, token, a: number, b: number }`
Lobby only; any seated member; swaps the two seat entries (either may be empty/bot). → `{ ok }`.

### POST /start  `{ code, token }`
Host only (`NOT_HOST` 403), lobby only, all 6 seats filled (`NOT_FULL` 409). Sets
`status='playing'`, `game = newGame(roomSeed)`. → `{ ok }`. Runs the bot chain if seat 0 is a bot.

### POST /action  `{ code, token, action }`
`action` is one of (seat always derived from token):
`{ type:'ask', target: Seat, card: Card }` · `{ type:'claim', book: BookId, assignments: Record<Card, Seat> }`
· `{ type:'pass', to: Seat }` · `{ type:'designate', to: Seat }`.
Server validates phase/turn via `reduce`; engine error codes pass through as
`{ error: { code } }` (400). While paused → `PAUSED` (409). After a successful human action, the
**bot chain** runs: while `status='playing'`, not paused, and the seat to act is a bot → decide via
the bot module (public `seatView` only, seeded by `hash(roomSeed, moveIndex)`) → reduce → broadcast
each step; cap 60 steps per request (heartbeats resume a capped chain). → `{ ok }`.

### POST /heartbeat  `{ code, token }`
Updates `lastSeen`; recomputes pause; resumes a pending bot chain; broadcasts only when public
state changed (pause flips, bot moves). → `{ ok, version }`. Client sends every 20 s while mounted.

### POST /vote-bot  `{ code, token, targetSeat, vote: boolean }`
Playing only. Valid when target seat is a connected-record human whose `lastSeen` is ≥ 90 s old.
First `vote:true` creates `pendingVote`. Substitution triggers when yes-votes from **connected
humans other than the target** reach a majority of them (> half). On substitute: `isBot=true`,
`botDifficulty='medium'`, keep `tokenHash` (rejoin reclaims), clear vote, recompute pause,
broadcast, run bot chain. → `{ ok }`. Errors: `VOTE_INVALID` (409).

### GET /health → `{ ok, rooms, ts }` (exists already).

## 4. Realtime broadcast

- Channel/topic: `room:{CODE}` (code uppercase). Public broadcast channel; clients subscribe with
  supabase-js using the anon key. **Clients never subscribe to postgres_changes.**
- One event type: `event: 'room'`, payload = `PublicRoomState` (full snapshot, idempotent).
  Server sends via Realtime REST (`/realtime/v1/api/broadcast`, service key) — one HTTP call per
  mutation, `messages[]` batched in bot chains (one entry per engine step, ascending `version`).

```ts
interface PublicRoomState {
  code: string; status: 'lobby'|'playing'|'finished'; hostSeat: number;
  seats: { seat: number; filled: boolean; name: string|null; isBot: boolean; connected: boolean }[]; // 6
  paused: boolean;                                    // playing && some filled human seat disconnected
  pendingVote: { targetSeat: number; yes: number; needed: number } | null;
  game: PublicState | null;                           // lib/engine publicView(state) — NO hands, ever
  version: number;
}
```
`connected` = `now - lastSeen < 45_000` (bots: always true). `paused` is computed, never stored.

## 5. Client behavior

- Identity: localStorage `cf:name` (display name), `cf:room:{CODE}:token`. On `/r/:code` mount:
  token present → `GET /state` (restores seat + hand + room, target < 3 s); else join form.
- Subscribe to `room:{CODE}` on mount. Apply payload iff `payload.version > current.version`.
  On (re)subscribe and on visibility regain → refetch `/state` (authoritative resync).
- Refetch `/state` (debounced ~150 ms) whenever new log entries include an `ask` with
  `hit && (asker===mySeat || target===mySeat)` or any `claim` — those change my hand.
- Heartbeat every 20 s. Surface `paused`, per-seat `connected`, and the vote UI when
  `pendingVote` targets someone (any connected human may open a vote via seat menu once a seat
  shows disconnected ≥ 90 s — client shows the button when `connected===false` persists).

## 6. Rate limits (server, `rate_limits` table, bucket pk, count, window_start)

- `c:{ip}:{hour}` create ≤ 20/h/IP · `j:{ip}:{hour}` join ≤ 120/h/IP ·
  `a:{tokenHash[0..7]}:{epochSec/10}` actions ≤ 30/10 s/token. Exceed → 429 `RATE_LIMITED`.
- IP = first entry of `x-forwarded-for` (fallback `'?'`). Implement as atomic upsert+increment
  returning the new count.

## 7. data-testid contract (client MUST ship exactly these; the e2e gate depends on them)

Home `/`: `create-name`, `create-room`, `join-code`, `join-name`, `join-room`.
Lobby `/r/:code`: `room-code` (text = code), `seat-{0..5}` (attr `data-filled`, `data-team`),
`seat-name-{n}`, `start-game` (disabled until 6 filled + host).
Table: `your-turn` (rendered only when it's my turn and an action is required of me), `phase`
(text = engine phase), `turn-seat` (text = seat number), `count-{0..5}` (text = card count),
`score-a`, `score-b`, `hand` (container), `card-{CARD}` (e.g. `card-9H`, one per own card),
`log` (container), `log-entry` (each), `game-over`, `winner` (text `A`/`B`/`tie`).
Ask flow: `ask-open`, `ask-target-{n}`, `ask-book-{BOOKID}` (e.g. `ask-book-LOW-H`),
`ask-card-{CARD}`, `ask-submit`.
Claim flow: `claim-open`, `claim-book-{BOOKID}`, `claim-card-{CARD}-seat-{n}` (assign card to
teammate), `claim-submit`.
Pass/designate: `pass-to-{n}`, `designate-{n}`.
States: `paused-banner`, `disconnected-banner`, `error-banner`, `vote-bot-{n}`.
All interactive testids must be actual interactive elements (button/input), tap targets ≥ 44 px.

## 8. Server code layout (portability + testability)

```
server/deps.ts      Deps interface: loadRoomByCode, insertRoom, saveRoomCAS, bumpRateLimit,
                    broadcast(topic, payloads[]), now(), randomToken(), sha256hex()
server/protocol.ts  request/response + PublicRoomState types & builder (from RoomState + engine publicView)
server/room.ts      all mutations (create/join/swap/start/action/heartbeat/vote) as pure fns over Deps
server/bots.ts      Phase-2 placeholder bot: deterministic seeded choice among legal actions,
                    signature decide(view: SeatView, difficulty, seed) — public view ONLY
server/handlers.ts  route(req: Request, deps: Deps): Promise<Response> — Web-standard, no Deno/Node APIs
supabase/functions/api/index.ts   Deno entry: builds real Deps (npm:@supabase/supabase-js@2,
                    Deno.env service key), Deno.serve(route). EXCLUDED from tsc (Deno globals).
tests/server/       vitest: in-memory Deps; full flows (create→join×5→start→scripted game to
                    finish incl. pass/designate), rejoin/restore, vote-bot substitution, rate
                    limits, CAS retry, and a payload-privacy test: for every seat, /state returns
                    only that seat's hand, and every broadcast payload JSON contains no card
                    strings outside `game.books`/`game.log` claim reveals.
```
The engine stays pure; `server/` holds all IO decisions behind `Deps`; the edge entry is a thin shim.
