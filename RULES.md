# RULES.md — Canadian Fish (Literature), pinned rule set

This file is the single source of truth for the rules engine. Every row is marked **DEFAULT**
(shipped behavior) or **OPTIONAL TOGGLE** (engine config flag, off by default). Literature has many
live variants; these were pinned before any engine code was written.

**Baseline sources** (accessed 2026-08-20):
- pagat.com — Literature: https://www.pagat.com/quartet/literature.html
- Wikipedia — Literature (card game): https://en.wikipedia.org/wiki/Literature_(card_game)

Defaults follow the build brief, which matches the pagat/Wikipedia baseline. The two clauses the
brief deferred to pagat (post-claim turn, whole-team-out procedure) were verified against pagat on
2026-08-20 and are pinned in §3–§4. Where the two sources describe variation, the variant is listed
in §5 as a toggle.

## 1. Decision table

| # | Rule | Pinned setting | Status |
|---|------|----------------|--------|
| 1 | Players & teams | 6 players, 2 teams of 3, seated alternating — seats 0,2,4 = Team A, seats 1,3,5 = Team B | DEFAULT |
| 2 | Deck | Standard 52 minus the four 8s → 48 cards | DEFAULT |
| 3 | Books (half-suits) | 8 books of 6: per suit, LOW = 2·3·4·5·6·7, HIGH = 9·T·J·Q·K·A | DEFAULT |
| 4 | Deal | All 48 dealt, 8 per player; deterministic seeded shuffle; first turn = seat 0 (engine-configurable) | DEFAULT |
| 5 | Ask: target | One specific card from one **opponent**; teammates may never be asked | DEFAULT |
| 6 | Ask: book requirement | Asker must hold ≥ 1 card of the asked book | DEFAULT |
| 7 | Ask: own card | Asker may not ask for a card they hold | DEFAULT |
| 8 | Ask: target has cards | Target must hold ≥ 1 card (of anything) | DEFAULT |
| 9 | Hit | Target hands the exact card over face up; asker keeps the turn and asks again | DEFAULT |
| 10 | Miss | Turn passes to the player who was asked | DEFAULT |
| 11 | Claim timing | On your own turn only | DEFAULT (claim-on-any-turn = toggle T8) |
| 12 | Claim content | Name the book and the exact holder of **every** card (assignments restricted to your own team) | DEFAULT |
| 13 | Claim: correct | All six locations right → your team scores the book | DEFAULT |
| 14 | Claim: opponent holds ≥ 1 | Opposing team scores the book (regardless of other locations) | DEFAULT |
| 15 | Claim: own team holds all six, any location wrong | Book is **void** — removed from play, nobody scores | DEFAULT |
| 16 | Claim without holding | You may claim a book holding none of its cards | DEFAULT |
| 17 | After any claim (correct, opponent-scored, or void) | The claimant's turn **continues** (verified pagat) | DEFAULT |
| 18 | Information | Card counts are public and shown; the app displays the persistent public log of asks/results (see §6); players keep no written records — the UI has no notes field | DEFAULT (`strictMemory` toggle = last ask only, T10) |
| 19 | Out of cards (not via own claim) | You drop out: can't ask, can't be asked; play continues around you | DEFAULT |
| 20 | Out of cards via your own claim | You choose any teammate **with cards** and pass the turn to them | DEFAULT |
| 21 | Whole team out of cards | Play stops; the team **with** cards must claim every remaining book — procedure in §4 (verified pagat) | DEFAULT |
| 22 | Game end | All 8 books resolved (scored or void) | DEFAULT |
| 23 | Winner | More books wins; equal counts (e.g. 4–4) = **tie** | DEFAULT |
| 24 | Player count | Engine parameterized, but 6 is the only supported/shipped value — no 8-player mode | DEFAULT |

## 2. Ask legality (engine error codes)

An `ask{seat,target,card}` is legal iff **all** hold, else the named error:

| Check | Error code |
|---|---|
| Game in `playing` phase (not endgame/awaiting pass/finished) | `WRONG_PHASE` |
| It is the asker's turn | `NOT_YOUR_TURN` |
| Asker has ≥ 1 card | `ASKER_OUT` |
| Target is an opponent (different team) | `TARGET_TEAMMATE` |
| Target ≠ asker | `TARGET_SELF` |
| Target holds ≥ 1 card | `TARGET_OUT` |
| Asker holds ≥ 1 card of the asked card's book | `NO_CARD_OF_BOOK` |
| Asker does not hold the asked card | `ASKING_OWN_CARD` |
| Card is a real card of the 48 | `INVALID_CARD` |

Hit → card moves target→asker, turn unchanged. Miss → turn = target. Both outcomes are public
events recording asker, target, named card, and hit/miss.

## 3. Claim resolution

