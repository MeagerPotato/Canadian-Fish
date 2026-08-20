/**
 * decide.ts — deterministic difficulty-tiered bot policies (SPEC.md §5).
 *
 * decide(view, difficulty, seed) -> GameAction. Consumes ONLY the public
 * SeatView (the same payload a human client gets), is pure and deterministic
 * (same view+difficulty+seed => same action; the only randomness is the
 * engine's mulberry32 over `seed`, used exclusively by the easy tier), never
 * throws, and never returns an illegal action: every choice is validated
 * against the view and falls back to a legal-by-construction placeholder
 * policy if anything is off.
 *
 * Tiers:
 *  - easy:   knowledge from only the last 6 log events, no set-constraints;
 *            25% seeded chance of a uniformly random legal ask; claims only
 *            books fully in its own hand (except when forced).
 *  - medium: full knowledge engine; certain hits first, else best-ranked ask;
 *            claims exactly when a whole book is certainly on its team
 *            (or when forced: no legal ask, or a proven dead position).
 *  - hard:   medium + EV claims + information protection + stalemate breaking
 *            + endgame counting (details at each helper below).
 */
import type { BookId, Card, GameAction, Seat } from '../types.ts'
import { ALL_BOOKS, bookCards, cardBook, isCard, seatTeam, teamSeats } from '../cards.ts'
import { legalAsksFromView } from '../helpers.ts'
import { mulberry32, randInt } from '../rng.ts'
import {
  askHitProbability,
  buildKnowledge,
  holderOf,
  rankAsksWith,
  refinedHitProbability,
} from './knowledge.ts'
import type { BotDifficulty, Knowledge, RankedAsk, SeatView } from './types.ts'

type Rng = () => number

/* ------------------------------------------------------------ utilities --- */

function opponentTeamSeats(seat: Seat): readonly Seat[] {
  return teamSeats(seatTeam(seat) === 0 ? 1 : 0)
}

function teammateSeats(seat: Seat): Seat[] {
  return teamSeats(seatTeam(seat)).filter((s) => s !== seat)
}

/** First unresolved book fully contained in the viewer's own hand. */
function completeOwnBook(view: SeatView): BookId | null {
  const held = new Set(view.hand)
  for (const b of ALL_BOOKS) {
    if (view.books[b]) continue
    if (bookCards(b).every((c) => held.has(c))) return b
  }
  return null
}

function claimAllSelf(seat: Seat, book: BookId): GameAction {
  const assignments = {} as Record<Card, Seat>
  for (const c of bookCards(book)) assignments[c] = seat
  return { type: 'claim', seat, book, assignments }
}

/**
 * Stall detection over the public log. Claims are the only permanent progress
 * (books resolve monotonically); hits at least move information. A position is
 * declared dead when the table has produced neither for a long stretch —
 * cross-book deadlocks exist (every possible ask by every seat can be a known
 * miss forever), and the only way out is claiming on best evidence. Thresholds
 * are deliberately conservative so normal miss-heavy midgames never trigger.
 */
function isDeepStalled(view: SeatView): boolean {
  const log = view.log
  let lastHit = -1
  let lastClaim = -1
  for (let i = log.length - 1; i >= 0; i--) {
    const ev = log[i]
    if (lastHit === -1 && ev.type === 'ask' && ev.hit) lastHit = i
    if (lastClaim === -1 && ev.type === 'claim') lastClaim = i
    if (lastHit !== -1 && lastClaim !== -1) break
  }
  const last = log.length - 1
  const noHitFor = last - lastHit // lastHit -1 => "forever"
  const noClaimFor = last - lastClaim
  return (noHitFor >= 36 && noClaimFor >= 120) || noClaimFor >= 400
}

/** No hit anywhere in the last `n` log events (stalemate-breaker trigger). */
function noRecentHit(view: SeatView, n: number): boolean {
  const log = view.log
  for (let i = log.length - 1; i >= 0 && i > log.length - 1 - n; i--) {
    const ev = log[i]
    if (ev.type === 'ask' && ev.hit) return false
  }
  return true
}

/* -------------------------------------------------------- claim planning --- */

