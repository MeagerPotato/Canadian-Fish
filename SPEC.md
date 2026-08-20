# Canadian Fish — SPEC

Six-player **Literature** ("Canadian Fish") as a mobile-first web app: live multiplayer rooms with
anonymous seats, fully server-authoritative rules, deterministic inference bots, a keyboard-driven
practice/drill suite, and club materials for a Berkeley student organization. Built autonomously
overnight, 2026-08-20. Rules are pinned in [RULES.md](RULES.md) — the engine implements that file.

## 1. Fixed decisions (from the build brief — not re-litigated)

| Area | Decision |
|---|---|
| Repo | `MeagerPotato/Canadian-Fish`, public, branch `main` |
| Stack | Vite + React + TypeScript + CSS Modules. No Next.js, no Tailwind |
| Authority | All game logic in Vercel serverless functions under `/api/`. Client is a thin renderer and never decides anything |
| Persistence + sync | Supabase project `Fish` (`fnandjtzwhihgefkfwzj`, org `Projects`, us-east-1). Schema via migrations. Realtime **Broadcast** for live sync |
| Deploy | Vercel production, team `Big Potatos` (`friedtofuzs-projects`), project `canadian-fish` |
| Identity | Anonymous `playerToken` (random, localStorage). Refresh/rejoin restores seat + hand. No accounts |
| Retention | Rooms hard-deleted 6 h after last activity. Nothing survives the session |
| Bots | Deterministic TypeScript knowledge-state inference engines, server-side. No LLM, no API keys |
| Visual style | Tokens extracted from `MeagerPotato/holdem-odds-engine` (its `design_handoff_holdem_odds_engine/` + per-component CSS modules) into `src/styles/tokens.css`; every page built from tokens |
| Player count | Engine parameterized; **6 players is the only shipped/supported value** |

## 2. Architecture

```
 browser (thin renderer)                         Vercel serverless (/api)              Supabase
┌──────────────────────────┐   POST /api/*      ┌───────────────────────┐   SQL (CAS) ┌──────────────┐
│ React + CSS Modules      │ ─────────────────▶ │ validate playerToken   │ ──────────▶ │ rooms table  │
│ own hand + public state  │                    │ engine.reduce(action)  │             │ (full state, │
│                          │ ◀───────────────── │ persist w/ version CAS │             │  RLS: deny   │
│ GET /api/state (own hand)│    JSON            │ broadcast PUBLIC events│             │  anon fully) │
│                          │                    └──────────┬────────────┘             └──────────────┘
│ supabase-js realtime     │  broadcast: public state only │  REST broadcast
│ subscribe room:{code}    │ ◀─────────────────────────────┘  (Realtime channel room:{code})
└──────────────────────────┘
```

Pinned because it is the easy thing to get wrong:

- Full room state **including all six hands** lives in one Postgres row (`rooms.state` jsonb). RLS is
  enabled with **zero policies for `anon`/`authenticated`** — direct client access is denied entirely.
- Clients never read that table and are **never** subscribed to `postgres_changes` (that would leak
  hands). The only realtime traffic is **Broadcast** events containing *public state*: turn, phase,
  per-seat card counts, resolved books (with revealed locations at claim time), the public ask/result
  log, and lobby metadata. **Never card identities from hands.**
- Every mutation goes through `POST /api/action` with `{code, playerToken, action}`. The server loads
  the room with privileged credentials, validates via the pure engine, writes back with an optimistic
  `version` CAS (`UPDATE … WHERE id=$1 AND version=$2`, retry on conflict), then broadcasts.
- Each client fetches **only its own hand** from `GET /api/state?code&token`, keyed by `playerToken`.
- Server DB credential: preferred = Supabase secret/service key in Vercel env; fallback (no dashboard
  access available to the build) = dedicated Postgres role `game_server` (login via Supavisor pooler,
  allow-all RLS policies granted only to that role). Secret lives only in Vercel env vars and
  `.env.local`; `.env*` is gitignored (repo is public). Which path was used is recorded in PROGRESS.md.
