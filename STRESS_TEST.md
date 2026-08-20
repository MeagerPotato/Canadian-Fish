# Canadian Fish — Robustness / Load Red-Team Report

> **Post-review status (orchestrator, 2026-08-20).** No Critical or High defects were found here.
> LOW-1 (a *miss* ask is not idempotent under duplicate submit) and LOW-2 (CAS retry cap of 4) are
> deferred to MANUAL_TODO #3 with rationale. Two changes landed after this report was written and do
> not invalidate its numbers: the rate limiter became an atomic Postgres counter (SECURITY_REVIEW F2
> — it now *rejects* concurrent excess rather than undercounting), and the client treats realtime
> broadcasts as untrusted hints that trigger an authoritative `/state` fetch (SECURITY_REVIEW F1),
> which adds one throttled fetch per state change per client. The six-client e2e was re-run against
> the live backend after both changes: full game to 8/8 books, reload recovery 266 ms / 269 ms.

**Date:** 2026-08-20
**Target:** live Supabase Edge Function `…/functions/v1/api` + pure room layer (`server/room.ts`) driven in-process via the `tests/server/memdeps.ts` harness (Node 24 native type-stripping, same path as `npm run sim`).
**Posture:** break it under concurrency / load / edge conditions and report measured numbers. No code was changed; the rate limiter was neither disabled nor edited.

---

## Numbers at a glance

```
LOGIC LAYER (in-process, no network / no Supabase limits)
  concurrency               100 / 200 / 500 concurrent all-bot games
  games driven to finished  100/100, 200/200, 500/500      (0 not-finished)
  invariant violations      0   (checkInvariants on every final engine state)
  request/engine errors     0
  engine transitions driven >90,000 through room.ts, 0 invariant violations
  sustained throughput      ~15,400 engine moves/s, ~137 games/s (1 JS thread)
  per-move latency (clean)   0.177 ms/move (all-bot, full medium inference)
  /action handler latency    p50 0.46 ms · p95 2.04 ms · max 2.2 ms (no contention)
  bot-chain 60-step cap      holds exactly (worst-case 60-step chain = 14 ms)
  CAS double-apply           impossible (exactly-one-winner proven in every race)
  input fuzz                 4,700 malformed/illegal reqs -> 0x HTTP 500

LIVE API (within Supabase limits, deployed edge function)
  full games finished        3/3    (real bot games, seat-0 human via decide())
  /action latency            p50 724 ms · p95 971 ms · max 1191 ms
  /state  latency            p50 305 ms · p95 450 ms · max 1141 ms
  5xx responses              0
  broadcast monotonicity     3/3 streams strictly ascending, 0 dups, 0 gaps (1..112)
  CAS integrity              verified: version delta == moves applied (no lost update)
  create rate limit          20/h/IP ENFORCED (429 after shared-IP budget exhausted)
```

## Summary table

| # | Scenario | Mode | Result | Key measured numbers |
|---|----------|------|--------|----------------------|
| 1 | Concurrency at scale | in-proc 100/200/500 | **PASS** | 500/500 finished, 0 inv-fail, 15.4k moves/s; per-move 0.177 ms; /action p50 0.46/p95 2.04 ms |
| 1 | Concurrency (live) | live 3 rooms | **PASS** | 3/3 finished, 0 5xx; /action p50 724/p95 971 ms |
| 2 | Version-CAS / simultaneous | in-proc 15 asserts | **PASS** | retry succeeds on 4th attempt; 4 conflicts→409; every race exactly-one-winner |
| 2 | Version-CAS (live) | live | **PASS** | "both 200" = legit sequential miss-asks; version Δ == moveIndex Δ, no lost update |
| 3 | Double-submit idempotency | in-proc 12 asserts | **PASS** | claim→BOOK_RESOLVED, hit-ask→ASKING_OWN_CARD; parallel claim exactly-one |
| 3 | Idempotency finding | live+in-proc | **PASS** (Low note) | miss-ask can re-apply as a 2nd legal move under duplicate submit (no corruption) |
| 4 | Reconnect / refresh storm | in-proc 12 asserts | **PASS** | 6 concurrent /state identical + no hand leak; 5-min silent client resyncs cleanly |
| 5 | Pause + bot substitution | in-proc 22 asserts | **PASS** | vote→substitute→unpause→reclaim; whole-team-stale no deadlock; full-sub reaches finished |
| 6 | Bot-chain amplification/cap | in-proc 8 asserts | **PASS** | cap = exactly 60/req; worst-case chain 14 ms; heartbeat resumes to finished |
| 7 | Broadcast monotonicity | in-proc 5 + live | **PASS** | 30 games + concurrent HB: strictly ascending, 0 dups/decreases; live 0 gaps |
| 8 | Intra-room write contention* | in-proc 15 asserts | **PASS** | 50 concurrent same-room HB: 0 lost updates; rate limit exact 30/10s |
| 9 | Input fuzz for crashes* | in-proc 4 asserts | **PASS** | 4,700 malformed/illegal reqs → 0 HTTP 500; oversized→400 |

