# PLAYSTYLES.md — Literature / Canadian Fish: play styles, rule dialects, and engine specification

**Date:** 2026-08-22 · **Rules baseline:** [RULES.md](RULES.md) (6 players, 2×3 alternating, 48 cards, 8 books of 6, void-on-misattribution) · **Engine context:** [SPEC.md](SPEC.md) §5, `lib/engine/bots/`

**Purpose.** This document is the synthesis of six research passes into the strategy, folklore, rule
dialects and algorithmic prior art of Literature (Canadian Fish / Fish / Lit), written for someone
building a strong engine for it. It does three jobs, in order: (1) it **enumerates every play style**
found — 65 of them, each with a name, a definition, an observable signature and an engine mapping;
(2) it **defines the variant space**, because rule dialects change the game tree and the engine needs
config flags for them; and (3) it **specifies the engine** — evaluation terms, search architecture,
belief model, an opponent-detection statistics panel, and difficulty tiers. Nothing here is presented
as more certain than the evidence supports: every claim carries an evidence tier, and the access
limits that produced those tiers are stated in §1 rather than buried.

---

## Legend — evidence tiers

| Tier | Meaning |
|---|---|
| `[attested-direct]` | The source file was actually read in full — a GitHub raw file, a downloaded implementation source, or a file in this repo. Quotes are verbatim. |
| `[attested-search]` | A real, named URL whose content reached the researcher only as a **search-engine extract**. The page was never opened. Wording is near-verbatim at best; attribution is reliable at the page level, not the sentence level. |
| `[inferred from rules]` | Derived from the pinned rule set by reasoning. Sound but **not sourced** — no community reports doing this. |
| `[coined]` | The *name* was invented by a research agent. The underlying idea may still be attested; the tier of the idea is given separately. |
| `UNVERIFIED` | Surfaced but could not be traced to a named page, or traced only to a source judged unreliable (AI-generated encyclopedia, machine-generated aggregator, non-independent repo). |

**Never promote a tier.** If a style is `[inferred from rules]`, it is a hypothesis for self-play to
test, not a community practice to imitate.

