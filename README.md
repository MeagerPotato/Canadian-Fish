# Canadian Fish

Six-player [Literature](https://www.pagat.com/quartet/literature.html) ("Canadian Fish") — live
multiplayer rooms, deterministic inference bots, and a practice drill suite. Mobile-first, no
accounts, nothing persists past the room.

- **Rules**: [RULES.md](RULES.md) (pinned decision table)
- **Design/architecture**: [SPEC.md](SPEC.md)
- **Build log**: [PROGRESS.md](PROGRESS.md)

## Stack

Vite + React + TypeScript + CSS Modules · Vercel serverless (`/api`, authoritative game logic) ·
Supabase (state + Realtime Broadcast) · Playwright + Vitest.

## Develop

```
npm install
npm run dev        # client
npm test           # engine unit + fuzz tests
npm run typecheck
npm run lint
```
