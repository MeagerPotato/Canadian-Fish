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
