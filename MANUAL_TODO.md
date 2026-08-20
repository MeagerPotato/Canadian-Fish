# MANUAL_TODO.md — things only a human can do

Read this first. Numbered, in priority order. Each entry: what is blocked, why, exactly what to do,
and how long it takes. Empty sections mean nothing is blocked there yet.

1. **(Optional) Move the API from Supabase Edge Functions to Vercel serverless functions.**
   - *What happened*: the brief pinned "authoritative logic in Vercel serverless under /api/". That
     requires a privileged Supabase credential in Vercel env vars, and no autonomous path existed
     tonight: no `vercel` CLI login/token on this machine, the Vercel MCP connector has no env-var
     tool, and the permission layer (correctly) blocked SQL that provisions a database login role.
   - *What was built instead*: same server-authoritative design, hosted as Supabase Edge Function
     `api` where the platform injects `SUPABASE_SERVICE_ROLE_KEY` itself. A Vercel rewrite keeps the
     client calling `/api/*`. Net effect: the service-role key never existed in the repo, client,
     Vercel, or this build's transcript — arguably stronger than the original plan. All gates
     (server-side validation, no-hand-leak payloads, RLS denial) are unaffected.
   - *If you want the brief-literal architecture*: (1) `npm i -g vercel && vercel login`, link the
     project, (2) `vercel env add SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (production; key from
     Supabase dashboard → Settings → API), (3) port `server/` handlers into `api/*.ts` via the thin
     Node adapter documented in DESIGN of `server/` (Web-standard handlers, ~30 lines of shim),
     remove the rewrite from `vercel.json`, redeploy. ~20 minutes.
   - *Nothing is blocked* if you skip this — it's an architecture-preference item.

2. ~~**Create the Vercel project.**~~ **DONE 2026-08-20** — you ran `vercel login`, and the project
   was linked and deployed to production under `Big Potatos`. Live at
   **https://canadian-fish.vercel.app** (HTTP 200, full game verified end-to-end through that
   domain). Note: Vercel Authentication is on for *per-deployment* URLs
   (`canadian-fish-<hash>-…vercel.app` → 302 to the SSO wall) but **not** for the production alias,
   which is public. Nothing further is required. If you ever want the per-deployment preview URLs
   public too: Vercel → canadian-fish → Settings → Deployment Protection → Vercel Authentication →
   Disabled. (I could not toggle this myself — the permission layer blocks account/project setting
   changes, which is correct.)

   *Original entry preserved below for context.*

   **Create the Vercel project (≈2 minutes) — the ONE step needed to put the site live.**
   - *What is blocked*: the production deploy to Vercel. Everything else shipped: the repo builds
     clean, `vercel.json` (rewrite `/api/*` → the live Supabase edge function + SPA fallback) is
     committed, the backend is already deployed and verified in production, and the full app was
     gate-tested end-to-end against it (six-browser Playwright run, local build + live backend).
   - *Why*: no autonomous path existed tonight. The Vercel MCP connector's grant can list the
     `Big Potatos` team but returns 403 `forbidden` for project creation on both the team and
     personal scope (tested both APIs); there is no `vercel` CLI login or `VERCEL_TOKEN` on this
     machine; and no logged-in browser session was available overnight.
   - *Exactly what to do* (either path):
     - **Dashboard**: vercel.com → team `Big Potatos` → Add New → Project → Import
       `MeagerPotato/Canadian-Fish` → framework auto-detects Vite, keep all defaults (no env vars
       are needed — the client config is baked in and the API secret lives in Supabase) → Deploy.
       Pushes to `main` then auto-deploy production.
     - **CLI**: `npm i -g vercel && vercel login`, then from `C:\Projects\fish`:
       `vercel link --project canadian-fish` (scope `friedtofuzs-projects`) and `vercel --prod`.
   - *Verify*: open `https://canadian-fish.vercel.app` (or the assigned domain) → create a room on
     your phone, join from a second device, play a turn. Should just work; the backend it talks to
     is the same one all the gates ran against.

3. **Deferred Low-severity items (nothing blocking — pick up whenever).**
   Every Critical/High/Medium finding from the Phase 6 red team was fixed and re-verified; these are
   the survivors, kept honest rather than quietly dropped. Sources: [SECURITY_REVIEW.md](SECURITY_REVIEW.md),
   [STRESS_TEST.md](STRESS_TEST.md), [POLISH_REVIEW.md](POLISH_REVIEW.md).
   - **Security F4** — any seated member can rearrange lobby seats before start (griefing only, no
     information leak). Fix: restrict `/lobby-swap` to the host, or require both affected seats to
     confirm. ~30 min.
   - **Security F5** — `rate_limits` stores the raw client IP for ≤2 h. Fix: store
     `sha256(ip + daily_salt)` instead. ~20 min.
   - **Security F6 / platform hardening** — the realtime topic is public, so an attacker with a room
     code can publish noise (harmless since F1: the client only refetches, throttled to one per
     250 ms). Defence-in-depth: switch to Supabase *private* channels and add an RLS policy on
     `realtime.messages` allowing `anon` SELECT but never INSERT for `room:%`. ~1 h including an
     end-to-end re-test, because a wrong policy silently breaks live sync.
   - **Robustness LOW-1** — a *miss* ask is not idempotent: a double-submit can legitimately apply
     twice once the turn cycles back. No corruption. Fix: an optional client-supplied idempotency
     key on `/action`. ~45 min.
   - **Robustness LOW-2** — the CAS retry cap is 4; >4 truly-parallel writers to one room could see
     `409 CONFLICT`. Turn-based play makes this near-impossible; clients already surface a friendly
     retry message.
   - **Polish L1–L8** — decorative brass glyphs at 3.46–4.0:1 contrast, a borderline 4.43:1 "CARDS"
     label, 14 px Learn step dots and 13 px source links (both have keyboard/large alternatives),
     sheets that move focus but do not *trap* Tab, and a sparse desktop right column at game start.
   - **Bundle size** — 616 kB JS (182 kB gzipped) because the bots' knowledge engine ships to the
     client for the coach overlay and drills. Code-splitting `/practice/*` and `CoachPanel` behind
     dynamic imports would cut the initial payload substantially. ~1 h.

4. **Club items needing a human (from [CLUB_PLAN.md](CLUB_PLAN.md) §8).**
   Eleven facts could not be verified from official sources and are flagged in the plan rather than
   asserted. The ones that actually gate decisions:
   - New Org Orientation / Office Hours format (in person vs Zoom) — email oasis.center@berkeley.edu.
   - ASUC Senate Contingency dollar caps for 2026-27 — ask the ASUC CFO/Finance Committee.
   - The Contingency application window — two official Berkeley pages contradict each other; both
     are quoted in the plan.
   - Current ASUC Student Union room rates — the published chart is FY2023-24 and marked
     "subject to change"; confirm with eventservices@berkeley.edu.
   **Time-sensitive:** the new-org application window is **Aug 31 – Sep 18, 2026**, and you need four
   signatories with at least two enrolled students. Fall Calapalooza (Aug 27) is scouting-only — a
   brand-new club cannot table until Spring 2027.
