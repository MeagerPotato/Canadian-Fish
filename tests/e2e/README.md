# GATE 2 — six-client e2e game test

Covers: six browser contexts create/join one live room, play a complete game to 8 resolved books through the shipped UI (asks, claims, pass/designate, endgame), mid-game reload recovery < 3 s, payload privacy (no /api response or realtime frame ever carries another seat's hand), and an identical game-over on all six clients.
Run: `npm run build` then `npm run e2e` (Playwright starts `scripts/harness.mjs` on port 8788, which serves `dist/` and proxies `/api/*` to the LIVE Supabase edge function).
Each full run creates ONE real room (create-room is limited to 20/hour/IP); retries are pinned to 0 — do not loop the suite.
The run takes several minutes (the driver console-logs every move); traces are kept on failure only.