- Broadcast send path: server → Supabase Realtime REST broadcast (public channel `room:{code}`, topic
  guarded by room-code entropy; re-examined in Phase 6).
- Room expiry: `pg_cron` job hard-deletes rooms with `last_activity < now() - interval '6 hours'`.

## 3. Repository layout

```
lib/engine/        pure rules engine + bots + views (no IO, no framework imports; shared everywhere)
api/               Vercel serverless functions (thin: auth → engine → persist → broadcast)
api/_lib/          server-only helpers (db, broadcast, tokens, rate limits)
src/               Vite React client (components/, pages/, viewmodels/, styles/tokens.css)
tests/             vitest unit + property/fuzz; Playwright e2e in tests/e2e/
supabase/migrations/  SQL migrations (applied via Supabase MCP)
scripts/           local dev server harness (serves dist + mounts api handlers), simulations
```

Architectural habits copied from `holdem-odds-engine`: pure engine module with hand-written types,
reducer with explicit mutation semantics, viewmodel builders separate from components, per-component
CSS modules over shared tokens.

## 4. Engine (`lib/engine/`)

Pure, side-effect-free reducer usable by server, bots, and tests with no network:

- `newGame(seed, config)` → `GameState` (seeded deterministic shuffle/deal).
- `reduce(state, action)` → `{ok:true, state, events} | {ok:false, error:{code,message}}`. Never
  throws, never mutates input.
- Actions: `ask{seat,target,card}`, `claim{seat,book,assignments: Card→Seat(own team)}`,
  `pass{seat,to}` (after claiming out), `designate{seat,to}` (empty team names the opponent who must
  claim out the endgame).
- Phases: `playing → awaitPass | awaitDesignate | endgame → finished` per RULES.md §4.
- Views: `publicView(state)` (no hand card identities anywhere), `seatView(state, seat)` (public +
  own hand). Bots receive **only** a seat view.
- `checkInvariants(state)`: 48 cards conserved (hands + 6×resolved books, voids included), no
  duplicates, turn validity, phase/turn consistency, counts match. Run after every fuzz step.
- Config toggles per RULES.md §5, all off by default.
- Cards: `"<Rank><Suit>"`, ranks `2 3 4 5 6 7 9 T J Q K A`, suits `C D H S`. Books `LOW-♣ … HIGH-♠`
  encoded `LOW-C` … `HIGH-S`.

## 5. Bots (`lib/engine/bots/`)

Deterministic (seeded by room seed + move index), pure functions `decide(seatView, difficulty) →
Action`. Knowledge state derived **only** from public information — enforced by the type system (the
decision function takes the same `SeatView` a human client gets) and by a test asserting no other
hand is reachable.

Inference core: per (card, seat) status lattice `NO / MAYBE / YES` plus "holds ≥ 1 of set S"
constraints from every ask (asker holds ≥1 of the book, lacks the asked card; hit/miss fix single
cards; claims reveal books; public card counts bound everything). Constraint propagation to fixpoint.

- **Easy** — remembers only the last ~6 events, no set constraints, error rate ε≈0.25, asks
  semi-randomly among legal asks, claims only own-hand-complete books.
- **Medium** — full deduction, claims when certain (or forced), no signalling.
- **Hard** — Medium + risk-weighted claim timing (expected value vs. leak risk), teammate
  signalling conventions and stalemate-breaker behavior taken from the Phase-5 strategy research,
  and endgame counting.

Difficulty = depth of inference + memory decay / error rate. Gate: 1,000-game round-robins with a
printed win-rate table (Phase 3).

## 6. Multiplayer flows

- **Create room** → 6-char code (alphabet `A-HJ-NP-Z2-9`, 31 symbols ≈ 8.9×10⁸ codes) + share link
  `/r/{code}`.
- **Lobby**: 6 seats, auto-alternating team assignment, manual swap before start, start locked until
  6 seats filled (practice rooms may fill remaining seats with bots).