interface ClaimPlan {
  book: BookId
  assignments: Record<Card, Seat>
  /** Estimated probability the claim scores for the claimer's team. */
  p: number
  /** Cards whose holder was guessed rather than known. */
  uncertain: Card[]
}

/**
 * Plan a claim of `book` for the viewer's team using knowledge + counts.
 * Certain cards go to their known holders. Uncertain cards are assigned by
 * COUNT-CONSISTENCY: greedily to the candidate teammate with the most
 * remaining unidentified slots (a card is a-priori equally likely to sit in
 * any unidentified slot), decrementing a working capacity map so multiple
 * guesses stay jointly consistent with the public hand sizes. p multiplies
 * per-card success estimates (certain-on-team = 1; certain-on-opponent = 0;
 * uncertain = chosen capacity / total candidate capacity).
 */
function planClaim(view: SeatView, k: Knowledge, book: BookId): ClaimPlan {
  const me = view.seat
  const myTeam = seatTeam(me)
  const mates = teamSeats(myTeam)
  const capacity = [...k.unknownSlots]
  const assignments = {} as Record<Card, Seat>
  const uncertain: Card[] = []
  let p = 1
  for (const c of bookCards(book)) {
    const h = holderOf(k, c)
    if (h !== null) {
      if (seatTeam(h) === myTeam) {
        assignments[c] = h
      } else {
        // Certainly with an opponent: the claim would hand them the book.
        // Assign legally (own team) but the plan is worthless.
        assignments[c] = me
        p = 0
      }
      continue
    }
    const cand = k.cands[c] ?? []
    const teamCand = cand.filter((s) => seatTeam(s) === myTeam)
    if (teamCand.length === 0) {
      assignments[c] = me
      p = 0
      uncertain.push(c)
      continue
    }
    // Deterministic greedy: highest remaining capacity, then lowest seat.
    let best = teamCand[0]
    for (const s of teamCand) {
      if (capacity[s] > capacity[best]) best = s
    }
    let totalCap = 0
    for (const s of cand) totalCap += Math.max(0, capacity[s])
    p *= totalCap > 0 ? Math.max(0, capacity[best]) / totalCap : 1 / cand.length
    if (capacity[best] > 0) capacity[best]--
    assignments[c] = best
    uncertain.push(c)
  }
  // Guard: every card must be assigned to an own-team seat (mates is
  // guaranteed non-empty; `me` is always legal).
  for (const c of bookCards(book)) {
    const s = assignments[c]
    if (s === undefined || !mates.includes(s)) assignments[c] = me
  }
  return { book, assignments, p, uncertain }
}

/** Claim whose six cards are all CERTAIN and on the viewer's team, if any. */
function certainClaim(view: SeatView, k: Knowledge): GameAction | null {
  for (const b of ALL_BOOKS) {
    if (view.books[b]) continue
    const plan = planClaim(view, k, b)
    if (plan.uncertain.length === 0 && plan.p === 1) {
      return { type: 'claim', seat: view.seat, book: b, assignments: plan.assignments }
    }
  }
  return null
}

/**
 * HARD (a) — risk-weighted EV claim. Trigger: an unresolved book with five
 * cards certainly on the team and ONE uncertain card whose candidates are all
 * teammates. The book is then guaranteed to belong to the team — an opponent
 * can never score it (and, holding none of its cards, can never even ask into
 * it) — so the only risk is a void. EV analysis: claiming costs no tempo
 * (RULES row 17 — the claimant's turn continues) and the candidate teammate
 * who ACTUALLY holds the card usually sees all six as certain from its own
 * view and will bank the book safely on its next turn, so a premature guess
 * mostly converts a ~1.0-expectation book into p < 1. Claiming is favorable
 * only when p is very high (the holder may never get a turn before the
 * endgame) — threshold 0.8 — or once the position is provably dead, where a
 * coin-flip book beats guaranteed zero progress (threshold 0.5). p is the
 * best teammate's free (unidentified) slots / total candidate free slots.
 */
