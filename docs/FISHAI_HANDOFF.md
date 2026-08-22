# FishAI handoff brief — Literature / Canadian Fish engine research

**From:** the play-style research pass (six parallel research agents, 2026-08-22).
**Full reference:** [`PLAYSTYLES.md`](../PLAYSTYLES.md) at the repo root — 65 play styles, 48 rule-dialect
axes, engine spec, bibliography. On branch `claude/literature-playstyles-research-zqa3vs` / PR #2.
**This brief:** the load-bearing subset, written to be read cold and acted on immediately.

Read §1 first — it exists to stop you re-deriving work that is already done.

---

## 1. Do not duplicate this

### Already covered — six research passes, ~52,000 words of raw notes

| Pass | Output |
|---|---|
| Wikis + canonical rules | 28 rule variants, 9 contradictions, terminology tables |
| Forums + community | 27 house rules, 11 archetypes, ~30-term jargon glossary |
| Academic literature | 89 sources, algorithmic families, formal characterization |
| Strategy + conventions | 28 archetypes with counter-play and detection signatures |
| Regional variants | Indian/North American dialects, etymology trail |
| Implementations | **never produced its file** — see §9 |

### Still open — and worth your budget

The session egress policy returned **403 for nearly every non-GitHub host**: pagat, Wikipedia, BGG,
Reddit, Stack Exchange, Quora, YouTube, Bryn Mawr, gamerules, and all live play sites. **No forum
thread was ever read.** Most prose sourcing is search-extract, not verbatim page reads.

If your session has wider egress, the highest-value unmined sources are:

1. **pagat.com/quartet/literature.html** in full — the Variations section especially. Everything
   currently attributed to pagat is a search extract.
2. **Reddit / Quora / Board Games Stack Exchange threads** — the entire "how real players describe
   their own strategy" layer is missing.
3. **Bryn Mawr DMC "Rules of Fish"** (`brynmawr.edu/math/rules-fish`) — a complete self-consistent
   house dialect, only partially extracted.
4. **Mike Develin, "Canadian Fish" ch. 9** (`bantha.org/~develin/cardgames.html#ch9`, HTTP only) —
   reportedly the deepest single strategy text in existence. Never opened.
5. **Indian college-fest tournament rulebooks** — codified competitive rules, likely PDFs.
6. **East Asia / Middle East / Europe** — entirely unresearched. Warning: "fishing" in card-game
   taxonomy usually means *table capture* (Seep, Basra, Pasur, 捞鱼), which is a **different game
   family**. Do not classify one as Literature without team structure + half-suit collection + claiming.

---

## 2. Five findings that change the design

### 2.1 A team-contained book is an absorbing state — the sharpest result

If your team holds all six cards of a book, **the book cannot be taken from you**. Two closure paths,
both verified against the pinned rules:

- **No opponent can ask into it.** A legal ask requires the asker to hold ≥1 card of the asked book.
  If your team holds all six, no opponent holds any, so no opponent can name a card in it. Teammates
  may never ask each other. The cards are frozen.
- **No opponent can steal it by claiming.** A claimant must assign all six cards to their *own* team.
  An opponent claiming a book you contain therefore triggers the "opposing team holds one → opposing
  team scores" rule and **gifts it back to you**. This holds even under claim-on-any-turn.

Containment can only be ended by the containing team's own claim. ∎

**Consequences.** Claiming early has **zero defensive value** under the void ruleset. The only reasons
to claim are tempo, endgame forcing, and human memory decay — none of which apply to a bot with
perfect recall. A snap-claiming bot is leaving value on the table. Compute `Unaskable(book)` as a hard
predicate first at every node: it gates claim timing and zeroes banking decay risk.

**Caveat:** this is derived from the rules, not observed in play. Sources disagree about hoarding vs.
claiming early; this argument is why the disagreement resolves toward hoarding *under this ruleset*.

### 2.2 A contained book is a free, repeatable turn-pass

Corollary of 2.1, and it does not appear in any source. If your team contains book B and you
personally hold ≥1 card of B but not all of it, then asking any opponent for any card of B you lack is:

- **legal** (you hold a card of the book, you don't hold the named card, the target is an opponent),
- **a guaranteed miss** (no opponent holds any card of B),
- **information-free** once containment is publicly deducible.

So it is a zero-cost turn-terminator, aimed at **any opponent you choose**, replayable every turn.
Claiming that book destroys the pass move. Cache it as a null-move candidate.

### 2.3 Claim EV has a threshold, and it is not certainty

Let `c = P(your team contains the book)` and `a = P(your assignment is exactly right | contained)`.

| Ruleset | EV of claiming | Claim iff |
|---|---|---|
| **Void** (misattribution → nobody scores) | `c·a − (1 − c)` | **`c > 1/(1+a)`** — 0.5 at `a=1`, 0.667 at `a=0.5` |
| **Opponents-score** (any error → they get it) | `c·a − (1 − c·a)` | **`c·a > 0.5`** |

Keep `c` and `a` as **separate quantities**. An engine that computes only `P(entire claim exactly
right)` claims far too conservatively under the void rule, because the void outcome is cheap (0) while
the gift outcome is expensive (−1).

### 2.4 Difficulty is informational, not combinatorial

Branching factor is **≤120, typically 20–40** — versus chess ~35, Go ~250. Information sets reach
**7.66×10²⁴**. Spend the strength budget on belief quality, not search depth. Target choice is cheap
enough to *search* rather than heuristic away.

### 2.5 The endgame is exactly solvable

Once ≲18 unknown cards remain (~3 books), the team-pooled residual space is ~1.7×10⁷ **before**
constraints and far smaller after; at ≤12 unknowns it is ~3.5×10⁴. Since claiming is all-or-nothing,
that is where most points are decided. **Highest-leverage, lowest-risk component to build first:**
solve the endgame exactly and back its value into the midgame.

---

## 3. Verified combinatorics

Computed with exact integer arithmetic; independently reproduced.

| Quantity | Expression | Value |
|---|---|---|
| Total deals, 6 identified seats | `48!/(8!)^6` | 2.8893×10³³ |
| One seat's information set at the deal | `40!/(8!)^5` | 7.6567×10²⁴ |
| A team's joint information set at the deal | `24!/(8!)^3` | 9.4655×10⁹ |
| Claim assignments per book (3 teammates) | `3^6` | 729 |
| Legal asks per turn, upper bound | 3 targets × ≤40 cards | 120 |

Team-pooled belief is ~15 orders of magnitude smaller than the naive deal space, which makes
ex-ante-correlated (TMECor-style) reasoning far more affordable than the raw numbers suggest.

**If you see 4.01×10³⁰ quoted as the deal count, it is wrong.** It equals `48!/(8!)^6 ÷ 6!` — an
unlabelled-partition count that treats the six hands as interchangeable. Seats are labelled in a
partnership game; the `÷6!` is an error.

---

## 4. Rule flags you must not hardcode

Literature has no single ruleset. These axes are attested across independent implementations, and
several **flip strategic doctrine**, not just legality. Build them as config from day one.

| Flag | Values | Why it matters to the AI |
|---|---|---|
| **`wrongClaim`** | `void` / `opponentsScore` | **The single most important flag.** Changes the claim threshold (§2.3) and whether deliberate voiding is even a move. pagat carries void as baseline, opponents-score as a listed variation; many implementations default to the variation. |
| **`bluff`** (ask for a card you hold) | off / on | Decides whether `asker ∉ holders(card)` is a **hard constraint or soft evidence**. This is the backbone inference of the whole game. Build the seam as a likelihood ratio with a bluff-rate parameter — do not delete the clause. |
| **`logVisibility`** | last-action / last-two / everything | Decides whether a perfect-recall bot is even playing the same game as its human opponents. |
| **`declareTiming`** | own-turn / any-turn | Any-turn creates a race to cash known books — real strategic pressure that turn-based play lacks. |
| **`deck` / partition** | 8s-out (2–7 / 9–A) · 7s-out ace-low (A–6 / 8–K, Indian "Lit") · 54-card with 8s+jokers as a 9th book | **Treat the book partition as data, not constants.** The Indian dialect breaks every hardcoded ask-legality check. |
| **`termination`** | all 8 books / first-to-N | first-to-5 makes draws impossible. Note: first-to-N combined with voids can be unreachable — a team may never get there. |
| **`handSizeVisibility`** | public / secret | Card counts bound every deduction; secret counts remove a whole constraint class. |
| **`highBooksDouble`** | off / on | Every EV term must be weighted; high books justify ~2× the risk. |
| **`memoryBits`** | ∞ / N | See §7. |

---

## 5. Architecture — build order

1. **Exact deduction layer.** Three-tier lattice (`known` / `knownset` / `possible`) + per-seat
   cardinality constraints, propagated to fixpoint after every public event. Implement the
   **Hall/pigeonhole propagator** generically. Anchor facts to *deal-time* card variables so they
   survive card movement rather than needing rewriting.
2. **Exact endgame solver** (§2.5), value backed into the midgame.
3. **Calibrated belief** — weighted particles over consistent deals; switch to exact enumeration
   at ≲18 unknowns. Keep **per-book joints, not marginals**: six correct marginals are not one
   correct assignment, and claims need the joint.
4. **Policy-conditioned reweighting** — reweight particles by `P(observed asks | world, π̂_seat)`.
   This is where the signalling channel gets decoded and where most of the superhuman edge lives.
5. **Search**, with these non-obvious requirements:
   - Ask nodes are `(target, card)` pairs; **target choice must be searched**.
   - **Miss branches are handoffs**, not penalties — evaluate as the negated value of the *chosen*
     opponent's position.
   - **Do not prune provably-failing asks** and do not collapse certain-hit asks. Both are
     strategically load-bearing; a naive generator kills the first as dominated.
   - **"Claim book B" must be legal at every node**, including when B is not the objective — its
     value can flow entirely through the turn transfer.
   - Use a **WDL head, not linear book count** — a book-count maximiser cannot reason about the 4–4
     tie as a target.

### The trap: never let a determinizing search evaluate claims

**PIMC / perfect-information-Monte-Carlo suffers catastrophic strategy fusion on claims.** In every
determinized world the claim succeeds — the sampler already knows where the cards are — so the agent
claims constantly and hemorrhages books. Gate every claim through a **paranoia query**: is this book
claimable in *every* surviving world? (Or: does it clear the §2.3 threshold under the full belief?)
This is the most likely way to build a bot that looks sophisticated and plays terribly.

### Formal note

All hidden information originates at a **single chance node — the deal**. Every subsequent action is
public, so each hand is a deterministic function of (deal, public history) and card counts are common
knowledge. This makes Literature a near-best-case for **public-belief-state** methods and gives an
unusually strong hard-constraint system. Communication regime is **ex ante coordination only** ⇒
**TMECor** is the right solution concept for a team-optimal reference point.

---

## 6. Play styles that matter most for v1

The full taxonomy is 65 styles. These are the ones with the highest ratio of strength gained to
implementation cost. Names in brackets are the section anchors in `PLAYSTYLES.md`.

| Style | What it is | Engine mapping |
|---|---|---|
| **Hoarder** [S23] | Bank a contained book instead of claiming it | Follows from §2.1; needs `Unaskable()` |
| **Contained-book exit** [S19] | The free turn-pass of §2.2 | Null-move candidate, computed exactly |
| **Blackballing** [S13] | Team-level protocol: never miss into the dangerous opponent | `Danger(seat)` term scaling miss cost per target |
| **Turn-Parking** [S14] | On a likely miss, choose *where* the turn lands | Requires miss-branch-as-handoff evaluation |
| **Known-Negative Ask** [S4] | Deliberate guaranteed miss to transmit "I hold this book" | Must not be pruned as dominated |
| **Key-stripping** [S17] | Take an opponent's last card of a book to revoke their right to ask into it | Score against *destroyed option value*, not the card |
| **Stalemate-Breaker** [S20] | Cash a banked book to hand the turn to a locked-out teammate | Claim must be legal at every node |
| **EV Claimer** [S26] | Claim on §2.3 thresholds, not certainty | Separate `c` and `a` |
| **The Cloak** [S3] | Suppress asks in books you actually hold | Concealment prior: **never** infer "lacks book B" from "never asked in B" |
| **Playing Possum** [S21] | Feign ignorance to avoid being blackballed | Compute `Danger` from **what the log entails**, not observed behaviour |

**Sharpest inference asymmetry to exploit:** deduce from **asks not made** (M3). After each turn, apply
a soft Bayesian penalty to hypotheses under which the mover had an obviously better ask available than
the one they played. **No implementation found does this.**

---

## 7. Memory as an explicit axis

One prior framework (Sanjay Kannan's *Literature 0.01*) parameterizes bot memory **in bits**: 2 bits
for "X has card Z", 2 bits for "X does not have Z", 1 bit for "X has a basis in suit Y", with explicit
capacity accounting and a relevance-ranked eviction policy.

This is the cleanest difficulty knob available, and it is **more honest than error injection**: a
memory-limited bot fails the way humans fail — it forgets the least relevant fact — rather than
playing well and then randomly blundering. Keep the agent's memory capacity **independent** of the
UI's log-visibility setting; they are different axes.

Useful priors from a prior implementation: at six players, a seat that has certified a book holds any
given remaining card of it with probability **1, 5/9, 19/43** (1/2/3 cards left); an uncertified seat,
**0, 1/9, 6/43**. Certification is worth roughly a 5× likelihood ratio.

---

## 8. Opponent modeling — detection statistics

Every one of these is computable from the **public log alone**, so the engine can run the panel on all
five other seats every turn and persist per-seat profiles across games.

- `banked_book_turns` — turns between provable containment and the claim. High ⇒ Hoarder.
- `books_claimed_before_turn_20` — low ⇒ Hoarder; high ⇒ Snap Claimer.
- Ask-target distribution vs. uniform — a seat starved of asks ⇒ someone is blackballing.
- Known-miss ask rate — high ⇒ signaller; near-zero ⇒ prohibitionist.
- Ask clustering (consecutive asks at one seat / in one book) — the leak is superlinear, so penalize
  it convexly rather than per ask.
- Zero asks in a book the log shows they hold ⇒ Cloak.
- `claim(A) by seat i → claim(B) by seat j≠i within one turn` ⇒ stalemate-breaker executed.

---

## 9. Epistemic warnings — read before citing any of this

1. **Evidence tiers are load-bearing.** `PLAYSTYLES.md` tags every claim: `[attested-direct]` (source
   read in full), `[attested-search]` (real URL, search extract only, **page never opened**),
   `[inferred from rules]` (derived, unsourced), `[coined]`, `UNVERIFIED`. **Never promote a tier.**
   Anything marked inferred — including §2.1 and §2.2 above — is a hypothesis for self-play to test,
   not established community practice.
2. **There is no academic prior art.** Eight query families across arXiv, ACM, IEEE, AAAI, and thesis
   repositories returned **zero** papers on Literature, Canadian Fish, Fish, Go Fish, or quartet-game
   AI. No baseline agent, no environment, no benchmark. The domain is unclaimed — which is an
   opportunity, but it also means no result here has been peer-reviewed.
3. **Verify arXiv IDs before citing in anything formal.** The academic pass flagged ~30 entries with
   `UNVERIFIED` author fields because it could not open the pages.
4. **A cluster of very new GitHub "Literature" repos reads as AI-generated.** One of them belongs to
   this project's own owner. They were weighted at ~zero as non-independent evidence. **Do not treat
   this project's own artifacts as external corroboration.**
5. **The implementations research pass never produced its file.** Part IX.3 of `PLAYSTYLES.md` is
   marked provisional; for several source files the upstream repo could not be re-verified. The
   substance came from reading downloaded source directly, so it is solid — but provenance is thin in
   places.

---

## 10. What would most improve the engine

1. **Log games.** Public histories + revealed hands, from bot self-play and from humans. Policy-
   conditioned inference (§5.4), convention decoding, and any learned component are all gated on data
   that **does not exist publicly**. Instrument this now; it is the long pole.
2. **Test §2.1 empirically.** Hoarder vs. Snap Claimer, self-play, held-out seeds. The argument is
   sound but unobserved. If it holds, it is a large and cheap strength gain.
3. **Build the `wrongClaim` flag before tuning anything.** Half the strategic literature assumes the
   other ruleset; a tuned bot under the wrong flag is mistuned everywhere.
4. **Implement inference from asks not made.** Nothing found does it, and the information is free.
