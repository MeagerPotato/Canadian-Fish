# DESIGN NOTES — Canadian Fish

A practical guide for building this app's UI so it looks and behaves like the user's
**Hold'em Odds Engine**. All tokens referenced below live in `src/styles/tokens.css`
(extracted 1:1 from the source — read that file first; it is the contract).

**Source repo** (read-only reference), referred to below as `SRC/`:
`C:\Users\allen\AppData\Local\Temp\claude\C--Projects-fish\20c90e13-406e-4a50-8a26-6df1c2ec496a\scratchpad\holdem-odds-engine\`
Its design handoff (component-by-component spec + screenshots):
`SRC/Hold'em Odds Engine/design_handoff_holdem_odds_engine/README.md`

## The look in one paragraph

**Dark-only casino luxe.** Near-black green grounds (`--page-bg`, `--panel-bg`) with a
radial felt glow, brass/gold as the single accent family, warm cream text, off-white
5:7 playing cards with deep soft shadows, and a fine `feTurbulence` grain overlay on
every large surface (`--grain-07` / `--grain-05`). Three strictly-separated type
voices: **Bodoni Moda** for anything display (titles, big numerals, card ranks),
**IBM Plex Mono** for every label/eyebrow/stat caption/log line (always uppercase +
wide tracking — smaller text gets wider tracking), **Instrument Sans** for body and
row text. Almost every border is `1px solid` brass at some alpha step; dashed brass =
"empty, awaiting a card"; 2px solid `--brass-bright` = focus/attention. Depth comes
from translucent black washes and gradients, never from elevation ramps.

---

## 1. Component patterns (with source refs)

### Buttons — `SRC/src/components/left/ControlsRow.module.css`

All buttons: `height: 32px; border-radius: var(--radius-control); font-family:
var(--font-mono); font-size: var(--font-size-control); letter-spacing:
var(--tracking-button); text-transform: uppercase;`. Three variants (base class +
`composes` in the source):

```css
.secondary { padding: 0 12px; border: var(--border-control);
  background: var(--wash-btn); color: var(--btn-text); }
.secondary:hover { border-color: var(--brass); color: var(--btn-text-hover);
  background: var(--brass-a12); }

.primary { padding: 0 13px; border: 1px solid var(--brass-a45);
  background: var(--gradient-btn-primary); color: var(--brass-pale); font-weight: 600; }
.primary:hover { background: var(--gradient-btn-primary-hover); }

.destructive { border: 1px solid var(--danger-a40);
  background: var(--wash-danger-btn); color: var(--danger-btn-text); }
.destructive:hover { border-color: var(--danger-hover); color: var(--danger-btn-text-hover); }
```

Hover = border brightens + wash strengthens; there is **no** transform on buttons
(only tray cards lift). The player **stepper** is a bordered group
(`border-radius: 8px; overflow: hidden; background: var(--wash-btn)`) with 29×32px
`−`/`+` buttons in 17px brass and a center block (serif count over a 7.5px mono
caption). Global reset (`SRC/src/styles/global.css`): buttons have no default border,
background, or padding, inherit font/color, and get `touch-action: manipulation`.

### Panels / section cards — `SRC/src/components/shared/SectionCard.module.css`

The primary content container:

```css
.card { border: var(--border-card); border-radius: var(--radius-panel);
  background: var(--gradient-section); padding: 17px 19px; margin-bottom: 15px; }
.title { font-family: var(--font-serif); font-size: 19px; font-weight: 700; line-height: 1; }
.sub   { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.1em;
  color: var(--slate-green); margin-top: 4px; }
```

Head row is flex `space-between` with an optional right-aligned node (badge, big
stat, hint) — see `SectionCard.tsx` for the `headAlign: 'center' | 'end' | 'plain'`
API. A slimmer bar variant for one-line headline content (`MadeHandStrip.module.css`):
`padding: 11px 15px; border-radius: var(--radius-tile); border: 1px solid
var(--brass-a20); background: var(--gradient-strip)` — eyebrow + serif 20px name +
right-aligned cards. Empty state (`EmptyState.module.css`): dashed brass border,
`border-radius: 14px; padding: 54px 30px; text-align: center`, italic serif 27px
brass headline, 14px sage body capped at `max-width: 410px`.