function evClaim(view: SeatView, k: Knowledge, threshold: number): GameAction | null {
  const myTeam = seatTeam(view.seat)
  let best: ClaimPlan | null = null
  for (const b of ALL_BOOKS) {
    if (view.books[b]) continue
    const plan = planClaim(view, k, b)
    if (plan.uncertain.length !== 1 || plan.p < threshold) continue
    const c = plan.uncertain[0]
    const cand = k.cands[c] ?? []
    if (cand.length === 0 || !cand.every((s) => seatTeam(s) === myTeam)) continue
    if (best === null || plan.p > best.p) best = plan
  }
  if (best === null) return null
  return { type: 'claim', seat: view.seat, book: best.book, assignments: best.assignments }
}

/**
 * Forced claim: the position demands SOME claim (no legal ask, endgame, or a
 * proven-dead deadlock). Pick the unresolved book with the highest estimated
 * success probability (ties: fewer guessed cards, then canonical book order)
 * and its count-consistent assignment.
 */
function forcedClaim(view: SeatView, k: Knowledge): GameAction {
  let best: ClaimPlan | null = null
  for (const b of ALL_BOOKS) {
    if (view.books[b]) continue
    const plan = planClaim(view, k, b)
    if (
      best === null ||
      plan.p > best.p ||
      (plan.p === best.p && plan.uncertain.length < best.uncertain.length)
    ) {
      best = plan
    }
  }
  if (best === null) {
    // No unresolved book should be impossible pre-'finished'; stay legal-ish.
    return claimAllSelf(view.seat, ALL_BOOKS[0])
  }
  return { type: 'claim', seat: view.seat, book: best.book, assignments: best.assignments }
}

/* ------------------------------------------------------------- passing --- */

/** Standard pass/designate: the candidate with the most cards (SPEC §5). */
function passAction(view: SeatView, diff: BotDifficulty): GameAction {
  const mates = teammateSeats(view.seat).filter((s) => view.counts[s] > 0)
  const pool = mates.length > 0 ? mates : teammateSeats(view.seat)
  let to = pool[0]
  if (diff !== 'easy') {
    for (const s of pool) if (view.counts[s] > view.counts[to]) to = s
  }
  return { type: 'pass', seat: view.seat, to }
}

function designateAction(view: SeatView, diff: BotDifficulty): GameAction {
  const opps = opponentTeamSeats(view.seat).filter((s) => view.counts[s] > 0)
  const pool = opps.length > 0 ? opps : [...opponentTeamSeats(view.seat)]
  let to = pool[0]
  if (diff !== 'easy') {
    for (const s of pool) if (view.counts[s] > view.counts[to]) to = s
  }
  return { type: 'designate', seat: view.seat, to }
}

/* ------------------------------------------------------------ easy tier --- */

/**
 * Easy: memory of only the last 6 public events, no set-constraint reasoning,
 * and a 25% seeded error rate replacing its best ask with a uniformly random
 * legal one. Claims only books fully in its own hand — unless the position
 * forces a claim (no legal ask / endgame / dead position), where it guesses
 * missing cards onto seeded-random teammates.
 */
function decideEasy(view: SeatView, rng: Rng): GameAction {
  const seat = view.seat
  if (view.phase === 'endgame') {
    return easyGuessClaim(view, rng)
  }
  const complete = completeOwnBook(view)
  if (complete !== null) return claimAllSelf(seat, complete)
  if (isDeepStalled(view)) return easyGuessClaim(view, rng)
  const asks = legalAsksFromView(view)
  if (asks.length === 0) return easyGuessClaim(view, rng)
  if (rng() < 0.25) {
    const a = asks[randInt(rng, asks.length)]
    return { type: 'ask', seat, target: a.target, card: a.card }
  }
  const k = buildKnowledge(view, { logWindow: 6, useConstraints: false })
  const ranked = rankAsksWith(view, k)
  const top = ranked[0]
  return { type: 'ask', seat, target: top.target, card: top.card }
}