*Scenarios 8–9 are additional red-team probes beyond the requested 7.

In-process assertion totals: **93 PASS / 0 FAIL** across S2–S9, plus S1 (800/800 games clean).

---

## Severity-ranked findings

No **Critical** and no **High** defects were found. The concurrency-control (version-CAS), pause/substitution, bot-chain cap, broadcast-monotonicity, and crash-safety properties all hold under load, both in-process at scale and on the live API within its limits.

### LOW-1 — A *miss* ask is not idempotent under duplicate submission
A rapid double-submit (double-click, or a client auto-retry after a slow response) of the **same ask that misses** can be applied **twice**, as two distinct legal moves, when the turn cycles back to the actor between them.
- **Why it happens:** version-CAS correctly serializes the two requests. When the racing action is a *hit* or a *claim*, re-validation of the loser rejects it (`ASKING_OWN_CARD` / `BOOK_RESOLVED`) because the action consumed its own precondition. A *miss* ask's precondition ("I hold a card of this book, not the asked card; target is an opponent with cards") **survives its own application**, so if opponents also miss/pass the turn straight back, the reloaded second request is a fully legal fresh move and applies.
- **Evidence (live, room INS):** two parallel identical `ask seat1 9D` → both 200; log shows the two asks at indices 1 and 3, **separated by a bot move** (not adjacent); `version Δ = moveIndex Δ = 8` (every move accounted for — *no* lost update, *no* same-base double-write); card-conservation intact (`sum counts + 6·resolved = 48`). Reproduced in 4/5 fresh live rooms; the 5th correctly serialized to one 200 + one 400.
- **Impact:** no state corruption, no crash, invariants always hold. The only effect is the actor semantically "spends" a second identical miss-ask it may not have intended. Requires a client double-submit/retry to trigger.
- **Repro:** `scratchpad/dbtest/live-inspect.mjs`, `live-doubleapply.mjs`.
- **Recommendation:** client-side submit debounce / disable the action control while a request is in flight (PROTOCOL §5's in-flight tracking likely already does this). For defense-in-depth, an optional per-action client idempotency key/nonce would let the server dedupe retries. This is an enhancement, not a correctness fix.

### LOW-2 / informational — CAS retry cap is 4; a truly-simultaneous same-room write storm can surface 409
`mutateRoom` retries a CAS conflict at most 3 times (4 attempts) then returns `409 CONFLICT`. Under **genuinely parallel** writers on one room exceeding ~4 simultaneous (e.g., a synchronized heartbeat/action burst), some legitimate writes would exhaust their retries and return 409, requiring a client retry.
- Not reproducible in the in-process model (single-threaded microtask serialization drains the retry queue — measured **0 conflicts even at 50 concurrent same-room heartbeats, with 0 lost updates**), and could not be driven on the live server because room creation was rate-limited during testing.
- **Real-world risk is low:** play is turn-based (only one legal action-writer at a time), and client heartbeats are jittered across a 20 s cadence rather than synchronized.
- **Recommendation:** ensure clients treat 409 as retryable (heartbeats naturally retry on the next beat; the `/action` path should surface a transparent retry). Consider raising `MAX_CAS_ATTEMPTS` slightly if real telemetry ever shows 409s on `/action`.

### Informational — benign broadcast version gaps
When a `/heartbeat` resumes a capped bot chain with **no** connectivity change, it suppresses its own no-op snapshot (offset 1) but still increments the stored version, so broadcast version numbers can skip by 1–2. Broadcasts remain **strictly ascending with no duplicates**, so the client's "apply iff `version > current`" rule is unaffected. Observed max gap = 2 in-process; live full games showed contiguous streams.

### Informational — shared-IP create rate limit exhausts quickly
`create-room` is limited to **20/h/IP** and the bucket is shared across every client on that IP — including concurrent red-team agents/CI. During this run the budget was exhausted after ~10–20 combined creates, returning `429 RATE_LIMITED` and blocking further live room creation for the remainder of the clock hour. This is the limiter working as designed, but it is an operational constraint for any at-scale live testing (and the reason the scale scenarios must run in-process).

---

## Detail by scenario

### 1 — Concurrency at scale

**In-process (primary).** One shared `MemDeps` store; N rooms flipped to all-bot (seat 0 keeps its host token so `startRoom`/`heartbeat` can drive it), created with distinct IPs to avoid the create limit, then driven to `finished` through `startRoom` + `heartbeat` bot-chain resumption. All N drivers run under one `Promise.all` (they interleave at every `await`, exercising the shared store concurrently).

| N rooms | finished | inv-fail | errors | total moves | wall | throughput |
|--------:|---------:|---------:|-------:|------------:|-----:|-----------|
| 100 | 100/100 | 0 | 0 | 11,599 | 819 ms | 122 games/s · 14,154 moves/s |
| 200 | 200/200 | 0 | 0 | 22,594 | 1,462 ms | 137 games/s · 15,449 moves/s |
| 500 | 500/500 | 0 | 0 | 56,372 | 3,645 ms | 137 games/s · 15,465 moves/s |

- moves/game (500 run): min 51 · p50 113 · p95 137 · max 218.
- **Clean per-move latency** (single sequential all-bot game, no contention): **0.177 ms/move** (each move includes a full medium-tier knowledge inference).
- **True `/action` handler latency** (seat-0 human driven via `decide()`, bots 1–5 auto-chaining, no contention): **p50 0.46 ms · p95 2.04 ms · max 2.2 ms**.
- The "per-request wall" reported inside the 100/200/500 runs (p50 0.33 s → 1.5 s as N grows) is *thread-contention amortization* — N games sharing one JS thread, each request running a 60-step inference chain — not representative of real per-request latency (which is the 0.46 ms figure above). Throughput plateaus at ~15.4k moves/s because a single JS thread saturates; correctness stays perfect.
- Scripts: `s1-scale.mjs`, `s1b-peraction.mjs`.

**Live (within limits).** 3 real rooms (`create fillBots:5` → seat-0 human + 5 bots), subscribed to `room:{CODE}` realtime, started, and played to `finished` with seat 0 driven by the real `decide()` policy over a `SeatView` reconstructed from `/state`.
- 3/3 games finished; **0 5xx**, 0 unexpected non-2xx.
- `/action` latency (n=52): **p50 724 ms · p95 971 ms · max 1191 ms** (edge fn + Postgres CAS + realtime broadcast round-trip).
- `/state` latency (n=55): p50 305 · p95 450 · max 1141 ms.
- Script: `live-s1-game.mjs`.

### 2 — Version-CAS / simultaneous actions

**In-process (15/15 PASS).** Deterministic races via `Promise.all` on one room, plus forced conflicts via `MemDeps.failNextSaves`:
- 3 forced conflicts → succeeds on the **4th** attempt; book resolved exactly once.
- 4 forced conflicts → **409 CONFLICT**, **no partial apply** (book stays unresolved).
- Two identical claims at once → exactly one 200, loser `400 BOOK_RESOLVED`; book resolved once; **version +1, moveIndex +1** exactly (no lost update / no double-bump); invariants clean.
- Two identical hit-asks at once → exactly one 200, loser `400 ASKING_OWN_CARD`; asked card in hand exactly once.

**Live.** Firing two identical `/action` in parallel returned "both 200" in 4/5 rooms — **investigated and shown to be correct**, not a double-apply: the two asks are separated by a bot move in the log, and `version delta == moveIndex delta == number of moves applied` (a genuine same-base double-write would leave the version short). Card conservation held in every case. See LOW-1 for the one nuance (miss-ask re-application). Scripts: `s2-cas.mjs`, `live-s2s3.mjs`, `live-doubleapply.mjs`, `live-inspect.mjs`.

### 3 — Double-submit / rapid-click idempotency

**In-process (12/12 PASS).**
- Identical claim sent twice (sequential) → 2nd `BOOK_RESOLVED`; book/claim in log exactly once.
- **Exact requested sequence** — an action arriving *after* a claim already resolved that book: seat 0 resolves LOW-C and passes to seat 2, seat 2's claim of LOW-C → `BOOK_RESOLVED`.
- Identical hit-ask twice → 2nd `ASKING_OWN_CARD`; card held once.
- Parallel identical claims → exactly one 200.
**Live:** replayed identical `/action` after resolution → clean `400` (never a second apply). Script: `s3-idempotency.mjs`.

### 4 — Reconnect / refresh storm

**In-process (12/12 PASS).**
- All 6 clients call `/state` simultaneously → all 200, **byte-identical public snapshots**, agreeing on version; each client sees its own 8-card hand and seat; **no response leaks another seat's hand**. 200 repeated 6-way storms: per-call p50 0.012 ms / p95 0.028 ms.
- Silent client for 5 minutes (injected-clock advance +300 s, others refreshed): game **paused** while gone, silent seat shows disconnected, any action refused `PAUSED`; on return `/state` serves the **intact seat + unchanged hand**, and a single `/heartbeat` **unpauses and resumes** the game; invariants clean.
- Live fresh-room verification was blocked by the create limit; the concurrent-read consistency and resync guarantees are fully covered in-process, and S8 confirms up to 50 concurrent same-room heartbeats preserve every update. Script: `s4-reconnect.mjs`.

### 5 — Pause / disconnect + bot substitution

**In-process (22/22 PASS).**
- **Single stale seat:** advance clock 91 s (seat 1 stale, others refreshed) → paused, seat 1 vote-eligible; votes accumulate (`yes=1 needed=3`), majority reached → seat 1 **substituted** (`isBot=true`, `botDifficulty='medium'`, **keeps tokenHash**); pendingVote cleared, game unpaused; the original human **reclaims** seat 1 by token (`rejoined:true`, back to human).
- **Whole team stale:** seats 1/3/5 all stale → paused, **no crash/deadlock**; all three substituted via majority of the connected team; unpaused; the mixed 3-human + 3-substituted-bot game is driven to **`finished`** with clean invariants.
- **Fully-substituted game:** seats 1–5 substituted by lone-voter majority → seat-0-human + 5-bot game reaches **`finished`**, invariants clean.
- Live vote substitution needs 2 humans + a real 95 s stale window; it was scripted (`live-s4s5.mjs`) but blocked by the create limit at run time. The substitution state machine is fully exercised in-process. Script: `s5-pause-vote.mjs`.

### 6 — Bot-chain amplification & caps

**In-process (8/8 PASS).** All-bot room; `startRoom` triggers the longest single-request chain.
- Chain applied in the start request: **exactly 60 steps** (`BOT_CHAIN_CAP`), never more.
- Stored version advanced by exactly `1 (base) + 60`.
- **State legal after the capped chain** (mid-game `checkInvariants` = []).
- Worst-case 60-step chain wall: **14 ms**; a follow-up `/heartbeat` resumed the capped chain to **`finished`** (per-resume ~6 ms); invariants clean at every capped chunk.
- No single request broadcast more than `1 + cap` snapshots. Script: `s6-botchain.mjs`.

### 7 — Broadcast / version monotonicity under load

**In-process (5/5 PASS).** 30 bot-heavy games (start + heartbeat chains) → **all 30 strictly ascending**, 0 duplicate versions, 0 decreases. 4-way concurrent heartbeats on one room → still strictly ascending, no dups, game finishes legally. Version gaps ≤2 appear (benign; see Informational note).
**Live:** 3/3 broadcast streams strictly ascending with **0 dups and 0 gaps** (contiguous `1..112`). Scripts: `s7-monotonic.mjs`, `live-s1-game.mjs`.

### 8 — Intra-room write contention (additional)

**In-process (15/15 PASS).**
- Concurrent heartbeat storm on one room (K = 6/10/20/50): **every non-conflict call succeeds, 0 lost updates** (final version = start + K exactly), 0 other errors, invariants intact. (Caveat: MemDeps serializes microtasks, so this under-represents true-parallel Postgres CAS — see LOW-2.)
- Concurrent action storm on one turn (K = 4/8/16): **exactly one** action applies (`LOW-C` claimed at most once — no double-apply), the rest cleanly rejected (`WRONG_PHASE` / `BOOK_RESOLVED`), invariants intact, no 500.
- Action rate limit: firing 40 same-token actions in one 10 s window → **exactly 10 rejected 429, first 429 at call #31** (limit = 30/10 s/token, enforced *before* engine validation). Script: `s8-contention.mjs`.

### 9 — Input fuzz for crashes (additional)

**In-process (4/4 PASS).** Through the full `route()` HTTP dispatch:
- 4,000 random schema-valid-but-illegal `/action` bodies (bad targets, non-cards, malformed claims, off-range seats) → **0 × HTTP 500**; all rejected 400 by parse/engine.
- 700 malformed raw bodies (truncated JSON, wrong types, over-long codes/tokens, NUL bytes) across all 7 endpoints → **0 × 500**.
- Oversized (>32 KB) body → **400 BAD_REQUEST** (not a crash).
The engine never throws on schema-valid illegal input; the handler's top-level try/catch was never triggered. Script: `s9-fuzz.mjs`.

---

## Methodology & harness

- **In-process:** probe scripts in `…/scratchpad/dbtest/` import the project's TypeScript directly (Node 24.19 native type-stripping, the same mechanism `npm run sim` relies on). `MemDeps` (`tests/server/memdeps.ts`) provides real version-CAS semantics, an injectable clock, captured broadcasts, and a rate-limit map. The only harness modification is a `MemDeps` subclass overriding `randomToken()` with real crypto entropy — the stock token stream's LCG collides on 6-char room codes after ~39 rooms (a test-double artifact); **all server logic, including the CAS, rate limiter, and `codeFromHex`, is unchanged and exercised.**
- **Live:** raw `fetch` against the deployed edge function with the public anon key. Human seats are driven with the real `decide()` policy over a `SeatView` reconstructed from `/state` (`= PublicState + own hand`). Realtime broadcasts captured with `@supabase/supabase-js`.
- **Coverage totals:** >90,000 engine transitions driven through `room.ts` across 800+ in-process games plus 3 live games, with **0 invariant violations** and **0 HTTP 500s** anywhere.

### Caveats / not covered
- True-parallel same-room CAS contention (LOW-2) could not be reproduced: in-process is single-threaded, and live room creation was rate-limited. The code path (`MAX_CAS_ATTEMPTS = 4` → 409) is confirmed by reading, not by driving 409s live.
- Live Scenarios 4 (concurrent-read storm on a fresh room) and 5 (end-to-end vote substitution) were scripted but blocked by the 20/h/IP create limit at run time (~28 min from the next reset); both are covered comprehensively in-process.
- Latency figures are point-in-time samples from a single client region; they are not a sustained live load test (which the create/action limits preclude).
