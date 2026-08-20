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