`claim{seat, book, assignments}` — legal iff: book unresolved (`BOOK_RESOLVED`), it's the claimant's
turn in `playing`/`endgame` phase (`NOT_YOUR_TURN`/`WRONG_PHASE`), assignments cover exactly the 6
cards of the book (`BAD_ASSIGNMENTS`), and every assigned seat is on the claimant's team
(`ASSIGN_OPPONENT` — you claim *for your team*; if you think an opponent holds one, you don't claim).
Claiming with none of the book in hand is legal (row 16).

Resolution order (public event reveals the **actual** holders in every case):
1. Any of the 6 cards actually held by the opposing team → **opposing team scores** the book.
2. Else, claimant's team holds all six: assignments all correct → **claimant's team scores**;
   any location wrong → **void**, nobody scores.
3. The six cards are removed from all hands; the book is marked resolved; game ends when 8 books
   are resolved. The claimant's turn continues (row 17) unless §4 applies.

## 4. Running out of cards & endgame (verified against pagat, 2026-08-20)

- Emptied because an opponent took your last card (hit), or a claim removed your last card on
  someone else's turn → you **drop out** silently (row 19). The turn is unaffected.
- Emptied by **your own claim** → you must `pass{to}` to a teammate with cards (row 20). Only `pass`
  is legal while this is pending (phase `awaitPass`).
- **Whole team out** (either team's total cards = 0, books remain) → phase `endgame`:
  - If the turn currently belongs to a player **with** cards: that player alone must claim all
    remaining books, in any order, without consulting teammates.
  - If the turn belongs to the **empty** team (e.g. the claim that emptied the team was theirs):
    that player must `designate{to}` one opponent with cards (phase `awaitDesignate`), and the
    designated player alone claims all remaining books.
  - Endgame claims resolve exactly per §3 (misattribution among teammates still voids). Only
    `claim` is legal in `endgame`.
- Precedence: if a claim resolves the 8th book, the game is `finished` regardless of pending
  pass/designate. If the claimant emptied themselves *and* their whole team, `awaitDesignate`
  applies (not `awaitPass`). If the claimant emptied the *opposing* team, endgame starts with the
  claimant (they have the turn; if the claim also emptied the claimant but teammates have cards,
  `awaitPass` resolves first, then `endgame`).

## 5. Optional toggles — implemented as engine config flags, ALL OFF by default

| Flag | Variant |
|---|---|
| T1 `jokers` | 54 cards: add 2 jokers + keep 8s as "eights & jokers" 9th book → 9 books of 6 |
| T2 `rankQuartet` | Books are rank-quartets (all four 9s, etc.) instead of half-suits |
| T3 `mandatoryDeclare` | A completed book in one hand must be declared immediately |
| T4 `announceLastCard` | A player down to one card must announce it |
| T5 `highBooksDouble` | HIGH books score 2 points |
| T6 `askOwnCardAllowed` | May ask for a card you hold (bluff ask) |
| T7 `declarerChoosesNext` | After a successful claim the claiming team chooses who asks next |
| T8 `claimAnyTurn` | Claims allowed on any player's turn |
| T9 *(reserved)* | 8-player mode — deliberately **not** built (row 24) |
| T10 `strictMemory` | UI shows only the last question/answer instead of the persistent log |

Only the flags' rule effects are engine-level; T1/T2 change deck/book construction and are
implemented behind the same `RulesConfig` without UI exposure in v1.

## 6. Information rules & the public log (decision)

Traditional table rule: only the *last* question and answer may be restated; earlier history is
memory-only; no written records (pagat "History" rule). The build brief also requires the table UI
to show a persistent public log of asks/results and card counts. Decision (SPEC §11.1): the app
displays the full public log by default — the app acts as the shared table state, and every entry
it shows was public information when it happened; no player-private notes are possible (no notes
field). Purist tables set `strictMemory` (T10) to limit the UI to the last ask only. Card counts
are always shown. Nothing in any mode ever displays hidden card identities.

## 7. Worked examples (engine test vectors)

1. **Correct claim**: Team A seats {0,2,4} hold LOW-H = {2H@0, 3H@0, 4H@2, 5H@2, 6H@4, 7H@4};
   seat 0 claims with exactly those locations → Team A scores LOW-H; seat 0 keeps the turn.
2. **Opponent holds one**: as above but 7H is actually at seat 1 (Team B) → Team B scores LOW-H.
3. **Misattribution**: Team A holds all six but seat 0 swaps 4H/6H locations → LOW-H void; 0 keeps turn.
4. **Claim-out pass**: seat 0's correct claim uses their last 2 cards → seat 0 must pass to seat 2
   or 4 (whichever has cards); passing to a cardless teammate is illegal (`PASS_TARGET_OUT`).
5. **Endgame designation**: seat 0's claim empties all of Team A while Team B has cards → seat 0
   designates any Team B seat with cards; that seat alone claims the remaining books.
6. **Tie**: 4 books each (voids can also produce 3–3 or 2–2 with the rest void) → tie.