---

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Master index of play styles](#2-master-index-of-play-styles)
3. [Part I — Rule dialects: the variant space](#part-i--rule-dialects-the-variant-space)
4. [Part II — Strategic play styles](#part-ii--strategic-play-styles)
5. [Part III — Conventions and the signalling schism](#part-iii--conventions-and-the-signalling-schism)
6. [Part IV — Memory and deduction styles](#part-iv--memory-and-deduction-styles)
7. [Part V — Algorithmic play styles](#part-v--algorithmic-play-styles)
8. [Part VI — Engine specification](#part-vi--engine-specification)
9. [Part VII — Contradictions and open questions](#part-vii--contradictions-and-open-questions)
10. [Part VIII — Research gaps](#part-viii--research-gaps)
11. [Part IX — Bibliography](#part-ix--bibliography)
12. [Appendix — Verified combinatorics](#appendix--verified-combinatorics)

---

## 1. How to read this document

### 1.1 The research-access caveat — stated plainly

**The research sessions behind this document could not open almost any of the sources they cite.**
The egress proxy returned **403 policy denials for nearly every non-GitHub host**, confirmed by direct
probe across all six passes: `pagat.com`, `en.wikipedia.org` and all Wikimedia hosts,
`boardgamegeek.com`, `reddit.com` (also refused by the search backend), `boardgames.stackexchange.com`,
`quora.com`, `youtube.com`, `brynmawr.edu`, `gamerules.com`, `depositgenius.com`, `cardrulesplus.com`,
`gambiter.com`, `grokipedia.com`, `en-academic.com`, `bantha.org` (Develin), `cornellsun.com`,
`games.rmwinslow.com`, `highprogrammer.com`, `play-litaf.onrender.com`, `web.archive.org`, and every
search engine's own domain.

**Only GitHub hosts were directly fetchable** (`raw.githubusercontent.com`, `github.com`,
`codeload.github.com`, repo-scoped `api.github.com`). GitHub *code* search was disabled for the
sessions. The shared `WebSearch` budget (200 calls) was exhausted partway through, cutting off
planned work.

Consequences you must carry into every reading of this file:

- **Most prose sourcing is search-extract, not a page read.** Every pagat, Wikipedia, Bryn Mawr,
  Deposit Genius, gamerules, Grokipedia, Winslow and Cornell quotation below is `[attested-search]`.
  Those quotes read as page text, but nobody diffed them against the live page, saw their surrounding
  context, or enumerated the full Variations sections they came from.
- **The strongest evidence in this document is source code**, because implementations cannot be vague
  about deck composition, ask legality or claim resolution. `[attested-direct]` here mostly means "a
  `.ts`/`.py`/`.rs` file was read".
- **Anything load-bearing for the engine should be re-verified** against the live page when egress
  allows. Part VIII lists the exact URLs and queries to re-run.

### 1.2 The independence caveat

A cluster of the newest Literature repositories reads as AI-generated: `EshwarKo/FishBot`,
`Mkishore7/Literature-Card-Game-Vibe-Coding-`, `MeagerPotato/Fish-Onboarding`,
`Kakashi-hatake1105/Raise-N-Call` (whose rules document is internally impossible — it pairs a
six-card lower half with a seven-rank upper half and calls Literature a four-player game). Critically,
**the owner `MeagerPotato` also owns a repo named `Canadian-Fish-Demo` — the same name as this working
directory** — so at least one of these is not an independent source at all but a sibling of this
project. **All of these are weighted at near zero** and are used nowhere as sole evidence. The
load-bearing repositories are the older, organic ones: `cjquines/cfish` (2020, Heroku-era),
`gyash24x7/littplay`, `neelsomani/literature` (2018), `Dynosol/playfish.io`, `amy-lei/fish`,
`grantbw4/literature-rl`, `TaranKamireddy/LiteratureBot`, `Ryan1729/canadian-fish`,
`zairza-cetb/literature`, `Rocky-921/Literature`, `scarroy-02/literature_game`.

### 1.3 Relationship to what this repo already has

`src/learn/strategy-content.ts` already ships an attributed strategy corpus (15 sources) to the
`/strategy` page. **Material already in that corpus is not new**, and rows that restate it are marked
`corpus` in the "Status in this repo" column. What is genuinely new in this document is: the merged
variant catalogue with toggle mapping (Part I), the observable-signature and counter-play columns for
every style (Part II), the mechanical rendering of the Salahuddin convention (Part III), the
bounded-memory-in-bits model (Part IV), the algorithmic families with verified citations (Part V), the
engine specification (Part VI), and the corrected combinatorics (Appendix).

### 1.4 Status vocabulary

| Status | Meaning |
|---|---|
| `shipped` | The current bot (`lib/engine/bots/decide.ts`) actually does this. |
| `partial` | Something adjacent exists but the style is not fully realised. |
| `corpus` | Documented in `src/learn/strategy-content.ts` (the `/strategy` page) but not implemented in the bot. |
| `gap` | Neither implemented nor documented in-repo. |
| `n/a` | Not applicable to this app (live-table procedure, or a different game). |

### 1.5 Four corrections the lead verified — these override the raw research

1. **Combinatorics.** Full deals = `48!/(8!)^6` = **2.8893×10³³**; one seat's information set at the
   deal = `40!/(8!)^5` = **7.6567×10²⁴**. The figure `4.01×10³⁰` that appears in one raw source does
   **not** reproduce as a deal count — see the [Appendix](#appendix--verified-combinatorics).
2. **A team-contained book is a genuine absorbing state** — no opponent can ask into it *and* no
   opponent can steal it by claiming. This strengthens the Hoarder ([S23](#s23-hoarder)) well beyond
   what the narrative sources say. Full argument in [S23](#s23-hoarder); it is this document's
   sharpest strategic finding.
3. **Claim EV threshold** under the pinned void rule: claim iff `c > 1/(1+a)`. Under the
   opponents-score-any-error dialect the threshold is the harsher `c·a > 1/2`. See
   [§II.3 preamble](#ii3-claiming-doctrine).
4. **Contradiction C1 is not a source conflict.** pagat carries both the void rule (its baseline) and
   the opponents-score rule (in its Variations section). The repo follows pagat's baseline correctly;
   the gap is a *missing toggle*, not a wrong choice. See [V17](#v17-any-error-scores-for-the-opponents).

### 1.6 One research pass is missing — the implementation material is provisional

Five of the six research passes had landed when this document was written: wikis and rules references,
forums and community, academic literature, strategy and conventions, and regional variants. **The
dedicated implementations-and-code pass (`04-implementations-code.md`) had not produced a file.**

Everything this document says about implementations was therefore assembled from two other sources:
(a) the implementation material embedded in the other five passes, and (b) **downloaded source files
read directly during synthesis** — a TypeScript rules engine with a four-axis house-rule taxonomy, a
bot with teammate-signal detection, a Python engine with learned bots, a hosted implementation's
server logic, two Rust engines, a Java simulator, a Node server, and a bounded-memory bot framework.
Reading those files is why several claims in this document are `[attested-direct]` rather than
`[attested-search]`, and why three variants ([the Challenge](#v23-the-challenge),
[secret hand sizes](#v39-secret-hand-sizes), [bounded memory](#s44-bounded-memory-player)) could be
upgraded from single-source prose to verified implemented behaviour.

**Consequences to expect.** [Part IX.3](#ix3-implementations) is explicitly marked provisional: for
several local source files the **upstream repository could not be re-verified in-session**, and those
rows say so. When the missing pass lands, expect it to (i) pin those provenances, (ii) add
implementations not seen here, and (iii) possibly revise the variant table's "attested at" column.
Nothing in Parts II–VIII depends on an unattributed implementation as its *sole* evidence.

---

## 2. Master index of play styles

**65 styles.** This table is self-contained: name, category, evidence tier, one-line description, and
whether this repo does it. Every name links to its detail section.

### 2.1 Strategic, signalling and memory styles (50)

| # | Name | Category | Evidence | One-line description | Status in this repo |
|---|---|---|---|---|---|
| S1 | [Signal Broker](#s1-signal-broker) | Information | `[attested-search]` | Treats every ask as a message to partners first and a card grab second, accepting the symmetric leak to opponents. | gap |
| S2 | [Prohibitionist](#s2-prohibitionist) | Information | `[attested-search]` | Refuses to spend anything on signalling, because three opponents hear what two partners hear. | `partial` (bot never signals except when stalled) |
| S3 | [The Cloak](#s3-the-cloak) | Information | `[attested-search]` | Suppresses asks in the books you actually hold, then harvests the whole book in one burst. | gap |
| S4 | [Known-Negative Ask](#s4-known-negative-ask) | Information | `[attested-search]` | Deliberately ask a card you know the target lacks, purely to transmit "I hold this book". | `partial` (`signallingAsk`, stalemate-only) |
| S5 | [Confirmation Ask](#s5-confirmation-ask) | Information | `[inferred from rules]` | Ask for a card whose location you already know with certainty: free tempo, zero new information. | shipped (certain hits sort first) |
| S6 | [Zero-Downside Ask](#s6-zero-downside-ask) | Information | `[attested-search]` | Ask inside a book your team already wholly holds — the leak is provably nil. | gap |
| S7 | [Chain Discipline](#s7-chain-discipline) | Information | `[attested-search]` | Spread asks across targets and books; consecutive asks at one seat leak superlinearly. | gap |
| S8 | [The Echo](#s8-the-echo) | Information | `[attested-search]` | Ask back into the book an opponent just asked you in — their ask proved they hold it. | `corpus` |
| S9 | [Teammate Re-ask](#s9-teammate-re-ask) | Information | `[attested-search]` | Re-ask the exact card your partner just failed on: fewer possible holders remain. | `corpus` |
| S10 | [The Bluffer](#s10-the-bluffer) | Information | `[attested-search]` (variant T6) | Ask for a card in your own hand to destroy the opponents' soundest inference. | toggle T6 exists; no bot behaviour |
| S11 | [Poisoned Handoff](#s11-poisoned-handoff) | Information | `[attested-search]` (variant T6) | Dump your team's last card of a book onto the least-informed opponent, transferring the burden. | gap (illegal at default) |
| S12 | [Least-Informed Targeting](#s12-least-informed-targeting) | Information | `[attested-search]` | Point risky or leaky asks at the opponent who knows least. | gap |
| S13 | [Blackballing](#s13-blackballing) | Turn-flow | `[attested-search]` | Never ask the dangerous opponent, so the turn can never reach them. Team-level protocol. | `corpus` |
| S14 | [Turn-Parking](#s14-turn-parking) | Turn-flow | `[inferred from rules]` + `[attested-direct]` | On a likely miss, choose the target so the surrendered turn lands where it hurts least. | `partial` (fewest-cards tiebreak) |
| S15 | [Lightning Rod](#s15-lightning-rod) | Turn-flow | `[attested-search]` | Hold a big hand on purpose so opponents probe you instead of your partners. | gap |
| S16 | [Foot-in-the-Door](#s16-foot-in-the-door) | Turn-flow | `[inferred from rules]` | Your last card of a book is not material, it is the *licence* to ask in it — never spend it. | gap |
| S17 | [Key-Stripping](#s17-key-stripping) | Turn-flow | `[attested-search]` (as "targeted voiding") | Take an opponent's final card of a book to lock them out of it permanently. | `corpus` |
| S18 | [Turn-Terminator](#s18-turn-terminator) | Turn-flow | `[inferred from rules]` | There is no pass, so construct the cheapest possible deliberate miss and end your turn. | gap |
| S19 | [Contained-Book Exit](#s19-contained-book-exit) | Turn-flow | `[inferred from rules]` | A book your team contains gives a renewable, zero-information-cost, aimable pass move. | gap |
| S20 | [Stalemate-Breaker](#s20-stalemate-breaker) | Turn-flow | `[attested-search]` | Bank a claimable book, then cash it later solely to hand the turn to a locked-out teammate. | `corpus` (mechanism supported by row 20) |
| S21 | [Playing Possum](#s21-playing-possum) | Turn-flow | `[inferred from rules]` | Look uninformed on purpose so you stay the seat opponents feel safe missing into. | gap |
| S22 | [Going Empty](#s22-going-empty) | Turn-flow | `[attested-search]` (rule) + `[inferred]` (doctrine) | Being cardless makes you unaskable and unparkable — sometimes a weapon, not a loss. | gap |
| S23 | [Hoarder](#s23-hoarder) | Claiming | `[attested-search]`, strengthened `[inferred from rules]` | Don't claim even at certainty: a contained book cannot be attacked or stolen, so it is a free option. | gap — **bot does the opposite** |
| S24 | [Snap Claimer](#s24-snap-claimer) | Claiming | `[attested-search]` | Claim the instant all six locations are known. | shipped (`certainClaim`) |
| S25 | [Certainty Purist](#s25-certainty-purist) | Claiming | `[attested-search]` | Never claim below 100% certainty; a bad claim is a social failure, not just an EV loss. | shipped at medium tier |
| S26 | [EV Claimer](#s26-ev-claimer) | Claiming | `[inferred from rules]` | Claim on expected value using `c > 1/(1+a)`, treating voids as an acceptable cost. | `partial` (`evClaim`, threshold 0.8/0.5) |
| S27 | [The Spoiler](#s27-the-spoiler) | Claiming | `[inferred from rules]` | Claim a contained-but-unresolvable book on purpose to void it and freeze a lead. | gap |
| S28 | [Endgame Solo Declarer](#s28-endgame-solo-declarer) | Claiming | `[attested-search]` | When one team is out, the other must claim everything alone; the best-informed, biggest hand should hold the turn. | shipped (`forcedClaim` in endgame) |
| S29 | [Endgame Dumping](#s29-endgame-dumping) | Claiming | `[inferred from rules]` | Race your own team to zero cards to force the opponents into a no-consultation solo sweep. | gap |
| S30 | [Brazen Prober](#s30-brazen-prober) | Claiming | `[attested-search]` | Steal books by guessing rather than knowing — claim (or challenge) on probability. | gap |
| S31 | [Forced Claimer](#s31-forced-claimer) | Claiming | `[attested-search]` + `[attested-direct]` | With cards but no legal ask you must claim: play the best-guess claim well. | shipped (`forcedClaim`) |
| S32 | [Control-Transfer Claim](#s32-control-transfer-claim) | Claiming | `[attested-search]` | Time a claim so it empties your hand, converting the claim-out pass into a chosen turn handoff. | `corpus` |
| S33 | [Breadth Shape](#s33-breadth-shape) | Hand shape | `[inferred from rules]` | Keep a foot in many books: maximum ask rights and parking options, no containment. | gap |
| S34 | [Depth Shape](#s34-depth-shape) | Hand shape | `[inferred from rules]` | Concentrate in few books: containment and easy claims, few legal asks, very readable. | gap |
| S35 | [The Reader](#s35-the-reader) | Meta | `[attested-search]` | Play the people: exploit each opponent's known habits across games, not just the cards. | gap |
| S36 | [Ali Salahuddin Convention](#s36-ali-salahuddin-convention) | Signalling | `[attested-search]` | The one named, codified partnership code: your next ask after a partner's failed ask encodes whether you hold the denied card. | `corpus` |
| S37 | [Implicit Target Signal](#s37-implicit-target-signal) | Signalling | `[attested-search]` | Whom you ask is itself a message — the convention-free baseline every table runs. | gap (inverse model not built) |
| S38 | [Rally Signal](#s38-rally-signal) | Signalling | `[attested-search]` | An out-of-pattern ask means "pile into this book with me"; a markedness convention. | gap |
| S39 | [Signal-Back](#s39-signal-back) | Signalling | `[attested-direct]` | When a teammate fails on a card you hold, ask in that same book on your next turn to confirm. | gap |
| S40 | [Convention Prohibition](#s40-convention-prohibition) | Signalling | `[attested-search]` | The counter-school: prearranged conventions are cheating; only in-game inference is fair. | `corpus` |
| S41 | [Emergent Convention](#s41-emergent-convention) | Signalling | `[attested-direct]` | Let self-play invent its own signalling and measure it with excess mutual information. | gap |
| S42 | [Full-Log Deductivist](#s42-full-log-deductivist) | Memory | `[attested-direct]` | Three-tier belief lattice (`known` / `knownset` / `possible`) propagated to fixpoint after every event. | shipped (`knowledge.ts`) |
| S43 | [The Accountant](#s43-the-accountant) | Memory | `[attested-search]` | Track every ask in the game, including ones you are not part of, and run elimination logic. | shipped |
| S44 | [Bounded-Memory Player](#s44-bounded-memory-player) | Memory | `[attested-direct]` | Memory capacity capped in **bits**, with an explicit eviction policy over fact types. | gap — best available difficulty knob |
| S45 | [Recency Player](#s45-recency-player) | Memory | `[inferred from rules]` | Remembers only the last few events; hit rate decays with the age of the supporting evidence. | shipped (easy tier, `logWindow: 6`) |
| S46 | [Own-Hand-Only Player](#s46-own-hand-only-player) | Memory | `[inferred from rules]` | Plays purely off hand shape, ignoring the public log entirely. | gap (a cleaner easy tier than the current one) |
| S47 | [Triage Memorizer](#s47-triage-memorizer) | Memory | `[attested-search]` | Memorise only the books you can contest; flush resolved books to free capacity. | `corpus` |
| S48 | [Log-Reader](#s48-log-reader) | Memory | `[inferred from rules]` | The app's default: with a persistent log, memory stops differentiating players and skill collapses onto inference. | shipped (RULES row 18) |
| S49 | [Random-Legal Floor](#s49-random-legal-floor) | Benchmark | `[attested-direct]` | Uniform choice among legal asks — the novice floor every ladder needs. | shipped (fallback policy) |
| S50 | [One-Ply Greedy](#s50-one-ply-greedy) | Benchmark | `[attested-direct]` | Claim if provable, else ask the most-likely-held card, else forced claim. No signalling, no opponent model, one ply. | shipped ≈ medium tier |

### 2.2 Algorithmic play styles (15)

| # | Name | Category | Evidence | One-line description | Status in this repo |
|---|---|---|---|---|---|
| A1 | [Constraint-Propagation Deductivist](#a1-constraint-propagation-deductivist) | Algorithmic | `[attested-search]` (Clue/Cluedo literature) | Ternary card×seat lattice plus cardinality constraints, propagated to fixpoint; claims only what is provable. | shipped |
| A2 | [Belief-Sampling Probabilist](#a2-belief-sampling-probabilist) | Algorithmic | `[attested-search]` | Weighted particles over consistent deals; exact model counting once the residual space is small. | gap (bot uses slot-count marginals only) |
| A3 | [Entropy-Driven Asker](#a3-entropy-driven-asker) | Algorithmic | `[attested-search]` | Score asks by expected information-set entropy reduction, traded against tempo. | gap (`narrowing` term is a crude proxy) |
| A4 | [PIMC Determinizer](#a4-pimc-determinizer) | Algorithmic | `[attested-search]` | Sample full deals, solve each perfectly, vote. **Catastrophic on claims** — strategy fusion. | gap (and should stay one) |
| A5 | [Information-Set MCTS](#a5-information-set-mcts) | Algorithmic | `[attested-search]` | Tree over information sets, statistics shared across determinizations; MO-ISMCTS for 6 asymmetric observers. | gap |
| A6 | [Paranoia Claim Gate](#a6-paranoia-claim-gate) | Algorithmic | `[attested-search]` | "Is this book claimable in *every* surviving world?" — αμ/KBPS applied narrowly to the claim decision. | `partial` (certainty test is the degenerate case) |
| A7 | [Policy-Conditioned Inference](#a7-policy-conditioned-inference) | Algorithmic | `[attested-search]` | Reweight worlds by `P(observed asks \| world, opponent policy)` — decodes signalling you were never told about. | gap — **highest ceiling** |
| A8 | [CFR / TMECor Solver](#a8-cfr--tmecor-solver) | Algorithmic | `[attested-search]` | Ex-ante-correlated team equilibrium; the formally correct solution concept, tractable only for endgames. | gap |
| A9 | [Public-Belief-State Search](#a9-public-belief-state-search) | Algorithmic | `[attested-search]` | Learned value over public belief states plus depth-limited re-solving — the "Stockfish" destination. | gap |
| A10 | [Blueprint + Single-Agent Search](#a10-blueprint--single-agent-search) | Algorithmic | `[attested-search]` | SPARTA: fix a blueprint everyone is assumed to follow, then search only your own next action. Never worse than the blueprint. | gap — best strength per unit effort |
| A11 | [Self-Play Deep RL](#a11-self-play-deep-rl) | Algorithmic | `[attested-search]` + `[attested-direct]` | Learn a policy/value from massive self-play with no explicit belief model. | gap (an MLP move-scorer exists in prior art) |
| A12 | [Zero-Shot Coordinator](#a12-zero-shot-coordinator) | Algorithmic | `[attested-search]` | Other-Play / Off-Belief Learning: suppress arbitrary self-play conventions so the agent can partner with strangers. | gap |
| A13 | [Human-Regularized Searcher](#a13-human-regularized-searcher) | Algorithmic | `[attested-search]` | Search inside a KL ball around a human-imitation anchor: strong *and* legible. | gap (needs logs) |
| A14 | [Opponent-Model Exploiter](#a14-opponent-model-exploiter) | Algorithmic | `[attested-search]` | Fit per-seat policy and belief models, then best-respond instead of equilibrium-playing. | gap |
| A15 | [Symbolic + LLM Hybrid](#a15-symbolic--llm-hybrid) | Algorithmic | `[attested-search]` | Constraint solver does the deduction; a language model only narrates. Methods yes, LLM-as-player no. | n/a (SPEC §12 forbids LLMs) |

---

## Part I — Rule dialects: the variant space

Literature has no governing body and no published tournament rulebook that anyone could reach. What
exists is a folk game with a dominant core and a wide skirt of house rules, plus a dozen independent
implementations that each froze one table's dialect into code. **The core is remarkably stable** —
six players in two teams, ask one named card from one opponent, must hold a card of that book, may not
ask a teammate, hit keeps the turn, miss passes the turn to the asked player, transfers are face up.
No source contradicts any of those. **Everything else moves.**

The table below is the merged catalogue: 48 axes on which real tables, real rules pages, or real
implementations differ, each mapped to this repo's `RulesConfig` toggles (`RULES.md` §5).

### I.1 Full variant table

| # | Axis | Variant | Evidence | Attested at | Repo toggle | Status |
|---|---|---|---|---|---|---|
| V1 | Deck | 8s out → 48 cards, LOW 2–7 / HIGH 9–A | `[attested-search]` + `[attested-direct]` | pagat, Wikipedia, Bryn Mawr, gamerules, playfish.io, literature-rl, Rocky-921, akshith6212 | — (default) | implemented |
| V2 | Deck | [7s out, **Ace low**: A–6 / 8–K](#v2-sevens-out-ace-low-deck) | `[attested-direct]` (code) | `gyash24x7/littplay` deck source; pagat lists it; a second engine's `CANADIAN` book type | none | **gap** |
| V3 | Deck | 2s out: 3–8 / 9–A | `UNVERIFIED` | one unattributed multi-site search extract | none | gap (unverified) |
| V4 | Deck | [54 cards, jokers + 8s = a ninth book](#v4-fifty-four-cards-and-a-ninth-book) | `[attested-search]` + `[attested-direct]` | pagat, Wikipedia, `cjquines/cfish`, `scarroy-02`, a Node server implementation | **T1 `jokers`** | implemented |
| V5 | Deck | 52 cards, **unequal books**: minor A–6 (6 cards), major 7–K (7 cards) | `[attested-direct]` (code) | Sanjay Kannan's Literature framework (`wh_lit.py` `SETS()`); pagat's "52-card version with 7-card major sets" | none | **gap** |
| V6 | Books | Rank quartets: 13 sets of 4 (all four 9s, …) | `[attested-search]` + `[attested-direct]` | pagat variation extract; an engine whose `BookType` is `NORMAL` (ranks) vs `CANADIAN` (half-suits) | **T2 `rankQuartet`** | implemented |
| V7 | Deck | Whole deck dealt, **no stock** | invariant | every Literature source | — | invariant — guard against Go Fish contamination |
| V8 | Players | 6, two teams of 3, alternating seats | `[attested-search]` + `[attested-direct]` | universal | — (default) | implemented |
| V9 | Players | 8, two teams of 4, 6 cards each ("Russian Fish" per one aggregator) | `[attested-search]` | pagat, Wikipedia, cardrulesplus | T9 *(reserved, deliberately not built)* | **gap by decision** (RULES row 24) |
| V10 | Players | 4, two teams of 2, 12 cards each | `[attested-direct]` | `neelsomani/literature` (trains at 4), `playfish.io`, one 4-seat rules doc | none | gap |
| V11 | Teams | Team **count** ≠ 2 (3 or 4 teams) | `[attested-direct]` | an implementation whose config carries `teamCount: 2 \| 3 \| 4` | none | gap (novel; no folk attestation) |
| V12 | Seating | Alternating by team, stated as an **anti-collusion** device; teams drawn by high card | `[attested-search]` | De Smet; Bryn Mawr; Deposit Genius | — (default alternating) | implemented |
| V13 | Players | "4 to 12 players" | `UNVERIFIED` | one college-club README, unsupported by its own rules | none | ignore |
| V14 | Ask | Asker must hold ≥1 card of the asked book | invariant | every source; **no source relaxes it** | — | invariant — safe inference axiom |
| V15 | Ask | May ask for a card you already hold (the bluff) | `[attested-search]` + `[attested-direct]` | Wikipedia, pagat variations, `cfish` `BluffRule`, playfish `bluffQuestions` | **T6 `askOwnCardAllowed`** | implemented (rules only) |
| V16 | Ask | Ask by **rank**, target hands over **all** matching cards | `[attested-search]` | Go Fish — a *different game*; leaks into aggregator write-ups | — | out of scope |
| V17 | Claim | [Any error scores for the opponents (no void)](#v17-any-error-scores-for-the-opponents) | `[attested-search]` + `[attested-direct]` | pagat *variations*; Bryn Mawr; `playfish.io`; `amy-lei/fish`; `cfish`; `littplay` | none | **gap — highest priority** |
| V18 | Claim | Own team holds all six, a location wrong → **void**, nobody scores | `[attested-search]` + `[attested-direct]` | pagat *baseline*; Wikipedia; `literature-rl` ("thrown in"); Rocky-921; akshith6212 | — (default, row 15) | implemented |
| V19 | Claim | [Timing: own turn / team's turn / any time](#v19-claim-timing) | `[attested-search]` + `[attested-direct]` | pagat & Wikipedia (own turn); `cfish` default `DURING_ASK`; `amy-lei` "declare anytime"; playfish `'own-turn' \| 'team-turn' \| 'anytime'` | **T8 `claimAnyTurn`** (binary) | partial — no `team-turn` mode |
| V20 | Claim | Must declare immediately on holding all six | `[attested-search]` | Wikipedia house rules | **T3 `mandatoryDeclare`** | implemented |
| V21 | Claim | Irrevocable once the first card is named (abort window before) | `[attested-search]` | Bryn Mawr club rules | none | n/a — claims are atomic (§3) |
| V22 | Claim | Direct claim by tabling all six face up | `[attested-search]` | pagat, gamerules | — | degenerate case of the general claim |
| V23 | Claim | [The **Challenge**: force the opposing team to claim a named book](#v23-the-challenge) | `[attested-search]` + `[attested-direct]` | Winslow rules page; old-Wikipedia rationale; **implemented** in `playfish.io` (`challengeMode`, pass/declare race) | none | **gap — new action type** |
| V24 | Claim | The declaring **team** chooses who asks next | `[attested-search]` + `[attested-direct]` | Wikipedia (as baseline!); an engine's `transferTurn` after a successful claim | **T7 `declarerChoosesNext`** | implemented |
| V25 | Claim | Split claim: name holders on **both** teams | `UNVERIFIED` | one low-provenance aggregator | none | ignore unless corroborated |
| V26 | Claim | Forced claim when you hold cards but have no legal ask | `[attested-direct]` | `literature-rl` RULES.md; Winslow | — (implicit) | shipped (`forcedClaim`) |
| V27 | Turn | After an **incorrect** claim the turn goes to an opponent with cards | `[attested-direct]` (code) | `littplay` | none | gap |
| V28 | Turn | Who asks first: dealer / highest drawn card / fixed seat / random | `[attested-search]` + `[attested-direct]` | Deposit Genius (dealer); Bryn Mawr (high card); playfish (random) | — (seat 0, configurable) | implemented, differently |
| V29 | Turn | Miss passes the turn to the player asked | invariant | every source | — | invariant |
| V30 | Turn | Out-of-cards routing: **your choice** / lowest-seated teammate / back to the asker / "player on the left" | `[attested-search]` + `[attested-direct]` | pagat (choice); `literature-rl` (lowest seat); `amy-lei` (asker/left) | — (choice, row 20) | implemented as *choice* |
| V31 | Endgame | Whole team out → the other team claims everything, **without consulting** | `[attested-search]` + `[attested-direct]` | pagat; `playfish.io` README | — (§4) | implemented |
| V32 | Scoring | Most books wins; 4–4 is a tie | `[attested-search]` | pagat, Wikipedia, playfish | — (row 23) | implemented |
| V33 | Scoring | High (major) books score 2, low (minor) 1 | `[attested-search]` + `[attested-direct]` | Wikipedia, Deposit Genius, UltraBoardGames; playfish `highSuitsDouble` | **T5 `highBooksDouble`** | implemented |
| V34 | Scoring | Bonus point for the first book claimed | `[attested-search]` (single, weak source) | Deposit Genius | none | gap (low value) |
| V35 | Termination | [Game ends when a team reaches 5 books / a majority](#v35-first-to-five-ends-the-game) | `[attested-direct]` | `amy-lei/fish`, `playfish.io`, Litaf, `cfish` (>half of 9) | none | **gap — and it interacts dangerously with V18** |
| V36 | Scoring | "First to 100 points" / multi-deal match play | `UNVERIFIED` (probably erroneous) | gamerules.com | none | gap; treat the *format* question as real, the number as not |
| V37 | Match | 4–4 draw replayed with roles reversed; best-of-three | `[attested-search]` (weak) | cardrulesplus; gamerules | none | gap (match layer) |
| V38 | Information | Log depth: **everything** / last two / last action only | `[attested-search]` + `[attested-direct]` | pagat "History" rule; Bryn Mawr "no history"; `cfish` `LogRule` (3 levels, default `LAST_ACTION`) | **T10 `strictMemory`** (binary) | partial — no `LAST_TWO` |
| V39 | Information | [Hand sizes **secret** (only "out or not" is public)](#v39-secret-hand-sizes) | `[attested-direct]` | `cfish` `HandSizeRule`, whose redaction reveals zero but hides counts; a pagat extract says the same | none | **gap — large inference change** |
| V40 | Information | "How many cards do you have?" is a legal free question | `[attested-search]` | pagat extract | — (counts always public) | subsumed by default |
| V41 | Information | Announce your last card; announce and retire at zero | `[attested-search]` | Wikipedia house rules | **T4 `announceLastCard`** | implemented |
| V42 | Information | No written records, no aids | `[attested-search]` | pagat; every club source | — (no notes field) | implemented by omission |
| V43 | Information | Timed turns (20–30 s) | `[attested-search]` (weak source) | cardrulesplus | none | gap — the natural bot handicap axis |
| V44 | Information | "Silent Literature": no non-verbal communication at all | `[attested-search]` (weak source) | cardrulesplus; Grokipedia notes non-verbal cues are out of bounds | — | n/a for bots; matters for benchmark fairness |
| V45 | Information | **Memory bounded in bits**, with an eviction policy | `[attested-direct]` | Sanjay Kannan's framework spec (`wh_impl.txt`) + its `ActivePlayer` implementation | none | **gap — best difficulty knob available** (see [S44](#s44-bounded-memory-player)) |
| V46 | Procedure | The "pause button" — any player may halt play to think | `[attested-search]` | Bryn Mawr | none | n/a (async UI) |
| V47 | Information | Cards are transferred **face up** | invariant | pagat, gamerules, Deposit Genius | — | invariant — the whole deduction substrate |
| V48 | Procedure | Remedy for an illegal ask or a withheld card is decided ad hoc by the table | `[attested-search]` | pagat/gamerules extract | — (engine rejects illegal actions) | n/a |

### I.2 Variants with **no** toggle — the gap list

Ranked by how much each changes the game tree, and therefore by what it would cost the engine to be
wrong about it:

1. **[V17](#v17-any-error-scores-for-the-opponents) — any wrong claim scores for the opponents.** The
   most-corroborated variant in the entire catalogue and the one that most changes optimal play. See
   below; this is the single highest-priority addition.
2. **[V35](#v35-first-to-five-ends-the-game) — first to five (or majority) ends the game.** Changes the
   terminal test, truncates the endgame, and *combined with V18 it is an outright bug* (voids can make
   5 unreachable).
3. **[V23](#v23-the-challenge) — the Challenge.** Adds an entirely new action type available to every
   player at (nearly) every node, and makes beliefs about **opponent-only** books valuable, which they
   otherwise never are.
4. **[V39](#v39-secret-hand-sizes) — secret hand sizes.** Deletes the counting constraints that do much
   of the work in `knowledge.ts`, and correspondingly empowers concealment styles.
5. **[V2](#v2-sevens-out-ace-low-deck) / V5 — alternate book partitions.** Zero structural impact but
   they break every hard-coded rank test and any shared card encoding. The fix is to carry the
   partition as data.
6. **V10 / V11 — four players, or more than two teams.** Claim assignment space per book goes
   3⁶ = 729 → 2⁶ = 64 (4p) or 4⁶ = 4096 (8p); no belief representation sized for six seats transfers.
7. **V45 — bounded memory.** Not a folk rule but an *engineering* axis with an implemented precedent;
   it is the cleanest way to build a fair, tunable difficulty ladder.
8. **V19 `team-turn` mode, V38 `LAST_TWO`, V27, V34, V36, V37, V43.** Lower-value completeness items.

### I.3 Detail by axis

#### Deck and book construction

The 48-card, 8s-out deck is the dominant form everywhere — Canada, US campuses, Chennai and IIT
Madras, and every major rules page. Three genuine alternates exist.

##### V2 Sevens-out ace-low deck

The Indian "Lit" dialect removes the four **7s** instead of the 8s and runs the Ace **low**:
`Small Set = A 2 3 4 5 6`, `Big Set = 8 9 10 J Q K`. This is `[attested-direct]` from
`gyash24x7/littplay`, where the deck construction is unambiguous in code
(`deck.removeCardsOfRank("SEVEN")`), and the README states the two halves verbatim. A second,
independent engine encodes exactly this partition as its `CANADIAN` book type (`L`ow A–6 / `U`pper
8–K over a 48-card deck). pagat lists the same variation. **Do not state that "India plays sevens
out"** — the Chennai/IIT-Madras material uses 8s-out, and the sources conflict on which form is
"common in India". State only that the sevens-out/ace-low form is a real, implemented dialect.

*Engine impact:* pure relabelling — same 48 cards, same 8 books of 6, same branching factor. But it
breaks any `rank !== 8` test and any card-index encoding shared with a trained model. **Carry the
book partition as configuration data, never as a hard-coded rank filter.**

##### V4 Fifty-four cards and a ninth book

Play the full 52 plus two jokers; the four 8s stay in and, with the two jokers, form a ninth six-card
book ("eights and jokers"). Nine cards each at six players. Corroborated by pagat, Wikipedia, and at
least three implementations, one of which (`cjquines/cfish`) makes it the *default*.

*Engine impact:* the ninth book has **no suit and no rank order**, so suit-based inference — a strong
pruning signal — does not apply to it, and the "must hold a card of this book" test needs a special
case. Wikipedia's claim that nine books make ties impossible **is only true when the void rule is
off**: with V18 on, a book can still be nulled and 4–4 returns.

**V5** is the rarest and most surprising: a **52-card** deck with **unequal** books — minor `A–6`
(six cards) and major `7–K` (**seven** cards). It is `[attested-direct]` in Sanjay Kannan's framework,
whose `SETS()` literally lists seven-card majors, and pagat is reported to list a 52-card version with
7-card major sets. An engine that assumes `bookSize === 6` anywhere will not survive this variant.

#### Asking

Two rules are invariant across every source found, and can be hard-coded as inference axioms:
**you must hold a card of the asked book** (V14), and **transfers are face up** (V47). The only real
ask-rule variation is the bluff (V15, toggle T6), and it is the single most destructive variant in the
catalogue for a deduction engine: it converts `asker ∉ holders(card)` from a hard constraint into a
likelihood ratio. Both sources that describe it also record that most players reject it as making the
game "complicated and confusing"; every implementation that offers it ships it **off**.

#### Claiming — the contested centre

##### V17 Any error scores for the opponents

**This is not a source conflict.** pagat carries *both* rules: its baseline is "your team holds all
six but you state a location wrongly → the half-suit is cancelled and neither team gets it" (= this
repo's row 15), and its **Variations** section lists "some play that if your claim is incorrect in any
way, the half-suit counts for your opponents, even if the half-suit is in fact entirely held by your
team, and the only mistake is in stating wrongly which member of your team has which cards."

So the repo's row 15 correctly follows pagat's baseline. What is missing is a **toggle for the
variation** — and the variation is not marginal. It is the *default* at Bryn Mawr's Distressing Math
Collective, in `playfish.io`, in `amy-lei/fish` (which explicitly flags it as a deviation from
standard), in `cjquines/cfish` (`const scorer = correct ? team : 1 - team;`) and in `gyash24x7/littplay`.
One engine even exposes it as a named option, `harshDeclarations`, **defaulting to true**.

*Engine impact — large, and in the direction people get wrong.* Under V18 (void) a claim decomposes
into two independent risks: **containment** (wrong → opponents score) and **assignment** (wrong →
void, nobody scores). The assignment axis is a **free roll**. Under V17 both collapse into one and any
error gifts the book. The EV thresholds differ accordingly:

| Ruleset | EV of claiming (units: books to us minus books to them) | Claim iff |
|---|---|---|
| **V18 void (this repo's default)** | `c·a − (1 − c)` | **`c > 1/(1+a)`** — with `a = 1`, `c > 0.5`; with `a = 0.5`, `c > 0.667` |
| **V17 opponents-score-any-error** | `2·c·a − 1` | **`c·a > 0.5`** |

where `c = P(your team contains the book)` and `a = P(your assignment is exactly right | contained)`.
A solver tuned on V18 will **over-claim** under V17; a solver tuned on V17 will leave books on the
table under V18. This is why the club documents preach "100% or don't" while the pagat lineage
tolerates aggression — they are playing different games. **Expose it as a flag.**

##### V19 Claim timing

Three positions, not two. pagat and Wikipedia both say **on your own turn**. `cjquines/cfish` makes
**during any ask phase** the *default* and on-your-turn the option — the inverse of the baseline. And
one engine's config offers a third mode, `'team-turn'` (any member of the team whose turn it is may
declare), which appears in no prose source at all. Under anytime-declaring the engine must generate
legal moves for *every* player at *every* node, needs a simultaneity/priority rule that no source
specifies (one implementation resolves it as an explicit **race**, first responder wins), and gains a
genuine "claim now vs. gather one more fact" tension for **opponents**, not just holders.

##### V23 The Challenge

A player calls out the opposing team on one named book, forcing them into a defensive claim. The
prose sources (Winslow's rules page, echoed by the older Wikipedia text) state the mechanism and,
unusually, the **design rationale**: to "give incentive to keep some track of cards solely in the
other team's hands" and to "introduce the possibility of stealing suits through bluffing or brazen
probability."

This document upgrades the Challenge from `single-source` to **`[attested-direct]`**: `playfish.io`
implements it in full. Reading its server source, the mechanics are: challenge is legal only when it
is *not* your turn, before the current player has acted, and only if you hold cards; each member of
the challenged team then responds `pass` or `declare`; the first to answer `declare` **wins a race**
and must declare; if **all** challenged players pass, the **challenger** must declare the opposing
team's cards. That is a complete, implementable sub-game.

*Engine impact:* a whole new action type, plus a pass/no-pass sub-game, plus — uniquely — it makes
beliefs over **opponent-only** books valuable, which under the baseline they never are. It also
punishes the [Hoarder](#s23-hoarder) directly, and creates an exploitable read: a challenger is
advertising that they think they know the opponents' holdings.

#### Turn order and the endgame

The out-of-cards rules are where casual rule summaries lose the most content, and they contain two
real decision nodes: **which teammate inherits your turn when your own claim empties you** (row 20),
and **which opponent must claim out the endgame when your whole team is empty** (§4). Both are
choices in the pagat lineage and this repo; two implementations replace them with deterministic rules
(lowest-seated teammate; back to the asker / "player on the left"), which shrinks the action space and
removes the skill entirely. The whole-team-out endgame — one player claiming every remaining book
alone, without consulting anyone — is a clean, exactly solvable single-agent deduction sub-problem and
the natural first target for an exact solver.

#### Scoring and termination

##### V35 First to five ends the game

Three implementations plus one hosted service stop the game the moment a team reaches five books
(`cfish` generalises it to "more than half of `FISH_SUITS.length`", so 5 of 9). This is **only sound
when the void rule is off**: under V18 a team may never reach five, so a naive "first to 5" terminal
test can hang or mis-score. Note the internal consistency of the implementations that use it — they
pair first-to-five *with* V17 (no voids). A V18 + first-to-five mix is a latent bug. Beyond
correctness, first-to-five **truncates the endgame**, deleting the deepest, most information-rich part
of the game from any agent trained under it.

#### Information regime

##### V39 Secret hand sizes

`cjquines/cfish` exposes `HandSizeRule.PUBLIC | SECRET`, and its redaction logic is precise about what
SECRET means: **zero is still public** — you always know who is *out*, never how many cards the others
hold. A pagat extract reports the same table rule ("players must reveal if asked whether they have
cards or not, but do not have to reveal how many"). Note that the existence of the "announce your last
card" house rule (V41) is itself weak evidence that some tables do not show counts.

*Engine impact:* hand-size counts are a **major** inference channel — count exhaustion and count
forcing do a large share of the propagation in this repo's `knowledge.ts`. Under SECRET you drop the
cardinality constraints but keep the `count > 0` bit, deduction weakens sharply, and the concealment
styles ([S3](#s3-the-cloak), [S15](#s15-lightning-rod), [S23](#s23-hoarder)) all get stronger.

**Log depth (V38)** is the other half of the information regime and arguably the most consequential
rule in the whole catalogue for AI-vs-human comparability. Bryn Mawr's "no history" rule is strict:
the table remembers only the most recently asked question, and players may not ask about any earlier
question — *not even to clarify which card was asked for or whether it was received*. `cfish`
generalises this to three levels and defaults to `LAST_ACTION`. This repo defaults to the full log
(SPEC §11.1) with T10 for purists, which is a defensible product decision, but be clear about what it
does: **it removes the memory dimension of the game entirely**, and with it every memory-based
archetype in [Part IV](#part-iv--memory-and-deduction-styles). A perfect-recall bot playing against
humans under a no-history table rule is not playing the same game they are.

---

## Part II — Strategic play styles

### II.0 The three maxims every style is built on

**M1 — The information-asymmetry maxim** `[attested-search]`. The most-repeated sentence in the
literature: *"The best strategy for a player is to emit as much information as possible to his
team-mates while simultaneously emitting as little information as possible to his opponents. Thus good
strategy consists not only of asking for some cards that one needs, but not prematurely divulging the
existence of all half-suits they have."* (Wikipedia lineage, mirrored on several sites.) Note its
internal contradiction: **teammates and opponents receive the identical public signal.** There is no
private channel. So M1 is not directly achievable, and every real convention is an attempt to
manufacture an *asymmetric decoding advantage* — signals partners can decode because of shared private
context (what they hold) that opponents lack.

**M2 — The turn is the scarce resource** `[attested-search]`, via blackballing and the
stalemate-breaker. A miss transfers the turn **to the player you asked**, so on every failed ask *you
choose who plays next*. Turn allocation is a first-class decision on every ask, independent of the
card sought. An engine that treats a miss as a uniform penalty is misplaying the game.

**M3 — Deduction from non-asks** `[attested-search]`: *"you must also make inferences on each player's
hand through the questions they ask **and don't ask**"* (Cornell Daily Sun). Silence is evidence. This
is the Literature analogue of Hanabi's "if it were X, they would have clued it," and no implementation
found does it.

### II.1 Information doctrine

#### S1 Signal Broker
*Aliases: information-maximizer, the broadcaster.* **Evidence:** `[attested-search]`.
**Definition.** Treats every ask as primarily a message to partners and only secondarily as an attempt to win a card.
**Description.** Accepts the symmetric leak as the price of turning three private hands into one team model. Favours asks that resolve the largest number of *partner-relevant* unknowns; will spend a turn on a low-probability ask when either outcome collapses a big chunk of shared belief; avoids "silent" turns that teach the team nothing. This is M1 read as a mandate to emit.
**Triggers.** Early to mid game; diffuse team belief; a hand of scattered singletons with no natural run to press.
**Strengths / weaknesses.** Builds a coherent team map fast and enables early coordinated claims; beats hoarders and memory-limited opponents. But the leak is symmetric — three opponents learn what two partners learn — and it burns turns.
**Counter-play.** Out-remember them and harvest the map they build. Blackball them so nobody can act on the broadcast. Claim the books they illuminate before their team consolidates.
**Observable signature.** High ask entropy: `distinct_books_entered / total_asks` well above baseline, elevated rate of *first entries* into new books, `hit_rate` **below** baseline (they accept misses for information), and asks that are a-priori low-probability given the public log.
**Engine mapping.** An explicit `+w_info · ΔH_team` term in ask evaluation, computed per-observer. Model such an opponent with a high info-weight parameter and predict their asks by maximising team-entropy reduction rather than hit probability.
**Sources.** Wikipedia / pagat / Grokipedia extracts of the M1 passage.

#### S2 Prohibitionist
*Aliases: information-denier, the silent school.* **Evidence:** `[attested-search]`.
**Definition.** Plays only value-maximising asks and refuses to spend anything on signalling, on the grounds that the information trade is structurally unfavourable.
**Description.** The direct opposite of S1 and the other half of the same quoted maxim: *"not prematurely divulging the existence of all half-suits they have."* The sharpest formulation in the corpus is Develin's sober caveat — the opponents learn exactly as much as your partners do, and there are three of them and two of you. Distinct from [S40](#s40-convention-prohibition), which is a *rule* banning prearranged conventions rather than a style choice.
**Triggers.** Default posture against strong, attentive opponents; any table where opponents demonstrably track the log.
**Strengths / weaknesses.** Never feeds the opposition; forces them to work for every inference. But it under-coordinates: your partners cannot claim books they cannot locate, and `a` (assignment confidence) is the term conventions exist to raise.
**Counter-play.** Nothing to decode, so beat them on tempo and on claim EV instead: contain books they never learn about, and force the endgame while their team map is still fragmented.
**Observable signature.** Ask distribution tightly concentrated on high-`p_hit` cards; near-zero `provably_dead_asks`; hit rate above baseline; very few first-entries into new books.
**Engine mapping.** The same evaluation as S1 with `w_info ≈ 0`. **These two archetypes are one tunable parameter**, which is exactly why self-play should be able to settle the schism empirically per game phase.
**Sources.** Wikipedia/pagat extracts; Develin via this repo's `/strategy` corpus.

#### S3 The Cloak
*Aliases: lie low, the camper.* **Evidence:** `[attested-search]`.
**Definition.** Suppresses asks in the books you actually hold, to avoid advertising them, then harvests the whole book in one burst.
**Description.** *"Sometimes it can be best to lie low and gather as much information as possible before you begin asking for certain cards, so you can get as many as possible in a single turn and possibly claim the book before ever revealing you have them"* (Deposit Genius); *"the ideal way to play is to get cards without the other team noticing what suit you are working on"* (Cornell). Prefers asks in books where you hold a *token* card over books where you hold a near-run.
**Triggers.** Opening phase; holding a long run in one book; a dangerous opponent seated and paying attention.
**Strengths / weaknesses.** Denies opponents the chance to blackball your real project or to counter-claim; sets up burst turns. But it concedes tempo, your **teammates** also cannot see what you hold (so team claims are late and the team can compete with itself), and you can be drained of the very book you were hiding.
**Counter-play.** Track counts and non-asks (M3): a player with many cards who never enters a book is the prime suspect for holding it. Probe them in untouched books. Or simply take the turn away from them.
**Observable signature.** Low ask rate per turn held; asks concentrated in books where they later prove to hold only one card; then a late, sudden burst — three or more hits in one turn in a book they had never previously entered — followed immediately by a claim. Statistics: `books_held_at_claim_never_previously_asked`, and `latency_from_first_hold_to_first_ask` per book.
**Engine mapping.** A **concealment prior** in the belief model: never assume a player lacks a book merely because they never asked in it; weight that inference by their measured concealment tendency. For our own play, an evaluation penalty on asks that reveal a book where we hold ≥3 cards, scaled by opponent modelling strength.
**Sources.** Deposit Genius strategy page; Cornell Daily Sun; the M1 passage.

#### S4 Known-Negative Ask
*Aliases: the deliberate failed ask, the free miss.* **Evidence:** `[attested-search]`; the noun is `[coined]`.
**Definition.** Deliberately ask for a card you already know the target does not hold, purely to transmit information.
**Description.** *"Sometimes it is correct to ask questions to which you already know that the answer is no in order to give your teammates more information"* (pagat). The ask is a **pure message**: you knowingly forfeit the turn, and what you transmit is (a) the mandatory certification "I hold ≥1 card of this book" and (b) the *choice* of card and target, which under a convention encodes more. Literature's closest analogue to a bridge signal-discard or a Hanabi clue that gives no cards. Deposit Genius adds a second motive: it lets you make progress without alerting a dangerous opponent.
**Triggers.** You cannot make material progress this turn anyway; every productive ask would alert a dangerous seat; the turn needs parking on a specific opponent; a partner is one fact away from a claim.
**Strengths / weaknesses.** Buys team certainty for one turn — very strong under the void rule, where certainty unlocks a free-roll claim. But it is pure tempo loss and it broadcasts the book to opponents too; it only pays if a partner can act on it.
**Counter-play.** **Do not update naively.** The asker chose that card *because* it was a known miss, so the miss is not evidence about the target's hand in the usual way. Then decline to be a useful turn-recipient: make an unhelpful ask back.
**Observable signature.** The cleanest detector in the game: an ask is known-negative when the public log already entails that the target lacks that card. Statistic `provably_dead_asks / total_asks`. A novice's rate is ~0 (they don't know); a memory-limited player's is >0 but *unintentional*; an expert's is deliberate and correlates with a partner claiming shortly after. Separate intentional from accidental by whether the player has ever made an inference-only correct claim.
**Engine mapping.** **The ask generator must not prune provably-failing asks.** A naive engine prunes them as dominated; they are not. Score as `V(ask) = p·V_hit + (1−p)·[V_turnflow(target) + w_team·ΔH_team]` — with `p = 0` the ask still scores through the second bracket. As an opponent feature, `provably_dead_asks` is a strong expertise classifier.
**Sources.** pagat; Deposit Genius. In this repo: `signallingAsk()` in `decide.ts` is a restricted version — hard tier only, and only once every legal ask is a known miss.

#### S5 Confirmation Ask
*Aliases: the certain hit, free tempo.* **Evidence:** `[inferred from rules]`; the name is `[coined]`.
**Definition.** Ask for a card whose holder you already know with certainty, to take it for free while revealing nothing new.
**Description.** A guaranteed hit keeps the turn with probability 1 and adds no new public information about the target (everyone already knew), while physically consolidating the book into your hand. Under the void rule, pulling cards into your own hand drives assignment risk for those cards to **zero**, which is material value, not just tempo.
**Triggers.** You need to stay on turn to reach a claim but every exploratory ask would leak; or the endgame approaches and concentrating a book makes the claim assignment trivially safe.
**Strengths / weaknesses.** Riskless progress. But it does reveal *that you hold the book* if you had not already shown it, it tells opponents you have knowledge, and it spends a known card that might have been worth more left in place (as a banked asset, [S20](#s20-stalemate-breaker)).
**Counter-play.** Read it as what it is — the player is spending known information and is close to a claim. Claim first if you can; otherwise blackball them before their next turn.
**Observable signature.** Asks with 100% log-entailed hit probability: `provably_certain_asks / total_asks`. **Two or more certain asks in one book is a near-perfect claim predictor** — flag it.
**Engine mapping.** Two uses: move ordering (certain hits are the safest turn extension — this repo already sorts them strictly first via the `+20` certainty bonus in `rankAsksWith`), and a **claim-imminence detector** for the opponent model, where `P(opponent claims book B next turn)` should spike on observing certain asks in B.
**Sources.** Derived from `RULES.md` rows 6–9. Implemented in `knowledge.ts`/`decide.ts`.

#### S6 Zero-Downside Ask
**Evidence:** `[attested-search]` (Develin, via this repo's `/strategy` corpus).
**Definition.** Ask inside a book your team already wholly holds: the ask reveals nothing an opponent can use.
**Description.** The cheapest way to signal or to shed a turn. Because the book is already yours, the certification "I hold this book" costs nothing, and the opponents cannot act on it even in principle. Under this repo's ruleset the idea has a much stronger form — see [S19](#s19-contained-book-exit), where the ask is not merely cheap but a **guaranteed, renewable, aimable miss**.
**Triggers.** Any turn where you want to transmit or to hand the turn somewhere specific without paying an information price.
**Strengths / weaknesses.** Strictly dominates the generic known-negative ask ([S4](#s4-known-negative-ask)) on the leak axis. It requires actually holding a contained book, and it burns the turn.
**Counter-play.** Recognise that the asker has a contained book and count it out of the remaining distribution — the ask still tells you *which* book is gone.
**Observable signature.** Repeated asks into a book the log already shows to be contained by the asker's team, always missing, never followed by material progress in that book.
**Engine mapping.** Compute the `information leakage = 0` set explicitly and prefer it whenever the engine wants a cheap exit. See [S19](#s19-contained-book-exit) for the exact predicate.
**Sources.** Develin, via `src/learn/strategy-content.ts` (`corpus`).

#### S7 Chain Discipline
*Aliases: sequencing hygiene.* **Evidence:** `[attested-search]`; the name is `[coined]`.
**Definition.** Spread asks across targets and books, because consecutive asks at one seat leak superlinearly.
**Description.** *"If you fail to get a card from a player and then ask them for another card, you're giving everyone a lot of information, making it likely that one of their opponents is 'dangerous' since so much information has been revealed"* (Deposit Genius). The repo's existing corpus states the same idea in its sharpest form: fail-ask a player for the 2, then later ask the same player for the 3, and the table reads you as holding the book but neither card. The corollary advice is to **exhaust all opponents on one card before switching cards**.
**Triggers.** After any miss; whenever several books are live.
**Strengths / weaknesses.** Flattens the emitted information and keeps your hand shape ambiguous. Sometimes inefficient — occasionally the same target really is right twice.
**Counter-play.** Bait it: hold a book so that the natural continuation is a second ask at you.
**Observable signature.** `same_target_consecutive_ask_rate` and `same_book_consecutive_ask_rate` within a single turn. Disciplined players show markedly low values; greedy and novice players cluster.
**Engine mapping.** Penalise the **cumulative** opponent-side entropy reduction across a turn, not per ask; because the leak compounds, the penalty should be **convex** in asks-per-book-per-turn.
**Sources.** Deposit Genius; pagat via `/strategy` corpus.

#### S8 The Echo
*Aliases: the ask-back.* **Evidence:** `[attested-search]`.
**Definition.** When an opponent asks you for a card in a book where you hold others, ask them back in that book.
**Description.** Their ask proved they hold at least one card of the book (V14 is invariant), so they are a known-positive target. The cost: your reply reveals your second card of the book. Note the deeper point behind it — **being asked is informationally profitable for you**, because the asker must certify a holding to do it.
**Triggers.** Immediately after being asked in a book where you hold ≥2 cards.
**Strengths / weaknesses.** Cheap, high-yield inference. It does advertise your own depth in that book.
**Counter-play.** Anticipate the echo when choosing whom to ask; prefer targets who cannot profitably echo.
**Observable signature.** `P(ask into book B by player X | X was just asked in B)` well above base rate.
**Engine mapping.** Already implicit in a correct constraint model (the asker's certification is recorded), but worth an explicit move-ordering bonus: an opponent who just asked in book B is the highest-probability target in B.
**Sources.** Develin and Deposit Genius, via `/strategy` corpus.

#### S9 Teammate Re-ask
**Evidence:** `[attested-search]`.
**Definition.** Ask for the exact card your partner just failed on, from a different opponent.
**Description.** Their failed ask proved they hold the *book*, not that card — so the card sits with strictly fewer possible holders, and your ask has elevated odds. It doubles as a confirmation to your partner that you also hold the book. Under the Salahuddin convention ([S36](#s36-ali-salahuddin-convention)) this exact move is the **coded denial** ("I don't have it, but I have the book"), so at a convention table it is not a free action.
**Triggers.** Right after a teammate's failed ask in a book you also hold.
**Strengths / weaknesses.** Higher-than-baseline hit probability at no extra leak. At a convention table it transmits a specific message you may not intend.
**Counter-play.** Model it: after a partner's miss, the remaining opponents' probability of holding that card rises for everyone, including you.
**Observable signature.** `P(ask for card c by partner | partner's teammate just failed on c)` above base rate — and, critically, this is one of the two branches the Salahuddin detector must distinguish.
**Engine mapping.** Falls out of correct constraint propagation. Explicit value: it is a cheap, high-EV ask *and* a convention-bearing one — the engine must know which meaning is active.
**Sources.** Develin via `/strategy` corpus; pagat (Salahuddin encoding).

#### S10 The Bluffer
*Aliases: self-ask.* **Evidence:** `[attested-search]`. **Variant only — requires T6 `askOwnCardAllowed`.**
**Definition.** Ask for a card in your own hand to poison the opponents' deductions.
**Description.** *"A variant played by some advanced players is to allow people to ask for cards they already possess, in order to confuse opponents"* (Wikipedia). It destroys the single most reliable inference in the game — "the asker does not hold the asked card" — so every deduction chain resting on that axiom becomes probabilistic.
**Triggers.** T6 tables only; used when a dangerous opponent's deduction is the main threat.
**Strengths / weaknesses.** Collapses opponent certainty and can manufacture false "known" cards in their model, inducing catastrophic mis-claims (under [V17](#v17-any-error-scores-for-the-opponents) an induced mis-claim gifts you the book — a devastating trap). But it poisons your **teammates'** model identically, unless the team has a meta-convention for when bluffs are on. Both sources describing it also record that most players reject it.
**Counter-play.** Downgrade `asker ∉ holders(card)` from a hard constraint to a likelihood ratio and keep hypotheses where the asker holds it. Then check containment carefully before claiming books they bluffed into.
**Observable signature.** Detectable only retroactively, when a reveal shows a player held a card they previously asked for: `self_ask_violations`. Under default rules this statistic is 0; any positive value proves T6 is on or the player is cheating. Secondary tell: unusually high ask diversity with unusually low hit rate.
**Engine mapping.** Build the constraint layer with **pluggable hardness from day one** — under T6 the asker-lacks-card clause must degrade from hard to soft rather than being deleted. This repo already threads the toggle through `buildKnowledge` (`ownCardToggle`), which is the right shape; what is missing is the probabilistic bluff-rate model on top.
**Sources.** Wikipedia; pagat variations; `cfish` `BluffRule`; `playfish.io` `bluffQuestions`.

#### S11 Poisoned Handoff
**Evidence:** `[attested-search]`; the name is `[coined]`. **Variant only — requires T6.**
**Definition.** Dump your team's last card of a book onto the least-informed opponent, forcing them to guess the whole book.
**Description.** pagat describes the line in full: *"It is your turn and you have the only card held by your team. You do not know where the cards of this set are, but you are fairly sure that the opponents do not know either. So you select the opponent who you judge has least information and ask this player for the card you hold yourself. You then surrender your card to this player, forcing him or her to guess the location of all the remaining sets."* A deliberate material sacrifice to transfer epistemic burden.
**Triggers.** You hold your team's only card of a book you cannot win, and you judge one opponent to be the worst informed.
**Strengths / weaknesses.** Converts an unwinnable book into a coin flip the opponents must resolve, and hands it to their weakest link; also frees you from a losing book. But you give away a card and the turn, and if you misjudge you have simply completed their book.
**Counter-play.** Do not accept the framing: a lone card arriving in a book is a signal that the giver had no information, which itself narrows the book to your side.
**Observable signature.** A player asks for and receives a card they later prove to have already held. Under default rules the structurally analogous legal move is: a player's last card of a book is taken and they had conspicuously declined to defend it.
**Engine mapping.** Illegal at default (T6 off). The **legal analogue** is [S29](#s29-endgame-dumping) plus deliberate shedding — using asks and claims to empty yourself of a doomed book. Model as minimising `E[opponent claim EV]` by redistributing cards toward the least-informed opponent.
**Sources.** pagat.

#### S12 Least-Informed Targeting
**Evidence:** `[attested-search]`.
**Definition.** Aim risky or leaky asks at the opponent judged to know the least.
**Description.** The general principle behind [S11](#s11-poisoned-handoff), and the natural partner to [S14](#s14-turn-parking): if an ask will probably miss, the turn should land on the seat least able to use it, and if the ask leaks, it should leak toward the seat least able to exploit it. Requires a per-opponent *information* estimate, which is second-order belief ("who at this table knows least?").
**Triggers.** Any ask with `p_hit` well below 0.5; any ask that must reveal a book you care about.
**Strengths / weaknesses.** Cheap and always available. It is self-defeating over time — the designated dump target becomes better informed with every gift.
**Counter-play.** [Play possum](#s21-playing-possum): look uninformed so you remain the designated recipient, then convert.
**Observable signature.** `E[target_information | miss]` significantly below `E[target_information | hit]` for that player.
**Engine mapping.** Requires `knowledge_score(seat)` — the deduction the public log affords a seat given their certified holdings and count. Build it once; it feeds `Danger()` in [S13](#s13-blackballing) and `V(opponent on move)` in [S14](#s14-turn-parking).
**Sources.** pagat (within the bluff line); Deposit Genius.

---
### II.2 Turn-flow doctrine

#### S13 Blackballing
*Aliases: locking someone out, turn starvation.* **Evidence:** `[attested-search]` — the flagship named archetype.
**Definition.** Never ask the dangerous opponent, so the turn can never reach them.
**Description.** *"One of the most important strategies is to keep control of the game away from dangerous opponents. You can prevent this player from making or claiming the book by never letting them have a turn. To do this, you simply never ask them for a card. So long as your teammates are paying as much attention as you, blackballing is a very effective strategy for Literature"* (Deposit Genius). "Dangerous" is defined in the same source as **cards × knowledge**: *"a player on the other team who might have a dangerous mix of cards and knowledge that will allow them to clean your team out of a half-suit and make an easy claim."* This is a **team-level protocol, not an individual move** — the quote explicitly conditions its effectiveness on all three teammates observing it. That makes it the game's clearest *emergent* convention: an unspoken agreement enforced entirely by shared inference about who is dangerous. Develin's blunt version, in this repo's corpus, is that deliberately keeping the turn away from the other team is central strategy — and that mutual blackballing between two strong teams is exactly what produces deadlocks.
**Triggers.** As soon as one opponent's public record shows both established holdings in a book your team contests **and** demonstrated deduction ability. Also fires on whoever most recently made a strong claim.
**Strengths / weaknesses.** Can neutralise the opposition's best player for a whole game — the classic answer to a carry. But it shrinks your target set from 3 to 2, which makes your asks more predictable and forces worse-EV asks; it fails if **any one teammate defects**; and it cannot stop the target being handed the turn from inside their own team ([S20](#s20-stalemate-breaker), row 20 pass).
**Counter-play (as the blackballed player).** Look safe: stop asking in your strong books and let your visible knowledge go stale. Get the turn from your own side via a teammate's stalemate-breaker claim. Or make yourself unavoidable — keep exactly one card of a book the opponents desperately need. Going fully empty is *not* a counter (you cannot be asked anyway), it is a concession.
**Observable signature.** The most measurable style in the game. Per (asker, target) pair, compare actual asks to asks expected under a danger-blind model. Statistic: `target_share[p]`, the fraction of a team's asks aimed at opponent `p`. Blackballing shows as `target_share` collapsing toward 0 for one opponent **across all three attackers simultaneously**, and — the key tell — **persisting even when that opponent is the most likely holder** of the card sought. Look also for strictly dominated asks (lower `p_hit`) that avoid the dangerous seat, and track **onset time**: it starts right after the target demonstrates strength.
**Engine mapping.** Two pieces. (a) *Evaluation:* `− w_danger · Danger(target) · (1 − p_hit)` on every ask, with `Danger(p) = f(cards_held(p), knowledge_score(p), books_contested_with_us(p))`. (b) *Coordination and self-modelling:* the shared `Danger` vector **is** the team's implicit convention; for a bot team it can be explicit shared state. The engine must also detect **being** blackballed — its own inbound-ask rate collapsing — and switch to the counter-play repertoire.
**Sources.** Deposit Genius; Wikipedia/Grokipedia extracts; Develin via `/strategy` corpus (`corpus` — the app's `/strategy` page already has a "Lockout & blackballing" section).

#### S14 Turn-Parking
*Aliases: safe-miss targeting.* **Evidence:** `[inferred from rules]`, with the sibling idea `[attested-direct]` in a bot's design notes (*"Asking less risky players"*).
**Definition.** On an ask that will probably miss, choose the target so the surrendered turn lands where it does least damage.
**Description.** M2 made concrete. Since a miss gives the turn to the person you asked, target selection on low-probability asks is really **next-mover selection**. Park the turn on the opponent with the fewest cards, the least demonstrated knowledge, only resolved or void books, or no productive continuation. The natural complement to blackballing: blackballing says who *not* to give it to, parking says who to give it to instead.
**Triggers.** Any ask with `p_hit < ~0.5`; always on a deliberate known-negative ask.
**Strengths / weaknesses.** Converts a wasted turn into a controlled handoff. But the safe opponent gets better informed over the game — repeated parking manufactures a new dangerous player — and it is predictable enough to be exploited by a possum.
**Counter-play.** [Play possum](#s21-playing-possum), or run yourself low on cards to become un-askable and force them to park elsewhere.
**Observable signature.** On **misses**, the target distribution skews to low-count, low-knowledge opponents in a way the distribution on **hits** does not. Statistic: the gap between `E[target_danger | miss]` and `E[target_danger | hit]`; also `corr(p_hit_estimate, target_danger)` should be **positive** for a parker (they only risk dangerous targets on near-certain asks).
**Engine mapping.** The `V(opponent on move)` term of M2: on the miss branch, the node value is the negated value of the *chosen* opponent's position — negamax with a chosen successor. This means **target choice must be searched, not fixed heuristically**. This repo has a shadow of it: `hardPickAsk` breaks ties among known-miss asks by handing the turn to the opponent with the fewest cards.
**Sources.** `RULES.md` row 10; `TaranKamireddy/LiteratureBot` `notes.txt` (`[attested-direct]`); `decide.ts`.

#### S15 Lightning Rod
*Aliases: card magnet.* **Evidence:** `[attested-search]`; the name is `[coined]`.
**Definition.** Deliberately hold a large hand so opponents ask *you* instead of your teammates.
**Description.** *"A player with a large number of cards is more likely to be asked questions by opponents, discouraging them from asking your teammates who may actually have the cards being asked for"* (Deposit Genius). A big hand is a **decoy** that attracts the opponents' probability mass; every ask spent on you is an ask not spent discovering your partners' holdings. And being asked is informationally *profitable*: the asker must certify a book and, on a miss, hands you the turn.
**Triggers.** Mid-game, when your partners hold the team's real assets and you can afford to absorb probing.
**Strengths / weaknesses.** Shields partners' hands and converts inbound asks into free information. But a big hand is also a big target for a well-informed opponent, and hits genuinely drain you.
**Counter-play.** Refuse the bait — ask the *small*-handed opponents, where a hit is more diagnostic and the search space is smaller. Or convert against the magnet using certain asks only.
**Observable signature.** `cards_held` trajectory flat or rising into mid-game with `books_claimed == 0`, and a high `inbound_ask_share`.
**Engine mapping.** Hand size must be a **non-monotonic** evaluation term. Naive engines treat cards as pure material (more is better) or pure liability. The truth is a tuned interior optimum over (a) ask-rights breadth, (b) decoy value, (c) drain exposure — plus a separate `inbound_ask_attraction` term used when evaluating *teammates'* safety.
**Sources.** Deposit Genius.

#### S16 Foot-in-the-Door
**Evidence:** `[inferred from rules]`; the name is `[coined]`.
**Definition.** Your last card of a book is not material — it is the *licence* to ask in that book. Never spend it.
**Description.** `RULES.md` row 6 requires holding ≥1 card of a book to ask in it. Cards are only *gained* by asking. Therefore losing your last card of a book **permanently** locks you out of it: you can never legally ask in it again, and can participate only as a claim assignee. **This is a one-way door and the most under-appreciated constraint in the rules.**
**Triggers.** Whenever choosing which book to press — pressing a book where you hold one card risks nothing material but everything optional. (You cannot refuse when asked; the door closes without your consent.)
**Strengths / weaknesses.** Recognising it makes you value singleton keys correctly. Over-valuing them makes you passive and unable to contest anything.
**Counter-play.** The offensive form is [S17](#s17-key-stripping).
**Observable signature.** Players who understand it avoid burning their last card of a book on a speculative claim and avoid asks that expose the key.
**Engine mapping.** `OptionValue(seat, book) = 1[holds ≥1 card] · V(future asks in book)` — a distinct evaluation term, plus a self-preservation penalty on lines that leave us at one card in a contested book.
**Sources.** Derived from `RULES.md` rows 5–7.

#### S17 Key-Stripping
*Aliases: targeted voiding, lockout ask.* **Evidence:** `[attested-search]` (as "targeted voiding", in this repo's `/strategy` corpus, attributed to pagat); independently derived `[inferred from rules]` by the strategy pass, which named it.
**Definition.** Take an opponent's last card of a book to lock them out of it permanently.
**Description.** The attacking mirror of [S16](#s16-foot-in-the-door): *"Strip an opponent's last card of a half-suit and they can never legally ask into it again — you have locked them out of the book even though its cards are still in play."* The move costs nothing — it is a hit, so you keep the turn — and it permanently removes a player from a contest. Its value is the **option value you destroy**, which can far exceed the card's material value.
**Triggers.** Whenever the log proves a target's holding in a live book is down to one card and you hold a card of that book.
**Strengths / weaknesses.** Free tempo plus permanent denial. It does tell the table you are counting that precisely.
**Counter-play.** Hide your last-card status: avoid asks that would prove your book holding has shrunk to one; keep the count ambiguous.
**Observable signature.** `lockout_asks` — hits on a target's provably-final card of a live book, especially when the asker had better material asks available.
**Engine mapping.** Add `key_strip` to the tactical move generator and score it explicitly against the option value destroyed. This is a *generated move class*, not just a scoring tweak: a naive generator will find these asks but price them as ordinary hits.
**Sources.** pagat via `src/learn/strategy-content.ts` ("Targeted voiding"); `RULES.md` row 6.

#### S18 Turn-Terminator
*Aliases: the deliberate miss, the pass surrogate.* **Evidence:** `[inferred from rules]`; the mechanism is attested via [S4](#s4-known-negative-ask).
**Definition.** End your own turn on purpose, because continuing would leak more than it gains.
**Description.** There is no pass in Literature — you must ask, and asking leaks — but you *can* choose to miss. A player on turn with nothing safe to do converts the forced action into a controlled exit: pick a known-negative ask, in a book that is already fully public so the certification costs nothing, aimed at the safest opponent. **Constructing the cheapest possible exit is a real skill**, and it is a constrained optimisation the engine can solve exactly.
**Triggers.** On turn holding a strong hidden book you do not want to reveal; on turn when every productive ask would alert a dangerous opponent; when you want a specific opponent to move next.
**Strengths / weaknesses.** Minimises the compounding leak of a long turn; often correct for [The Cloak](#s3-the-cloak). It gives up tempo entirely, and an engine that over-uses it stalls the game.
**Counter-play.** When you receive the turn from an obvious terminator ask, infer that the giver had something to hide, and mark them as a concealment suspect for the books they *didn't* enter.
**Observable signature.** Asks that are simultaneously (a) provably dead, (b) in a book with no remaining hidden information, and (c) aimed at the lowest-danger opponent. The conjunction is the fingerprint. Statistic: `cheap_exit_asks` — asks in the bottom decile of both `p_hit` and `opponent_info_gain`.
**Engine mapping.** A **null-move candidate at every node**: `argmin over legal asks of opponent_ΔH`, subject to target ∈ safe set. Cache it. [S19](#s19-contained-book-exit) gives an exact, zero-cost solution whenever one exists — check for that first.
**Sources.** Derived from `RULES.md` rows 5–10.

#### S19 Contained-Book Exit
**Evidence:** `[inferred from rules]` — derived, not sourced. The strongest form of [S6](#s6-zero-downside-ask).
**Definition.** A book your team fully contains supplies a permanent, renewable, zero-information-cost, freely aimable way to end your turn.
**Description.** Combine two facts. (i) If your team holds all six cards of book B, no opponent holds any card of B, so **any** ask you make in B against **any** opponent is a *guaranteed* miss. (ii) Once containment is publicly deducible, that ask leaks nothing new — the certification "I hold a card of B" is already common knowledge. Therefore every banked, contained book is a pass move you can play **every turn**, aimed at **whichever opponent you choose**. It composes directly with [Turn-Parking](#s14-turn-parking), and it is a strong extra argument for hoarding over snap-claiming: **claiming a book destroys your best pass move.** No source states this; it follows from `RULES.md` rows 5–7 plus the containment argument in [S23](#s23-hoarder).
**Triggers.** Any turn where the best available action is to hand the turn somewhere specific at minimum cost, and your team contains at least one unclaimed book.
**Strengths / weaknesses.** The cheapest exit in the game, and it is renewable — the miss does not consume anything. It requires an unclaimed contained book, so it trades directly against banking the score.
**Counter-play.** Count the contained book out of the distribution and race on tempo; you cannot attack the book itself.
**Observable signature.** Repeated dead asks into a single provably contained book, aimed at varying opponents, with no material progress.
**Engine mapping.** Compute `Contained(book, team)` at every node (it is cheap and already needed for claim gating) and, when a cheap exit is wanted, take the ask from a contained book aimed at the lowest-value successor. Concretely for this repo: extend `signallingAsk()` — which currently picks the book it holds *most* of — to prefer a **contained** book when one exists, since that ask is strictly cheaper on the leak axis.
**Sources.** `RULES.md` rows 5–7, 11–15.

#### S20 Stalemate-Breaker
**Evidence:** `[attested-search]` — a genuine community term and the canonical named team convention.
**Definition.** Bank a claimable book unclaimed, then cash it later purely to transfer the turn to a stuck teammate.
**Description.** *"A common strategy adopted is the 'stalemate-breaker'. If the members of a team come to the conclusion that all the cards in a set are all held by their own team and they can correctly attribute them, they don't declare the set immediately. This set is kept as a stalemate-breaker. If at a later point in the game a player in the team is at the verge of finishing a set … but is unable to do so because he does not get a turn, the stalemate-breaker is used. One of his team-members can declare the stalemate-breaker set when he gets the turn and pass the turn to him"* (Wikipedia lineage). **This is the direct, canonical counter to [blackballing](#s13-blackballing)**: blackballing denies the turn from outside; the stalemate-breaker manufactures one from inside. The two are the game's central strategic dialectic.
**Mechanical caveat for this ruleset** `[inferred from rules]`. The quoted "declare and pass the turn to him" maps onto `RULES.md` **row 20 — you only choose a teammate if the claim empties your own hand.** Row 17 says the claimant's turn otherwise simply continues. So under the pinned defaults the classic stalemate-breaker works cleanly **only** when the banker's claim uses their last cards (triggering `awaitPass`), or under toggle **T7 `declarerChoosesNext`**. Otherwise the convention degrades: the claiming teammate keeps the turn and cannot act on the stuck player's private knowledge (no consultation is permitted). **A team can still engineer it** by arranging for the banker to hold *only* that book's cards, so the claim empties them. This is a real and easily-missed ruleset interaction.
**Triggers.** A team-contained book is identified **and** a teammate is demonstrably locked out **and** that teammate has near-complete knowledge of a *different* book.
**Strengths / weaknesses.** Breaks lockouts and converts a safe asset into tempo exactly when tempo is priceless. The narrative sources warn of decay risk — that a banked book can be broken up before you cash it — but see [S23](#s23-hoarder): **under this ruleset the decay risk is zero**, which makes banking far stronger than the sources imply. The real cost is the race: banking defers score while the opponents bank points.
**Counter-play.** **Probe for banks** — a team that has stopped asking in a book it clearly holds is banking. Under most rulesets you attack that book directly; **under this repo's rules you cannot** (containment is absorbing), so the counter is tempo and blackballing the banker so their bank never converts. Also: do not blackball so obviously that you telegraph the need for a breaker.
**Observable signature.** (a) A book the log establishes as team-contained, in which that team then makes **zero asks for many turns** while acting elsewhere. (b) The cash-out is dramatic: a claim by a player who has not been asking in that book, immediately followed by a *different* teammate claiming a *different* book. Statistics: `banked_book_turns` (turns between provable containment and claim), and the sequence `claim(A) by seat i → claim(B) by seat j≠i within one turn`.
**Engine mapping.** A **claim-timing** term that is not "claim ASAP". Model each contained book as an option with intrinsic value (1 book), decay risk (`0` under this ruleset — see S23), and exercise value (the tempo it buys). Evaluate hold-vs-claim as a real option. In search, "claim book B" must be a legal move even when a *different* book is the objective, because its value flows through the turn transfer. For opponent modelling, `banked_book_turns` measures a team's claim-patience parameter directly.
**Sources.** Wikipedia lineage; gamerules; `RULES.md` rows 17, 20 and §4. Already in this repo's `/strategy` corpus.

#### S21 Playing Possum
**Evidence:** `[inferred from rules]`; the name is `[coined]`.
**Definition.** Look uninformed on purpose so you remain the seat opponents feel safe missing into.
**Description.** The counter to [Turn-Parking](#s14-turn-parking) and, in weaker form, to [blackballing](#s13-blackballing). Avoid certain asks, avoid claims, keep your visible knowledge stale — then convert once they have fed you enough turns. It is a deliberate distortion of the very statistics an opponent model reads.
**Triggers.** You detect that you are the designated safe target (high inbound-miss share), or that you are being blackballed and want to be re-included.
**Strengths / weaknesses.** Cheap and invisible if done early. It costs real EV while you are pretending, and against an opponent who models *rates over time* rather than snapshots it is detectable as an implausibly low conversion of information into action.
**Counter-play.** Score information the opponent *should* have (from the public log, given their certified holdings) rather than information they have *demonstrated*. A possum's `knowledge_score` from the log stays high even as their revealed behaviour goes quiet.
**Observable signature.** A widening gap between log-implied knowledge and demonstrated knowledge: high `deducible_certainties` with near-zero `provably_certain_asks` and no claims.
**Engine mapping.** Confirms that `Danger(p)` must be computed from **what the log entails for that seat**, not from their observed behaviour, or the model is trivially spoofable. That is also cheaper to compute.
**Sources.** Derived; counter-play to attested styles.

#### S22 Going Empty
**Evidence:** rule consequences `[attested-search]`; the doctrine is `[inferred from rules]`.
**Definition.** Being cardless is not purely a loss — it makes you unaskable, undrainable and unparkable.
**Description.** A cardless player cannot be asked, so the turn cannot be given to them (`RULES.md` row 19). That immunises you from [key-stripping](#s17-key-stripping) and from being drained, and it narrows the opponents' turn-flow channel to your two teammates. Conversely, row 20 means a player who empties **via their own claim** gets to **choose** which teammate receives the turn — a rules-supported turn-transfer mechanism and the cleanest way to execute [S20](#s20-stalemate-breaker).
**Triggers.** Late game; when your remaining cards are all in books you cannot win; when the team wants control of turn routing.
**Strengths / weaknesses.** Removes you as a target and, done via a claim, buys a chosen handoff. But you also stop contributing asks entirely, and if your *whole* team empties, §4 hands the opponents the endgame sweep.
**Counter-play.** Route asks to their remaining teammates; if their whole team is nearly empty, consider whether forcing the endgame favours you ([S29](#s29-endgame-dumping)).
**Observable signature.** Claims timed to empty the claimant's hand, followed by a pass to a specific teammate rather than the highest-count one.
**Engine mapping.** The `pass{to}` decision is a real policy, not a formality. This repo currently passes to the teammate with the most cards (`passAction`); a stronger rule is "pass to the teammate whose position value is highest", which usually means the one closest to a claim, not the one with the most cards.
**Sources.** pagat; `RULES.md` rows 19–20, §4.

---
### II.3 Claiming doctrine

Claiming is the highest-stakes decision in the game and the one the rule dialects disagree about most,
so the arithmetic comes first.

**The two risks are independent under this repo's rules.** Let `c = P(your team contains the book)`
and `a = P(your assignment is exactly right | contained)`. Under the pinned void rule (`RULES.md`
rows 13–15):

```
EV(claim) = c·a·(+1)  +  c·(1−a)·(0)  +  (1−c)·(−1)   =   c·a − (1 − c)
```

so claiming beats standing pat when **`c > 1/(1+a)`**. With a perfect assignment (`a = 1`) the bar is
`c > 0.5`; with a coin-flip assignment (`a = 0.5`) it is `c > 0.667`. **The assignment axis is a free
roll**: if you are certain the book is contained, the worst outcome is a void, never a gift.

Under the [opponents-score-any-error dialect](#v17-any-error-scores-for-the-opponents) the void
outcome disappears and both risks collapse into one:

```
EV(claim) = c·a·(+1) + (1 − c·a)·(−1) = 2·c·a − 1        →  claim iff  c·a > 0.5
```

which is much harsher, and explains why the club documents preach absolute certainty while the pagat
lineage tolerates aggression. **The engine's claim threshold must be a function of the ruleset flag,
not a constant.** Units above are book-differential (a book to them counts −1 relative to not
claiming); under toggle T5 `highBooksDouble` every term must be weighted by book value, and high books
justify roughly twice the risk.

#### S23 Hoarder
*Aliases: late claimer, the banker.* **Evidence:** `[attested-search]` for the practice; the decisive
argument below is `[inferred from rules]`.
**Definition.** Do not claim, even at certainty: a book your team contains cannot be attacked or stolen, so it is a free option.
**Description.** The attested advice is blunt: *"If you have all 6 cards necessary for a book, the natural instinct is to claim it. However, it can benefit your team tremendously to hold onto it"*, and *"Unless you are absolutely certain about the location of all cards in a book, don't claim it. If your entire team has those cards, it's safe. There's no way your opponents can steal it from you — unless you claim it incorrectly!"* (Deposit Genius). Under **this repo's pinned rules** that intuition is not just good advice, it is a theorem.

> **A contained book is an absorbing state.** Suppose Team A holds all six cards of book B.
> **(1) No opponent can ask into it.** To ask for a card of B you must yourself hold a card of B
> (`RULES.md` row 6) and you may only ask opponents (row 5). No Team B player holds any card of B, so
> no Team B player has any legal ask in B at all. Teammates may never be asked, so Team A cannot break
> its own containment either.
> **(2) No opponent can steal it by claiming.** Under §3 a claimant must assign every card to seats on
> **their own team** (`ASSIGN_OPPONENT`). If a Team B player claims B, then by hypothesis Team A holds
> cards of it, so resolution rule 14 fires — *"any of the 6 cards actually held by the opposing team →
> opposing team scores"* — and the book is **gifted to Team A**. The same holds under toggle T8
> `claimAnyTurn`, which changes only *when* a claim may be made, not how it resolves.
> Therefore containment can be ended only by the containing team's own claim. ∎

**Consequences.** (i) A hoarded book is **100% safe to hold indefinitely** — the decay risk the
narrative sources warn about is *zero* under this ruleset. (ii) **Under the pinned rules, claiming
early has no defensive value whatsoever.** The only reasons to claim are **tempo** (the
[stalemate-breaker](#s20-stalemate-breaker) handoff), **endgame forcing**, and **memory risk** (a human
may forget; a bot with the full log does not). (iii) It holds for a book split across three teammates
exactly as much as one complete in a single hand — **containment, not concentration, is what confers
safety**. (iv) It supplies the free renewable pass of [S19](#s19-contained-book-exit). This is the
sharpest strategic finding in this document, and it says the community's "claim promptly" advice is
inherited from memory-limited live play and from
[opponents-score-any-error tables](#v17-any-error-scores-for-the-opponents), not from the rules this
engine implements.
**Triggers.** Any provably contained book, at any point before the endgame, unless tempo or forcing
says otherwise.
**Strengths / weaknesses.** Safe is not the same as winning. Hoarding **defers score**, so it loses
outright to an opponent who simply claims faster and reaches the majority first; it forgoes the
belief-state simplification a claim provides (a claim publicly reveals all six actual holders); it
requires the team to maintain a shared assignment map without the log-clearing effect of a claim
(where human memory actually fails); and it is fatal if containment was **mis**-assessed — a book you
wrongly believe contained is exactly the book you will eventually gift away.
**Counter-play.** You cannot attack a contained book, so the counter is **tempo**: claim your own books
fast and win the race, and blackball the hoarder so the bank never converts. Also consider forcing the
endgame ([S29](#s29-endgame-dumping)), which compels them to claim everything under pressure. Note
that under the [Challenge variant](#v23-the-challenge) hoarding *is* directly punishable — which is
precisely the rationale that rule's authors gave for it.
**Observable signature.** A player who never asks in a book yet is revealed to hold many of it; card
count staying high; claims deferred. Statistics: `mean_claim_delay` (turns between provable
containment and claim) high, `books_claimed_before_turn_20` low.
**Engine mapping.** Implement `Unaskable(book) := no opponent of the holding team holds any card of it`
as a **hard safety predicate** computed exactly from the belief state, and gate the entire claim-timing
module on it. Books that are provably unaskable have zero decay risk and should be claimed only for
tempo, forcing, or at game end. **This repo's `decide.ts` already states the observation** — the
`evClaim` doc comment notes that an opponent "can never score it (and, holding none of its cards, can
never even ask into it)" — but the *policy* does not follow through: `certainClaim` still fires the
moment a book is certainly on the team. The engine is a [Snap Claimer](#s24-snap-claimer) that knows
better.
**Sources.** Deposit Genius; `RULES.md` rows 5–6, 11–15, §3; `lib/engine/bots/decide.ts`.

#### S24 Snap Claimer
**Evidence:** `[attested-search]`.
**Definition.** Claim the instant all six locations are known.
**Description.** *"Claim as soon as you know all 6 cards' locations rather than waiting for opponents to consolidate."* The reasoning: a book scored is a book banked, safe from your own memory decay, from miscounting, and from endgame rules that can force a solo claim. Directly opposed to [S23](#s23-hoarder).
**Triggers.** Any moment of full certainty.
**Strengths / weaknesses.** Zero risk of misremembering; banks the point; simplifies your own belief state (fewer live books, easier deduction). Beats a hoarder in a pure race. But it reveals your holdings and sharpens the opponents' deductions on the remaining books, forfeits the banked-asset value, and — per [S23](#s23-hoarder) — sacrifices a genuinely risk-free option for nothing under the pinned rules.
**Counter-play.** Let them claim, then harvest the information release: a claim reveals the **actual** holders of all six cards (`RULES.md` §3), which is the single largest information event in the game. Use it to solve the remaining books.
**Observable signature.** `mean_claim_delay` near zero; claims land immediately after the log event that completed the information.
**Engine mapping.** The naive baseline — and the correct fallback whenever the engine's belief is uncertain or its memory model is lossy. **Ship it as a difficulty tier**, not as the top tier. This is what `certainClaim()` currently is.
**Sources.** Deposit Genius / gamerules extracts; `lib/engine/bots/decide.ts`.

#### S25 Certainty Purist
*Aliases: the 100% rule.* **Evidence:** `[attested-search]` (Bryn Mawr club document).
**Definition.** Never claim below total certainty.
**Description.** *"Do not make a claim if you are not 100% sure that you know which team member has which card, or else you will disappoint your team with your folly"*, and *"Only make a claim when you know that the full half-suit is on your side and when you know which person has which card."* Note this is stated in explicitly **social** terms — it is a norm about blame allocation as much as about EV, and it is the standard teaching posture at club tables.
**Triggers.** Default posture at casual and club tables; correct under the opponents-score dialect.
**Strengths / weaknesses.** Never gifts a book; robust for memory-limited humans; correct under [V17](#v17-any-error-scores-for-the-opponents). **Strictly EV-suboptimal under the void rule**, where the real bar is `c > 1/(1+a)` (0.5–0.67), not 1.0 — it leaves books unclaimed at game end.
**Counter-play.** Manufacture ambiguity: keep the last card of a book circulating so the purist can never reach certainty, then take the endgame.
**Observable signature.** `claim_accuracy == 100%` combined with a **low claim count** and books unresolved at game end. Statistic: `claims_attempted / books_provably_contained` well below 1.0.
**Engine mapping.** A claim-threshold parameter `θ ≈ 1.0`. Detecting a purist opponent is directly exploitable — cheap ambiguity denies them books. The engine's own `θ` should come from the EV formula above, not from the norm. This repo's **medium** tier is a pure Certainty Purist by construction.
**Sources.** Bryn Mawr Distressing Math Collective, "The Rules of Fish".

#### S26 EV Claimer
**Evidence:** `[inferred from rules]` — **no source advocates sub-certainty claiming**; the name is `[coined]`.
**Definition.** Claim on expected value using `c > 1/(1+a)`, accepting voids as a cost of doing business.
**Description.** Under the void rule the void is cheap and the gift is expensive, so the decision hinges almost entirely on **containment** confidence. A 50/50 assignment on a certainly-contained book is worth `+0.5` books versus `0` for standing pat (ignoring option value). The style therefore maintains `P(contained)` and `P(assignment | contained)` as **separate** quantities and treats them asymmetrically — an engine that computes only `P(entire claim exactly right)` will claim far too conservatively.
**Triggers.** Endgame; when ahead and wanting to freeze the score via voids ([S27](#s27-the-spoiler)); when a book is contained but the assignment is genuinely ambiguous. Note the interaction with [S23](#s23-hoarder): because containment is absorbing, "wait and resolve the assignment later" is usually available and usually better — the EV claim is for when *waiting itself* is what costs you.
**Strengths / weaknesses.** Harvests books purists leave on the table and turns the void rule from a threat into a tool. But voids are pure lost value whenever waiting would have resolved the assignment; the style is catastrophic if the table actually plays [V17](#v17-any-error-scores-for-the-opponents); and it needs accurate containment estimation, which is the hardest inference in the game.
**Counter-play.** Break their containment estimates — keep exactly one card of every contested book so `c` never gets high. Their aggression then becomes gifts to you.
**Observable signature.** The precise error profile is the fingerprint: `claim_accuracy` meaningfully below 100% with `void_rate > 0` but `gift_rate ≈ 0` — they fail only on assignment, never on containment. A reckless claimer also gifts.
**Engine mapping.** The core claim module: maintain the two distributions separately and claim when `c·a > 1 − c`; report both to the search so claim timing can trade against option value. This repo's `evClaim()` is a narrow special case — it fires only when exactly one card is uncertain *and* all its candidates are teammates (so `c = 1` by construction), with `θ = 0.8` normally and `0.5` once the position is provably stalled. That is defensible but leaves the general case unimplemented.
**Sources.** Derived from `RULES.md` rows 13–15; `lib/engine/bots/decide.ts`.

#### S27 The Spoiler
*Aliases: deliberate void, the burn.* **Evidence:** `[inferred from rules]` — **not source-attested**; the name is `[coined]`.
**Definition.** Claim a contained-but-unresolvable book on purpose to void it, freezing the score when you are ahead.
**Description.** With 8 books, a lead of `k` is protected by removing books from play. Claiming a contained book you cannot assign yields a void with high probability: nobody scores, the book leaves play, and the number of live books drops. A team ahead 3–2 with 3 live books prefers 3–2 with 1 live book. It also makes the **tie** (`RULES.md` row 23) reachable as a deliberate defensive target. Useless under [V17](#v17-any-error-scores-for-the-opponents), where there is no void outcome.
**Triggers.** Ahead on books, late game, holding a contained book with an ambiguous assignment, opponents with strong remaining prospects.
**Strengths / weaknesses.** Converts uncertainty into safety. It throws away real EV whenever the assignment was resolvable, and if containment was misjudged it gifts the book — the worst case.
**Counter-play.** Deny containment: keep one card of every book. Also note that a spoiler is telling you they are ahead and scared.
**Observable signature.** Claims made **while leading**, on books the log shows contained but ambiguous, producing voids far above chance, clustered in the last third of the game. Statistic: `void_rate | leading` ≫ `void_rate | trailing`.
**Engine mapping.** **Requires a win/draw/loss evaluation, not a book-count evaluation.** A book-count maximiser will never find the spoiler; a win-probability maximiser will. This is the strongest single argument for a WDL head over a linear book-differential score.
**Sources.** Derived from `RULES.md` rows 15, 22–23.

#### S28 Endgame Solo Declarer
*Aliases: the sweep, max-hand claimer.* **Evidence:** `[attested-search]`.
**Definition.** When one team runs out of cards, the other must claim every remaining book alone, without consulting teammates — so prepare for who that will be.
**Description.** The rule: *"The team with all the remaining cards must then try to claim out all remaining half-suits. If the turn is with the team that has cards, the player whose turn it is must claim all the remaining sets, without consulting his partners"* (pagat), and *"In the endgame, a player without cards may still make claims on behalf of his or her team, so long as he or she does not look at any teammate's hand."* The attested tactical rule for **who** should claim: *"let the player with the most cards do the claiming. They will have the best chance at correctly identifying who has what."* Because consultation is banned, the claimer must reason about what their *teammates* would say — a theory-of-mind sub-problem, and an excellent benchmark scenario.
**Triggers.** Either team's total card count hits zero with books remaining (`RULES.md` §4).
**Strengths / weaknesses.** This is a *forced* phase, so the style is really pre-endgame preparation: teams that steer so the best-informed player holds the most cards enter it far stronger.
**Counter-play.** [S29](#s29-endgame-dumping) — choose *when* the endgame starts.
**Observable signature.** Endgame claim accuracy, and whether a team's card distribution before the endgame concentrated on its strongest deducer.
**Engine mapping.** The endgame is an **exactly solvable subgame**: one player, a fixed belief, assign all remaining cards to maximise expected books. Solve it by enumeration (the residual space is small — see the [Appendix](#appendix--verified-combinatorics)) and **back its value up into the midgame** so `V(force_endgame)` is available as a search objective. This repo handles the phase (`forcedClaim` in `endgame`, claiming the most-certain book first so its reveal feeds the next inference) but does not *value* the endgame during the midgame.
**Sources.** pagat; Deposit Genius; `RULES.md` §4; `lib/engine/bots/decide.ts`.

#### S29 Endgame Dumping
*Aliases: shedding.* **Evidence:** `[inferred from rules]` — not source-attested.
**Definition.** Race your own team to zero cards to force the opponents into a solo, no-consultation, all-books claim under maximum uncertainty.
**Description.** The counter-play to [S28](#s28-endgame-solo-declarer) turned into a plan. If the opponents' knowledge is fragmented across three hands, compelling one of them to claim *everything* alone is devastating: every misassignment is a void (or, under V17, a gift). The mechanism is legal and cheap — claim books that empty your hands, and let opponents take your cards.
**Triggers.** Mid-to-late game; your team is behind or level; the remaining books are murky; the opponents' certainties are visibly spread across seats rather than concentrated.
**Strengths / weaknesses.** Can convert a fragmented opponent map into several voids. But it hands the opponents every remaining book they *can* resolve, and it is a one-way commitment.
**Counter-play.** Concentrate your team's knowledge and cards into one seat before the endgame can be forced; claim resolvable books early rather than banking them.
**Observable signature.** `team_card_count` slope steeply negative in mid-game while `books_claimed` does not keep pace; claims chosen to empty hands; no contesting of late books.
**Engine mapping.** Make `V(force_endgame)` an explicit search objective (it requires the solvable endgame of [S28](#s28-endgame-solo-declarer) to be evaluated first). This is a genuinely under-explored line — no source describes anyone doing it — and a good self-play experiment.
**Sources.** Derived from `RULES.md` §4.

#### S30 Brazen Prober
*Aliases: the probabilist, the stealer.* **Evidence:** `[attested-search]` (as a named style, single source).
**Definition.** Take books by guessing rather than knowing — claim or challenge on probability.
**Description.** Attested as the behaviour the [Challenge rule](#v23-the-challenge) was designed to enable: *"introduce the possibility of stealing suits through bluffing or brazen probability."* Distinct from [S26](#s26-ev-claimer) in that the prober is willing to bet on **containment**, not just assignment — which under the void rule is the expensive axis.
**Triggers.** Behind on books; late game; a table that plays the Challenge.
**Strengths / weaknesses.** High variance, which is exactly right when behind. It needs calibrated probabilities over **full 6-card assignments**, not per-card marginals — the genuinely hard part.
**Counter-play.** Keep one card of every book you can. A prober's errors are gifts.
**Observable signature.** `gift_rate > 0` (they fail on containment, not only on assignment) — the profile that distinguishes reckless from competent EV claiming.
**Engine mapping.** A claim threshold `θ < 1` applied to `c` as well as `a`, plus **joint** per-book distributions in the belief model. Six correct marginals are not one correct assignment.
**Sources.** Winslow rules page; older Wikipedia text.

#### S31 Forced Claimer
**Evidence:** `[attested-search]` + `[attested-direct]`.
**Definition.** With cards but no legal ask, you must claim — so be good at the best-guess claim.
**Description.** *"A player with cards but no legal ask (e.g. all their half-suits are resolved, or they share no unresolved half-suit with an askable opponent) must claim"* (`grantbw4/literature-rl`, `[attested-direct]`). Winslow's dialect also pushes teams into this state via the Challenge. The style is entirely about the *quality* of a guess made under duress: pick the book with the highest success probability and the most count-consistent assignment.
**Triggers.** No legal ask exists; the endgame; or a provably dead position where no ask can gain anything.
**Strengths / weaknesses.** Nothing optional about it. The skill is in not wasting the forced claim on the wrong book.
**Counter-play.** Engineer it: [key-strip](#s17-key-stripping) an opponent out of their last live books so their only legal move is a bad claim. This is a strong, under-used attacking idea.
**Observable signature.** `forced_rate` — one prior implementation tracks exactly this as a health metric — plus claims that arrive with no supporting information event.
**Engine mapping.** Legal-move generation must fall back to claim-only, and the claim planner must produce a *best-guess* claim, not only certain ones. This repo does it (`forcedClaim`), including a deliberately conservative deep-stall detector so ordinary miss-heavy midgames do not trigger it.
**Sources.** `grantbw4/literature-rl` RULES.md; Winslow; `lib/engine/bots/decide.ts`.

#### S32 Control-Transfer Claim
*Aliases: withhold for the handoff.* **Evidence:** `[attested-search]`.
**Definition.** Time a claim so that it empties your hand, converting the claim-out pass into a chosen turn handoff.
**Description.** The individual-level mechanism behind [S20](#s20-stalemate-breaker), and it is already in this repo's corpus: *"a fully-known book is a banked asset. Held back, it keeps you ask-worthy — and when you finally claim yourself empty, the claim-out pass lets you hand the turn to the teammate of your choice at exactly the right moment."* Under `RULES.md` row 17 a claim otherwise leaves the turn with you, so **emptying yourself is the only way to choose the next mover** without toggle T7.
**Triggers.** A teammate needs the turn; your remaining cards are exactly (or nearly) one contained book.
**Strengths / weaknesses.** The only rules-supported turn gift. It requires arranging your hand so the claim actually empties it — which is a mid-game shaping problem, not a spot decision.
**Counter-play.** Blackball the *recipient* as well as the banker; or drain the banker so the claim no longer empties them.
**Observable signature.** Claims that leave the claimant at zero cards, immediately followed by a pass to a teammate who is *not* the highest-count teammate.
**Engine mapping.** Two changes to a naive engine: (a) the `pass{to}` policy must maximise position value rather than card count; (b) hand shaping must be able to *aim* for an empty-on-claim configuration, which means the value of a card depends on whether it is in the book you intend to cash.
**Sources.** Develin and Wikipedia via `/strategy` corpus; `RULES.md` rows 17, 20.

### II.4 Hand shape and meta-play

#### S33 Breadth Shape
*Aliases: wide hand.* **Evidence:** `[inferred from rules]`.
**Definition.** Hold a few cards in many books: maximum ask rights, maximum flexibility, no containment.
**Description.** Ask rights are gated on holding a card of the book ([S16](#s16-foot-in-the-door)), so a wide hand can legally enter many books — which maximises available [turn-parking](#s14-turn-parking) targets, [known-negative asks](#s4-known-negative-ask) and cheap exits. The cost is that every book is one strip away from lockout and you contain nothing.
**Triggers.** Early game, and any time flexibility and turn control matter more than scoring.
**Strengths / weaknesses.** Options, deniability, and a hand shape that is hard to read. Contains nothing, so it converts to no books on its own.
**Counter-play.** [Key-strip](#s17-key-stripping) them repeatedly; each strip is permanent and their breadth is exactly what makes each singleton fragile.
**Observable signature.** Certified holdings spread across many books with low count per book; high ask diversity; few or no claims.
**Engine mapping.** Part of the hand-shape term below.

#### S34 Depth Shape
*Aliases: deep hand, the run.* **Evidence:** `[inferred from rules]`.
**Definition.** Concentrate in few books: approaches containment and easy claims, at the cost of few legal asks and high readability.
**Description.** The mirror of S33. Depth is what converts into books and into the absorbing state of [S23](#s23-hoarder), but a deep hand has few legal asks (you can only enter books you hold), is easy to read once you start pressing, and is a single point of failure.
**Triggers.** Late game, and whenever containment is within reach.
**Strengths / weaknesses.** Scores. Advertises. Can be starved of legal asks entirely, which forces [S31](#s31-forced-claimer).
**Counter-play.** Blackball the deep player and let their legal-ask set shrink to nothing.
**Observable signature.** Few books certified, high count per book, bursts of asks in one book, early claims.
**Engine mapping.** One explicit, **phase-conditioned** term: `Σ_books g(cards_held_in_book)` with `g` concave early (option value rewards breadth) and convex late (containment value rewards depth). Phase-conditioned weights are the cheapest way to get both.

#### S35 The Reader
*Aliases: opponent-tendency modeller.* **Evidence:** `[attested-search]` (single source).
**Definition.** Play the people: exploit each opponent's known habits rather than only the cards.
**Description.** *"Knowledge of your opponents and their tendencies can be invaluable."* In a club setting the exploitable tendencies are stable across games: who over-signals, who claims early, who forgets, who never re-takes a card that was taken from them.
**Triggers.** Repeated play against the same table — the club product case, not the one-off case.
**Strengths / weaknesses.** The largest single edge available against humans. Exploitative and therefore exploitable; needs a safety fallback when the model's confidence is low.
**Observable signature.** N/A — this is the style that *does* the observing.
**Engine mapping.** A **per-seat profile that persists across games**: signal rate, claim aggression, memory-decay curve, blackball participation, convention usage. Everything in the [detection panel](#vi4-opponent-detection-statistics-panel) is a feature of this profile. Requires the app to log full public histories plus revealed hands — a data-collection decision that must be made *before* the games are played.
**Sources.** Deposit Genius.

### II.5 Benchmark archetypes

These two exist as **implemented reference opponents** in prior art and give a ready-made ladder.

#### S49 Random-Legal Floor
**Evidence:** `[attested-direct]` (`grantbw4/literature-rl` describes `RandomLegalAgent` as *"the novice floor"*).
**Definition.** Uniform choice among legal asks; claim only when forced.
**Engine mapping.** Every evaluation needs this floor to be meaningful. This repo has it as `fallbackAction()` and as the easy tier's 25% error branch.

#### S50 One-Ply Greedy
*Aliases: the "experienced player" benchmark.* **Evidence:** `[attested-direct]`.
**Definition.** (1) Claim any provably complete book; (2) else ask the card the target is most likely — often certainly — holding, preferring books you hold more of; (3) claim when you have no legal ask.
**Description.** A written-down formalisation of a competent-but-not-expert human, used as an RL baseline and explicitly described by its author as doing *"no signaling, no opponent modeling"* and looking *"one move ahead — leaving room for a learning team to find something beyond it."* It is **not** presented as a validated human expert, and this document does not present it as one either.
**Engine mapping.** This is almost exactly this repo's **medium** tier. Adopt the published ladder: Random floor → One-Ply Greedy → learned or search-based policy, and report win rates against both.
**Sources.** `grantbw4/literature-rl` README (`[attested-direct]`).

---

## Part III — Conventions and the signalling schism

Two traditions exist and they are incompatible. One documents a named, prearranged partnership code;
the other bans prearranged codes outright and treats them as cheating. **Both are presented here as
written. This document does not adjudicate between them** — the engine needs a flag, a decoder, and a
detector, not an opinion.

### III.1 The pro-convention tradition

#### S36 Ali Salahuddin Convention
**Evidence:** `[attested-search]` — the only *named, codified* convention found anywhere in the corpus.
**Definition.** After a partner's failed ask, your next ask encodes whether you hold the card they were denied.
**Provenance.** Named for a real person. pagat credits its Literature strategy notes in part to **Ali Salahuddin** and Brett Stevens, and reports that Salahuddin was a masters student in mathematics and an MBA student at the **University of Toronto, 1993–1995**, who learned the game from his father, who played it at **Columbia University in the 1950s** having grown up in **Kerala, India**. That single line is the clearest documented thread linking the Indian and Canadian lineages of the game.

**The mechanism, in full.** Player A asks an opponent for a card — say the 2♥ — and is refused. The
book (minor hearts) is now publicly certified to be in A's hand. On partner C's next turn, C's *choice
of ask* carries the message:

| C's next ask | Encoded meaning |
|---|---|
| A **different** card in the **same** half-suit (3♥/4♥/5♥/6♥, asked of anyone) | *"I hold the 2♥ — the card you were denied."* |
| **The same** card that was denied (2♥) | *"I do not hold it, but I do have cards in this half-suit."* |
| A card in an **entirely different** half-suit | *"I have nothing useful in that half-suit."* |

The elegance is that all three branches are **legal and natural-looking**: you must hold a card of a
book to ask in it, so each branch is an ask C could plausibly have made anyway. The convention rides
entirely on **which** card is chosen — a free parameter that costs nothing.

**Two renderings, one mechanism.** The two independent extracts differ only in emphasis: one says the
partner signals possession by *"calling for a different card in the same half-suit"* and denies by
*"continuing to ask for the original card or switching to a different set"*; the other says the same
with "minor hearts" as the worked example. **The exact three-branch encoding above rests on a single
extracted description and should be verified against the live pagat page before being implemented as
a hard protocol.**
**Triggers.** Immediately after a teammate's failed ask, on your own next turn.
**Strengths / weaknesses.** It attacks the hardest coordination problem in the game — locating cards
*within your own team*, which is exactly what a claim requires, and exactly the `a` term in the claim
EV formula. It costs nothing extra. But it is **fully public**: opponents who know the convention
decode your team's internal map as well as you do. It is also brittle — it constrains your next ask,
which can force a materially bad move, and it assumes you get a next turn at all, which
[blackballing](#s13-blackballing) is designed to prevent.
**Counter-play.** Learn it and read it. Then **blackball the signaller's partner** so the signal can
never be acted on. Or exploit the constraint: a partner obligated to a particular ask is predictable,
which is free information for [turn-parking](#s14-turn-parking).
**Observable signature.** Statistically detectable as **conditional ask correlation**:
`P(next ask by partner is in the same half-suit | partner's previous ask failed)` significantly above
base rate, **and** the card chosen within that half-suit correlating with subsequently revealed
holdings. Concretely, fit `P(partner holds card X | partner's ask choice after X was denied)`: a
convention-using team shows a strong, consistent, learnable mapping; a non-convention team shows
noise. This is a **learnable per-opponent-team parameter and the single highest-value
opponent-modelling target in the game.**
**Engine mapping.** Two separable capabilities. **(a) Convention inference** — treat every player's
ask-choice as a noisy channel and learn the encoding online with a Bayesian model over convention
hypotheses; this is exactly the Hanabi "conventions as a prior over policies" problem and the same
machinery applies. **(b) Convention execution** — if the engine plays with human partners it must be
able to *adopt a declared convention* and encode/decode accordingly. Note this is a **policy
constraint layer on top of search**, not a change to the evaluation function: the convention restricts
which ask you may play given the message you intend, and search optimises within that restriction.
**Sources.** pagat; Wikipedia lineage; Grokipedia (derivative). Already summarised in this repo's
`/strategy` corpus.

#### S37 Implicit Target Signal
**Evidence:** `[attested-search]`; the name is `[coined]`.
**Definition.** Whom you ask is itself a message — the zero-cost convention that exists even at tables with no agreements at all.
**Description.** *"Partners convey strategic information primarily through the choice of whom to ask for cards and the specific cards requested. By targeting a particular opponent with a request for a card in a half-suit they hold, a player implicitly signals to their teammates that they lack that card and suspect the opponent possesses it."* Every ask carries three facts for free: **(i)** I hold ≥1 card of this book (mandatory), **(ii)** I do not hold this exact card (mandatory), **(iii)** I suspect *this* target (chosen).
**Triggers.** Every ask, always. There is no opting out.
**Strengths / weaknesses.** Free and unavoidable. Facts (i) and (ii) are hard constraints; fact (iii) is soft and policy-dependent, so it is only as good as your model of the asker.
**Counter-play.** Vary targets to make (iii) uninformative — this is [Chain Discipline](#s7-chain-discipline) seen from the other side.
**Observable signature.** Not a style you detect; it is the substrate every detector is built on.
**Engine mapping.** Facts (i) and (ii) are already in this repo's `knowledge.ts` (`addAskConstraint`, `clearCand`). **Fact (iii) is the one engines drop**, and it is the whole soft channel: build the **inverse model** — given an opponent's target choice, infer what *they* believe, then propagate. "They think seat 3 has the Q♥" is evidence that seat 3 *does* have the Q♥, weighted by that opponent's demonstrated accuracy. This is recursive belief at **depth 1**, and per the one prior implementation that tried it, depth 1 is where to stop: `neelsomani/literature` maintains `dummy_players` — a model per seat of what that seat knows — and its author concluded that deeper layers were not worth the exponential dimensionality. **Recommendation: depth-1 recursive beliefs.**
**Sources.** Wikipedia/Grokipedia extracts; `neelsomani/literature` `player.py` (`[attested-direct]`).

#### S38 Rally Signal
*Aliases: the unusual ask.* **Evidence:** `[attested-search]`; the name is `[coined]`.
**Definition.** An out-of-pattern ask means "pile into this book with me."
**Description.** *"Unusual asking patterns can be used as signals, where asking for an uncommon card tells teammates to also ask for cards in that suit to pull a half-suit together."* This depends on a shared sense of what is *normal*, so it is a **markedness convention**: the message is carried by deviation from the expected policy, not by the content of the ask. It is structurally identical to how Hanabi conventions work, and it is the deepest analogy between the two games. (The Hanabi comparison is this document's, `[inferred]` — no source shows Literature players drawing it.)
**Triggers.** You want partners in a book and cannot say so.
**Strengths / weaknesses.** Cheap and expressive. Requires the whole team to share a baseline; opponents who model the same baseline decode it identically.
**Observable signature.** Asks with low prior probability under a baseline policy model, followed by correlated same-book asks from partners within one to two turns: `P(partner enters book B within 2 turns | player made a low-prior ask in B)`.
**Engine mapping.** Requires a **baseline policy model** to define "unusual" at all; then surprisal `−log P_baseline(ask)` is a feature that both detects opponents' rally signals and lets the engine emit them. Important consequence: **the engine's own baseline policy becomes common knowledge and therefore a signalling medium** — deviations from it are meaningful. This argues for maintaining an explicit, stable, *published* baseline policy rather than a continuously retrained one.
**Sources.** Grokipedia (derivative of Wikipedia).

#### S39 Signal-Back
*Aliases: book echo, confirm-in-book.* **Evidence:** `[attested-direct]` — read from an implemented bot.
**Definition.** When a teammate fails to get a card **you hold**, ask in that same book on your next turn to confirm it.
**Description.** This is the Salahuddin convention's possession branch, implemented independently and without the name. One engine's bot detects both directions: `detectTeammateSignals()` scans recent asks for the pattern *"teammate T fails on card X from book B, then teammate T2's next ask is for a different card from book B"* and concludes T2 likely holds X, with **confidence graded by the gap** between the two asks (0.7 if within two intervening asks, 0.4 within five, 0.2 beyond); and `detectBooksToSignal()` does the emitting side, flagging books where a teammate recently failed on a card the bot itself holds so that asks in that book get a ×2 weight boost. The detected signal then feeds claim planning: a signalled card can be assigned to the signalling teammate at `MAX_WEIGHT × confidence`.
**Triggers.** A teammate's failed ask on a card in your hand, within a short recency window.
**Strengths / weaknesses.** Fully mechanical, cheap, and it directly raises `a` (assignment confidence) — the term that gates claim value. It is also decodable by any opponent running the same detector, and the confidence decay makes it fragile across a busy log.
**Counter-play.** Run the detector on your opponents. A team using it is publishing its internal map.
**Observable signature.** Identical to [S36](#s36-ali-salahuddin-convention)'s, minus the denial branch.
**Engine mapping.** The most directly copyable convention artifact found: a **gap-graded confidence** signal detector that feeds both ask weighting and claim assignment. It is a strictly better first implementation than a hard three-branch protocol, because it degrades gracefully when the partner is not actually signalling.
**Sources.** An implemented Fish bot's `detectTeammateSignals` / `detectBooksToSignal` (`sw_bot.ts`, read in full).

### III.2 The prohibitionist tradition

#### S40 Convention Prohibition
**Evidence:** `[attested-search]` — multiple independent sources.
**Definition.** Prearranged conventions are cheating; only genuine in-game inference is fair.
**Description.** This is a **rule**, not a style: Develin's Canadian Fish forbids conventions explicitly, the US student "Fish" rules take the same stance, and the older Wikipedia text banned communication "verbal or otherwise." Under these rules the Salahuddin scheme is not clever, it is prohibited. The corroborating table culture is consistent: Grokipedia records that *"non-verbal cues are limited in Literature as the game emphasizes verbal exchanges and prohibits physical signals or external aids"*; alternating seating is justified explicitly as an **anti-collusion** device (*"players want to share information with their own team, but not the other … This encourages them to hide their cards"*); and no-written-records is universal.

A telling side-note already in this repo's corpus: Develin's own collection contains *Spielen*, a game
built entirely on prearranged codes — the community did not reject coded signalling as uninteresting,
it **quarantined it into a different game**.
**The distinction that matters for the engine.** Prohibition bans **prearranged** codes. It does not
and cannot ban [S37](#s37-implicit-target-signal) — the information that leaks from *which* card you
ask *whom* is unavoidable, and reading it is exactly the "genuine in-game inference" the prohibitionists
endorse. So a prohibitionist table still has a full soft channel; what it lacks is a **shared codebook**.
**Engine mapping.** The engine must (a) be able to play with conventions **off**, (b) be able to play
with a declared convention **on**, and (c) **detect which regime the opponents are in** rather than
assuming. Detection is the same statistic as S36's: conditional ask correlation against a permutation
baseline. Shipping a convention-using bot to a prohibitionist table is a rules violation, not a
strength setting — so this must be a room-level configuration, visible to the players.
**Sources.** Develin; Board Games Stack Exchange #31946; `amy-lei/fish`; Cornell Daily Sun; older
Wikipedia text — all via this repo's `/strategy` corpus. Grokipedia for the non-verbal note; De Smet
for the seating rationale.

#### S41 Emergent Convention
**Evidence:** `[attested-direct]` (an RL study's README, read in full).
**Definition.** Do not teach a convention — let self-play invent one, then measure whether it did.
**Description.** One RL project sets out explicitly to see whether signalling **emerges** from self-play, precisely because every ask is public: its stated goal is *"to observe emergent strategy — especially the implicit *signaling* that arises because every 'ask' is public information"*, and its metric list includes *"ask-agreement with Experienced, known-hit share, thrown-in rate, signaling excess-MI."* That last item is the useful artifact: **excess mutual information** between a player's ask and their hidden hand, above a permutation null.
**Triggers.** Any self-play training run with fixed partners.
**Strengths / weaknesses.** Finds conventions nobody thought of, and finds them optimised for *this*
ruleset rather than inherited from folklore. But self-play conventions are arbitrary and **do not
transfer** — an agent trained this way is a poor partner for humans or for independently-trained agents
(see [A12](#a12-zero-shot-coordinator)). And in Literature, unlike Hanabi, **the opponents hear the
convention too**, so the objective is *differential* information gain, not absolute — an open problem
for which no published treatment was found.
**Observable signature.** The excess-MI probe itself, run over the engine's own logs.
**Engine mapping.** **Steal the evaluation design.** Build the permutation-null excess-MI probe first;
it is the only way to know whether your agent invented a convention, whether your opponents are running
one, and whether your zero-shot regularisation actually suppressed one.
**Sources.** `grantbw4/literature-rl` README (`[attested-direct]`).

### III.3 The schism, summarised for the engine

| | Pro-convention | Prohibitionist |
|---|---|---|
| Position | Signalling is established practice with a named codified system | Every signal helps three opponents and only two partners; prearranged codes are cheating |
| Named artifacts | [Salahuddin convention](#s36-ali-salahuddin-convention), [rally signals](#s38-rally-signal), [signal-back](#s39-signal-back) | The ban itself; the quarantine of coded play into a different game |
| Attested at | pagat, Wikipedia lineage, an implemented bot | Develin, Board Games SE, `amy-lei/fish`, Cornell, older Wikipedia |
| Status | genuinely unresolved in the community | genuinely unresolved in the community |

**What the engine needs:** a room-level `conventions` setting; an encoder/decoder for at least the
Salahuddin three-branch protocol and the gap-graded signal-back; a detector that infers which regime
the table is in; and the excess-MI probe to measure any convention the engine invents on its own.
**This is also the highest-value question a self-play engine could actually settle empirically** — the
sources disagree, the experiment is cheap, and the answer is probably phase-dependent.

---

## Part IV — Memory and deduction styles

Memory is the axis on which Literature is usually *taught* — *"The game involves no luck, all memory
and deduction"* — and the axis this app's default settings **delete**. With a persistent public log,
recall stops differentiating players and skill collapses onto inference and strategy. That is a
legitimate product decision (`RULES.md` row 18, SPEC §11.1) but it has to be stated, because it means
a perfect-recall bot beating humans is not evidence about the game humans play at a no-history table.
The styles below are ordered from most to least capacity.

#### S42 Full-Log Deductivist
*Aliases: the three-tier lattice.* **Evidence:** `[attested-direct]` — a bot's design notes, read in full.
**Definition.** Maintain, per player, `known` (certain holdings), `knownset` (certain to hold *some* card of an enumerated set), and `possible` (not excluded); propagate to fixpoint after every public event.
**Description.** The clearest written engine design found for Literature. Its update rules, verbatim:
> *"When a move is made and it's successful the knowledge gained is the asker, askee, and card. We must also learn that the asker must have had a card in that set so their knownset must be updated to include all cards in that set that aren't already in known…"*
> *"When an unsuccessful move is made the knowledge gained is that neither the asker nor askee has the card. We learn that the asker has a card in that set so their knownset now includes everything from that set that isn't that card."*
> *"If there is ever a single card from a set in knownset then it should move to known."*
> *"If numCards is equal to length of known then knownset and possible should be cleared."*
> *"If a card is not in anyone's knowledge except for one person then that card should be moved to known for that person."*
> *"When I lose a card that's in known. The other cards in that set get moved from knownset to possible."*

and the rules the same author flags as **not yet implemented** — which are the interesting ones:
> *"specific set hasn't been asked but players have known and knownset cards that make it impossible for them to have it so another person has it"*; *"when 2 sets are left if it isn't known what the other team has but their knownset does not include the other set then your team must have it and vice versa"*; *"if n number of cards of the same set are in knownset and they are known to have n cards of that set then those cards in knownset move to known."*

**Engine mapping.** This is a **constraint-satisfaction problem, not a probability table**. The three
tiers plus exact public hand sizes admit strong propagation: model it as a bipartite assignment CSP
(cards × seats) with cardinality constraints per seat and per book, run **generalised arc consistency**
after each event, then sample or count solutions for probabilities. The last unimplemented rule above
is a **Hall's-theorem / pigeonhole propagator** — implement it generically rather than as a special
case. This repo's `knowledge.ts` already implements the equivalent of the lattice (candidate bitmasks
+ fixed deal-holders + at-least-one-of-set constraints), count exhaustion, count forcing,
single-candidate elimination and set-constraint forcing to fixpoint — the notable design choice being
that it reasons over **deal-time variables** so that historical facts stay immutable as cards move.
**Sources.** `TaranKamireddy/LiteratureBot` `notes.txt` (`[attested-direct]`); `lib/engine/bots/knowledge.ts`.

**Companion result — priors under uncertainty** `[attested-direct]`. The same notes derive by explicit
enumeration the probability that a player who has *certified* a book holds a given remaining card of
it, for six players: **1** (one card left), **5/9** (two left), **19/43** (three left); an uncertified
player holds it with **0**, **1/9**, **6/43**. These are directly usable priors, and they quantify how
strong the certification signal is: **a certified player is roughly five times more likely** to hold
any given card of that book than an uncertified one. (These figures are the source's own; they were not
independently re-derived here.)

#### S43 The Accountant
*Aliases: the perfect-memory counter.* **Evidence:** `[attested-search]`.
**Definition.** Win by tracking every ask in the game — including asks you are not part of — and running elimination logic.
**Description.** The archetype every rules page describes as the core skill: *"To be successful it is necessary to pay attention to questions asked by other players, remember them and make appropriate deductions"*; *"pay attention to every ask in the game, not just asks involving you, as each successful or failed ask reveals information about card locations."* Late-game it becomes pure elimination: hand-size counts plus resolved books pin the remainder.
**Triggers.** Always; decisive in the last three books.
**Strengths / weaknesses.** Dominant among humans. **Trivially dominated by machines** — this is the one archetype a bot beats for free, which is exactly why it should be built as a *substrate* rather than a *policy*: one prior implementation gives every agent a shared *"perfect-memory logical-deduction substrate"* so that learning is about judgment rather than recall.
**Counter-play (human vs human).** Play a no-history table; keep the count ambiguous.
**Observable signature.** `hit_rate` **independent** of the age of the supporting evidence (see [S45](#s45-recency-player) for the contrast), and inference-only claims.
**Engine mapping.** Shipped. It is the floor, not the ceiling.
**Sources.** pagat/Wikipedia/gamerules extracts; `grantbw4/literature-rl`.

#### S44 Bounded-Memory Player
*Aliases: the bit-budget player.* **Evidence:** `[attested-direct]` — a framework specification plus its reference implementation, both read in full.
**Definition.** Memory capacity is capped **in bits**, and the style is defined by the eviction policy over what to keep.
**Description.** Sanjay Kannan's Literature framework makes imperfect memory a *first-class constraint on the agent*, not a property of the log. Verbatim from its specification:
> *"It must be constrained by imperfect memory. This is specified by a parameter to only store a certain amount of bits. Bits can be defined in one of three different ways.*
> *— Two bits: Player X has card Z.*
> *— Two bits: Player X does not have card Z.*
> *— One bit: Player X has a basis in suit Y."*

An agent gets `self.limit` bits, tracks `self.free`, and must stay within budget; the framework does no
checking, so the discipline is the agent's own. Its reference `ActivePlayer` implements exactly that:
it derives facts from each move as tagged tuples (`Card`, `~Card`, `Base`, `~Base`), **ranks them by
relevance to its current focus book**, then refills memory from scratch each turn — resetting
`free = limit` and spending **2 bits** per card fact and **1 bit** per basis fact until the budget runs
out. It also has a `spotlight()` routine that chooses the book to focus on by counting how much of its
memory and hand already bears on each book.

**Why this matters more than it looks.** It converts "how good is this bot's memory" from a vague
difficulty dial into a **single interpretable number**, and it forces the interesting question:
*given `k` bits, what should you remember?* The three fact types have different costs and very
different values — a basis fact ("X holds something in this book") costs half as much as a card fact
and is often worth more, because it is what gates ask legality and drives the `19/43`-style priors.
**Triggers / calibration.** Full 6-player perfect recall of card facts alone would need roughly
2 bits × 48 cards × 6 seats in the worst case; a human plausibly manages a small fraction of that. A
bit budget is therefore a *directly calibratable* handicap.
**Strengths / weaknesses.** Honest, tunable, and fair in a way that "make the bot 25% random" is not:
a bounded-memory bot makes *human-shaped* mistakes — it forgets the oldest, least-relevant facts —
rather than random ones.
**Observable signature.** In humans: the decay curve of [S45](#s45-recency-player). In a bot: exactly
the same curve, by construction.
**Engine mapping — the recommendation.** **Replace the current easy-tier design with a bit budget.**
This repo's easy tier is `logWindow: 6` plus a 25% uniform-random error rate, which is a *recency*
model plus noise. A bit-budget model with a relevance-ranked eviction policy is strictly better as a
difficulty axis: it is monotone (more bits is always at least as strong), interpretable, human-shaped,
and it composes with everything else (a bounded-memory bot can still be a Hoarder, a Blackballer, or a
Signal Broker). Expose `memoryBits` as a config field alongside the T-toggles.
**Sources.** `wh_impl.txt` (framework spec) and `wh_lit.py` (`ActivePlayer` memory accounting), both
read in full. **Note the framework's deck is the 52-card, 7-card-major variant** ([V5](#i1-full-variant-table)) —
the memory model is independent of that, but its constants are not.

#### S45 Recency Player
**Evidence:** `[inferred from rules]`.
**Definition.** Remembers only the last few events; effectiveness decays with the age of the supporting evidence.
**Description.** The default human failure mode, and the cheapest bot handicap. Distinguished from S44 by having no relevance ranking — it keeps the newest facts regardless of value.
**Observable signature.** **The single best skill-level estimator available from the log**: plot `hit_rate` as a function of the *event age* of the evidence that supports the ask. A sharp decay curve is the fingerprint, and its half-life is a per-player parameter.
**Engine mapping.** Shipped as the easy tier (`buildKnowledge(view, { logWindow: 6, useConstraints: false })`). Note the subtlety this repo already handles: with a truncated window, replayed running counts would be wrong, so historical count exhaustion is disabled and resolved books are seeded as gone from the public book state rather than from the log. Any bounded-memory model needs the same care.
**Sources.** Derived; `lib/engine/bots/knowledge.ts`.

#### S46 Own-Hand-Only Player
**Evidence:** `[inferred from rules]`.
**Definition.** Asks purely from hand shape, ignoring the public log entirely.
**Description.** The true novice. Asks are uncorrelated with public information; hit rate sits at baseline; `provably_dead_asks > 0` **accidentally**; claims only books complete in their own hand.
**Observable signature.** Zero correlation between ask choice and log-entailed probabilities; no inference-only claims ever.
**Engine mapping.** A cleaner easy tier than "good tier plus 25% noise", because its mistakes are *systematic* and legible to a learner watching it — it models "I don't know how to use the log yet", which is exactly the beginner's actual state.
**Sources.** Derived.

#### S47 Triage Memorizer
**Evidence:** `[attested-search]`.
**Definition.** Memorise only the books you can contest; actively flush resolved books.
**Description.** pagat's advice is to *save your brain cells* for the half-suits you can actually contest; Develin prefers exact knowledge of a few suits over vague impressions of everything and recommends actively flushing resolved books to free the space; Deposit Genius suggests binding players to cards with rhymes or songs — the only concrete mnemonic device in the corpus. All three are already in this repo's `/strategy` corpus.
**Engine mapping.** This is the human-facing name for the eviction policy of [S44](#s44-bounded-memory-player), and it says what the policy should be: **rank facts by contestability**, not by recency. It also validates the `spotlight`-style focus mechanism found in the bounded-memory reference implementation.
**Sources.** pagat, Develin, Deposit Genius via `/strategy` corpus.

#### S48 Log-Reader
**Evidence:** `[inferred from rules]`.
**Definition.** This app's default: with a persistent visible log, memory ceases to differentiate players.
**Description.** Not a choice a player makes but a regime a table sets. It collapses [S42](#s42-full-log-deductivist)–[S47](#s47-triage-memorizer) into a single style and shifts all skill onto inference and strategy. It is also what makes bot-vs-human results *comparable* — under a no-history rule they are not.
**Engine mapping.** Keep the **observation history** and the **display policy** as separate concepts in the engine, so that bounded-memory opponents can be simulated regardless of what the UI shows. `T10 strictMemory` covers the display side; `memoryBits` ([S44](#s44-bounded-memory-player)) would cover the agent side. Note the two are independent: a full log with a bounded-memory bot is a perfectly coherent (and probably the most useful) configuration.
**Sources.** `RULES.md` row 18; SPEC §11.1.

---

## Part V — Algorithmic play styles

### V.0 The headline finding: Literature is an unclaimed research domain

Targeted searches across arXiv, ACM DL, IEEE Xplore, AAAI proceedings, ResearchGate and university
thesis repositories found **zero peer-reviewed papers, theses or technical reports on Literature /
Canadian Fish / Fish as a game-AI domain**. No baseline agent, no published environment, no
state-space analysis, no equilibrium analysis, no benchmark. Everything in this part is **transfer
from adjacent domains**, and every entry says which domain it comes from.

**Formal placement** (`[inferred from rules]`, using vocabulary from the cited literature):

- Literature is a **two-team, constant-sum, imperfect-information, sequential game** with perfect
  recall and **no explicit communication channel**. Exactly 8 books are distributed, so team scores
  sum to 8 — zero-sum after centring. It is **two-team**, not team-versus-one-adversary, which is the
  harder and much younger setting.
- The communication regime is **ex ante only**: teams may agree on conventions before play but cannot
  communicate during it. In Celli & Gatti's taxonomy that is regime (ii), and its solution concept is
  **Team-Maxmin Equilibrium with Correlation (TMECor)** — a correlated joint team strategy committed
  in advance, not three independent policies. *This is the formal justification for conventions
  existing at all.*
- **All hidden information originates at a single chance node — the deal — and every subsequent action
  and outcome is public.** Asks, answers, transfers and claim resolutions are all public; card counts
  are common knowledge. Therefore **every player's hand at time t is a deterministic function of
  (initial deal, public history)**. Consequences: the belief state is a distribution over *deals*, one
  clean object with no nested beliefs-about-draws as in Hanabi; the public state is common knowledge,
  so public-belief-state methods apply unusually cleanly; hard deduction is exact and cheap; and the
  signalling channel is a **public broadcast with an adversarial eavesdropper** — the bridge situation,
  not the Hanabi one.
- **Branching is tiny; information is everything.** At most 3 targets × ≤40 askable cards = 120 legal
  asks, typically 20–40. Compare chess (~35) and Go (~250). But one seat's information set at the deal
  is 7.66×10²⁴. **Search depth is cheap; belief fidelity is the whole game.** This is the single most
  important design fact for the engine.

**Constraint system emitted by one ask** (P asks Q for card *c* of book *B*):

| Kind | Constraint | Strength |
|---|---|---|
| Legality | P holds ≥1 card of *B* | **hard** |
| Legality | P does **not** hold *c* (unless T6) | **hard** |
| Answer yes | Q held *c*; *c* transfers to P | **hard** |
| Answer no | Q does not hold *c* | **hard** |
| Cardinality | every hand size is known exactly, always | **hard** |
| Book exhaustion | each book has exactly 6 cards, all located | **hard** |
| Target choice | P believed Q rather than the other two opponents | **soft, policy-dependent** |
| Card choice | P chose *c* among all askable cards | **soft, policy-dependent** |
| Failed claim | the declared assignment was wrong; reveals the claimer's model | hard + strong soft |

The hard rows are exactly the pseudo-Boolean at-least/at-most cardinality structure formalised for
Clue; the soft rows are exactly what the trick-taking literature calls **policy-based inference**.

---

#### A1 Constraint-Propagation Deductivist
**How it decides.** Maintain a card×seat ternary matrix {has, has-not, unknown} plus per-seat and
per-book cardinality constraints. Every public event emits clauses; run unit propagation / arc
consistency to fixpoint; any forced location is *proved*. Claim when a book is fully proved for your
team. Optionally lift to a full SAT/pseudo-Boolean encoding for entailment queries ("is it *provable*
that Q holds the 4♠?").
**Fit to Literature: ★★★★★** — better than in any source domain. Literature hands the deduction engine
more free hard constraints than Clue does: exact public hand sizes for all six seats at all times,
exact book sizes, an ask-legality constraint on *every* ask, and total card conservation.
**Failure modes.** Incomplete by construction — it says nothing about the ~90% of the game where cards
are merely probable, and it ignores the soft channel entirely. Must be paired with A2 and A7.
**Citations.** Neller & Luo, *Mixed logical and probabilistic reasoning in the game of Clue*, ICGA
Journal 40(4):406–416 — the reference implementation of cardinality constraints over card deals plus
solution sampling; Meng & Lucas, *Cluedo AI* (FDG '25), which splits deduction into **knowledge
updating** and **action selection**, exactly the decomposition wanted here; Morenville & Piette,
*Modeling Uncertainty: Constraint-Based Belief States in Imperfect-Information Games* (arXiv:2507.19263)
on constraint store vs. factor graph.
**Status here:** shipped (`knowledge.ts`). Two implementation notes worth stealing from prior art: one
Rust engine represents a hand as a vector of **slots**, each carrying either `InBook(book)` or
`IsCard(card)` plus an excluded-card set — a dual encoding that makes "holds ≥1 of this book" a
first-class object rather than a side constraint; and this repo's own trick of translating every fact
into **deal-time variables** keeps stored facts immutable as cards move.

#### A2 Belief-Sampling Probabilist
**How it decides.** Where A1 leaves cards unknown, estimate `P(card c is at seat p | public history)`
by (a) rejection/importance sampling of consistent deals, (b) WalkSAT-style near-uniform solution
sampling with tabu diversification, or (c) **exact model counting** once the residual space is small.
Maintain a weighted particle set over deals and resample after each public event.
**Fit to Literature: ★★★★★**, and the numbers cooperate. Because all hidden information is one deal, a
particle *is* a permutation: trivial to represent, check and update (a public transfer is a
deterministic relabel). Exact enumeration becomes feasible in the last ~3 books, so you can hand off
from sampling to counting exactly where the points are.
**Failure modes.** **Uniform sampling over the consistent set is wrong** — it discards the information
in *why* an opponent asked what they asked. That correction is A7. Also: marginals are not enough
(see A6/A9).
**Citations.** Neller & Luo (above) — the most directly transferable single paper for this project;
*History Filtering in Imperfect Information Games* (NeurIPS 2023, arXiv:2311.14651) on sampling
histories consistent with an information set and its complexity; Morenville & Piette (above).
**Status here:** gap. This repo estimates `P(target holds card)` as *the target's unidentified slots
over all candidates' unidentified slots* — a first-order slot prior, not a sampled belief. It is cheap
and surprisingly serviceable, but it cannot express joint structure within a book, which is what
claims need.

#### A3 Entropy-Driven Asker
**How it decides.** Treat each ask as a query that partitions the belief. Score candidates by expected
entropy reduction (or expected support-size reduction, or Knuth-style minimax over the worst-case
partition), blended with immediate material/tempo EV.
**Fit to Literature: ★★★★☆.** The claim objective makes information the literal currency, and the Bryn
Mawr rules page frames the game in exactly these terms — *"the goal for each player is to collect as
much information as possible about what cards and half-suits are in everyone else's hands."* Two
Literature-specific wrinkles that the deduction-game literature does **not** cover: **(i)** a miss
passes the turn, so information has a price — this is a *cost-sensitive* query problem, not free
20-questions; **(ii)** your query informs the **opponents** too, so the objective is expected
**differential** entropy reduction (yours + partner's − opponents'), not absolute. No published work
was found on either point; (ii) in particular looks like a genuine open problem.
**Failure modes.** Without the tempo term it will happily buy information at ruinous cost; with a naive
absolute-entropy objective it hands the opposition a free map.
**Citations.** Meng & Lucas, *Deduction Game Framework and Information Set Entropy Search* (IEEE CoG
2024, arXiv:2407.21178) — introduces **ISES** and reports beating SO-ISMCTS on 8 deduction games under
tight time budgets, with explainable decisions; Xu, Meng, Verbrugge & Lucas, *CSP4SDG* (AAAI-26,
arXiv:2511.06175) — hard constraints prune, weighted soft constraints score, information gain weights
hypotheses, and it beats LLM baselines; *Comparing question asking strategies for Cluedo* (AISB 2017);
Mastermind/Wordle query-design background (arXiv:1305.1010, arXiv:1207.0773, arXiv:2305.09111 — authors
`UNVERIFIED`).
**Status here:** gap. The `narrowing = 1/(candidates−1)` term in `rankAsksWith` is a crude, single-card
proxy for information gain; it does not measure the partition of the belief and it is not differential.

#### A4 PIMC Determinizer
**Read this before writing one.**
**How it decides.** Sample *N* complete deals consistent with your information set, solve each as a
perfect-information game, vote or average over the per-world best moves.
**Fit to Literature: ★★☆☆☆ — poor, and specifically dangerous.**

> **The strategy-fusion warning.** PIMC implicitly assumes it may play differently in different
> worlds. But **a claim must name one exact assignment**, and in *every* determinization the claimer
> knows the true assignment, so the claim always succeeds. **PIMC therefore evaluates "claim now" as
> near-free in every world and claims constantly, losing books en masse.** This is not a subtle
> degradation; it is a total failure of the game's central action. **Any PIMC-based Literature agent
> must special-case claims out of the search** — gate them through A6 instead.

The second pathology is **non-locality**: uniform determinization samples worlds without conditioning
on *why* opponents and partners chose the asks they did, and since essentially all information in
Literature flows through ask choice, that throws away most of the actual signal. On Long et al.'s
three diagnostic properties, Literature has **low disambiguation** early (asks resolve little) and
**extreme leaf-correlation sensitivity** at claim time — precisely the regime where PIMC is weakest.
**Citations.** Long, Sturtevant, Buro & Furtak, *Understanding the Success of Perfect Information Monte
Carlo Sampling in Game Tree Search*, AAAI 2010, 134–140 — the canonical analysis; Whitehouse, Powley &
Cowling on determinization vs. ISMCTS in Dou Di Zhu (IEEE CIG 2011); Bax, *Determinization with MCTS
for Hearts* (Utrecht thesis) as a readable worked example.
**Status here:** gap, and it should stay one. Useful only as a strength floor and as an ablation.

#### A5 Information-Set MCTS
**How it decides.** Build the tree over *information sets* rather than states. Each iteration samples a
determinization, but statistics are shared at the information-set level, so one policy is learned per
information set — which structurally repairs part of strategy fusion. **MO-ISMCTS** keeps a separate
tree per player over that player's own information sets, which is the variant needed for six
asymmetric observers.
**Fit to Literature: ★★★★☆** — the pragmatic strong baseline. The tiny branching factor makes the tree
shallow and wide in a friendly way, and information sets are cleanly defined by the constraint store.
**Failure modes.** It still needs a world sampler, so it inherits A2/A7's quality directly — ISMCTS on a
*policy-conditioned* sampler is far stronger than on a uniform one. It does not model the team
correlation device, so it under-coordinates with partners relative to TMECor. And Meng & Lucas report
ISES beating SO-ISMCTS on deduction games under tight time limits, so for the pure-inference
sub-problem A3 may dominate it.
**Citations.** Cowling, Powley & Whitehouse, *Information Set Monte Carlo Tree Search*, IEEE TCIAIG
4(2):120–143, 2012 (defines SO-ISMCTS, SO-ISMCTS+POM, MO-ISMCTS); *Combining Prediction of Human
Decisions with ISMCTS in Imperfect Information Games* (arXiv:1709.09451) — the cheap way to make an
ISMCTS bot read human signalling.
**Status here:** gap. Recommended as the v1 opponent to beat.

#### A6 Paranoia Claim Gate
**How it decides.** αμ maintains, at each node, a *vector* of outcomes across sampled worlds and forces
a single action across all of them, eliminating strategy fusion directly. Knowledge-Based Paranoia
Search asks instead: *is there a forced win against every world in my belief space* (or against most
of them)?
**Fit to Literature: ★★★☆☆ overall, ★★★★★ for one high-value sub-problem** — deciding whether a claim
is safe. *"Is this book claimable in every world in my belief support?"* is **exactly** a paranoia
query, and it is exactly the question A4 gets catastrophically wrong. αμ's vector propagation is the
principled repair for claim evaluation generally.
**Failure modes.** Broad αμ use is limited by its "opponents have perfect information" assumption,
which in Literature is very pessimistic — opponents genuinely do not know your hand.
**Citations.** Cazenave & Ventos, *The αμ Search Algorithm for the Game of Bridge* (arXiv:1911.07960),
explicitly motivated by fixing strategy fusion and non-locality; *Optimizing αμ* (arXiv:2101.12639);
Edelkamp, *Knowledge-Based Paranoia Search in Trick-Taking* (arXiv:2104.05423), which reports
above-human Skat play and includes an approximation for "forced win against most worlds".
**Status here:** `partial`. `certainClaim()` is the degenerate paranoia query (support size 1 per card).
**Concrete recommendation: implement KBPS narrowly as the claim gate even if you never build full αμ.**

#### A7 Policy-Conditioned Inference
*The highest ceiling in this review.*
**How it decides.** Instead of sampling worlds uniformly from the consistent set, sample from
`P(world | history) ∝ P(world) · Π_t P(action_t | info_t(world), π̂_actor)`, where `π̂` models each
player's policy. Every ask is evidence about the asker's hand *through their policy*: if a strong
player asks seat 4 rather than seat 2 for the K♦, that is evidence about what they think seat 4 holds,
which is evidence about what they have seen, which constrains the deal.
**Fit to Literature: ★★★★★ — arguably the highest-ceiling idea in this entire review for this game.**
In trick-taking games the soft channel is a modest correction on top of card-play legality. **In
Literature it is the entire game above the hard-deduction floor**, because the only thing you learn
beyond hard constraints is who chose to ask whom for what. An engine with exact deduction but uniform
soft sampling is leaving most of its strength unclaimed; an engine with a good policy-conditioned
sampler **will read conventions it was never told about** — including the Salahuddin convention, the
rally signal and any house code, without being taught any of them.
**Failure modes.** Needs a policy model for every seat *including your partners*; exploitative by
construction, so it is exploitable in turn by a [possum](#s21-playing-possum); and it is only as good
as `π̂`, which for humans requires logs.
**Citations.** Rebstock, Solinas, Buro & Sturtevant, *Policy Based Inference in Trick-Taking Card Games*
(IEEE CoG 2019, arXiv:1905.10911) — reports that player-model-based inference "vastly improves the
inference as compared to previous work" in Skat; Serrino, Kleiman-Weiner, Parkes & Tenenbaum,
*Finding Friend and Foe* / **DeepRole** (NeurIPS 2019, arXiv:1906.02330) — integrates deductive
reasoning **directly into vector-form CFR** in a hidden-role team game and beat humans as both
cooperator and competitor; *DouZero+* (arXiv:2204.02558) for opponent modelling in a team card game.
**Status here:** gap.

#### A8 CFR / TMECor Solver
**How it decides.** Counterfactual regret minimisation over information sets; for ex-ante-only team
communication the target is TMECor — the team commits to a correlated joint strategy, a correlation
device draws a joint plan, play proceeds without further communication. Implemented by transforming
the team into a single coordinator over joint plans, or by column generation / double oracle.
**Fit to Literature: ★★★☆☆ overall, ★★★★★ for endgames.** The **theory is exactly right** — TMECor is
the correct solution concept and it is what makes "conventions" a formally meaningful object. The
**scale is the problem**: 2.89×10³³ deals, and the team-plan space compounds that. Two realistic uses:
(1) **endgame solving**, where the residual space is small enough to solve exactly or nearly so, and
where most points are decided; (2) **abstraction + blueprint** — solve a heavily abstracted Literature
to *discover conventions*, then transfer them as priors.
**Failure modes.** Literature is **two-team**, not team-vs-one, so most TMECor algorithms do not apply
off the shelf and the two-team literature reports hardness results. And equilibrium carries **no win
guarantee** at six players anyway.
**Citations.** Zinkevich, Johanson, Bowling & Piccione, *Regret Minimization in Games with Incomplete
Information* (NIPS 2007); **Celli & Gatti**, *Computational Results for Extensive-Form Adversarial Team
Games* (AAAI 2018, arXiv:1711.06930) — **the framing paper for Literature**: it defines the three
communication regimes, gives the right solution concept for each, and bounds the inefficiency of
restricted communication; two-team results at arXiv:2111.04178 and arXiv:2409.07398 (authors
`UNVERIFIED`); Brown & Sandholm, *Superhuman AI for multiplayer poker* (Pluribus, Science 2019) for the
"no guarantee, but it works at six players" posture.
**Status here:** gap.

#### A9 Public-Belief-State Search
**How it decides.** Define the state as the **public belief state** (public history + joint
distribution over private information). Learn a value function and policy over PBSs by self-play; at
runtime run depth-limited equilibrium-finding inside the current PBS subgame with the learned value at
the depth limit.
**Fit to Literature: ★★★★★ on structure — this is the "Stockfish" answer.** Because all hidden
information comes from one chance node and everything else is public, the **PBS is literally "a
distribution over the 48-card deal"** and the public history is common knowledge with no ambiguity.
That is a better-behaved PBS than poker's and far better than Hanabi's, and public information is
provably the necessary and sufficient context for optimal depth-limited value functions.
**Failure modes.** The guarantees are for two-player zero-sum; Literature is two-team and six-handed,
so you inherit Pluribus's posture plus the "subgame solving is unsound without common knowledge"
caveat. The PBS is high-dimensional, so it must be represented by sufficient statistics — the natural
choice is the **48×6 marginal matrix plus per-book joint summaries**, which is small and, given the
hard constraints, surprisingly informative.
**Citations.** Brown, Bakhtin, Lerer & Gong, **ReBeL** (NeurIPS 2020, arXiv:2007.13544); Moravčík et al.,
**DeepStack** (Science 356:508–513, 2017); Schmid et al., **Student of Games** (Science Advances 2023,
arXiv:2112.03178) — also notable for beating the SOTA agent in Scotland Yard, a deduction-flavoured
game; Kovařík et al., *Value Functions for Depth-Limited Solving* (AIJ 314:103805, arXiv:1906.06412);
Kovařík, Schmid, Burch, Bowling & Lisý, *Rethinking Formal Models of Partially Observable Multiagent
Decision Making* (AIJ 2022, arXiv:1906.11110) — **factored-observation stochastic games**, the
formalism to write Literature down in.
**Status here:** gap. The correct destination, reachable via A1/A2/A7 + A10, not cold.

#### A10 Blueprint + Single-Agent Search
*Best strength per unit of effort.*
**How it decides.** Fix a blueprint policy all teammates are assumed to follow. At your turn, maintain
the exact Bayesian belief induced by everyone playing the blueprint, then **search only over your own
next action**, evaluating each by rolling out with the blueprint for everyone including future-you.
Single-agent search improves on the blueprint with a guarantee of not making it worse, up to bounded
approximation error.
**Fit to Literature: ★★★★★** and the strongest recommendation here for a *first strong* engine.
(i) The belief-under-blueprint is exactly computable, because all information is public plus one deal —
the Bayes update is a reweighting of consistent deals. (ii) The never-worse-than-blueprint property is
enormously valuable when the blueprint is a hand-written convention system **that human partners also
follow**. (iii) It **preserves conventions** rather than destroying them, which naive search does.
(iv) It composes perfectly with A1/A2/A7 — the belief it needs *is* the A2 belief reweighted by the A7
policy model.
**Failure modes.** Designed for a fully cooperative game; the adaptation is to run it against the
*team's* blueprint while treating opponents as adversarial policy models. Needs a simulator and a
blueprint worth having.
**Citations.** Lerer, Hu, Foerster & Brown, **SPARTA** — *Improving Policies via Search in Cooperative
Partially Observable Games* (AAAI 2020, 34:7187–7194, arXiv:1912.02318, code at
`facebookresearch/Hanabi_SPARTA`); Foerster et al., **Bayesian Action Decoder** (ICML 2019,
arXiv:1811.01458) — the public-belief-MDP construction, the cleanest statement of "reason about what
your action reveals"; *Simplified Action Decoder* (ICLR 2020) as the cheaper practical version.
**Status here:** gap. Moderate cost: one belief update plus |A| ≤ 120 rollouts per turn.

#### A11 Self-Play Deep RL
**How it decides.** Encode observation (own hand, public history, counts, book status) as tensors and
learn value/policy by massive self-play, with no explicit belief model.
**Fit to Literature: ★★★☆☆.** It works and it is cheap to start, but it fights the game's structure: it
must *learn* the deduction A1 gives exactly and free, and *learn* a belief representation the game
hands you analytically. The strongest use is **hybrid** — compute belief features with A1/A2 and let RL
learn the policy over beliefs.
**Failure modes.** Brittle to distribution shift; and — critically — **self-play invents private
conventions its human partners cannot read** (see A12). Prior art here is thin and 4-player:
`neelsomani/literature` scores serialised (state, move) pairs with an `MLPRegressor` trained by
self-play, caps games at 200 moves to prevent non-termination, and — a genuinely instructive detail —
its move generator first restricts to asks that are not known misses, and only if that set is
**empty** re-admits known-miss asks, on the explicit reasoning that such an ask *"might still be useful
to signal to teammates what card this Player does or does not possess."* That is [S4](#s4-known-negative-ask)
appearing as an engineering fallback. Note its results are **4-player** and should not be read as
6-player evidence.
**Citations.** Zha et al., **DouZero** (ICML 2021, arXiv:2106.06135) — three-player, competition +
collaboration, huge varying action set, and an action-encoding trick that maps well onto Literature's
variable legal-ask set; *DanZero+* (arXiv:2312.02561) — the closest published *team* card-game RL;
Li et al., **Suphx** (arXiv:2003.13590) — global reward prediction, oracle guiding, runtime adaptation;
OpenSpiel (arXiv:1908.09453) and RLCard for tooling.
**Status here:** gap, and out of scope by SPEC §12 (no LLM, and the deterministic-bot requirement).

#### A12 Zero-Shot Coordinator
**How it decides.** **Other-Play** regularises self-play by the game's known symmetries — the agent must
do well when its partner's policy is any symmetry-relabelling of its own — which kills arbitrary
"secret handshake" conventions. **Off-Belief Learning** goes further, training the agent to act
optimally under the belief that partners played a fixed base policy up to now, yielding a unique
convergence point. **k-level reasoning** builds a hierarchy of best responses.
**Fit to Literature: ★★★★☆ and conditionally essential.** Literature has an enormous explicit symmetry
group — **the four suits are interchangeable, and in most rule sets the low/high split is a labelling**
— so Other-Play has exactly the structure it needs, and using it prevents the engine learning "I always
ask spades first to mean X". Whether you *want* that depends entirely on the product: if the engine
plays with **human partners** or foreign agents, OP/OBL are close to mandatory; if it plays all six
seats or with a fixed known partner, you *want* arbitrary conventions, because they are free bandwidth.
**Decide this before training.**
**Failure modes.** The adversarial wrinkle again: in Hanabi a convention is pure profit, in Literature
the opponents hear it. The optimal convention set is the one maximising *differential* information, and
no paper was found addressing that.
**Citations.** Hu, Lerer, Peysakhovich & Foerster, ***Other-Play* for Zero-Shot Coordination** (ICML
2020, arXiv:2003.02979); Hu, Lerer, Cui, Pineda, Wu, Brown & Foerster, **Off-Belief Learning** (ICML
2021, arXiv:2103.04000); Cui et al., *K-level Reasoning for Zero-Shot Coordination in Hanabi* (NeurIPS
2021); Bard et al., **The Hanabi Challenge** (AIJ 280:103216, arXiv:1902.00506) — the framing paper for
communication-free coordination through action choice; *Self-Explaining Deviations for Coordination*
(arXiv:2207.12322) on deviating from a convention *interpretably*, which is directly relevant to
Literature's "unexpected ask" problem.
**Status here:** gap.

#### A13 Human-Regularized Searcher
**How it decides.** Run search but regularise the searched policy toward a human-imitation anchor with a
KL penalty, so the agent stays inside the manifold of behaviour humans can interpret while being much
stronger.
**Fit to Literature: ★★★★☆, and very high value for a *product*.** Literature has strong human
conventions; a bot that plays them and searches inside them feels like a great human player rather than
an alien one. Cicero is the only published system that plays a many-player, team-forming,
communication-heavy game at human level, and its **intent-conditioned planning** is the right shape for
reading Literature partners.
**Failure modes.** Needs human game logs to fit the anchor. **That is a concrete, time-sensitive action
item: no public Literature dataset exists, so the app must be instrumented to collect full public
histories plus revealed hands, and the data is the moat.**
**Citations.** Meta FAIR Diplomacy Team, *Human-level play in the game of Diplomacy by combining language
models with strategic reasoning* (**Cicero**), Science 378(6624):1067–1074, 2022 (individual author
names `UNVERIFIED` — the search result did not enumerate them); *Human-AI Coordination via
Human-Regularized Search and Learning* (arXiv:2210.05125, authors `UNVERIFIED`).
**Status here:** gap; gated on logging.

#### A14 Opponent-Model Exploiter
**How it decides.** Fit per-seat models of (i) **what they will ask** — which feeds A7's inference — and
(ii) **what they believe** — which predicts when they will claim and lets you make asks that mislead
them. Then best-respond rather than equilibrium-play.
**Fit to Literature: ★★★☆☆ standalone, ★★★★★ as a component of A7.** The unusually exploitable
behaviours are concrete: opponents who ask greedily (revealing their whole hand shape), opponents who
claim on insufficient evidence (bait them), and opponents who fail to notice that *your* ask was
constrained. There is also a genuine **deception** dimension unique to games with public queries — a
legal but informationally misleading ask — for which no published treatment was found in this setting.
**Failure modes.** Exploitative and therefore exploitable; pair with a safety floor that falls back to
the blueprint when model confidence is low.
**Citations.** Rebstock et al. (arXiv:1905.10911); DeepRole (arXiv:1906.02330); *DouZero+*
(arXiv:2204.02558); *Modeling Other Players with Bayesian Beliefs for Games with Incomplete Information*
(arXiv:2405.14122, authors `UNVERIFIED`).
**Status here:** gap. The [detection panel](#vi4-opponent-detection-statistics-panel) is the feature set.

#### A15 Symbolic + LLM Hybrid
**How it decides.** Constraint/information-theoretic machinery does the deduction; a language model, if
present at all, narrates or is a tool-caller.
**Fit to Literature: ★★☆☆☆ — methods yes, LLM-as-player no.** Literature's inference is exactly
formalisable, so a solver dominates a language model on the core task. CSP4SDG's own result is that the
constraint framework **beats** LLM baselines and is best used as a tool the model calls. The one thing
worth borrowing is the **explainability** claim of symbolic-plus-learned hybrids — and the A1+A3 stack
gives you that for free, symbolically ("this ask splits your uncertainty about High Hearts in half"),
which is excellent for a teaching UI.
**Citations.** Xu, Meng, Verbrugge & Lucas, *CSP4SDG* (AAAI-26, arXiv:2511.06175); DeepRole
(arXiv:1906.02330). Also noted, and explicitly **`UNVERIFIED` as academic work**: the NooK/NukkAI
hybrid symbolic + deep-learning bridge system reported in press to have beaten eight world champions at
declarer play (Paris, March 2022) — extensively covered in the press, but **no peer-reviewed paper was
surfaced**; treat it as a press claim, not a citation.
**Status here:** n/a — SPEC §12 rules out LLMs, and this document agrees for the player role.

### V.1 Comparison

| Family | Fit | Simulator | Training | Runtime | Models opponents | Play style | Build order |
|---|---|---|---|---|---|---|---|
| [A1](#a1-constraint-propagation-deductivist) constraint propagation | ★★★★★ | no | no | µs | no | sharp, correct | **1st** (done) |
| [A2](#a2-belief-sampling-probabilist) belief over deals | ★★★★★ | no | no | ms | no | calibrated | **2nd** |
| [A3](#a3-entropy-driven-asker) entropy-driven asking | ★★★★☆ | no | no | ms | no | very human-expert | **3rd** |
| [A7](#a7-policy-conditioned-inference) policy-based inference | ★★★★★ | no | model | ms–s | **yes** | scarily perceptive | **4th** |
| [A10](#a10-blueprint--single-agent-search) blueprint + search | ★★★★★ | yes | blueprint | s | partly | strong teammate | **5th** |
| [A5](#a5-information-set-mcts) MO-ISMCTS | ★★★★☆ | yes | no | s | via sampler | solid, loose | baseline |
| [A6](#a6-paranoia-claim-gate) paranoia claim gate | ★★★☆☆ (★★★★★ claims) | yes | no | s | no | conservative | claim gate |
| [A13](#a13-human-regularized-searcher) human-regularized | ★★★★☆ | yes | human logs | s | yes | legible + strong | product |
| [A11](#a11-self-play-deep-rl) self-play RL | ★★★☆☆ | yes | GPU-weeks | ms | implicitly | alien | later |
| [A12](#a12-zero-shot-coordinator) Other-Play / OBL | ★★★★☆ | yes | GPU-weeks | ms | no | human-compatible | with A11 |
| [A9](#a9-public-belief-state-search) PBS + depth-limited | ★★★★★ | yes | GPU-weeks | s | no | alien, strongest | destination |
| [A8](#a8-cfr--tmecor-solver) CFR / TMECor | ★★★☆☆ (★★★★★ endgame) | model | heavy | offline | no | unexploitable, alien | endgame |
| [A14](#a14-opponent-model-exploiter) opponent modelling | ★★★☆☆ | no | logs | ms | **yes** | predatory | with A7 |
| [A4](#a4-pimc-determinizer) PIMC | ★★☆☆☆ | yes | no | ms | no | alien; **throws games away on claims** | ablation only |
| [A15](#a15-symbolic--llm-hybrid) LLM hybrid | ★★☆☆☆ | no | — | s–min | yes | verbose | explanation only |

### V.2 Known failure-mode checklist

1. **PIMC claims constantly and loses** — strategy fusion makes every claim look free. → gate claims via [A6](#a6-paranoia-claim-gate).
2. **Uniform world sampling silently discards the signalling channel** — the main information source in this game. → [A7](#a7-policy-conditioned-inference).
3. **Self-play invents private conventions humans cannot read.** → [A12](#a12-zero-shot-coordinator) if human partners matter.
4. **Equilibrium gives no win guarantee at six players** (Pluribus's own framing, plus two-team hardness results). → do not over-invest in exact solving outside the endgame.
5. **Subgame solving is unsound without common knowledge** in >2-player settings (arXiv:2106.06068). → be careful re-solving mid-game.
6. **Belief must not be summarised to marginals alone.** Claiming needs the **joint** over a book's six cards; six correct marginals are not one correct assignment.
7. **Your conventions leak to opponents** — unlike Hanabi. Optimise *differential*, not absolute, information gain. No literature found on this.
8. **A "first to 5" terminal test plus the void rule can hang.** → see [V35](#v35-first-to-five-ends-the-game).

---

## Part VI — Engine specification

Everything above, reduced to what to build. Where a component already exists in
`lib/engine/bots/`, that is named.

### VI.1 Evaluation terms

| Term | Origin | Notes |
|---|---|---|
| **Win/draw/loss probability**, not linear book count | [S27](#s27-the-spoiler) | A book-count maximiser can never find the Spoiler, and cannot reason about the 4–4 tie as a target. Use a WDL head. |
| `P(contained[book])` | [II.3](#ii3-claiming-doctrine) | **Kept separate from assignment.** Drives the claim gate. |
| `P(assignment[book] \| contained)` | [II.3](#ii3-claiming-doctrine) | Scales captured value only. Claim iff `c > 1/(1+a)` (void rule) or `c·a > 0.5` ([V17](#v17-any-error-scores-for-the-opponents)). |
| `Unaskable(book)` — hard predicate | [S23](#s23-hoarder) | Zero decay risk ⇒ banking is free; also yields the cheapest legal exit. Compute first at every node. |
| `Danger(seat) = f(cards, knowledge_score, books_contested_with_us)` | [S13](#s13-blackballing) | Scales the cost of a miss per target. `knowledge_score` from **what the log entails for that seat**, not their observed behaviour ([S21](#s21-playing-possum)). |
| `V(opponent on move)` | M2, [S14](#s14-turn-parking) | The miss branch is a **choice**, not a penalty. |
| `OptionValue(seat, book) = 1[holds ≥1]` | [S16](#s16-foot-in-the-door), [S17](#s17-key-stripping) | Value of a key-strip = the option value destroyed, which can far exceed the card. Self-preservation term on our own singletons. |
| Hand-size term, **non-monotonic** | [S15](#s15-lightning-rod) | Ask-rights breadth + decoy value − drain exposure; tuned interior optimum. |
| Hand-shape term `Σ_books g(cards_in_book)`, **phase-conditioned** | [S33](#s33-breadth-shape)/[S34](#s34-depth-shape) | `g` concave early (breadth = options), convex late (depth = containment). |
| `+w_team·ΔH_team − w_opp·ΔH_opponents` (per observer) | M1 | **Opposite signs, computed per observer, conditioned on each observer's own hand.** Not symmetric, not global. |
| Cumulative per-turn leak, **convex** | [S7](#s7-chain-discipline) | Penalise ask-clustering superlinearly, not per ask. |
| `V(force_endgame)` | [S28](#s28-endgame-solo-declarer)/[S29](#s29-endgame-dumping) | Requires the endgame to be solved first, then backed up. |
| Book value weights | T5 `highBooksDouble` | Every EV term above must be weighted; high books justify ~2× the risk. |

### VI.2 Search architecture

1. **Compute `Unaskable(book)` first at every node.** It gates claim timing, zeroes banking decay
   risk, and yields an exact zero-cost turn-terminator when one exists ([S19](#s19-contained-book-exit)).
2. **Do not prune provably-failing asks** ([S4](#s4-known-negative-ask)) and do not collapse
   certain-hit asks ([S5](#s5-confirmation-ask)). Both are strategically load-bearing; a naive
   generator prunes the first as dominated and prices the second as ordinary.
3. **Ask nodes are `(target, card)` pairs and target choice must be searched**, not fixed by
   heuristic. Branching ≈ 3 targets × legal cards ≈ 20–40, up to 120. That is cheap.
4. **Miss branches are handoffs.** Evaluate as the (negated) value of the *chosen* opponent's
   position — negamax with a chosen successor.
5. **"Claim book B" must be a legal move at every node**, including when B is not the objective,
   because its value can flow entirely through the turn transfer ([S20](#s20-stalemate-breaker),
   [S32](#s32-control-transfer-claim)).
6. **Add a tactical move class for key-strips** ([S17](#s17-key-stripping)) so they are scored against
   destroyed option value rather than as ordinary hits.
7. **Cache a null-move candidate**: `argmin over legal asks of opponent_ΔH` subject to a safe target
   set. Check contained books first — they solve it exactly.
8. **Gate every claim through a paranoia query** ([A6](#a6-paranoia-claim-gate)): is this book
   claimable in *every* surviving world? Never let a determinizing search evaluate claims directly
   ([A4](#a4-pimc-determinizer)).
9. **Solve the endgame exactly** and back its value into the midgame ([S28](#s28-endgame-solo-declarer)).
10. **Maintain a stable, published baseline policy.** Rally signals ([S38](#s38-rally-signal)) are
    defined as deviations from it, so a constantly-retrained baseline destroys the channel — and the
    engine's own baseline becomes common knowledge and therefore itself a signalling medium.
11. **Belief before depth.** Branching ≤120 versus information sets up to 10²⁵: the strength budget
    goes almost entirely into belief quality, not search depth.

### VI.3 Belief model

- **Layer 0 — exact deduction** ([A1](#a1-constraint-propagation-deductivist)): the three-tier lattice
  (`known` / `knownset` / `possible`) plus exact per-seat cardinality constraints, propagated to
  fixpoint after every public event. Implement the **Hall/pigeonhole propagator** generically —
  "n cards of a book in `knownset` for a seat known to hold n of that book" forces all n.
  *Shipped as `knowledge.ts`, including deal-time-variable translation so facts survive card movement.*
- **Layer 1 — calibrated belief** ([A2](#a2-belief-sampling-probabilist)): a weighted particle set over
  consistent deals; switch to **exact enumeration** once ≲18 unknown cards remain (see the
  [Appendix](#appendix--verified-combinatorics) — the residual space is ~10⁷ pre-constraint and far
  smaller after). Keep **per-book joints**, not just marginals: six correct marginals are not one
  correct assignment.
- **Layer 2 — policy-conditioned reweighting** ([A7](#a7-policy-conditioned-inference)): reweight
  particles by `P(observed asks | world, π̂_seat)`. This is where the signalling channel is decoded and
  where most of the superhuman edge lives.
- **Depth-1 recursive beliefs only** ([S37](#s37-implicit-target-signal)) — model what each seat knows,
  not what each seat knows about what others know. The one prior implementation that tried it stopped
  there deliberately.
- **Update on non-asks** (M3): after each turn, apply a soft Bayesian penalty to hypotheses under which
  the mover had an obviously better available ask than the one played. Nothing found implements this.
- **Concealment prior** ([S3](#s3-the-cloak)): never infer "lacks book B" from "never asked in B";
  weight by measured concealment tendency.
- **Pluggable constraint hardness**: under T6 the `asker ∉ holders(card)` clause must degrade from hard
  to soft with a bluff-rate parameter, not be deleted. Build this seam now, not later.
- **Memory model parameter, separate from the display policy**: perfect recall vs. `memoryBits`
  ([S44](#s44-bounded-memory-player)) vs. `logWindow` recency. T10 controls what the *UI* shows; the
  agent's capacity is an independent axis.
- **Useful priors** ([S42](#s42-full-log-deductivist)): at six players, a seat that has certified a book
  holds any given remaining card of it with probability 1, 5/9, 19/43 for 1/2/3 cards left; an
  uncertified seat, 0, 1/9, 6/43. Certification is worth roughly a 5× likelihood ratio.

### VI.4 Opponent-detection statistics panel

Every statistic below is computable from the public log alone, which means the engine can run the whole
panel on all five other seats every turn, and persist per-seat profiles across games in a club setting
([S35](#s35-the-reader)).

| Statistic | Detects |
|---|---|
| `target_share[p]` collapsing across all three attackers **and persisting when p is the likely holder** | [Blackballing](#s13-blackballing) |
| Own `inbound_ask_share` collapsing | **We are being blackballed** — trigger the counter-play repertoire |
| `provably_dead_asks / total_asks` | [Known-Negative Ask](#s4-known-negative-ask) — and, when deliberate, expertise |
| `provably_certain_asks`, especially ≥2 in one book | [Confirmation Ask](#s5-confirmation-ask) → **claim imminent** |
| Gap between `E[target_danger \| miss]` and `E[target_danger \| hit]`; `corr(p_hit, target_danger) > 0` | [Turn-Parking](#s14-turn-parking) |
| `distinct_books_entered / asks` high with `hit_rate` low | [Signal Broker](#s1-signal-broker) |
| `latency_from_first_hold_to_first_ask`; late multi-hit bursts in never-entered books | [The Cloak](#s3-the-cloak) |
| `mean_claim_delay`, `banked_book_turns` | [Hoarder](#s23-hoarder) vs [Snap Claimer](#s24-snap-claimer) |
| `claim_accuracy`, `void_rate`, `gift_rate` **as three separate rates** | [Purist](#s25-certainty-purist) vs [EV Claimer](#s26-ev-claimer) (voids, no gifts) vs [Brazen Prober](#s30-brazen-prober) (gifts) |
| `void_rate \| leading` ≫ `void_rate \| trailing` | [The Spoiler](#s27-the-spoiler) |
| `claims_attempted / books_provably_contained` | Their claim threshold θ |
| `same_target_consecutive_ask_rate`, `same_book_consecutive_ask_rate` | [Chain Discipline](#s7-chain-discipline) (low) vs greedy/novice (clustered) |
| `hit_rate` as a function of **evidence age** (decay curve, half-life) | [Memory model](#s45-recency-player) — the best single skill-level estimator |
| `deducible_certainties` high while `provably_certain_asks` ≈ 0 and no claims | [Playing Possum](#s21-playing-possum) |
| `P(partner asks in same book \| partner's prior ask failed)` + the card-choice mapping | [Salahuddin convention](#s36-ali-salahuddin-convention) in use |
| `P(partner enters book B ≤2 turns \| low-prior ask in B)` | [Rally Signal](#s38-rally-signal) |
| `cards_held` flat/rising with `books_claimed == 0`, high `inbound_ask_share` | [Lightning Rod](#s15-lightning-rod) |
| `team_card_count` slope steeply negative, claims not keeping pace | [Endgame Dumping](#s29-endgame-dumping) |
| `lockout_asks` (hits on a target's provably-final card of a live book) | [Key-Stripping](#s17-key-stripping) |
| `self_ask_violations > 0` | T6 is on, or someone is cheating |
| `forced_rate` | Position health; [Forced Claimer](#s31-forced-claimer) frequency |
| **Excess mutual information** between a seat's ask and their hidden hand, vs. a permutation null | Any convention at all, taught or [emergent](#s41-emergent-convention) |

### VI.5 Difficulty tiers — archetypes as shippable bots

The research supports a **seven-rung ladder**. Rungs 1–4 exist in this repo in some form; 5–7 are the
build-out. Note the tiers vary along **two independent axes** — inference depth and strategic
repertoire — and the current implementation conflates them.

| Tier | Name | Composition | Repo status |
|---|---|---|---|
| 1 | **Random-Legal** ([S49](#s49-random-legal-floor)) | Uniform among legal asks; claim only when forced. | `fallbackAction()` |
| 2 | **Own-Hand-Only** ([S46](#s46-own-hand-only-player)) | Hand shape only; ignores the log; claims only books complete in hand. | gap — recommended replacement for the current easy tier |
| 3 | **Bounded-Memory Greedy** ([S44](#s44-bounded-memory-player) + [S50](#s50-one-ply-greedy)) | One-ply greedy over a **bit-budgeted** memory with relevance-ranked eviction. | current easy ≈ recency + 25% noise; **swap to a bit budget** |
| 4 | **Deductivist** ([S42](#s42-full-log-deductivist) + [S24](#s24-snap-claimer)) | Full lattice, full constraints, certain hits first, claims at certainty. | **shipped** = current medium |
| 5 | **Turn-Controller** | Adds [Blackballing](#s13-blackballing), [Turn-Parking](#s14-turn-parking), [Chain Discipline](#s7-chain-discipline), [Key-Stripping](#s17-key-stripping). | current hard has fragments: `leaky` tiebreak, fewest-cards miss target |
| 6 | **Conventionalist** | Adds [Salahuddin](#s36-ali-salahuddin-convention)/[Signal-Back](#s39-signal-back) encode+decode, [Known-Negative asks](#s4-known-negative-ask) as a real move class, [The Cloak](#s3-the-cloak). | gap; **must be room-configurable** (see [S40](#s40-convention-prohibition)) |
| 7 | **Full engine** | Adds unaskability-aware [hoarding](#s23-hoarder) and banking, general [EV claiming](#s26-ev-claimer), [Spoiler](#s27-the-spoiler), endgame steering, WDL evaluation, depth-1 opponent modelling, [A7](#a7-policy-conditioned-inference) inference, [A10](#a10-blueprint--single-agent-search) search. | gap |

### VI.6 The five highest-value changes to the current bot

Ordered by expected strength gain per unit of work.

1. **Stop snap-claiming.** `certainClaim()` fires the moment a book is certainly on the team, but by
   [S23](#s23-hoarder) a contained book is an absorbing state — it cannot be attacked or stolen, so
   claiming early has **no defensive value at all** under the pinned rules. Replace with: claim when
   (a) tempo demands it (a teammate needs the turn, i.e. the [stalemate-breaker](#s20-stalemate-breaker)),
   (b) the endgame is being forced, or (c) the game is ending. Keep an unclaimed contained book as both
   a banked asset and a free pass move. *This is a small diff with a large expected effect, and it is
   testable immediately in the existing 1,000-game round-robin harness.*
2. **Make target choice a searched decision.** Today the miss branch is a tiebreak (fewest cards);
   `V(opponent on move)` should be an evaluated successor. This is M2, and it unlocks
   [S13](#s13-blackballing), [S14](#s14-turn-parking) and [S12](#s12-least-informed-targeting) at once.
3. **Promote the known-negative ask from a stalemate hack to a first-class move.** `signallingAsk()`
   currently fires only when *every* legal ask is a known miss **and** nothing has hit in 8 events.
   Deliberate misses are a mainline tool ([S4](#s4-known-negative-ask)), and contained books make some
   of them free ([S19](#s19-contained-book-exit)).
4. **Add the missing toggles**, in order:
   [V17](#v17-any-error-scores-for-the-opponents) (wrong claim → opponents score) —
   [V35](#v35-first-to-five-ends-the-game) (first-to-N termination, with a guard against combining it
   with the void rule) — [V39](#v39-secret-hand-sizes) (secret hand sizes) —
   book-partition-as-data ([V2](#v2-sevens-out-ace-low-deck)/V5/V6) — `memoryBits`.
5. **Instrument the logs.** Every ambition in Part V above rung 5 is gated on human game data — the
   anchor policy for [A13](#a13-human-regularized-searcher), the policy models for
   [A7](#a7-policy-conditioned-inference), and the whole
   [detection panel](#vi4-opponent-detection-statistics-panel)'s calibration. **No public Literature
   dataset exists.** Note this collides with SPEC §1's six-hour hard-delete retention policy: collecting
   research logs is a *product decision with privacy consequences* that must be made deliberately, not
   as a side effect.

---

## Part VII — Contradictions and open questions

### VII.1 Where sources genuinely disagree

| # | Question | Position A | Position B | Status |
|---|---|---|---|---|
| C1 | Your team holds all six but you misattribute a card | **Void** — nobody scores. pagat *baseline*, Wikipedia, `literature-rl` ("thrown in"), Rocky-921, akshith6212 | **Opponents score.** pagat *variations*, Bryn Mawr, `playfish.io`, `amy-lei/fish`, `cfish`, `littplay` | **Not a source conflict.** pagat carries both — A as the rule, B as a listed variation. This repo follows the baseline correctly; the gap is a missing toggle. See [V17](#v17-any-error-scores-for-the-opponents). |
| C2 | When may a claim be made? | **On your own turn.** pagat, Wikipedia | **Any time**, pausing play. `cfish` (as its *default*), `amy-lei/fish` (self-labelled non-standard), Grokipedia. Plus a third mode, `team-turn`, in one implementation's config | Real fork. A is the documented rule; B is a live community default. Toggle T8 covers the binary; `team-turn` is unrepresented. |
| C3 | Who takes the turn after a successful claim? | **The claimant's turn continues.** pagat | **The claiming team chooses who asks next.** Wikipedia — stated as a rule, not a variation | **Unresolved.** The two most reputable sources state different rules as baseline. Wikipedia's strictly generalises pagat's (the team can always choose the claimant). Toggle T7 covers B. Note the interaction: under A the classic [stalemate-breaker](#s20-stalemate-breaker) only works when the claim empties the claimant. |
| C4 | Does play stop early? | **All books are played out**; 4–4 ties. pagat, Wikipedia | **First to 5** (or to a majority). `amy-lei`, `playfish.io`, Litaf, `cfish` | Real fork, and B is only coherent when C1-B is also in force. A + first-to-5 is an outright bug. |
| C5 | Which ranks are removed? | **8s out** (2–7 / 9–A) — dominant everywhere | **7s out, Ace low** (A–6 / 8–K) — pagat lists it; `littplay` implements it. Also **2s out** (unattributed) and **52 cards with 7-card majors** (one framework) | Multiple real forms. Also note the regional attributions conflict: one extract calls the *8s-out* form "common in India" while an explicitly Indian implementation uses *7s-out*. One of those is wrong. |
| C6 | Card counts: public or private? | **Public** — this repo (row 18), most implementations | **Private** — *"players must reveal if asked whether they have cards or not, but do not have to reveal how many"*; `cfish` `HandSizeRule.SECRET` | Real fork with large engine consequences. See [V39](#v39-secret-hand-sizes). |
| C7 | May you ask for a card you hold? | **No** — baseline everywhere | **Yes**, as an advanced/bluffing variant. Wikipedia, pagat variations | Agreed to be A-standard/B-optional; listed because B **invalidates a core inference rule** and needs a different reasoning engine. |
| C8 | Claim immediately, or hoard? | **Claim as soon as all six locations are known** | **Hold it** — as camouflage, as a banked asset, as a [stalemate-breaker](#s20-stalemate-breaker) | **Resolved for this ruleset in favour of hoarding**, by the absorbing-state argument in [S23](#s23-hoarder). The claim-early advice is best explained as inherited from memory-limited live play and from C1-B tables. Note it is also partly *rule*-dependent: T3 `mandatoryDeclare` forbids hoarding outright. |
| C9 | Signal, or stay silent? | **Emit as much as possible to teammates** — the M1 maxim, and a named convention exists | **Every signal helps three opponents and only two partners**; prearranged codes are cheating | **Genuinely unresolved in the community.** The two are one tunable parameter for an engine ([S1](#s1-signal-broker)/[S2](#s2-prohibitionist)) and the highest-value question self-play could settle. |
| C10 | Is bluffing good or ruinous? | *"Makes it much harder to deduce the locations of cards"* | *"Not very common among most players, because it can make the game very complicated and confusing"* | Contested; minority rule. Every implementation ships it off. |
| C11 | Is blackballing universal wisdom? | *"One of the most important strategies"* | *"…effective so long as your teammates are paying as much attention as you"* — it fails if any one teammate defects, and starving one opponent means feeding the other two | Widely endorsed but **explicitly conditional on team coordination**. |
| C12 | What does "Russian Fish" mean? | A **six**-player game, two teams of three (De Smet's own page) | The **eight**-player variant (one aggregator); or simply another alias for the same game (pagat) | The name is genuinely ambiguous. **Do not use "Russian Fish" as a player-count label.** |
| C13 | Who asks first? | The dealer (Deposit Genius) | The player who drew the highest card (Bryn Mawr); a fixed or random seat (implementations) | Minor; matters only for reproducibility and for measuring first-move advantage. |
| C14 | How is the game scored? | Count books; 4–4 is a tie | *"The first player to earn 100 points wins"* (gamerules.com) | B looks erroneous — the same page describes no per-book point values and says "player" for a partnership game. But **multi-deal match play is a real format question** even if the number is spurious. |
| C15 | Does the Challenge exist? | Two prose sources describe it, one of them the older Wikipedia text | Absent from pagat and current Wikipedia | **Upgraded by this pass:** an implementation was found that implements it in full, so the mechanic is real somewhere even if its distribution is unknown. See [V23](#v23-the-challenge). |

### VII.2 Open questions this document could not answer

1. **Differential information gain has no literature.** Every entropy-driven method found optimises
   *absolute* information gain. In Literature your query informs three opponents as much as two
   partners, so the correct objective is `ΔH_partners − ΔH_opponents`. No paper was found on
   cost-sensitive querying with an adversarial eavesdropper. This is a genuine open problem and a
   plausible research contribution.
2. **What is the optimal convention under an eavesdropper?** Related to (1). Hanabi conventions are
   pure profit; Literature conventions are not. The optimal codebook is presumably one whose decoding
   requires private context (what the decoder holds) that opponents lack — but nobody has formalised
   this.
3. **Is the Spoiler ([S27](#s27-the-spoiler)) real?** Deliberately voiding a book to protect a lead is
   derivable from the rules and no source describes anyone doing it. Cheap to test in self-play; needs
   a WDL evaluation to find at all.
4. **Is Endgame Dumping ([S29](#s29-endgame-dumping)) strong?** Same status: derivable, unattested,
   potentially very strong, and testable.
5. **How large is the first-move advantage?** One source says *"the team that asks the first question
   has a very slight advantage"*, unquantified. `RULES.md` row 4 fixes the first turn to seat 0, so
   self-play must alternate or the measurement is biased.
6. **Does the deliberate throw-in exist as a denial move?** Marked `UNVERIFIED` in the raw research —
   no source asserts players do this. It is the same idea as [S27](#s27-the-spoiler) and inherits its
   status.
7. **What is the actual exchange rate between tempo and information?** Every style in
   [II.1](#ii1-information-doctrine) and [II.2](#ii2-turn-flow-doctrine) is a trade between them, and no
   source quantifies it. Self-play with a tunable `w_info` would produce the curve directly.
8. **Where does the game actually come from?** pagat's own hedged wording is that southern India
   (Tamil Nadu, Kerala) is "the most likely place of origin on the basis of reports received so far",
   with a Madras report dating play to the **1940s** via a military doctor of the British Raj era, and a
   Kerala transmission at Government Engineering College Thrissur, 1986–1990. That is consistent with
   the game being carried outward by South Indian students and diaspora, but it does **not** prove
   Indian invention — a Raj-era military doctor is exactly the vector who could have brought a European
   quartet game in. The name "Literature" is conjectured (by pagat, explicitly as conjecture) to nod to
   the 19th-century American game *Authors*. **No native Tamil, Malayalam or Hindi name for the game was
   found**, and none was invented; the game appears to be called "Literature" in English (or
   transliterated) by its Indian players. Treat all of this as `[attested-search]` with the sources'
   own hedges preserved.

---

## Part VIII — Research gaps

The egress denials in [§1.1](#11-the-research-access-caveat--stated-plainly) blocked specific,
enumerable work. Each item below is a concrete next action with the exact URL or query to re-run.

### VIII.1 Primary sources never opened (highest priority)

1. **pagat.com — Literature**, https://www.pagat.com/quartet/literature.html. Read the **Variations
   section end to end** (only four variations were confirmed via extracts: 7s-out, jokers/54,
   incorrect-claim-to-opponents, bluff), the **History/records section** (to verify the memory rule
   this repo's T10 rests on), and the **Salahuddin convention** paragraph verbatim — the three-branch
   encoding in [S36](#s36-ali-salahuddin-convention) rests on a single extracted description.
2. **Mike Develin, "Canadian Fish", ch. 9**, http://www.bantha.org/~develin/cardgames.html#ch9 —
   described in this repo's own corpus as "the deepest single strategy text" and named as the rules
   authority by an independent implementation. **The single highest-value unread document.** Note:
   HTTPS is broken on that host; fetch over plain HTTP.
3. **Bryn Mawr, "The Rules of Fish"**, https://www.brynmawr.edu/math/rules-fish (mirror
   `/news/rules-fish`) — a real club codification; only two of its rules were surfaced.
4. **Wikipedia — Literature (card game)**, https://en.wikipedia.org/wiki/Literature_(card_game) —
   specifically its house-rules list and the C3 post-claim-turn clause.
5. **en-academic mirror of the OLD Wikipedia text**, https://en-academic.com/dic.nsf/enwiki/1167730 —
   older revisions are known to have carried more house rules; the Challenge rationale came from here.
6. **Board Games Stack Exchange q. 31946**, https://boardgames.stackexchange.com/questions/31946/
   (answer by Shivam Maheshwari, 2020), plus a general BGSE search for "Literature", "half suit",
   "claiming".
7. **Deposit Genius strategy page**, https://depositgenius.com/literature-strategy-canadian-fish/ —
   the single densest strategy source found and the origin of blackballing, lie-low, the Lightning Rod,
   hoarding and the max-hand endgame claimer. Everything from it is currently `[attested-search]`.
8. **R. M. Winslow**, https://games.rmwinslow.com/rules/othercards-literature.html — the Challenge and
   Forced Claim rules in full.
9. **Alan De Smet, "Russian Fish"**, http://www.highprogrammer.com/alan/games/russian_fish.html — the
   "Gimme my card back" jargon and the six-player Russian Fish claim (C12).

### VIII.2 Community sources with zero coverage

10. **Reddit** — r/boardgames, r/cardgames, r/india, r/chennai, r/kerala, r/bangalore, and university
    subreddits (r/mit, r/berkeley, r/uwaterloo, r/UofT). Blocked at both the proxy *and* the search
    backend. Zero coverage; likely the richest untapped source of informal jargon and disagreement.
11. **BoardGameGeek** forums and geeklists, https://boardgamegeek.com/boardgame/95788/literature — the
    entry itself is thin, but BGG forums are where house rules surface.
12. **Quora** — the expectation of rich Indian strategy content is entirely untested.
13. **YouTube** — tutorials, gameplay and comments. Two specific leads:
    https://www.youtube.com/watch?v=WYl4JWHlx6k ("How to play Literature card game in Tamil") and
    https://www.youtube.com/watch?v=UP9qDBLKKHY ("How I play fish game part one").
14. **The Canadian tournament claim** — annual Canadian Fish tournaments at **Queen's University** and
    the **University of Toronto**, reportedly running for decades. This rests on **one low-provenance
    page** and could not be corroborated from any university page. If real, tournament bodies publish
    rulebooks, which would be the best codified-rules source available. **Verify or drop.**
15. **App-store listings and their settings screenshots** —
    https://play.google.com/store/apps/details?id=com.cards.game.literature and
    https://apps.apple.com/us/app/literature-card-game/id6761733606. Commercial apps expose their
    house-rule toggles in the settings UI, which is a compact map of the variant space.
16. **Live implementations' in-product rules/settings**: https://play-litaf.onrender.com/ ("Declare
    Anytime" toggle), playfish.io, and the Google Play app.

### VIII.3 Non-English and regional

17. **Tamil / Malayalam / Hindi sources.** Two searches (`"லிட்ரேச்சர்" சீட்டு விளையாட்டு விதிமுறைகள்`
    and `"ലിറ്ററേച്ചർ" കാർഡ് ഗെയിം`) returned nothing about this game — but that is a very weak negative
    and `சீட்டு` is polysemous. Re-run properly, and add pagat's regional pages:
    https://www.pagat.com/national/india.html, `/canada.html`.
18. **East Asia, Middle East, Europe: not researched at all.** No claim is made about them. The
    important caveat for whoever picks this up: in card-game taxonomy, **"fishing" normally denotes a
    completely different family** — table-capture games (Casino, Scopa, Seep, Pasur, Basra). Chinese
    捞鱼/钓鱼, Persian *Pasur* and Arabic *Basra* are, on the face of the words, table-capture games with
    **no asking, no hidden-hand partnerships and no claiming**. Test that hypothesis; do not assume it
    either way. The right filter is pagat's own family index, https://www.pagat.com/quartet/.
19. **Diaspora conventions** — the game travels with Tamil/Malayali/Telugu families and Indian students
    to the UK, US, Canada, the Gulf and Singapore. Those conventions live in exactly the blocked
    sources (Reddit, Quora, YouTube, blogs).

### VIII.4 Academic and code

20. **Unfinished academic search queue**: Albrecht & Stone, *Autonomous agents modelling other agents*
    (AIJ 2018); Mirsky et al., *A Survey of Ad Hoc Teamwork* (IJCAI 2022); Stone et al., *Ad Hoc
    Autonomous Agent Teams* (AAAI 2010); Brown & Sandholm, *Libratus* (Science 2018); Buro, Long, Furtak
    & Sturtevant, *Improving State Evaluation, Inference, and Search in Trick-Based Card Games* (IJCAI
    2009); the Kermit/Skat agent line; Rabinowitz et al., *Machine Theory of Mind* (ICML 2018);
    Gmytrasiewicz & Doshi on I-POMDPs; van Ditmarsch's dynamic epistemic logic for Cluedo; #SAT/model
    counting (approxMC, sharpSAT) as an alternative to WalkSAT sampling.
21. **arXiv 2603.03252, "Valet: A Standardized Testbed of Traditional Imperfect-Information Card
    Games"** — surfaced incidentally; **unverified whether it covers Literature.** If it does, it is
    directly relevant prior art.
22. **GitHub code search was disabled** for these sessions (repo search worked, code search 403'd), so
    embedded strategy heuristics inside implementations were only partially mined. Re-run code search
    for `blackball`, `stalemate`, `signal`, `bluff`, `declare` across Literature repos.
23. **Identify the upstream repo of every downloaded source file.** Several implementation files were
    read from a local scratch copy whose provenance could not be re-verified in-session; the
    attributions in [Part IX](#part-ix--bibliography) mark which ones are certain.

---

## Part IX — Bibliography

**Reading key.** **[R]** = read directly and in full (GitHub raw file, downloaded source file, or a
file in this repo) — quotes are verbatim. **[S]** = reached only as a **search-engine extract**; the
URL is real and the attribution is reliable at the page level, but the page was never opened and the
wording is not certified. **[X]** = surfaced but judged unreliable or non-independent; used nowhere as
sole evidence.

### IX.1 Rules references and encyclopedias

| Source | URL | Access |
|---|---|---|
| John McLeod, *Literature*, pagat.com — strategy notes credited in part to **Ali Salahuddin** and Brett Stevens | https://www.pagat.com/quartet/literature.html | **[S]** |
| pagat, *Quartet Games* family index | https://www.pagat.com/quartet/ | **[S]** |
| pagat, *Go Fish / Authors* | https://www.pagat.com/quartet/gofish.html | **[S]** |
| pagat, regional indexes (India, Canada) | https://www.pagat.com/national/india.html · https://www.pagat.com/national/canada.html | not reached |
| Wikipedia, *Literature (card game)* | https://en.wikipedia.org/wiki/Literature_(card_game) | **[S]** |
| Wikipedia, *Go Fish* · *Authors* · *Quartets* | https://en.wikipedia.org/wiki/Go_Fish · /wiki/Authors_(card_game) · /wiki/Quartets_(card_game) | **[S]** |
| en-academic mirror of an older Wikipedia *Literature* revision | https://en-academic.com/dic.nsf/enwiki/1167730 | **[S]** |
| Nakoa Davis, *Literature card game*, gamerules.com | https://gamerules.com/rules/literature-card-game/ | **[S]** — carries the anomalous "first player to earn 100 points" objective |
| R. M. Winslow, *Literature — Game Rules* | https://games.rmwinslow.com/rules/othercards-literature.html | **[S]** — the Challenge and Forced Claim |
| Gambiter, *Literature* | https://gambiter.com/cards/Literature_card_game.html | **[S]** |
| UltraBoardGames, *Literature* | https://www.ultraboardgames.com/ | **[S]** — high/low differential scoring |
| BoardGameGeek entry | https://boardgamegeek.com/boardgame/95788/literature | **[S]** — thin; forums unreachable |
| CardRules+, *How to Play Literature* | https://cardrulesplus.com/games/literature/ | **[X]** — contains an impossible rule ("otherwise 'Go Fish'"); this repo's existing corpus already excludes it for low provenance |
| Grokipedia, *Literature (card game)* | https://grokipedia.com/page/Literature_(card_game) | **[X]** — AI-generated; its unique variants (anytime-claim, opponent-challenge) appear nowhere else, though the Challenge is independently corroborated by an implementation |

### IX.2 Club, campus and community sources

| Source | URL | Access |
|---|---|---|
| Bryn Mawr Distressing Math Collective, *The Rules of Fish* (Hannah Griggs '18 & Rachel Miller '18) | https://www.brynmawr.edu/math/rules-fish · mirror /news/rules-fish | **[S]** — the 100% claim rule, claim-halting, the pause button, no-history, high-low team draw |
| Bryn Mawr, Distressing Math Collective club page | https://www.brynmawr.edu/math/distressing-math-collective | **[S]** |
| Mike Develin, *The Ten Best Card Games You've Never Heard Of*, ch. 9 "Canadian Fish" | http://www.bantha.org/~develin/cardgames.html#ch9 | **not reached** (HTTPS broken on host) — all Develin material here is second-hand via this repo's `/strategy` corpus |
| Alan De Smet, *Russian Fish* | http://www.highprogrammer.com/alan/games/russian_fish.html | **[S]** |
| Grace Chen, *Grace's Grove: A New Card Game: Fish*, Cornell Daily Sun, 2018-03-08 | https://www.cornellsun.com/2018/03/08/graces-grove-a-new-card-game-fish/ | **[S]** — inference from asks *and non-asks* |
| Board Games Stack Exchange q. 31946 (answer by Shivam Maheshwari, 2020) | https://boardgames.stackexchange.com/questions/31946/ | **not reached** |
| Evan Chen, MOP pages — Fish as a camp institution | https://web.evanchen.cc/mop.html | **not reached** |
| Donna Dorsa, *Literature Game Strategy*, Deposit Genius, 2018-06-25 | https://depositgenius.com/literature-strategy-canadian-fish/ (also /literature-rules-… and /literature-history-…; mirror debitcardcasino.ca) | **[S]** — casino-affiliate site, moderate reliability, but the densest strategy source found |
| Blogs: "Scribblings" · info-newgame | https://ck2.blogspot.com/2020/01/literature-card-game.html · https://info-newgame.blogspot.com/2018/04/literature-card-game.html | **not reached** |
| Reddit · BGG forums · Quora · YouTube | — | **blocked entirely; zero coverage** |

### IX.3 Implementations

> **Provisional section.** The dedicated implementations research pass (`04-implementations-code.md`)
> **had not produced a file** when this document was written, so everything below comes from source
> files read directly during synthesis plus the implementation material inside the other five passes.
> Where a local source file's upstream repository could not be re-verified in-session, that is said
> explicitly. **Expect this section to be revised when that pass lands.**

| Implementation | URL | Access | What it contributes |
|---|---|---|---|
| `cjquines/cfish` | https://github.com/cjquines/cfish | **[R]** — `src/lib/cfish.ts`, `src/lib/cards.ts`, and its config UI read in full | **The four-axis house-rule taxonomy**: `BluffRule {NO,YES}`, `DeclareRule {DURING_ASK,DURING_TURN}`, `HandSizeRule {PUBLIC,SECRET}`, `LogRule {LAST_ACTION,LAST_TWO,EVERYTHING}`. Defaults: bluff NO, **declare DURING_ASK**, handSize PUBLIC, **log LAST_ACTION**. 54-card deck with an `EIGHTS` book (8s + both jokers); `winner` returns as soon as a team passes half the books, so **5 of 9 ends the game and draws are impossible**; incorrect declare → `scorer = 1 - team` (no void); a `PASS` phase for emptied players. |
| `Dynosol/playfish.io` | https://github.com/Dynosol/playfish.io | **[R]** — server game logic read in full (local copy; upstream repo matches the README quoted in two research passes) | Config axes `bluffQuestions`, `declarationMode: 'own-turn' \| 'team-turn' \| 'anytime'`, `harshDeclarations` (**default true**), `highSuitsDouble`, `challengeMode`. **A complete implementation of [the Challenge](#v23-the-challenge)**: challenge off-turn before the current player acts, each challenged player answers pass/declare, first `declare` wins a race, all-pass forces the *challenger* to declare the opposing team's cards. Also 4/6/8 players, alternating teams, endgame sweep "without consulting each other". |
| `gyash24x7/littplay` | https://github.com/gyash24x7/littplay | **[R]** (READMEs and rule sources read by the regional pass) | Indian "Lit": **7s removed, Ace low** (`Small Set` A–6, `Big Set` 8–K), verified in deck code; **no void** — any incorrect call scores for the opponents; after an incorrect call the turn goes to *an opponent with cards*; vocabulary "call a set", "decline", "chance" for turn. |
| `amy-lei/fish` | https://github.com/amy-lei/fish | **[R]** (README) | Campus Fish built during COVID. Self-declared deviations: **declaring can happen anytime** ("declaring pauses the game"), **incorrect declares go to the other team regardless of ownership** (author explicitly flags this as differing from standard), positional turn-pass on running out, **play to 5 half-suits**. |
| `grantbw4/literature-rl` | https://github.com/grantbw4/literature-rl | **[R]** (README + RULES.md) | The most rigorous third-party written ruleset found, and the source of the **"thrown in" / "stolen"** vocabulary for the three-way claim outcome. A shared *"perfect-memory logical-deduction substrate"*, an action mask that forbids dominated asks, symbolic claim-assignment solving, a **Forced Claim** rule, and the agent ladder `RandomLegalAgent` (novice floor) → `ExperiencedAgent` (one-ply probability-greedy). Metrics include **signalling excess-MI** against a permutation null. |
| `neelsomani/literature` | https://github.com/neelsomani/literature | **[R]** — `player.py`, `learning.py`, `knowledge.py`, `constants.py`, `actor.py`, `move.py` read in full (local copies) | Python engine + learned bots, **configured for 4 players** (`get_game(4)`), 200-move cap. **Depth-1 recursive belief** via `dummy_players` — a model per seat of what that seat knows — with the author's conclusion that deeper layers were not worth the dimensionality. Its `valid_ask(..., use_all_knowledge)` re-admits known-miss asks when nothing else is legal, explicitly *"to signal to teammates."* Deck is 7s-out (`MINOR 1–6`, `MAJOR 8–13`). Move scoring is an `MLPRegressor` over serialised (state, move). |
| A TypeScript Fish engine + bot with signal detection | upstream **not verified in-session** (local copies `sw_bot.ts`, `sw_engine.ts`, `sw_types.ts`) | **[R]** | **The only implemented convention found.** `detectTeammateSignals()` (failed teammate ask → a different teammate's next ask in the same book ⇒ that teammate likely holds the denied card, confidence **0.7 / 0.4 / 0.2** by ask-gap), `detectBooksToSignal()` (emit side, ×2 ask weight), `getKnownBookHolders()`, `getActiveBook()` (stick to the book you are working). Claim resolution is **no-void** (any incorrect claim scores for the opponents) and a **`transferTurn` after a successful claim** implements T7-style turn choice. Config axes: `BookType NORMAL \| CANADIAN` (rank quartets vs. **ace-low half-suits over a 48-card, no-7s deck**), `playerCount 4\|6\|8`, `teamCount 2\|3\|4`, `deckType 48\|52`, `bookSize 4\|6`. |
| `TaranKamireddy/LiteratureBot` | https://github.com/TaranKamireddy/LiteratureBot | **[R]** (`notes.txt`, `litbot.py`, `pseudocode.txt`, read by the strategy pass) | The three-tier belief lattice `known`/`knownset`/`possible` with verbatim update rules and three unimplemented propagators; the 6-player certification priors (1, 5/9, 19/43 vs 0, 1/9, 6/43); an explicit strategy list including *"Locking a dangerous player out"* and *"Asking less risky players"*; a snap-claiming decision hierarchy. Also the state-space figures discussed in the [Appendix](#appendix--verified-combinatorics). |
| Sanjay Kannan, *Literature 0.01* framework | upstream **not verified in-session** (local copies `wh_impl.txt`, `wh_lit.py`) | **[R]** | **The bounded-memory-in-bits model** ([S44](#s44-bounded-memory-player)): 2 bits for "X has card Z", 2 bits for "X does not have Z", 1 bit for "X has a basis in suit Y", with `self.limit`/`self.free` accounting and a relevance-ranked eviction policy in its reference `ActivePlayer`. Its deck is the **52-card, 7-card-major** form ([V5](#i1-full-variant-table)). |
| `Ryan1729/canadian-fish` | https://github.com/Ryan1729/canadian-fish | **[R]** (README by the community pass; local Rust sources read during synthesis) | Rust single-player Canadian Fish; **cites Develin ch. 9 as its rules authority**. Belief model is a per-seat `Knowledge { model_hand: Vec<ModelCard::Unknown\|Known>, facts: Vec<Fact::KnownNotToHave> }`. Its TODO list is a de-facto opponent-modelling heuristic list, including the **non-snatch read** (*"guess that if a player does not snatch back something that was taken then they are out of that suit?"*) — inference from an action **not** taken. |
| A Rust Fish engine with slot constraints | upstream **not verified in-session** (local copies `qc_engine.rs`, `qc_card.rs`) | **[R]** | An alternative belief encoding worth noting: a hand is a vector of **slots**, each `Constraint::InBook(book)` or `Constraint::IsCard(card)`, plus an `excluded_cards` set — making "holds ≥1 of this book" a first-class object. Book enum includes `Eights`. |
| A Java Literature simulator | upstream **not verified in-session** (local copies `yh_*.java`) | **[R]** | Belief represented as **per-book 6×6 (card × seat) probability matrices** — the simplest workable joint-per-book representation, and a reminder that per-book joints are what claims need. |
| A Node/socket.io Literature server | upstream **not verified in-session** (local copy `cb_server.js`) | **[R]** | 54-card deck with an explicit `"eights"` half-suit (`8H 8D 8C 8S BJ RJ`) — independent corroboration of [V4](#v4-fifty-four-cards-and-a-ninth-book). |
| `Rocky-921/Literature` (Chennai / IIT-M) · `akshith6212/literature-game` · `zairza-cetb/literature` (CET Bhubaneswar) · `scarroy-02/literature_game` ("pits") · `nikhilmandlik/canadian-fish` · `Raghav-Sao/literature` | see URLs in the regional pass | **[R]** (READMEs) | Indian Tradition-A corroboration (8s out, full three-way claim outcome, 4–4 tie); the "pit" terminology (single-source); a 54-card/9-book listing. |
| `EshwarKo/FishBot` · `Mkishore7/Literature-Card-Game-Vibe-Coding-` · `MeagerPotato/Fish-Onboarding` · `Kakashi-hatake1105/Raise-N-Call` | — | **[X]** | Read as AI-generated; `MeagerPotato` also owns `Canadian-Fish-Demo`, i.e. **not independent of this project**. Weighted at ~zero. |
| Litaf (hosted) · Google Play "Literature" · Apple App Store "Literature Card Game" | https://play-litaf.onrender.com/ · https://play.google.com/store/apps/details?id=com.cards.game.literature · https://apps.apple.com/us/app/literature-card-game/id6761733606 | **[S]** / not reached | 54-card default, first-to-5, a **"Declare Anytime"** setting. |
| `go-fish` (Rust crate) | https://crates.io/crates/go-fish | **[S]** | The simplest possible belief-table bot for the adjacent game: `(opponent, rank) → probability`, updated on catch/go-fish. |

### IX.4 Academic literature

All URLs below appeared in a search-engine result set. Fields marked `UNVERIFIED` could not be
confirmed and **must be checked before formal citation**. None of these papers was opened; none is
about Literature.

**Search in imperfect-information games**
1. Cowling, P. I., Powley, E. J., Whitehouse, D. (2012). *Information Set Monte Carlo Tree Search.* IEEE TCIAIG 4(2):120–143. https://eprints.whiterose.ac.uk/id/eprint/75048/
2. Long, J., Sturtevant, N., Buro, M., Furtak, T. (2010). *Understanding the Success of Perfect Information Monte Carlo Sampling in Game Tree Search.* AAAI 24(1):134–140. https://ojs.aaai.org/index.php/AAAI/article/view/7562 · PDF https://webdocs.cs.ualberta.ca/~nathanst/papers/pimc.pdf
3. Cazenave, T., Ventos, V. (2019). *The αμ Search Algorithm for the Game of Bridge.* arXiv:1911.07960. https://arxiv.org/pdf/1911.07960
4. *Optimizing αμ.* arXiv:2101.12639. https://arxiv.org/pdf/2101.12639 — authors `UNVERIFIED`.
5. Edelkamp, S. (2021). *Knowledge-Based Paranoia Search in Trick-Taking.* arXiv:2104.05423. https://arxiv.org/abs/2104.05423
6. Whitehouse, D., Powley, E. J., Cowling, P. I. (2011). *Determinization and information set MCTS for Dou Di Zhu.* IEEE CIG. https://www.semanticscholar.org/paper/67e1f4795c461a5467d6009b1efdaa36aad03a40
7. *An expert-level card playing agent based on a variant of perfect information Monte Carlo sampling.* IJCAI-2015. https://dl.acm.org/citation.cfm?id=2832267 — authors `UNVERIFIED`.
8. *Combining Prediction of Human Decisions with ISMCTS in Imperfect Information Games.* arXiv:1709.09451. https://arxiv.org/pdf/1709.09451 — authors `UNVERIFIED`.
9. Bax, F. *Determinization with Monte Carlo Tree Search for the card game Hearts.* Utrecht Univ. thesis. https://studenttheses.uu.nl/bitstream/handle/20.500.12932/37736/Thesis_draft.pdf?sequence=1
10. Edelkamp, S. *On the Power of Refined Skat Selection.* arXiv:2104.02997. https://arxiv.org/pdf/2104.02997

**Inference, deduction and belief representation**
11. Neller, T. W., Luo, Z. (2018). *Mixed logical and probabilistic reasoning in the game of Clue.* ICGA Journal 40(4):406–416. https://journals.sagepub.com/doi/abs/10.3233/ICG-180063 · PDF http://cs.gettysburg.edu/~tneller/papers/icgaj18-clue.pdf
12. Meng, F., Lucas, S. (2025). *Cluedo AI: Applying Constraint-Solving Methods to Play the Multi-Player Deduction Game Cluedo.* FDG '25. https://dl.acm.org/doi/10.1145/3723498.3723830
13. Meng, F., Lucas, S. (2024). *Deduction Game Framework and Information Set Entropy Search.* IEEE CoG. arXiv:2407.21178. https://arxiv.org/abs/2407.21178
14. Morenville, A., Piette, É. (2025). *Modeling Uncertainty: Constraint-Based Belief States in Imperfect-Information Games.* IEEE CoG. arXiv:2507.19263. https://arxiv.org/abs/2507.19263
15. Xu, K., Meng, F., Verbrugge, C., Lucas, S. (2026). *CSP4SDG: Constraint and Information-Theory Based Role Identification in Social Deduction Games with LLM-Enhanced Inference.* AAAI-26. arXiv:2511.06175. https://arxiv.org/abs/2511.06175
16. Rebstock, D., Solinas, C., Buro, M., Sturtevant, N. R. (2019). *Policy Based Inference in Trick-Taking Card Games.* IEEE CoG. arXiv:1905.10911. https://arxiv.org/abs/1905.10911
17. *History Filtering in Imperfect Information Games: Algorithms and Complexity.* NeurIPS 2023. arXiv:2311.14651. https://arxiv.org/html/2311.14651 — authors `UNVERIFIED`.
18. *Modeling Other Players with Bayesian Beliefs for Games with Incomplete Information.* arXiv:2405.14122. https://arxiv.org/abs/2405.14122 — authors `UNVERIFIED`.
19. Kingston (2017). *Comparing question asking strategies for Cluedo.* AISB. https://info.bb-ai.net/student_projects/papers_slides/Cluedo-Strategy-Kingston-AISB-2017.pdf — attribution `UNVERIFIED`.
20. *Clue Deduction: an introduction to satisfiability reasoning* (course handout). https://www.cs.carleton.edu/faculty/dmusicant/cs321-00-f21/clue/clue.pdf — authorship `UNVERIFIED`.
21. Mastermind/Wordle query design: arXiv:1305.1010 · arXiv:1207.0773 · arXiv:2305.09111 — authors `UNVERIFIED` on all three.

**Equilibrium computation and team games**
22. Zinkevich, M., Johanson, M., Bowling, M., Piccione, C. (2007). *Regret Minimization in Games with Incomplete Information.* NIPS 20. https://papers.nips.cc/paper/3306-regret-minimization-in-games-with-incomplete-information
23. Celli, A., Gatti, N. (2018). *Computational Results for Extensive-Form Adversarial Team Games.* AAAI 32(1). arXiv:1711.06930. https://arxiv.org/abs/1711.06930 — **the framing paper for Literature's communication regime.**
24. *Team-maxmin equilibrium: efficiency bounds and algorithms.* arXiv:1611.06134 — authors `UNVERIFIED`.
25. *A Generic Multi-Player Transformation Algorithm for … Adversarial Team Games.* arXiv:2307.01441 — authors `UNVERIFIED`.
26. *Enhanced Equilibria-Solving via Private Information Pre-Branch Structure in Adversarial Team Games.* arXiv:2408.02283 — authors `UNVERIFIED`.
27. *Computing Ex Ante Equilibrium in Heterogeneous Zero-Sum Team Games.* arXiv:2410.01575 — authors `UNVERIFIED`.
28. *Towards convergence to Nash equilibria in two-team zero-sum games.* arXiv:2111.04178 — authors `UNVERIFIED`.
29. *The Complexity of Two-Team Polymatrix Games with Independent Adversaries.* arXiv:2409.07398 — authors `UNVERIFIED`.
30. Heinrich, J., Silver, D. (2016). *Deep RL from Self-Play in Imperfect-Information Games* (NFSP). arXiv:1603.01121.
31. *Deep Counterfactual Regret Minimization.* arXiv:1811.00164 — authors `UNVERIFIED` (Brown, Lerer, Gross, Sandholm per citing literature).
32. *DREAM: Deep Regret minimization with Advantage baselines and Model-free learning.* arXiv:2006.10410 — authors `UNVERIFIED`.
33. *Subgame solving without common knowledge.* arXiv:2106.06068 — authors `UNVERIFIED`.
34. Brown, N., Sandholm, T. (2019). *Superhuman AI for multiplayer poker* (Pluribus). Science 365(6456):885–890. https://www.science.org/doi/10.1126/science.aay2400

**Belief-state search and unified learning + search**
35. Brown, N., Bakhtin, A., Lerer, A., Gong, Q. (2020). *Combining Deep RL and Search for Imperfect-Information Games* (ReBeL). NeurIPS 33. arXiv:2007.13544.
36. Moravčík, M., Schmid, M., Burch, N., Lisý, V., Morrill, D., Bard, N., Davis, T., Waugh, K., Johanson, M., Bowling, M. (2017). *DeepStack.* Science 356(6337):508–513.
37. Schmid, M., et al. (2023). *Student of Games.* Science Advances. arXiv:2112.03178.
38. Kovařík, V., Seitz, D., Lisý, V., Rudolf, J., Sun, S., Ha, K. (2023). *Value Functions for Depth-Limited Solving in Zero-Sum Imperfect-Information Games.* AIJ 314:103805. arXiv:1906.06412.
39. Kovařík, V., Schmid, M., Burch, N., Bowling, M., Lisý, V. (2022). *Rethinking Formal Models of Partially Observable Multiagent Decision Making* (FOSGs). AIJ. arXiv:1906.11110.
40. *Sound Algorithms in Imperfect Information Games.* arXiv:2006.08740 — authors `UNVERIFIED`.

**Cooperative coordination, conventions, Hanabi**
41. Bard, N., Foerster, J. N., Chandar, S., Burch, N., Lanctot, M., Song, H. F., Parisotto, E., Dumoulin, V., Moitra, S., Hughes, E., Dunning, I., Mourad, S., Larochelle, H., Bellemare, M. G., Bowling, M. (2020). *The Hanabi Challenge.* AIJ 280:103216. arXiv:1902.00506.
42. Foerster, J., Song, F., Hughes, E., Burch, N., Dunning, I., Whiteson, S., Botvinick, M., Bowling, M. (2019). *Bayesian Action Decoder.* ICML 36. arXiv:1811.01458.
43. *Simplified Action Decoder.* ICLR 2020. https://openreview.net/pdf?id=B1xm3RVtwB — authors `UNVERIFIED` (Hu & Foerster per citing literature).
44. Hu, H., Lerer, A., Peysakhovich, A., Foerster, J. (2020). *"Other-Play" for Zero-Shot Coordination.* ICML 37, PMLR 119:4399–4410. arXiv:2003.02979.
45. Hu, H., Lerer, A., Cui, B., Pineda, L., Wu, D., Brown, N., Foerster, J. (2021). *Off-Belief Learning.* ICML 38. arXiv:2103.04000.
46. Lerer, A., Hu, H., Foerster, J., Brown, N. (2020). *Improving Policies via Search in Cooperative Partially Observable Games* (SPARTA). AAAI 34:7187–7194. arXiv:1912.02318 · code https://github.com/facebookresearch/Hanabi_SPARTA
47. Cui, B., et al. (2021). *K-level Reasoning for Zero-Shot Coordination in Hanabi.* NeurIPS 34.
48. Lupu, A., et al. (2021). *Trajectory Diversity for Zero-Shot Coordination.* ICML, PMLR 139.
49. *Self-Explaining Deviations for Coordination.* arXiv:2207.12322 — authors `UNVERIFIED`.
50. *Human-AI Coordination via Human-Regularized Search and Learning.* arXiv:2210.05125 — authors `UNVERIFIED`.

**Hidden-role, team, and multi-player systems**
51. Serrino, J., Kleiman-Weiner, M., Parkes, D. C., Tenenbaum, J. B. (2019). *Finding Friend and Foe in Multi-Agent Games* (DeepRole). NeurIPS 32. arXiv:1906.02330.
52. Meta FAIR Diplomacy Team (2022). *Human-level play in the game of Diplomacy…* (CICERO). Science 378(6624):1067–1074. https://www.science.org/doi/10.1126/science.ade9097 — individual author names `UNVERIFIED`.
53. *A Survey on LLM-Based Social Agents in Game-Theoretic Scenarios.* arXiv:2412.03920 — authors `UNVERIFIED`.

**Deep RL for card games, frameworks**
54. Zha, D., Xie, J., Ma, W., Zhang, S., Lian, X., Hu, X., Liu, J. (2021). *DouZero.* ICML 38. arXiv:2106.06135.
55. *DouZero+: Improving DouDizhu AI by Opponent Modeling and Coach-guided Learning.* arXiv:2204.02558 — authors `UNVERIFIED`.
56. *DanZero+: Dominating the GuanDan Game through Reinforcement Learning.* arXiv:2312.02561 — authors `UNVERIFIED`.
57. Li, J., Koyamada, S., Ye, Q., Liu, G., Wang, C., Yang, R., Zhao, L., Qin, T., Liu, T.-Y., Hon, H.-W. (2020). *Suphx.* arXiv:2003.13590.
58. Lanctot, M., et al. (2019). *OpenSpiel.* arXiv:1908.09453. · RLCard: https://github.com/datamllab/rlcard (arXiv ID `UNVERIFIED`).
59. Dallas, A. S. (2019). *Solving an Esoteric Card Game with Reinforcement Learning.* Stanford AA228 report. https://web.stanford.edu/class/aa228/reports/2019/final111.pdf
60. **NooK / NukkAI** hybrid symbolic + deep-learning bridge system, reported to have beaten eight world champions at declarer play (Paris, March 2022). Press coverage: https://www.imperial.ac.uk/news/235238/ai-based-imperial-research-beats-world/ — **`UNVERIFIED`: no peer-reviewed paper was surfaced.** Cited only for its explainability claim.

### IX.5 In-repo sources

| File | Role |
|---|---|
| [`RULES.md`](RULES.md) | The pinned rule set; toggles T1–T10; claim resolution §3; endgame §4; information rules §6 |
| [`SPEC.md`](SPEC.md) | §5 bot tiers; §11.1 the public-log decision; §12 non-goals |
| [`src/learn/strategy-content.ts`](src/learn/strategy-content.ts) | The existing attributed strategy corpus (15 sources) shipped to `/strategy` — the `corpus` status in this document's tables |
| [`lib/engine/bots/knowledge.ts`](lib/engine/bots/knowledge.ts) | Deal-time-variable constraint propagation; `askHitProbability`, `refinedHitProbability`, `rankAsksWith` |
| [`lib/engine/bots/decide.ts`](lib/engine/bots/decide.ts) | Tiered policies; `certainClaim`, `evClaim`, `forcedClaim`, `leaky`, `hardPickAsk`, `signallingAsk`, `isDeepStalled` |

---

## Appendix — Verified combinatorics

Computed independently for this document (exact integer arithmetic), for the 6-player, 48-card,
8-books-of-6 baseline.

| Quantity | Expression | Exact value | ≈ | log₁₀ |
|---|---|---|---|---|
| Total deals to six identified seats | `48!/(8!)^6` | 2,889,253,496,242,619,386,328,267,523,990,000 | **2.8893×10³³** | 33.46 |
| One seat's information set at the deal | `40!/(8!)^5` | 7,656,714,453,153,197,981,835,000 | **7.6567×10²⁴** | 24.88 |
| A team's joint information set at the deal | `24!/(8!)^3` | 9,465,511,770 | **9.4655×10⁹** | 9.98 |
| Claim assignments per book, 3 teammates | `3^6` | 729 | — | — |
| Claim assignments per book, 4 teammates (8-player) | `4^6` | 4,096 | — | — |
| Claim assignments per book, 2 teammates (4-player) | `2^6` | 64 | — | — |
| Legal asks per turn, upper bound | 3 targets × ≤40 askable cards | 120 | — | — |

**Belief-support size by phase** (unknown cards split evenly; *pre-constraint* upper bounds — hard
constraints cut these by many orders of magnitude in practice):

| Unknown cards | Single-seat view (5 opponents) | Team-pooled view (3 opponents) |
|---|---|---|
| 40 | 7.66×10²⁴ | — |
| 30 | 1.37×10¹⁸ | — |
| 24 | — | 9.47×10⁹ |
| 18 | — | 1.72×10⁷ |
| 12 | — | 3.47×10⁴ |
| 6 | — | 90 |

**Three conclusions fall straight out of this table.**

1. **The endgame is exactly solvable.** Once ≲18 unknown cards remain (about three books), the residual
   space is ~10⁷ *before* constraints and typically far smaller after; ≤12 is trivially enumerable.
   Literature has a genuine, tractable exact-solve regime, and because claiming is all-or-nothing that
   is where most points are decided. **Highest-leverage, lowest-risk engine component.**
2. **Team-pooled belief is ~15 orders of magnitude smaller than the naive deal space** (10¹⁰ vs 10²⁵ at
   the deal), which makes ex-ante-correlated (TMECor-style) reasoning far more affordable than the raw
   numbers suggest.
3. **Branching is tiny** (≤120, typically 20–40) against information sets up to 10²⁵. Literature's
   difficulty is **entirely informational, not combinatorial** — spend the budget on belief, not depth.

### A note on the figure that did not reproduce

One raw research file reports **4.01285×10³⁰** as the number of initial deals for the 6-player game,
computed as `(48C8 · 40C8 · 32C8 · 24C8 · 16C8 · 8C8)/6!`. **That figure is not the number of deals**
and is omitted from this document. The numerator alone equals `48!/(8!)^6` = 2.8893×10³³, which is the
correct count; dividing it by `6!` yields 4.0129×10³⁰, i.e. exactly the reported figure — so the number
is *arithmetically* what its formula says, but the extra `÷6!` treats the six hands as **unlabelled**,
counting unordered partitions of the deck rather than deals to six identified seats. In a seated
partnership game the seats are labelled and the `÷6!` is wrong. (The same file's 8-player figure,
4.26313×10³³, uses the same `÷8!` convention and reproduces on the same terms.)

The independently computed value `40!/(8!)^5` = 7.6567×10²⁴ (log₁₀ ≈ 24.88) for a single seat's
information set **does** agree with the academic pass's figure of 10^24.9, so the two independent
derivations of the quantity that actually matters for engine design are consistent.

---

*End of document. 65 play styles, 48 rule-dialect axes, 15 algorithmic families. Every claim carries
its evidence tier; nothing was promoted, and nothing was invented.*
