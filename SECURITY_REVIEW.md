# SECURITY_REVIEW.md — Canadian Fish adversarial red team (Phase 6)

**Date:** 2026-08-20
**Target:** Live Supabase Edge Function `api` (`https://fnandjtzwhihgefkfwzj.supabase.co/functions/v1/api`),
Realtime broadcast channels `room:{CODE}`, the built client bundle (`dist/`), and Postgres (`rooms`,
`rate_limits`) behind RLS.
**Method:** Real requests against the live backend (create → 5 joins → start → play), live Realtime
subscription + frame capture, anon `supabase-js` direct-table/`postgres_changes` probes, a headless
Chromium DOM check via the local harness, full `dist/` + git-history secret scan, and source review of
`server/*.ts`, `supabase/functions/api/index.ts`, the SQL migration, and the React client.
**Rules honored:** no fixes applied, no state-mutating git. Read-only git history scanning was used
(explicitly requested by attack #3). Probe scripts live in the scratchpad `dbtest/`, not the repo.

> Two intended confirmations could not be executed: an execution-sandbox safety classifier began
> blocking new `node`/network commands partway through (reacting to cumulative conversation content,
> not to any specific action). The affected items are **F1 (broadcast-send injection)** and two trivial
> reads (anon-JWT expiry — already derived from the captured payload; live `/health` value). Everything
> else below was executed live. F1 is assessed from code + Supabase platform defaults and carries an
> exact repro the orchestrator can run to confirm.

## Summary table

| # | Severity | Title | Status |
|---|----------|-------|--------|
| F1 | **High** | Public broadcast channel is client-writable → live game-state spoofing + persistent client DoS (version poisoning) | **CONFIRMED, FIXED & RE-VERIFIED** — commit `fix(security)`, see §Remediation |
| F2 | **Medium** | Rate limits (create/join/action) bypassable via request concurrency (non-atomic `bumpRateLimit`) | **CONFIRMED, FIXED & RE-VERIFIED** — migration 0002 + edge fn v4, see §Remediation |
| F3 | Low | Client version-reconciliation lets an over-high version lock out authoritative `/state` (robustness; root-cause shared with F1) | **FIXED** as a consequence of the F1 remediation |
| F4 | Low | Lobby-swap griefing: any seated member can rearrange all seats/teams pre-start | Executed (200) — **deferred**, MANUAL_TODO #3 |
| F5 | Low | `rate_limits` stores client IP in plaintext for ≤2 h (vs "nothing survives the session") | Confirmed from code/migration — **deferred**, MANUAL_TODO #3 |
| F6 | Info | Fixed-window limiter allows ~2× burst at window boundaries | From code — deferred |

---

## Remediation (applied and re-verified by the orchestrator, 2026-08-20)

### F1 — HIGH — fixed by making broadcasts untrusted hints

**Confirmed first.** The reviewer's live send test had been blocked mid-run; the orchestrator
confirmed the vulnerability two ways: (a) the Phase-0 realtime probe had already published to
`room:TEST01` with only the public anon key and received it back (`202` + delivery), and (b) code
review showed `useRoom.ts` rendered broadcast payloads directly (`setRoom(next)`) *and* set
`versionRef` from them, so a forged `version: 999999999` would also make every later authoritative
`/state` fail the `>=` gate — a permanent client wedge.

**Fix (client-side, platform-independent).** Broadcast payloads are no longer data:

- `src/api/realtime.ts` — the subscription now extracts **only** `payload.version` and discards the
  rest; the handler is `onHint(hintVersion: number)`. A forged payload has no path into app state.
- `src/viewmodels/sync.ts` — `shouldApplyBroadcast` is replaced by `shouldRefetchOnHint`; only
  `shouldApplyFetch` (authoritative `GET /state`, authenticated by the caller's `playerToken`) may
  advance the version or render.
- `src/hooks/useRoom.ts` — a hint merely schedules a `/state` refetch, coalesced and throttled to at
  most one per 250 ms with a guaranteed trailing fetch, so hint-spam cannot storm the API either.

**Re-verification — live forged-broadcast attack (executed 2026-08-20, room `EHXHPT`):**

```
room EHXHPT: real score 0-0, version 1
rendered before attack: {"a":"0","b":"0","turn":"0"}
PASS  anon CAN still publish to the public channel (platform behaviour)  HTTP 202
rendered after attack:  {"a":"0","b":"0","turn":"0"}
PASS  forged score 99 NOT rendered  score-a="0"
PASS  client shows real score, unchanged
after a real move: server log 9 entries, UI shows 9
PASS  client NOT wedged — UI still tracks the server after the forgery  ui=9 server=9

F1 VERIFIED FIXED: forgery neither spoofed the table nor wedged the client.
```

Residual (accepted, Low): an attacker who knows a room code can still *publish noise* to the public
topic, costing victims at most one throttled `/state` fetch per 250 ms. Hardening the platform layer
(private channels + an RLS policy denying `anon` INSERT on `realtime.messages`) is recorded as
MANUAL_TODO #3; it is defence-in-depth, not required to close F1.

### F2 — MEDIUM — fixed with an atomic Postgres counter

**Fix.** `supabase/migrations/0002_atomic_rate_limit_bump.sql` adds

```sql
insert into public.rate_limits (bucket, count, window_start) values (p_bucket, 1, now())
on conflict (bucket) do update set count = public.rate_limits.count + 1
returning count;
```

as `public.bump_rate_limit(text)` (SECURITY DEFINER; `execute` granted to `service_role` only,
revoked from `anon`/`authenticated`). Edge function v4 calls it via `db.rpc(...)` and **fails closed**
— an unreadable limiter returns `Number.MAX_SAFE_INTEGER`, i.e. rate-limited, never an open door.

**Re-verification — two independent live measurements (2026-08-20):**

1. *Exact counting under concurrency.* 75 simultaneous `/join` landed in a fresh hourly bucket; the
   counter read **exactly 75** afterwards. The old read-modify-write undercounted badly (the
   reviewer's 80-request burst produced window counts of 19/11/19/18).
2. *The 429 path.* 45 simultaneous `/action` on one token against the documented 30-per-10s cap:

```
fired 45 CONCURRENT /action on one token in 1917ms  (cap = 30 per 10s)
   30 x  400 WRONG_PHASE
   15 x  429 RATE_LIMITED

F2 FIXED: 15/45 concurrent requests rate-limited (expected ~15).
```

Exactly 30 admitted, exactly 15 rejected — versus 0 rejections before the fix.

### Gates re-run after remediation

`npm test` 192/192 · `tsc --noEmit` 0 · `eslint --max-warnings 0` 0 · 10,000-game fuzz clean ·
6,000-game bot simulation unchanged · six-client Playwright e2e green against the live backend
(38 driver iterations to 8/8 books, reload recovery 266/269 ms, per-context payload-privacy scans
clean). Production redeployed and re-smoked through `https://canadian-fish.vercel.app` (42/42).
| F7 | Info | `GET /health` discloses global room count | From protocol/code |
| D1 | Info (PASS) | Hidden-hand leakage — defended on every surface | Executed |
| D2 | Info (PASS) | Identity/authz — seat derived from token; spoof/out-of-turn/foreign-token/non-host all rejected; 256-bit tokens | Executed |
| D3 | Info (PASS) | Secrets — only the anon key is exposed (by design); no service key in bundle/maps/history/env | Executed |
| D4 | Info (PASS) | RLS — all direct table ops denied (42501); `postgres_changes` delivers 0 rows | Executed |
| D5 | Info (PASS) | Room-code brute force infeasible at documented rate for realistic room counts | Executed |
| D6 | Info (PASS) | Input abuse — oversized/malformed/nested/proto-pollution/action-shape all rejected; names sanitized; XSS blocked end-to-end; React escapes | Executed (incl. headless DOM) |
| D7 | Info (PASS) | Deletion path — deleted/nonexistent room `/state` → 404; retention cron present in migration | Executed + reviewed |

**Must-fix:** F1 (High). **Should-fix:** F2 (Medium). **Defer/hardening:** F3–F7 (Low/Info).
No Critical found. Confidentiality of hidden hands, player tokens, and the service key is intact.

---

## F1 — High — Public broadcast channel is client-writable → game-state spoofing + persistent client DoS

**What the design assumes.** SPEC §10 / assumption 5: the `room:{CODE}` broadcast channel is a
public topic "guarded by room-code entropy," carrying "public state only, so a leak of the topic name
leaks nothing hidden." That reasoning covers **confidentiality** of the topic but not **authenticity**:
it never establishes that only the server may *write* to the channel.

**What the code does.**
- `src/api/realtime.ts:69` subscribes with a **plain** channel: `channel = supabase.channel(topic)` —
  no `{ config: { private: true } }`. In Supabase Realtime, non-private broadcast channels relay
  broadcasts sent by *any* connected client (the anon key is enough); only `private: true` channels
  enforce RLS on `realtime.messages` to restrict who may send.
- `src/api/realtime.ts:70-72` accepts any `room` event whose `payload.version` is a number.
- `src/viewmodels/sync.ts:15` applies a broadcast iff `incomingVersion > currentVersion`.
- `src/hooks/useRoom.ts:78-94` (`applySnapshot`) sets `versionRef.current = next.version` and
  `setRoom(next)` on any accepted snapshot — the payload is rendered verbatim (seats, names, phase,
  turn, counts, score, log, winner, pendingVote).

**Impact (two effects).**
1. **Spoofing.** A forged snapshot with a large `version` renders attacker-controlled public state to
   every other player: fake board, fake `turn` ("it's not your turn"), fake `game_over`/`winner`
   ("you lost 0-99"), fake seat names. Any of the 6 players trivially holds the room code; an outsider
   can guess/brute-force it (see D5/F2).
2. **Persistent client DoS ("version poisoning").** Because `versionRef.current` becomes the forged
   value (e.g. `2_000_000_000`), *every* subsequent legitimate update is gated out — real broadcasts
   (`50 > 2e9` = false) **and** authoritative `/state` fetches, heartbeat resyncs, and
   visibility-regain resyncs, which all use `shouldApplyFetch` = `incoming >= current`
   (`sync.ts:20-22`, `useRoom.ts:82`). `50 >= 2e9` is false, so real state can never overwrite the
   forgery. The victim is frozen on attacker state until a full remount/reload.

Server-authoritative state is **unaffected** — `/api/action` still validates against the real DB row,
and no hands/tokens/keys are exposed. This is purely client-side display integrity + availability, but
it breaks live games for all participants and is reachable with only the public anon key.

**Executed vs blocked.** The client trust model and poisoning amplification are confirmed from source
(above). The one live step — an anon `channel.send({type:'broadcast',event:'room',payload})` being
delivered to a second subscriber — was blocked by the execution sandbox before it ran. Exploitation is
highly likely given the plain public channel + Supabase's permissive default; the orchestrator should
confirm with the repro below.

**Repro (orchestrator, ~20 lines).**
```js
import { createClient } from '@supabase/supabase-js'
const url='https://fnandjtzwhihgefkfwzj.supabase.co', anon='<anon>'
const CODE='<any live room>'
const victim=createClient(url,anon), attacker=createClient(url,anon)
const got=[]; const v=victim.channel(`room:${CODE}`)
v.on('broadcast',{event:'room'},p=>got.push(p.payload)); await new Promise(r=>v.subscribe(s=>s==='SUBSCRIBED'&&r()))
const a=attacker.channel(`room:${CODE}`); await new Promise(r=>a.subscribe(s=>s==='SUBSCRIBED'&&r()))
await a.send({type:'broadcast',event:'room',payload:{code:CODE,status:'finished',hostSeat:0,paused:false,
  pendingVote:null,seats:[...Array(6)].map((_,i)=>({seat:i,filled:true,name:'PWNED',isBot:false,connected:true})),
  game:{phase:'finished',turn:0,counts:[0,0,0,0,0,0],score:[99,0],books:{},
        log:[{type:'game_over',score:[99,0],winner:0}],moveIndex:9e8,config:{}},version:2e9}})
await new Promise(r=>setTimeout(r,3000))
console.log('victim accepted forged frame:', got.some(p=>p.seats?.some(s=>s.name==='PWNED')))
```
If `victim accepted forged frame: true`, F1 is live-exploitable.

**Fix (any one closes spoofing; do the last regardless as defense-in-depth).**
- Make the channel **private**: client `supabase.channel(topic,{config:{private:true}})`, and add an
  RLS policy on `realtime.messages` that **denies** `anon`/`authenticated` INSERT for `room:*` topics
  (the server sends over the Realtime REST endpoint with the service key, which bypasses RLS, so
  server→client broadcasts keep working). This is the primary fix.
- **Defense-in-depth (also fixes F3):** treat broadcasts as *hints only*. On every accepted broadcast,
  always schedule an authoritative `/state` refetch, and let `/state` **reset** the version baseline
  rather than be gated by it (a broadcast must never be able to raise `versionRef` beyond what a signed
  server response has confirmed). This bounds the damage even if the channel is ever misconfigured.

---

## F2 — Medium — Rate limits bypassable via request concurrency (non-atomic `bumpRateLimit`)

**Root cause.** `supabase/functions/api/index.ts:59-86` implements the limiter as a non-atomic
read-modify-write: `SELECT count` → guarded `UPDATE … WHERE count = prev` (2 attempts) → **unguarded
best-effort** `UPDATE count = prev+1` fallback. Under concurrency, many requests read the same `prev`,
one wins the guarded update, the losers fall through to the unguarded fallback and all write the *same*
low value. The counter badly undercounts, so the `> LIMITS.*` threshold is never reached.

**Executed evidence (action bucket, `a:{tokenHash[0..7]}:{win}`, limit 30/10 s).**
- **80 concurrent** `/action` to a single token bucket, all inside one 10 s window
  (`window 178724010: total=80 {"404":80}`): **zero 429s.** An atomic limiter would 429 requests
  31-80. (404 = the request passed the rate gate, then failed room lookup for the dummy code — proving
  each one *did* reach and bump the limiter.)
- Control: 40 **sequential** requests spread across 3 windows (21 s) also produced no 429 — expected
  fixed-window behavior (≈2/s stays under 3/s), and confirms the burst result above is the concurrency
  race, not a dead limiter.
- The create limit **does** trigger under sequential load — I hit `429 RATE_LIMITED "too many rooms
  created from this address"` after the hour's create budget was consumed (my creates + shared-IP
  traffic). So the limiter works sequentially; concurrency is the bypass.

**Same code, higher-impact buckets.** `bumpRateLimit` is shared verbatim by the create
(`c:{ip}:{hour}`, 20/h) and join (`j:{ip}:{hour}`, 120/h) limits. By the identical mechanism, an
attacker firing concurrently can exceed both. Consequences:
- **Create bypass** → effectively unbounded room creation per IP → DB row growth + edge invocation cost
  (a real DoS/cost vector on the free-tier project).
- **Join bypass** → the 120/h cap is the *only* throttle on room-code guessing; concurrency raises the
  effective guess rate from 120/h toward edge-function throughput, cutting brute-force time (D5) by
  orders of magnitude (payoff is still only public state + seat-squatting).
- **Action bypass** → per-token action spam.

No confidentiality/integrity loss (engine authority + version-CAS on `rooms` are unaffected). I proved
the mechanism on the cheap `/action` bucket rather than flooding the shared production IP with rooms.

**Fix.** Make the increment atomic in one statement. Options: a Postgres RPC
`bump_rate_limit(bucket)` doing `INSERT … ON CONFLICT (bucket) DO UPDATE SET count = rate_limits.count
+ 1 RETURNING count`, called via `db.rpc(...)`; or a unique-key upsert with an atomic `count = count +
1`. Remove the unguarded fallback path.

---

## F3 — Low — Authoritative `/state` cannot recover from an over-high version

Independent of who sent it, once `versionRef.current` holds a too-high number, `shouldApplyFetch`
(`>=`, `sync.ts:20`) rejects every real `/state` (which carries a normal small version). This is the
amplifier behind F1's persistent DoS, but it is also a standalone robustness bug: a single anomalous
high-version snapshot (attacker, replay, or a future server off-by-large bug) wedges the client for the
room session with no self-heal short of remount. **Fix:** see F1's defense-in-depth item — `/state` is
authoritative and should reset the baseline, not be version-gated below a broadcast-supplied number.

## F4 — Low — Lobby-swap griefing

`POST /lobby-swap` authorizes *any* seated member (by design, PROTOCOL §3). Executed: a non-host member
(seat 1) swapped seats 0↔2 → **200**. A malicious lobby member can therefore rearrange everyone's seats
and teams (team = seat % 2), and shuffle the host seat, right up until start. Foreign-token swap →
`BAD_TOKEN`, `a==b`/out-of-range → `BAD_REQUEST` (all correctly rejected). Lobby-only, reversible,
no info leak — griefing only. **Fix (optional):** restrict swaps to the host, or to a member moving
only their own seat, or add a lobby "lock."

## F5 — Low — Client IP retained in `rate_limits` for up to 2 h

Bucket keys embed the raw client IP: `c:{ip}:{hour}`, `j:{ip}:{hour}` (`server/room.ts:185,236`). The
`clean-rate-limits` cron deletes rows only after `window_start < now() - interval '2 hours'`. So plain
IP addresses persist ~1-2 h — a mild tension with SPEC's "nothing survives the session." Standard for
rate limiting and low risk. **Fix (optional):** hash/truncate the IP in the bucket key, or shorten
retention.

## F6 — Info — Fixed-window burst doubling

Even once F2 is fixed, a fixed-window limiter permits ~2× the cap across a boundary (e.g. 30 at 9.99 s
+ 30 at 10.01 s). Common and acceptable; note for completeness. A sliding window or token bucket avoids
it.

## F7 — Info — `/health` room-count disclosure

`GET /health → { ok, rooms, ts }` returns the global room count (`server/room.ts:550-552`). Minor
operational metadata; no codes or hidden data. Leave as-is or gate behind an ops token.

---

## Defended surfaces (attacks executed that correctly failed to break anything)

### D1 — Hidden-hand leakage: DEFENDED (Info)
Created a real 6-seat game (`create` + 5 `join` + `start`) and captured all six hands via own-token
`/state`.
- **(a) Realtime `room:{CODE}`:** subscribed before joins, captured all 7 mutation frames; **0** frames
  contained `"hand"`, `"hands"`, `roomSeed`, or `seed`. Game-frame keys are exactly
  `code,game,hostSeat,paused,pendingVote,seats,status,version`; `game` keys are
  `books,config,counts,log,moveIndex,phase,score,turn`. Card strings appear **only** inside
  `game.log` (public asks/claims) and `game.books` (resolved) — public by rule, never a hidden hand.
  `publicView` (`lib/engine/views.ts:8-19`) omits `hands` and `seed`, so a client cannot re-derive
  hands via the deterministic deal.
- **(b) Own `/state`:** for all 6 seats, `you.seat` matched the token's seat, the `room` sub-object
  carried no hands, and no `seed`/`roomSeed` leaked. `hand` is exactly the caller's 8 cards.
- **(c) Crafted `/state`:** foreign 64-hex token → `401 BAD_TOKEN`; nonexistent valid-charset code →
  `404`; SQL-ish code `A' OR '1'='1` → `404` (killed by the `^[ALPHABET]{6}$` normalizer); 5 000-char
  code → `404`; missing token → `400`.
- **(d) Bundle/maps:** `dist/` ships one JS + one CSS + `index.html`; **no source maps**. The engine is
  bundled (minified `.hands` token present) but no hand *data* and no `roomSeed` is ever transmitted, so
  it is inert. (See D3 for secrets.)
- **(e) `postgres_changes` on `public.rooms`:** subscribed with the anon key while driving a live INSERT
  + 2 UPDATEs — **0 rows delivered** (channel reaches `SUBSCRIBED` but RLS/grants yield no data). No
  Realtime table-read path exists.

### D2 — Identity / authz: DEFENDED (Info)
- **(a) Spoofed seat:** sent `/action` as seat 0 with `seat:3`/`asker:3` injected at both top level and
  inside `action` — the resulting log entry's `asker` was **0** (the token's seat). Seat is derived
  from the token (`server/room.ts:409`, `toGameAction`), spoof ignored.
- **(b) Out of turn:** `400 NOT_YOUR_TURN`.
- **(c) Foreign token action:** `401 BAD_TOKEN`. There are no bot seats to hijack in a 6-human game, and
  you can only ever act as your own token's seat.
- **(d) Replay:** re-POSTing a captured successful `ask` returned `400 ASKING_OWN_CARD` (the first ask
  hit, so the card is now held) — replays are re-evaluated by the pure reducer against current state and
  the version-CAS, so a replay grants no power beyond what the token already holds. No nonce needed.
- **(e) Token entropy:** `randomToken()` = 32 crypto bytes → **64 lowercase hex chars = 256-bit**
  (SPEC says 128-bit; actual is stronger). Sample:
  `b5207dddaa97e04b386f22dcf8f4654426df85f1a7118b249b00153a6eec435d`. Seats are matched by
  `sha256(token)`, so forgery requires a SHA-256 preimage — infeasible.
- **(f) Non-host control:** non-host `start` → `403 NOT_HOST`; host `start` when not full → `409
  NOT_FULL`; `vote-bot` in lobby → `409 VOTE_INVALID`; `vote-bot` on a just-seen (connected) target →
  `VOTE_INVALID`; self-target and foreign-token votes rejected.

### D3 — Secrets: DEFENDED (Info)
- **Bundle:** the only JWT in `dist/assets/*.js` decodes to `role:anon` (public by design). No
  `service_role`, `SERVICE_ROLE`, `SERVICE_KEY`, or second JWT. No `.map` files.
- **Full git history (14 commits):** every `eyJ…` scan over all blobs found **0 tokens**; the only
  `service_role`/`SERVICE_ROLE` hits are documentation prose and the env-var reference
  `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. No `sbp_`/`sb_secret_`/PEM material.
- **Env files:** `.env*` is gitignored (only `.env.example`, a placeholder, is tracked); `.env.local`
  holds just the anon key + URL. The service key exists only as a platform-injected Edge Function env
  var (`supabase/functions/api/index.ts:13`).

### D4 — RLS: DEFENDED (Info)
Anon `supabase-js` direct access: `rooms` SELECT/INSERT/UPDATE/DELETE and `rate_limits`
SELECT/UPDATE/DELETE all → **`42501 permission denied`**. Unknown tables → `PGRST205` (schema usage
revoked). RPC → `PGRST202`. Matches migration `0001` (RLS enabled, zero client policies, grants + schema
usage revoked from `anon`/`authenticated`).

### D5 — Room-code brute force: infeasible at documented rate (Info)
Alphabet 31, length 6 → **887,503,681** codes. 40 random-code joins → **40× 404, 0 hits**. At 120
joins/h/IP, expected time to hit *any* of N live rooms = 7.4M/N hours: N=10 → 84 yr; N=1 000 → 0.8 yr;
N=10 000 → 740 h; only at an implausible N=100 000 does it fall to ~74 h. Payoff is public state +
seat-squatting only (no hands/tokens). Caveat: F2 (concurrency) is the real amplifier of the effective
guess rate — fixing F2 preserves this protection.

### D6 — Input abuse: DEFENDED (Info)
- Oversized (40 KB) body/name, malformed JSON, array/string/null top-level, → `400 BAD_REQUEST`
  ("…at most 32 KB" / type errors). 5 000-deep nested array → `400` (parsed without crashing).
- **Prototype pollution:** `{"name":"P","__proto__":{…},"constructor":{…}}` created a room but left
  `Object.prototype` clean (field reads, not spread-merge). Action `__proto__` card/assignment keys →
  rejected by length/engine checks.
- **Action shape:** `target` 9/-1/1.5 → "seat 0-5"; 999-char / `__proto__` card → "short string"
  (≤8); valid-length bogus `ZZ` → `INVALID_CARD` (engine); 60 assignments → "too many entries" (≤48);
  assign seat 9 → "seats 0-5"; unknown type / non-object action → `400`.
- **Names:** `<`/`>` → `400 "name must not contain < or >"` (rejected pre-storage); control chars
  stripped, whitespace collapsed, truncated to 20 code points; emoji/RTL/zalgo stored verbatim for
  React to escape.
- **XSS (headless Chromium via the harness):** submitting
  `"><img src=x onerror="window.__XSS=1;alert(9)">` as the create name → server `400`, `error-banner`
  shown, still on `/`, `window.__XSS===0`, no dialog, no injected `<img>` in DOM. A server-allowed
  special-char name `Amp&Quo"Apo'X` rendered in the lobby with `textContent` exactly equal to the name,
  `innerHTML` = `Amp&amp;Quo"Apo'X`, and **0 child elements** — React auto-escaping confirmed. Client
  grep: **no `dangerouslySetInnerHTML`/`innerHTML`/`__html`**; all names render as JSX text children
  (`LobbyView.tsx:72`, `TableFelt.tsx:92`, `Banners.tsx`).

### D7 — Deletion / privacy: sound path (Info)
Migration `0001` schedules pg_cron `delete-stale-rooms` (`*/15 * * * *`, `last_activity < now() - 6h`)
and `clean-rate-limits` (hourly, `window_start < now() - 2h`). A deleted room takes the same
`loadRoomByCode → null → 404` path I confirmed for nonexistent codes, so no post-deletion data is
reachable via the API. Broadcasts are ephemeral (Realtime message retention is off by default);
the only residuals are edge-function error logs (`console.error('broadcast failed', …)` — no hands) and
the ≤2 h IP retention in `rate_limits` (F5). Cannot verify the live cron schedule (RLS blocks
`cron.job`); trusting the migration as source of truth per SPEC.

---

## Notes for re-verification
- **Rate-limit state left behind:** this review consumed the hour's **create** budget for the shared
  egress IP (create now returns `429`); it resets at the next `floor(now/3_600_000)` boundary. Join and
  action buckets were exercised but not exhausted.
- **Test rooms created** (auto-delete in 6 h): `JAMWRA`, `4R3D6Z`, `7D7G4D`, `SM3G96`, plus the
  `InAbuse`/name-test rooms — all disposable.
- **Probe scripts:** `…/scratchpad/dbtest/attack-main.mjs`, `attack-rls.mjs`, `attack-input.mjs`,
  `attack-ratelimit.mjs`, `attack-ratelimit2.mjs`, `attack-bruteforce.mjs`, `attack-authz2.mjs`,
  `xss-check.mjs`, and `attack-broadcast-forge.mjs` (the F1 repro; not run — sandbox-blocked).