/** Easy's forced claim: most-held unresolved book, missing cards guessed. */
function easyGuessClaim(view: SeatView, rng: Rng): GameAction {
  const seat = view.seat
  const held = new Set(view.hand)
  const unresolved = ALL_BOOKS.filter((b) => !view.books[b])
  let best = unresolved[0]
  let bestHeld = -1
  for (const b of unresolved) {
    const n = bookCards(b).filter((c) => held.has(c)).length
    if (n > bestHeld) {
      best = b
      bestHeld = n
    }
  }
  const mates = teammateSeats(seat)
  const assignments = {} as Record<Card, Seat>
  for (const c of bookCards(best)) {
    assignments[c] = held.has(c) ? seat : mates[randInt(rng, mates.length)]
  }
  return { type: 'claim', seat, book: best, assignments }
}

/* ----------------------------------------------------- medium/hard tiers --- */

/**
 * HARD (b) — information protection. An ask is a public announcement of
 * interest in a book; once the team certainly accounts for >= 4 of a book's
 * cards, asking into it tells opponents which book the team is about to
 * complete (they can count it out and defend their remaining cards). Among
 * asks whose refined scores are effectively EQUAL (within LEAK_EPSILON), hard
 * prefers ones that do not touch such nearly-secured books. The margin is
 * deliberately tiny: information protection is a tiebreak, never a reason to
 * play a materially worse ask (a wider margin measurably loses games — the
 * best ask into a strong book is usually the ask that completes it).
 * First-principles self-censorship; Phase-5 strategy research may refine it.
 */
const LEAK_EPSILON = 0.5

function leaky(k: Knowledge, view: SeatView, book: BookId): boolean {
  const myTeam = seatTeam(view.seat)
  const held = new Set(view.hand)
  let n = 0
  for (const c of bookCards(book)) {
    const h = holderOf(k, c)
    if (held.has(c) || (h !== null && seatTeam(h) === myTeam)) n++
  }
  return n >= 4
}

/**
 * Hard's ask selection over the medium-ranked list:
 *  1. every entry is re-scored with the constraint-refined hit probability
 *     (refinedHitProbability) — surviving "holds >= 1 of set" constraints
 *     raise the estimate for their members, an inference medium skips;
 *  2. near-ties (LEAK_EPSILON) prefer non-leaky books (see above);
 *  3. among known-miss near-ties, prefer handing the turn to the opponent
 *     with the FEWEST cards — a smaller hand means fewer books they can ask
 *     into, so the surrendered turn is worth less to them.
 * Deterministic: refined score desc, then the base ranked order.
 */
function hardPickAsk(view: SeatView, k: Knowledge, ranked: RankedAsk[]): RankedAsk {
  interface Scored {
    r: RankedAsk
    refined: number
    s: number
    idx: number
  }
  const scored: Scored[] = ranked.map((r, idx) => {
    const base = askHitProbability(k, r.card, r.target)
    const refined = refinedHitProbability(k, r.card, r.target)
    return { r, refined, s: r.score + 70 * (refined - base), idx }
  })
  scored.sort((a, b) => (b.s !== a.s ? b.s - a.s : a.idx - b.idx))
  const top = scored[0]
  const near = scored.filter((x) => x.s >= top.s - LEAK_EPSILON)
  if (near.length === 1) return top.r
  near.sort((a, b) => {
    const la = leaky(k, view, cardBook(a.r.card)) ? 1 : 0
    const lb = leaky(k, view, cardBook(b.r.card)) ? 1 : 0
    if (la !== lb) return la - lb
    if (a.refined === 0 && b.refined === 0) {
      const ca = view.counts[a.r.target]
      const cb = view.counts[b.r.target]
      if (ca !== cb) return ca - cb
    }
    return a.idx - b.idx
  })
  return near[0].r
}

/**
 * HARD (c) — stalemate breaker. When every ranked ask is a KNOWN miss (the
 * asked seat provably lacks the card) and nothing has hit recently, no ask can
 * gain material — but an ask still generates the public constraint "I hold at
 * least one card of this book". Hard then asks into the book it holds MOST of:
 * the tighter the remainder set, the more its teammates (running the same
 * inference) learn about its hand, converting a dead turn into signal. The
 * miss is given to the opponent with the fewest cards (deterministic, and the
 * seat with the fewest options). First-principles convention; Phase-5 research
 * may refine it.
 */