- **Reconnect**: token → exact seat/hand/turn restore, target < 3 s after reload.
- **Disconnect**: client heartbeat (`/api/heartbeat`, ~20 s). Seat marked away after missed
  heartbeats; game pauses; after 90 s the table may vote to substitute a bot (majority of connected
  humans). A returning human reclaims their seat from the bot.
- **Rate limits**: per-IP room creation and per-token action caps enforced server-side.

## 7. Client pages

`/` create/join · `/r/{code}` lobby + table · `/practice` drill suite · `/learn` guided interactive
onboarding vs bots + printable one-page rules card · `/strategy` attributed conventions & worked
examples.

Mobile-first (375 px baseline; six people on phones around a table is the primary use case): tap
targets ≥ 44 px, hand fanned and legible one-handed, unmistakable "your turn" state, persistent
public log of asks/results and per-seat card counts. Loading / empty / error / disconnected states
designed, not raw strings.

## 8. Practice drills (`/practice`, localStorage only)

Fast, keyboard-driven, ≤ 60 s, each with score, personal best, accuracy/speed readout:
1. Book recall 2. Ask-legality 3. Deduction ("who holds the 9♥?") 4. Claim trainer
5. Card counting 6. Full game vs bots — runs as a server-side solo room (1 human + 5 bots) so the
authoritative-server rule holds even in practice — with optional coach overlay flagging the
strongest available ask (Hard-bot evaluation of the public view).

## 9. Phases and gates (from the brief)

P1 engine + RULES (unit + 10k-game fuzz + tsc + lint, output printed) → P2 rooms (6-context
Playwright: full game via UI, 2 mid-game reloads restored, no cross-hand payloads) → P3 bots
(1,000-game win-rate tables printed) → P4 practice (drills playable + scoring tests) → P5 club
research + CLUB_PLAN.md / EVENTS.md / `/learn` / `/strategy` → P6 adversarial red team
(SECURITY_REVIEW.md, STRESS_TEST.md; no unresolved Critical/High) → production deploy verified 200.
PROGRESS.md appended after every phase; MANUAL_TODO.md collects anything requiring a human.

## 10. Security model

- Public by design: anon key, room codes (entropy-guarded), public-state broadcasts.
- Secret: DB credential/service key — Vercel env only, never in bundle/repo/history.
- RLS denies anon on every table; clients have no table access path at all.
- `playerToken`: 128-bit random, room-scoped, dies with the room (6 h hard delete).
- Display names: length-capped, sanitized, React-escaped; no other user strings exist.
- Phase 6 red team attacks all of the above and documents results.

## 11. Decisions & assumptions log

1. **Public log vs. "no written records"**: the traditional rule says only the last question/answer
   is discussable and players may not keep records. The brief's UI section explicitly requires a
   persistent public log of asks/results (§3 mobile layout; drills replay sequences). Resolution:
   the app shows the full public log by default (the app is the table, not a player's notes), and a
   `strictMemory` toggle (off) restricts the UI to last-ask-only for purist play. RULES.md row 18.
2. **Endgame designation** (whole team out on their own turn): pinned per pagat — designated
   opponent claims *all* remaining books alone, no consultation. RULES.md §4.
3. **Practice full-game** uses a real server-side solo room rather than a client-side engine, so the
   thin-client rule is never violated. Drills 1–5 are pure client exercises (no hidden info exists).
4. **Server DB credential**: no dashboard/CLI session is available to the overnight build, so the
   build uses whichever privileged path is attainable non-interactively (see §2); swap to the
   official service key later is a 5-minute env-var change, listed in MANUAL_TODO.md if applicable.
5. **Broadcast channel is public-topic** with room-code entropy as the guard; contains public state
   only, so a leak of the topic name leaks nothing hidden. Rate limiting + Phase 6 review cover
   brute-force.
6. gh identity on this machine is `MeagerPotato` (verified via API) — matches the required repo owner.

## 12. Non-goals

8-player mode, accounts/emails, chat, spectators, persistence beyond the room lifetime, LLM
anything, native apps.