### Stat tiles — `SRC/src/components/right/EquityCard.module.css`, `WhosAheadCard.module.css`

The signature readout. Grid of tiles `repeat(auto-fit, minmax(118px, 1fr)); gap: 11px`
(170px min for 2-up), each `border-radius: var(--radius-tile); padding: 13px 14px`:

```css
.tileWin  { background: linear-gradient(180deg, rgba(232,198,106,.16), rgba(232,198,106,.03));
            border: 1px solid var(--brass-a30); }   /* label #cbb173, value --brass-pale */
.tileTie  { background: var(--wash-white-03); border: 1px solid var(--hairline-white-09); }
.tileLose { background: var(--danger-a10); border: 1px solid var(--danger-a30); }
```

Label: mono 8.5px uppercase `--tracking-wider`. Value: **serif 40px/700
`font-variant-numeric: tabular-nums`** with the unit (`%`) at 19px `opacity: .65`.
This good/neutral/bad tile triple is the template for any Fish stat (books won,
claims, cards left).

### Tables / data grids — `SRC/src/components/right/DistributionCard.module.css`

Not `<table>` — CSS grid rows with a **proportional bar painted behind the content**:

```css
.row { display: grid; grid-template-columns: minmax(52px,1fr) minmax(0,58px) minmax(0,54px) minmax(0,62px) 14px;
  gap: 7px; align-items: center; padding: 8px 11px; position: relative; }
.rowWrap { border-radius: var(--radius-row); overflow: hidden; background: var(--wash-black-16); }
.row:hover { background: var(--brass-a07); }
.rowBar { position: absolute; left: 0; top: 0; bottom: 0;
  background: var(--gradient-bar-fill); transition: width .5s var(--ease-slide);
  pointer-events: none; }   /* width set inline as a % of the max value */
```

Column headers are a matching grid above: mono **7.5px** uppercase `--slate-deep`,
numeric columns right-aligned, `border-bottom: 1px solid var(--brass-a12)`. Cells
that hold numbers are mono 12.5px `tabular-nums`; name cells are sans 13.5px
`--cream-warm` with a 5×5px category dot (`--dot-0..9`). Rows are `<button>`s
(cursor:pointer, focus-visible outline **inset**: `outline-offset: -2px`).
The per-seat share table in `EquityCard.module.css` is the same pattern with
`grid-template-columns: 36px 62px 1fr 56px` — hero row uses `--team-a-bar`/brass
text, others `--team-b-bar`/sage text. **Use this exact pattern for the Fish
public log and the books/score table.**

### Inputs — `SRC/src/components/right/PotOddsCard.module.css`

```css
.input { width: 100%; height: 38px; padding: 0 11px; border-radius: var(--radius-control);
  border: var(--border-control); background: var(--wash-black-34);
  color: var(--brass-pale); font-family: var(--font-mono); font-size: 15px; outline: none; }
.input:focus-visible { border-color: var(--brass); }
.fieldLabel { font-family: var(--font-mono); font-size: 8.5px;
  letter-spacing: var(--tracking-field); text-transform: uppercase;
  color: var(--slate-green); margin-bottom: 5px; }
```

Recessed dark field, brass text, label as a mono eyebrow above. Focus brightens the
border (no ring on inputs; rings are for non-field controls).

### Badges & pills

- **Status badge** (`EquityCard .badge`): mono 8.5px uppercase, `padding: 4px 9px;
  border-radius: var(--radius-pill); border: 1px solid var(--brass-a35);
  color: var(--brass); background: var(--brass-a08)`. Used for `EXACT · 45,540 DEALS`
  — reuse for `BOOK CLAIMED`, `YOUR TURN` etc.
- **Seat plaque** (`PokerTable .plaque`): dark ink on brass — mono 8.5px/600,
  `color: var(--seat-plaque-ink); background: var(--seat-plaque-gradient);
  padding: 2px 7px; border-radius: var(--radius-pill)`. The one place text sits ON
  brass. Fish seat labels (P1–P6 + team letter) should be exactly this.
- **Pot/score pill** (`PokerTable .potPill`): `background: var(--score-pill-bg);
  border: 1px solid var(--score-pill-border); border-radius: var(--radius-pill);
  padding: 4px 12px` — mono eyebrow label + serif 15px brass value.
