# PROGRESS.md — Canadian Fish overnight build

Append-only log. One entry per phase: what was built, what was verified, proof, what's left.

---

## Phase 0 — Bootstrap (2026-08-20)

**Built**
- `git init` in `C:\Projects\fish` (branch `main`), identity `MeagerPotato <allenhsieh2007@gmail.com>`.
- SPEC.md (architecture, pinned decisions, phase plan), RULES.md (pinned rule set with decision
  table; the two pagat-deferred clauses — post-claim turn continuation and whole-team-out
  designation — verified against pagat.com and Wikipedia, accessed 2026-08-20).
- .gitignore (`.env*` excluded — repo is public), PROGRESS.md, MANUAL_TODO.md.
- Design reference `MeagerPotato/holdem-odds-engine` cloned to scratchpad for token extraction.

**Environment verified**
- Node v24.19.0, npm 11.17.0, git 2.55.0, gh 2.97.0 authenticated (API identity = `MeagerPotato`,
  matches required repo owner).
- `vercel` and `supabase` CLIs not installed; no `VERCEL_TOKEN`/`SUPABASE_ACCESS_TOKEN` in env.
  Vercel MCP + Supabase MCP connectors are available and will be used instead (deploy, migrations).

**Left**: Phases 1–6 per SPEC §9.

---

## Phase 1 — Rules engine + tests (2026-08-20) — GATE 1 PASSED

**Built**
- Vite + React + TS scaffold (React 19, Vite 8, TS 6, ESLint 10 flat config, Vitest 4).
- `lib/engine/`: pure dependency-free reducer implementing RULES.md exactly — `newGame` (xmur3→mulberry32
  seeded deal), `reduce` (ask/claim/pass/designate, all 16 error codes), `publicView`/`seatView`,
  `checkInvariants`, `legalAsks`, toggles plumbed (askOwnCardAllowed + highBooksDouble fully live).
- `tests/engine/`: 70 tests in 8 files — every §2 error code, §7 vectors 1–6, hit/miss/elimination,
  claim-out pass, endgame designation, deferred endgame after pass, tie, determinism/replay/deep-freeze
  immutability, view-leak regex, and the 10k-game fuzz.

**Verified (output printed in transcript)**
- `npm run typecheck` → exit 0; `npm run lint` (--max-warnings 0) → exit 0.
- `npm test` → 70/70 passing. Fuzz: 10,000 seeded games, 1,170,401 reduces (117 avg/game),
  `checkInvariants` after every reduce, every game finished with exactly 8 books resolved
  (score+voids=8, hands empty), 9.5 s.
- Supabase infra (done during Phase 1 build): anon SELECT/INSERT on `rooms` → 42501 denied;
  realtime REST broadcast 202 + WS delivery received; edge function `api` /health reads DB via
  platform-injected service role → 200 (401 without JWT); cron jobs `delete-stale-rooms` (6 h,
  */15) + `clean-rate-limits` live.

**Left**: Phase 2 rooms (PROTOCOL.md contract → server + client agents → Playwright gate).

---

## Phase 2 — Multiplayer rooms (2026-08-20) — GATE 2 PASSED

**Built**
- PROTOCOL.md — full client⇄server contract (endpoints, broadcast, timings, rate limits, testids).
- `server/` — portable Web-standard handlers behind a `Deps` interface: create/join/state/swap/
  start/action/heartbeat/vote-bot/health, version-CAS persistence with retry, pause + 90 s
  bot-substitution vote, per-IP/token rate limits, 32 KB body cap, input validation, CORS;
  bot chain (placeholder bot, Phase 3 replaces internals). 32 in-memory server tests incl. a
  payload-privacy walker.
- Supabase Edge Function `api` v2 — the esbuild-bundled server deployed live (secrets stay
  platform-side). `scripts/pack-edge.mjs` + `scripts/harness.mjs` (static + /api proxy).
- Client — Home/Lobby/Table on the extracted token system: rotated seat ring, fanned hand, ask/
  claim/pass/designate sheets, persistent log with claim reveals, paused/vote/disconnect states,
  reconnect via localStorage token, realtime broadcast sync with version gating, heartbeat. 30
  viewmodel tests. Placeholder /practice /learn /strategy pages. vercel.json rewrite for /api.

**Verified (output printed in transcript)**
- 134 unit tests green (72 engine + 32 server + 30 client), typecheck 0, lint 0.
- Live smoke vs deployed backend: 42/42 assertions (create→join×5→start→states→hit→miss,
  401/403/400 guards, broadcast versions 1..8 ascending, no hand keys anywhere public).
- GATE 2 Playwright, six browser contexts vs live backend, twice by the build agent + once
  first-party: complete UI-driven game to 8/8 books (45 and 57 iterations), mid-game force-reload
  of one context per team restored hand+turn in 252–462 ms (< 3000 ms), and per-context network
  scanning: `hand` only ever in the owner's own /state; 58–63 broadcast payloads structurally
  hand-free; every other seat's exact hand serialization absent from each context's traffic.

**Left**: Phase 3 bots → Phase 4 practice → Phase 5 club research/pages → Phase 6 red team → prod deploy.

---

## Phase 3 — Inference bots (2026-08-20) — GATE 3 PASSED

