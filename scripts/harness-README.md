Build the client first: `npm run build` (harness serves `./dist` with SPA fallback).
Run: `node scripts/harness.mjs` (or `npm run harness`); `/api/*` is proxied to the deployed Supabase edge function.
Port: 8788 by default — override with the `PORT` env var, e.g. `PORT=5000 node scripts/harness.mjs`.