- **Chips** (`WhosAheadCard .chip`): `padding: 5px 10px; border-radius: var(--radius-pill);
  background: var(--wash-black-28); border: 1px solid var(--brass-a14)` — sans 12px
  name + mono 11px brass count. Good for half-suit chips in a claim UI.

### Header / nav — `SRC/src/components/left/Header.module.css`

Serif 25px/700 title with an *italic brass* accent word
(`.titleAccent { color: var(--brass); font-style: italic; }`), a mono 9.5px blurb
under it in `--slate-green`, and on the right a **sliding-thumb segmented switch**:
158px 2-col grid, `border: 1px solid var(--brass-a30); border-radius: 9px;
background: var(--wash-felt-65); padding: 3px`; the thumb is absolutely positioned,
`background: var(--gradient-thumb); transition: left .3s var(--ease-slide)`; labels
mono 9.5px/600 — active `--ink-on-brass`, inactive `--sage-muted`. Reuse for any
2-state toggle (e.g. Table/Practice).

### Stat readouts & hairline grids — `SRC/src/components/right/OutsCard.module.css`

Big-number + unit: serif 34px/700 `--brass-pale` with a mono 12px uppercase unit
beside it. The **hairline grid** (faked with gaps): wrapper `display: grid; gap: 1px;
background: var(--brass-a14); border: 1px solid var(--brass-a14); border-radius:
var(--radius-control); overflow: hidden;` cells `background: var(--card-inset);
padding: 11px 13px` with a mono 8px key over a serif 22px value. Use for the
end-of-game summary grid.

### Sticky status strip — `SRC/src/components/right/StatusStrip.module.css`

`position: sticky; top: 0; z-index: var(--z-sticky); background: var(--log-bg);
border-bottom: 1px solid var(--log-border)`. Inside: a 12px spinner
(2px `--gold-spinner-track` ring, `border-top-color: var(--brass)`, `spin .7s linear
infinite`) or a 7px `--idle-dot` with `--glow-idle`; mono 9.5px uppercase
`--log-text` message; right-aligned mono 9px `--slate-deep` note; and a 2px progress
track (`--brass-a10`) with `--gradient-progress` fill. **This is the template for
the Fish persistent log header** ("P4 asked P1 for 9♥ — no").

### Playing cards — `SRC/src/components/shared/PlayingCard.module.css`, `CardSlot.module.css`, `DeckTray.module.css`

- Face: `--gradient-card-face`, radius by size (3/4/6/8px), shadow by size
  (`--shadow-card-*`). Rank in **serif 700**, suit as Unicode text (♠♥♦♣ — never
  icons, so they inherit the suit color): black suits `--card-ink`, red `--card-red`.