**Built**
- `lib/engine/bots/`: knowledge engine over deal-time-holder variables (facts + ≥1-of-set ask
  constraints translated through the public position map; propagation: count exhaustion/forcing,
  single-candidate elimination, constraint forcing) — `buildKnowledge`, `holderOf`, `candidates`,
  `rankAsks` (scored + human-readable reasons, for the Phase-4 coach), hit probabilities.
- `decide(view, difficulty, seed)` — easy (6-event window, no constraints, ε=0.25), medium (full
  deduction, certain claims only), hard (medium + EV claims at p≥0.8, info-leak tiebreak,
  stalemate-breaker signalling, endgame counting). Stateless, deterministic, SeatView-only, never
  throws, validated + fallback. `server/bots.ts` now delegates to it.
- `scripts/simulate.mjs` (Node 24 native TS strip) + 19 new tests (public-view proof via Proxy
  path-recording + JSON-clone equality + import allowlist; determinism; 500-position legality;
  300-game knowledge-vs-ground-truth sweep; tier behavior).

**Verified (output printed in transcript)**
- 153 tests green, typecheck 0, lint 0.
- GATE 3 table (first-party `npm run sim`, 1000 games/pairing, deterministic, 29.9 s): hard-vs-easy
  **999/0/1**, hard-vs-medium **446/306/248 (59.3% of decided)**, medium-vs-easy **1000/0/0**,
  mirrors 47.7/50.6/46.6% — 6000 games, 1.23 M moves, 0 illegal fallbacks, 0 step-cap hits.
- Edge function **v3** deployed (real bots live); solo-room smoke: hard-bot chain played and
  returned the turn to the human, 0 void bot claims.

**Left**: Phase 4 practice drills → Phase 5 → Phase 6 → prod deploy (MANUAL_TODO #2).

---

## Phase 4 — Practice drills (2026-08-20) — GATE 4 PASSED

**Built**
- `/practice` hub + six keyboard-driven drills (≤60 s rounds, seeded deterministic, score + PB in
  localStorage + accuracy/speed/streak readouts): recall, ask-legality (every RULES §2 violation
  class each round, rule revealed per answer), deduction (bot-game replay with scrub + certainty-
  only questions + templated "why" from the Knowledge object), claim trainer (engine-verified
  fully-locatable positions), card counting, and full-game vs bots (real server solo room via
  fillBots, difficulty choice).
- Coach overlay (`?coach=1`): top-3 `rankAsks` with reasons + refined hit %, certain-claim hint —
  computed client-side from public view + own hand only; docked below the log; additive only.

**Verified (output printed in transcript)**
- First-party: typecheck 0, lint 0, 187/187 tests (34 drill tests listed verbatim: deterministic
  generators, legality labels ≡ engine codes, 50-seed deduction ground truth, claim puzzles
  engine-verified, conservation, PB semantics), build green.
- Build agent additionally re-ran the live six-client e2e once after its table edits: 1 passed
  (1.6 m), privacy scans clean, reload recovery 265/379 ms.

**Left**: Phase 5 deliverables (research done in parallel, all sourced) → Phase 6 red team →
prod deploy (MANUAL_TODO #2). Phase 6 polish notes: 568 kB chunk (code-split /practice + coach),
pre-hand-fetch "No cards" transient, deduction difficulty mix, recall negative-floor taste call.

---

## Phase 5 — Club deliverables + content pages (2026-08-20) — COMPLETE

**Research (4 parallel sourced reports in scratchpad/research/)**: Berkeley RSO registration/funding/
space/recruitment/constraints (2026-27 windows); Literature strategy & conventions (pagat vs US-
student traditions, Salahuddin convention, stalemate breaker); prior-art digital landscape (market
unserved; bots+drills near-unique; license red-lines); campus clubs + fair tournament formats
(duplicate/Swiss/BAM, Berkeley×Stanford poker chassis; verified NEGATIVE finding: no organized
Literature tournament documented anywhere — a fabricated AI-summary claim caught and rejected).
Every claim carries a source URL + access date 2026-08-20.

**Built**
- CLUB_PLAN.md (352 lines): mission, dated 2026-27 founding timeline, cadence, officer roles mapped
  to the 4-signatory rule, real-numbers budget, recruitment, retention, risks — 61 source URLs, 11
  UNVERIFIED items flagged for LEAD/ASUC.
- EVENTS.md (468 lines): 11 event concepts with run-of-show, 3 runnable fair tournament formats
  (Swiss/mirrored-deck Swiss teams/BAM w/ leak countermeasures), Berkeley×Stanford proposal with
  logistics + ready-to-send outreach email — 56 source URLs.
- `/learn`: 33-slide interactive walkthrough over a deterministic engine-replayed game (hit/miss/
  legality/correct+opponent+void claims/claim-out pass/endgame/winner) + printable one-page rules
  card (`/learn/rules-card`, @media print).
- `/strategy`: fully attributed (14 sources, inline chips, single-source flags, low-provenance
  source excluded), 6 sections + variants + 3 worked examples + bots box.

**Verified**: 191/191 tests (4 new /learn script tests: engine replay ok, annotations synced,
teaching order), typecheck 0, lint 0, build green; visual check of /learn, /strategy, /learn/
rules-card in-browser (content matches RULES.md).

**Left**: Phase 6 adversarial red team + polish → prod deploy (MANUAL_TODO #2).
