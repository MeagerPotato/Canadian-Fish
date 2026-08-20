# POLISH_REVIEW.md — responsiveness, accessibility, states, copy (Phase 6)

**Date:** 2026-08-20
**Method:** `npm run build` → `node scripts/harness.mjs` (port 8788, live Supabase backend), driven
with Playwright/chromium at **375 / 390 / 768 / 1280 px**. Real games created via
`POST /api/create-room {fillBots:5}` and played through the actual UI. Contrast sampled from rendered
`getComputedStyle` values and re-checked against `src/styles/tokens.css`. 40 screenshots captured.

## Headline

**No Critical, no High.** No rule-wrong copy, nothing broken, **no horizontal scroll on any page at
any width**, **zero console errors or warnings anywhere** (including React StrictMode, a full
lobby→table game, all six drills, the 33-step `/learn` replay, and `/strategy`), all six drills
fully keyboard-operable through to their results screen, and every state (loading skeleton / empty /
error / disconnected / 404) present and intentional.

| # | Severity | Finding | Status |
|---|---|---|---|
| M1 | Medium | Lobby showed stale, **factually wrong** copy: "Practice rooms … coming in a later phase tonight" (bot rooms already ship) | **FIXED** — replaced with a link to `/practice/game` |
| M2 | Medium | Brand/wordmark link only **27 px** tall on every page | **FIXED** — `min-height: 44px` on `.brand` |
| M3 | Medium | In-drill controls **32 px** tall (deduction/counting Pause, replay scrub, "To the question", reveal Next/Finish) | **FIXED** — base `.btn` floor raised to 44 px; scrub to 44 px |
| M4 | Medium | Two real labels failed WCAG AA via `--slate-deep`: `/learn` keyboard hint **3.81:1**, `/practice` "not played" **3.58:1** | **FIXED** — both moved to `--slate-green` |
| L1–L8 | Low | Decorative `--brass-dim` glyphs (3.46–4.0:1), borderline `.countUnit` 4.43:1, 14 px Learn step dots, 13 px source links, sparse desktop right column, low-contrast skeleton, sheets don't *trap* Tab focus, "declare/set" dialect words in cited prose | **Deferred** — MANUAL_TODO #3 |

## Overflow — all clear

Every page (home, `/learn` incl. all 33 steps, `/learn/rules-card`, `/strategy`, `/practice` hub, the
lobby, the in-game table, ask/claim sheets, all six drills, a 404 room and a 404 route) × {375, 390,
768, 1280} showed `scrollWidth === innerWidth` with no overflowing element.

## Tap targets

Passing before the fixes (≥44 px): primary CTAs, ask sheet 10/10, claim sheet 28/28, lobby seat
buttons, hand cards (60×85), nav tabs, every drill answer key, difficulty/coach toggles.
Sub-44 px controls found — brand link (27), drill Pause (32), replay scrub (32), "To the question"
(32), reveal Next/Finish (32) — are fixed by M2/M3. Remaining sub-44 items are supplementary
controls with keyboard equivalents (Learn step dots, inline source links) and are deferred.

## Contrast (measured, false positives excluded)

| Element | Token | Size | Ratio | Verdict |
|---|---|---|---|---|
| `/learn` `.kbHint` | `--slate-deep` → `--slate-green` | 9 px | 3.81 → pass | FIXED (M4) |
| `/practice` `.bestNone` | `--slate-deep` → `--slate-green` | 8 px | 3.58 → pass | FIXED (M4) |
| `/strategy` `.exFocusArrow` | `--brass-dim` | 11 px | 3.46 | Deferred (decorative) |
| claim `.seatKeyHint` | `--brass-dim` | 8 px | ~4.0 | Deferred (decorative) |
| table `.countUnit` | `--slate-green` | 8 px | 4.43 | Borderline, deferred |
| seat plaque ink-on-brass | `--ink-on-plaque` | 8.5 px | 5.3–9.8 | PASS |
| card rank/suit | card ink/red on face | — | 6.3–17 | PASS |
| log / body / titles / badges | gold-soft / cream / brass | — | 6–12+ | PASS |

No AA failure on body text. The tokens `DESIGN_NOTES.md` flags as AA-failing (`--slate-faint`,
`--suppressed`, `--brass`-on-`--felt-light`) are confirmed unused for real text.

## States (all verified live)

- **Loading** — layout skeleton (strip / oval / row / hand), not a bare spinner.
- **Empty** — log reads "Nothing yet — the first ask starts the record."; hub shows "not played".
- **Error** — a forced 400 on `/action` surfaces the friendly "It is not your turn."; injected raw
  server text did **not** leak; no `JSON.stringify(err)` anywhere in the client.
- **404** — room: "No table here…"; route: "Off the felt".
- **Disconnected** — closing the realtime socket shows "Live updates dropped — reconnecting…".
- Rate-limited `create-room` renders the friendly `RATE_LIMITED` message, not a stack.

## Keyboard, layout stability, copy

All six drills reach their results screen by keyboard alone and **Esc** exits each cleanly. Ask and
claim sheets move focus in (`role="dialog"`, `aria-modal`), close on **Esc**, and return focus to the
opener; the focus ring is `2px --brass-bright`. Layout is stable: the log growing 30 → 305 px after a
move shifted the felt, books, actions and log tops by **0 px**. Copy was proofread against
`RULES.md` — the printable rules card, home summary, ask sheet (opponents only, held-books only) and
claim sheet (own-team seats only, "a single miss forfeits the book") are all rule-accurate; M1 was
the only copy defect and is fixed.