function signallingAsk(view: SeatView): GameAction | null {
  const asks = legalAsksFromView(view)
  if (asks.length === 0) return null
  const held = view.hand
  const heldOfBook = new Map<BookId, number>()
  for (const c of held) {
    const b = cardBook(c)
    heldOfBook.set(b, (heldOfBook.get(b) ?? 0) + 1)
  }
  let best = asks[0]
  let bestScore = -1
  for (const a of asks) {
    const nHeld = heldOfBook.get(cardBook(a.card)) ?? 0
    // Prefer strongest own book; among those, the fewest-card opponent.
    const score = nHeld * 100 - view.counts[a.target]
    if (score > bestScore) {
      best = a
      bestScore = score
    }
  }
  return { type: 'ask', seat: view.seat, target: best.target, card: best.card }
}

function decideMediumHard(view: SeatView, diff: 'medium' | 'hard'): GameAction {
  const seat = view.seat
  const k = buildKnowledge(view)

  if (view.phase === 'endgame') {
    // HARD (d) — endgame counting (medium shares the machinery): every
    // remaining card is with the claimer's own team; knowledge + count
    // exhaustion locate most of them outright, and the rest are assigned by
    // count-consistency (planClaim). Claim the most-certain book first — its
    // reveal feeds the next buildKnowledge call and pins further cards.
    return forcedClaim(view, k)
  }

  // 1. Books fully in own hand are free certainty.
  const complete = completeOwnBook(view)
  if (complete !== null) return claimAllSelf(seat, complete)

  // 2. Claim as soon as a whole book is certainly located on the team.
  const certain = certainClaim(view, k)
  if (certain !== null) return certain

  const stalled = isDeepStalled(view)
  const ranked = rankAsksWith(view, k)

  // 3. A certain hit is riskless progress — take it before any EV claim.
  if (ranked.length > 0) {
    const top = ranked[0]
    if (holderOf(k, top.card) === top.target) {
      // Certain hits sort strictly above everything else; hard still applies
      // its near-tie information-protection choice among them.
      if (diff === 'medium') return { type: 'ask', seat, target: top.target, card: top.card }
      const pick = hardPickAsk(view, k, ranked)
      return { type: 'ask', seat, target: pick.target, card: pick.card }
    }
  }

  // 4. Hard: EV claim (see evClaim doc). Threshold relaxes once stalled.
  if (diff === 'hard') {
    const ev = evClaim(view, k, stalled ? 0.5 : 0.8)
    if (ev !== null) return ev
  }

  // 5. Dead position: claiming on best evidence is the only progress left.
  if (stalled) return forcedClaim(view, k)

  if (ranked.length === 0) return forcedClaim(view, k)

  // 6. Hard's stalemate breaker: every legal ask is a KNOWN miss and nothing
  // has hit recently — no ask can gain material, so spend the dead turn on
  // the most informative signal instead (see signallingAsk).
  if (diff === 'hard') {
    const allKnownMiss = ranked.every((r) => !(k.cands[r.card] ?? []).includes(r.target))
    if (allKnownMiss && noRecentHit(view, 8)) {
      const sig = signallingAsk(view)
      if (sig !== null) return sig
    }
  }

  // 7. Best-ranked ask. Hard re-scores with constraint-refined hit
  // probabilities and breaks near-ties by information protection.
  if (diff === 'hard') {
    const pick = hardPickAsk(view, k, ranked)
    return { type: 'ask', seat, target: pick.target, card: pick.card }
  }
  const top = ranked[0]
  return { type: 'ask', seat, target: top.target, card: top.card }
}

/* ----------------------------------------------------------- validation --- */