- Size ladder (all ≈5:7 — token'd as `--card-w-*`): hero 60×85, board 47×66,
  strip 26×36, seat 25×35, example 22×31, out 20×28, mini 18×25; tray cards are
  fluid `aspect-ratio: 5/7`.
- Large cards (hero/board) use corner glyphs: rank top-left, small suit under it,
  big suit bottom-right at `opacity: .9`. Small cards center rank over suit.
- Card back: `--gradient-card-back` with `border: 1px solid var(--card-back-border)`,
  paired backs rotated ∓7deg.
- Empty slot: dashed brass border + `--wash-slot-*` + centered mono 8–8.5px
  placeholder in translucent brass. Locked slot: `--hairline-white-06` border on
  `--wash-locked`, no text.
- Hover (tray): `transform: translateY(-5px) scale(1.06)` + `--shadow-card-hover`,
  `transition: transform .13s var(--ease-slide)`. Dimmed/used cards get a
  `--wash-felt-80` scrim overlay, not reduced opacity.
- Attention ring (drag-over / **your-turn**): sibling overlay `inset: -4px;
  border: var(--turn-ring); border-radius: <slot radius + 3px>;
  box-shadow: var(--turn-glow); pointer-events: none`.

### Disclosure ("show the math") — `SRC/src/components/shared/MathPanel.module.css`

Toggle is a mono 9.5px uppercase brass text button (`▸/▾` chevrons, hover
`--link-hover`); the revealed panel sits under a `--brass-a18` top rule and animates
`riseIn .3s ease both`. Reuse for expandable log entries / claim details.

---

## 2. Layout habits

- **Two-column desktop shell** (`SRC/src/App.module.css`):
  `display: grid; grid-template-columns: clamp(500px, 41%, 690px) 1fr; height: 100vh;
  overflow: hidden` — interactive surface left, results right, each column
  `overflow-y: auto` independently. At `≤1023px` it becomes a stacked single-scroll
  document (grid → block) and the status strip stays viewport-sticky.
- **Column anatomy**: left column is `flex-direction: column; gap: 12px;
  padding: 15px 18px 18px` on `--gradient-column` + a grain overlay div; right column
  is `--panel-bg` + `--grain-05`, content wrapper `padding: 20px 26px 70px;
  max-width: 940px` (long bottom runway so the last card clears the fold).
- **Section ordering via CSS `order`** (`RightColumn.module.css` + `SectionCard`'s
  `order` prop): sections render once and reorder per mode. Handy for reordering
  Fish panels between lobby/game/claim phases without remounting.
- **Micro-grids everywhere**: components lay out with inline `display: grid` and
  hard-tuned `grid-template-columns` (e.g. `36px 62px 1fr 56px`) rather than
  utility classes; `auto-fit, minmax()` for responsive tile rows.
- **The transform-scale trick** (`SRC/src/hooks/useTableScale.ts`): the oval table
  has a fixed 560×322 design size; below that width the whole thing is
  `transform: scale(s)` from `transform-origin: top center` (wrapper keeps
  `height: 322 * s`). Proportion-perfect on phones with zero per-element media
  queries. **Do the same for the Fish 6-seat table.**
- **Seat positioning** (`SRC/src/components/left/PokerTable.tsx` / handoff §Poker
  table): seats are placed on the felt ellipse in percentages —
  `left = 50 + 45.5·cos(a)%`, `top = 38 + 33·sin(a)%`, hero pinned at the bottom
  (`a = π/2`), others distributed over the remaining arc,
  `transform: translate(-50%,-50%)`.

## 3. CSS Modules conventions

- **One `.module.css` per component, same basename**, colocated
  (`PokerTable.tsx` + `PokerTable.module.css`), imported as `styles` and used as
  `styles.camelCase`. Class names are short camelCase roles (`.tileWin`, `.rowBar`,
  `.stepBtn`), never BEM.
- Components grouped by region: `components/left/` (interactive), `components/right/`
  (readouts), `components/shared/` (SectionCard, PlayingCard, MathPanel).
- **Variants** via `composes: btn` inside the module (ControlsRow) or by joining two
  classes in TSX (`${styles.head} ${styles.headEnd}`).
- Tokens + resets live in `src/styles/tokens.css` + `global.css` (imported once from
  `global.css` via `@import './tokens.css'`); modules consume only `var(--*)` and
  raw px. Dynamic values (bar widths, tween numbers, per-team colors computed in
  viewmodels) arrive as inline `style` props — never as generated class names.
- `global.css` owns: box-sizing reset, body font/color, button/input reset,
  scrollbar styling, `@keyframes spin/riseIn`, `.visually-hidden`, and the
  `prefers-reduced-motion` kill-switch.

## 4. Architectural habits (mirror these)

- **Pure engine module with hand-written types** — `SRC/src/lib/holdem-engine.js` +
  `holdem-engine.d.ts`: game logic is plain framework-free code (cards are integers,
  state in typed arrays) with a `.d.ts` written by hand, documented I/O boundary in
  the header comment, and fixture tests (`SRC/test/engine.fixtures.test.js`)
  asserting exact hand-derived counts. For Fish: the rules engine is a pure
  `reduce(state, action)` module with its own types, tested against RULES.md-derived
  fixtures, shared verbatim by server and bots.
- **Reducer purity & mutation semantics** — `SRC/src/state/reducer.ts`: a single
  `useReducer` with a typed action union; every case copies (`copy(s)` helpers) then
  mutates the copy; **all randomness happens in event handlers, never in the
  reducer** (StrictMode double-invoke safe); invariants are enforced inside cases
  ("move semantics": placing a card first `clearCard`s it from every other position;
  `compactBoard` keeps no gaps; mode-switch clears dependent state; counts clamped).
  Fish's client-side UI state (selection, open panels, optimistic pending action)
  should follow this shape.
- **Viewmodel builders separate from components** — `SRC/src/viewmodel/*.ts`
  (`equity.ts`, `distribution.ts`, `beat.ts`, `potOdds.ts`, `status.ts`,
  `footnote.ts`): pure functions `EngineResult → VM` that precompute every display
  string, percentage, bar width, and *color* (as token values); components just map
  VM → JSX. Expensive VM strings are built **only for panels that are open**. For
  Fish: `viewmodel/` turns public game state into log lines, seat VMs, claim VMs.
- **Async work controller in a hook** — `SRC/src/hooks/useSimulation.ts` +
  `SRC/src/worker/engine.worker.js`: worker ownership, 90ms debounce, monotonic
  token so superseded runs are dropped, tween driven by an interval, and a
  `signature` memo that covers *only inputs the engine reads* (pot/bet edits never
  recompute). For Fish this maps to the realtime/polling hook: debounce, drop
  stale responses by version, tween count changes.
- **Config read once from URL params** — `SRC/src/config.ts`: a typed `AppConfig`
  parsed from `location.search` with clamped fallbacks, exported as a constant.
- **Thin App** — `SRC/src/App.tsx`: `useReducer` + memoized scenario + one hook +
  two region components. Keep the Fish `App.tsx` this small.

---

## 5. The Fish screens on a phone (375px)

Everything below is the stacked-layout (`≤1023px`) rendering; desktop gets it for
free. All values are tokens from `src/styles/tokens.css`.

### 6-seat table

- Screen ground: `--table-page-gradient` + `--grain-07` overlay; the oval itself is
  `--table-rail-gradient` rail (9px pad, `--shadow-rail`) around
  `--table-felt-gradient` felt (`--shadow-felt`, dashed `--table-ring` inner ring).
- Build the table at a **fixed design size** (the source's 560×322 fits a 375px
  viewport at scale ≈0.63; design at ~360×300 to keep glyphs bigger) and
  transform-scale it à la `useTableScale`. Percentage seat positions from §2.
- **You sit at the bottom center** (the hero position); the other five seats spread
  over the top arc. Each opponent seat = two card backs (∓7deg, 22×31,
  `--gradient-card-back`) or just a mono card-count, plus a plaque
  (`--seat-plaque-gradient` / `--seat-plaque-ink`) reading seat + team
  (`P3 · A`). Team identity: tint the seat's fill/border with
  `--team-a-fill`/`--team-a-border` or `--team-b-*` — and always show the team
  letter; never color alone.
- Center of the felt: the score pill (`--score-pill-*`) showing books A–B, in the
  pot-pill pattern.

### Your hand, fanned, one-handed

- Up to 8 cards won't fit flat at 375px: **fan them** — absolutely positioned
  `--card-w-lg` (60×85) cards overlapping ~55–60%, each rotated
  `(i - (n-1)/2) * 6deg` about `transform-origin: bottom center`, pinned to the
  bottom edge like the source's `heroArea` (`left: 50%; bottom: 0;
  translateX(-50%)`, `z-index: var(--z-hero)`). 60×85 with serif corner glyphs
  (rank 23px) stays legible at that overlap because the top-left corner is exactly
  what the fan exposes.
- Selection = the tray-hover treatment: lift `translateY(-5px)` (or −12px in a fan)
  + `--shadow-card-hover`, `transition: transform var(--duration-hover)
  var(--ease-slide)`. Keep every card a `<button>` ≥44px tall tap target (85px
  height already is; enforce ≥28px exposed width per card — cap the fan at ~8 cards
  before switching to two rows).
- Sort/group controls above the fan as `.secondary` buttons (32px tall, thumb-reach).

### Persistent public log

- A viewport-sticky strip in the **status-strip pattern**: `position: sticky;
  top: 0; z-index: var(--z-sticky); background: var(--log-bg); border-bottom:
  1px solid var(--log-border)` showing the latest event as mono 9.5px uppercase
  `--log-text`, with the idle dot / spinner slot on the left ("whose turn" lives
  here too).
- The full log is a scrollable section-card of grid rows in the distribution-table
  pattern: `--log-row-bg` rows, radius `--radius-row`, ask events as
  `P4 → P1 · 9♥ · NO` with mini cards (`--card-w-xs`) inline; successful asks get a
  `--gradient-bar-fill` bar behind the row, refusals stay plain, claims get the
  danger or success tile treatment. Newest at top; cap visible height ~40vh so the
  table stays on screen.

### "Your turn" affordance

Layered, like the source treats drag-over + status:

1. Your seat/hand gets the **attention ring**: overlay with `border:
   var(--turn-ring); box-shadow: var(--turn-glow-strong); inset: -5px;
   border-radius: var(--radius-ring)`.
2. The sticky strip flips to `YOUR TURN — ASK OR CLAIM` in `--brass-pale` with the
   pulsing `--idle-dot`+`--glow-idle` swapped to `--turn-highlight`.
3. Primary action buttons switch from `.secondary` to `.primary` styling.
4. Announce it: update an `aria-live="polite"` region (source pattern:
   `.visually-hidden` announcer in `global.css`) and respect
   `prefers-reduced-motion` — no pulse animation, ring stays static.

### Claims

A claim is the dramatic moment — use the **verdict-bar pattern**
(`PotOddsCard .verdict`): serif 23px/700 word (`CLAIMED` / `LOST`) in a
`--radius-verdict` bar — success: `--brass-a13` fill + `--brass-a40` border +
`--brass-pale` text; failure: `--danger-claim-fill` + `--danger-claim-border` +
`--danger-claim-text`. Half-suit picker rows reuse the share-table grid with mini
cards; the in-progress claim banner uses `--danger-claim` accents since a wrong
assignment forfeits the book.

---

## 6. Accessibility

Observed in the source and to be carried over:

- **Focus**: every interactive element gets `:focus-visible { outline: 2px solid
  var(--focus-ring); outline-offset: 2px; }` (inset `-2px` on full-bleed rows).
  Inputs instead brighten `border-color` to `--brass`. Never remove outlines
  without replacement.
- **Touch**: `button, [role='button'], input { touch-action: manipulation; }`;
  buttons are 32px tall (fine with padding), cards are real `<button>`s.
- **Motion**: global `prefers-reduced-motion` block collapses all
  animations/transitions to 0.01ms (`SRC/src/styles/global.css`); the deal
  animation and tweens also check it in JS (`usePrefersReducedMotion.ts`).
- **Announcements**: results are mirrored to a `.visually-hidden`
  `aria-live="polite"` region. Do the same for turn changes and log events.
- **Color is never the only signal** in the source's tables (numbers/labels always
  present). Keep that: team = color **+ letter**, claim result = color **+ word**.

### Contrast — pairs that FAIL WCAG AA (small text) on `--panel-bg`/`--page-bg`

Computed against `#07130e`; do **not** use these for essential text:

| Token | Ratio | Verdict |
|---|---|---|
| `--suppressed` #3f574a | ≈2.4:1 | Decorative only (deliberately "off" values) |
| `--slate-faint` #4f6b5d | ≈3.2:1 | Footnote-grade only; bump to `--slate-green` if the info matters |
| `--slate-deep` #5f7a6c | ≈4.0:1 | Fails 4.5:1; OK for large text only — prefer `--slate-green` |
| `--brass-dim` #8a7130 | ≈4.0:1 | Chevrons/indices only, never labels |
| `--brass` on `--felt-light` | ≈4.4:1 | Don't put brass text on the bright felt center — put it on a dark pill first (the source always does) |

Safe pairs (all ≥4.5:1 on `--panel-bg`): `--slate-green` ≈6.2, `--danger` ≈6.9,
`--sage-muted` ≈8.5, `--gold-soft` ≈9.1, `--success` ≈10.5, `--brass` ≈11.5, and
everything brighter (`--brass-pale`, `--cream*`, `--mist*`, `--parchment*`).
`--card-red` on `--card-face-light` ≈6.3:1 — fine. `--ink-on-plaque` on brass
≈10:1 — fine.

One phone-specific caution: the source's mono ladder goes down to 7.5px on desktop.
At 375px keep 7.5–8px strictly for non-essential column heads/eyebrows; anything a
player must read to act (log lines, turn text, buttons) stays ≥9.5px
(`--font-size-control`) and anything numeric they act on ≥12.5px
(`--font-size-mono-lg`).
