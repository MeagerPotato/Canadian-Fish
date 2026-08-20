# DESIGN_AUDIT.md — Canadian Fish as a total beginner, on a phone

**Date:** 2026-08-20 · **Device:** 375 × 812 (iPhone-class), live site
`https://canadian-fish.vercel.app` · **Persona:** has never heard of Literature or Fish, owns a deck
of cards, is standing up holding a phone.

Screenshots: [`docs/audit/before/`](docs/audit/before). Every number below is measured off the live
DOM, not estimated.

---

## The headline number

| Question | Answer |
|---|---|
| Landing page → sitting at a table with cards | **~55 seconds, 4 taps, 2 scrolls** |
| Landing page → *actually understanding how to play* | **~9½ minutes** (34 learn slides) |
| Words to read before the first card appears | **~370** (home 173 + practice hub 198) |

The gap between those two rows is the whole problem. You can be *playing* in under a minute, but
you'll be staring at "ASK FOR A CARD" and "CLAIM A HALF-SUIT" with no idea what either means — and
the only thing that explains it is a 34-step wall of prose.

**Where I would have bounced, in order:** the home page (two forms I can't use), the practice hub
(six identical cards, keyboard instructions on a phone), and the `/learn` intro (34 progress dots
under five dense bullets — I'd have closed the tab).

### Measured page metrics

| Page | Words | Read @200wpm | Screens of scroll | Sub-44px controls | Jargon hits |
|---|---|---|---|---|---|
| `/` home | 173 | 52 s | 1.73 | 0 | 9 |
| `/learn` (slide 1 of 34) | 231 | 69 s | 1.40 | **33** | 8 |
| `/learn/rules-card` | 444 | 133 s | 2.50 | 0 | 26 |
| `/strategy` | **2 804** | **14 min** | **13.9** | 14 | 66 |
| `/practice` hub | 198 | 59 s | 1.51 | 0 | 7 |
| drills (each) | ~135 | ~40 s | 1.0 | 0 | 1–9 |
| `/practice/game` setup | 145 | 44 s | 1.26 | 0 | 7 |

Zero console errors anywhere, and no horizontal scroll at any width — the Phase 6 work holds up.
This audit is about comprehension and visual appeal, not breakage.

---

## Bug found during the audit (already fixed)

**The live site could not start a game at all.** `POST /api/create-room` returned **401** for every
real browser visitor. Vercel builds from the git repo, where `.env.local` is correctly gitignored,
and no env vars were set on the project — so `import.meta.env.VITE_SUPABASE_ANON_KEY` compiled to
`undefined` and every request went out with no `apikey` header. My earlier "production verified"
checks passed only because I supplied the headers myself with curl; I never drove the deployed
*client*. Verified in the production bundle: **0 occurrences** of the anon key.

Fixed in `src/api/config.ts` — the two public values (Supabase URL and the anon publishable key,
which RLS grants nothing) are now committed defaults with an env override, so a build can never
silently ship unauthenticated. Confirmed after redeploy: `200 POST create-room`, `200 POST start`,
table renders, no console errors.

---

## Per page

### 1. Home — [`home.jpg`](docs/audit/before/home.jpg)

**What's confusing.** The page opens with two forms — "Open a table" and "Join a table" — and both
need five other humans. A solo visitor has no usable path above the fold. The only thing they *can*
do, "PRACTICE VS BOTS", sits at **y = 1204 on an 812px screen** and is styled as a tertiary outline
button identical to two others.

**What's too wordy.** The hero explains the game in jargon a newcomer doesn't have yet:

> "Six players, two teams, forty-eight cards — win half-suits by asking sharp questions and claiming
> when your team knows where every card sits."

Then "The game in four lines" is a rulebook excerpt, not an introduction:

> "Deck is 52 minus the 8s: eight half-suits of six — 2–7 low, 9–A high."

"Half-suit", "claiming", "books" all appear before anything defines them (9 jargon hits in 173
words).

**What's visually flat.** There is no image on the page. Not one card, not one fish. Everything is
the same dark green at nearly the same value, so the squint test returns a uniform rectangle with a
slightly brighter button in it. The Bodoni-and-mono treatment reads as a private members' club, not
a party game six friends play in a dorm.

**Highest-impact fix:** make "Play against bots right now" the single, unmissable primary action
above the fold, and replace the four-line rulebook with one wordless picture of the core loop.

### 2. `/learn` — [`learn-intro.jpg`](docs/audit/before/learn-intro.jpg) · [`learn-step5.jpg`](docs/audit/before/learn-step5.jpg)

**What's confusing.** Slide 1 of **34** is five dense bullets covering goal, teams, deck, books and
the engine of play — the entire rulebook before a single card is shown. The 34 progress dots are
visible immediately and read as a sentence: *this will take a while*. They're also 14 × 14 px, which
is where all 33 sub-44px targets on the page come from.

**What's too wordy.** The intro's framing is cold and abstract:

> "This walkthrough replays a real game one move at a time — every hand is face up, because the point
> is to see how the machine works."

And a definition that defines two unknowns in terms of each other:

> "The goal: win more books than the other team. A book is a half-suit of six cards, and it is won by
> claiming it — naming exactly who holds every one of its cards."

**What's visually flat.** It's prose *about* cards with no cards in it. The single most teachable
thing in this game — a hit continues your turn, a miss passes it — is a sentence, when it should be
a two-frame diagram.

**Highest-impact fix:** cut 34 slides to ~6 wordless diagrams, and put a "skip and play" escape on
every one.

### 3. `/learn/rules-card` — [`rules-card.jpg`](docs/audit/before/rules-card.jpg)

Genuinely useful and correctly scoped — this is a reference, and density is right. But it's 444
words over 2.5 screens with 26 jargon hits, and the toggles line is an unreadable run-on:

> "JOKERS (54-CARD, 9TH BOOK) · RANK-QUARTET BOOKS · MANDATORY DECLARE · ANNOUNCE LAST CARD · HIGH
> BOOKS ×2 · BLUFF ASKS · DECLARER CHOOSES NEXT · CLAIM ANY TURN · STRICT MEMORY"

**Highest-impact fix:** keep the content, but make it print-first — two columns, suit glyphs instead
of the words LOW/HIGH, and demote the variant toggles to a footnote.

### 4. `/strategy` — [`strategy.jpg`](docs/audit/before/strategy.jpg)

**2 804 words and 13.9 screens of continuous scroll.** Density is fine here (it's a research page,
and the constraint is to keep every citation), but there is no way to skim it: no collapsible
sections, no table of contents, no way to jump to "claim timing". The longest single paragraph is
529 characters. The 14 sub-44px targets are inline source links at 13 px tall.

**Highest-impact fix:** same words, new skeleton — a sticky contents rail, collapsible sections, and
citations as tappable chips rather than 13px raw URLs. Delete nothing.

### 5. `/practice` hub — [`practice-hub.jpg`](docs/audit/before/practice-hub.jpg)

**What's confusing.** Six identical cards, numbered 1–6, which strongly implies "start at 1". Drill 1
is Book Recall — a memory exercise that assumes you already know what a half-suit is. The one entry
a beginner should take, "Full game vs bots", is **number 6, below the fold at y = 928**, and looks
exactly like the other five.

**What's too wordy — and wrong for the device.** Four keyboard references on a mobile-first page:

> "Six fast, keyboard-driven exercises … Press a drill's number to jump in."
> "EVERY DRILL: ENTER STARTS, ESC BACKS OUT, NUMBER AND ARROW KEYS DRIVE THE ROUND."

Phones have no Esc key. Descriptions also assume the vocabulary: "the broken rule revealed after",
"pin a card to its seat", "one wrong seat voids it".

**Highest-impact fix:** promote "Play a full game" to a distinct hero card at the top, demote the
five drills to a secondary grid, and describe them in plain language.

### 6. `/practice/game` setup — [`game-setup.jpg`](docs/audit/before/game-setup.jpg)

The difficulty choices are described in engine vocabulary rather than player experience:

> Easy — "SHORT MEMORY, LOOSE ASKS" · Medium — "FULL DEDUCTION, CERTAIN CLAIMS" · Hard — "EV CLAIMS,
> SIGNALLING, ENDGAME COUNTING"

And the screen leads with keyboard shortcuts (`1 / 2 / 3 DIFFICULTY · C COACH · ENTER DEAL`) plus a
paragraph of architecture reassurance about what the coach can see — correct, but not what someone
wants at the moment they're trying to start a game. "five deterministic house bots" uses a
developer's word.

**Highest-impact fix:** three bot *characters* with faces and one plain-language line each; move the
information-integrity note to a footnote.

### 7. Lobby — [`lobby.jpg`](docs/audit/before/lobby.jpg)

**The real problem is that this screen exists at all in the solo flow.** Tapping "Deal me in" creates
the room and drops you in a lobby with all six seats already filled (you + five bots), where you must
find and press a second button, "Deal the cards", to start. That's a pointless extra tap and an extra
concept for someone who asked to play a bot game.

**Highest-impact fix:** solo bot games should deal immediately; keep the lobby for human rooms.

### 8. The table — [`table.jpg`](docs/audit/before/table.jpg) · [`ask-sheet.jpg`](docs/audit/before/ask-sheet.jpg)

This is the best screen in the app and still has the most to gain.

**What works:** the six-seat ring with my seat at the bottom is genuinely readable; the "Your turn"
banner is big; card counts are visible on every seat.

**What's confusing.**
- **The log is below the fold** — measured at `top: 847` on an 812px viewport, so the public record
  is invisible without scrolling. The game's own copy insists "counts are public; memory is the whole
  game", then hides the record.
- **My hand is clipped.** Cards are 76 × 101 px, overlapped, and the row runs off the right edge — a
  seventh card is a visible sliver. The most important element on the screen is partly off-screen.
- **The eight book pills** ("LOW ♣ · LOW ♦ · HIGH ♠"…) are dashed grey outlines with no visible
  won/lost/void state and no explanation. A beginner cannot tell they're the scoreboard.
- **Seat chips carry five elements each** — "P3 · B" pill, "BOT" pill, name, card back, "8 CARDS" —
  times six seats, which is 30 competing labels around a small oval.
- **The banner says the same thing twice:** heading "Your turn", then "YOUR TURN — ASK AN OPPONENT
  OR CLAIM A HALF-SUIT".

**What's visually flat.** Felt, seat chips, panels and page background are all near-identical greens.
The bots have no faces — each is a red card back — so there's no sense of playing *against someone*.

**Highest-impact fix:** get the hand and the log both above the fold with real hierarchy — hand
big and uncut at the bottom, log as a compact live strip — and give the eight books an obvious
scoreboard state.

### 9. Drills — [`drill-recall.jpg`](docs/audit/before/drill-recall.jpg)

Mechanically excellent and genuinely fast. Two issues: every drill's start screen leads with keyboard
instructions on a touch device, and the drills present themselves as equals when their difficulty
order is really 2 → 5 → 1 → 3 → 4 for a newcomer.

---

## Cross-cutting themes

1. **Nothing is illustrated.** Across nine screens there is not a single drawing — no fish, no net,
   no diagram. Every explanation is a sentence. For a game whose rules are *spatial* (cards moving
   between six hands), that's the core failure.
2. **The vocabulary arrives before the meaning.** "Half-suit", "book", "claim", "void", "seat" are
   used ~9 times on the home page alone, all before definition.
3. **One value, one hue.** Dark green on dark green with brass accents. Elegant, but every page
   fails the squint test because nothing is lighter, larger or warmer than anything else.
4. **Desktop assumptions on a phone-first product.** 14 keyboard references across pages that
   mobile users cannot act on.
5. **The solo path is treated as an afterthought** even though it's the only path a first-timer has:
   below the fold on home, sixth on the practice hub, and gated behind an unnecessary lobby.

## The one change that matters most

If only one thing changes: **put "play right now against bots" as the primary action on the landing
page, and teach the rules with pictures instead of paragraphs.** Everything else in this audit is
downstream of those two.