/** View-side legality check for the chosen action; anything false => fallback. */
function isViewLegal(view: SeatView, action: GameAction): boolean {
  if (action.seat !== view.seat || view.turn !== view.seat) return false
  const myTeam = seatTeam(view.seat)
  switch (action.type) {
    case 'ask': {
      if (view.phase !== 'playing') return false
      if (view.hand.length === 0) return false
      if (typeof action.card !== 'string' || !isCard(action.card)) return false
      if (seatTeam(action.target) === myTeam) return false
      if (view.counts[action.target] <= 0) return false
      const book = cardBook(action.card)
      if (!view.hand.some((c) => cardBook(c) === book)) return false
      if (!view.config.toggles.askOwnCardAllowed && view.hand.includes(action.card)) return false
      return true
    }
    case 'claim': {
      if (view.phase !== 'playing' && view.phase !== 'endgame') return false
      if (view.books[action.book]) return false
      const cards = bookCards(action.book)
      if (cards.length !== 6) return false
      const keys = Object.keys(action.assignments)
      if (keys.length !== 6) return false
      for (const c of cards) {
        const s = action.assignments[c]
        if (s === undefined || seatTeam(s) !== myTeam) return false
      }
      return true
    }
    case 'pass':
      return (
        view.phase === 'awaitPass' &&
        seatTeam(action.to) === myTeam &&
        action.to !== view.seat &&
        view.counts[action.to] > 0
      )
    case 'designate':
      return (
        view.phase === 'awaitDesignate' &&
        seatTeam(action.to) !== myTeam &&
        view.counts[action.to] > 0
      )
    default:
      return false
  }
}

/**
 * Legal-by-construction last resort (the Phase-2 placeholder policy): first
 * teammate/opponent with cards for pass/designate; complete-own-hand claim,
 * else seeded-random legal ask, else most-held book with seeded guesses.
 */
function fallbackAction(view: SeatView, seed: number): GameAction {
  const rng = mulberry32(seed >>> 0)
  const seat = view.seat
  switch (view.phase) {
    case 'awaitPass': {
      const mates = teammateSeats(seat)
      const to = mates.find((s) => view.counts[s] > 0) ?? mates[0]
      return { type: 'pass', seat, to }
    }
    case 'awaitDesignate': {
      const opps = opponentTeamSeats(seat)
      const to = opps.find((s) => view.counts[s] > 0) ?? opps[0]
      return { type: 'designate', seat, to }
    }
    case 'endgame':
    case 'playing': {
      if (view.phase === 'playing') {
        const complete = completeOwnBook(view)
        if (complete !== null) return claimAllSelf(seat, complete)
        const asks = legalAsksFromView(view)
        if (asks.length > 0) {
          const a = asks[randInt(rng, asks.length)]
          return { type: 'ask', seat, target: a.target, card: a.card }
        }
      }
      return easyGuessClaim(view, rng)
    }
    case 'finished':
      // Unreachable through the bot chain; return an action the reducer will
      // reject rather than throwing.
      return { type: 'pass', seat, to: seat }
  }
}

/* --------------------------------------------------------------- decide --- */

/**
 * The bot decision function. Pure over (view, difficulty, seed); never throws;
 * never emits an action the engine's reduce() would reject (validated against
 * the view, with the placeholder policy as final fallback).
 */
export function decide(view: SeatView, difficulty: BotDifficulty, seed: number): GameAction {
  let action: GameAction | null = null
  try {
    action = decideInner(view, difficulty, seed)
  } catch {
    // decideInner failed; action stays null and the fallback takes over.
  }
  try {
    if (action !== null && (view.phase === 'finished' || isViewLegal(view, action))) return action
    return fallbackAction(view, seed)
  } catch {
    const seat = view !== null && typeof view === 'object' && typeof view.seat === 'number' ? view.seat : (0 as Seat)
    return { type: 'pass', seat, to: seat }
  }
}

function decideInner(view: SeatView, difficulty: BotDifficulty, seed: number): GameAction {
  switch (view.phase) {
    case 'awaitPass':
      return passAction(view, difficulty)
    case 'awaitDesignate':
      return designateAction(view, difficulty)
    case 'finished':
      return { type: 'pass', seat: view.seat, to: view.seat }
    case 'playing':
    case 'endgame': {
      if (difficulty === 'easy') return decideEasy(view, mulberry32(seed >>> 0))
      return decideMediumHard(view, difficulty)
    }
  }
}
