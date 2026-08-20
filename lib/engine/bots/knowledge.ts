/**
 * knowledge.ts — deterministic knowledge-state inference from PUBLIC data only.
 *
 * Rebuilt from scratch on every call (stateless — required for the serverless
 * path) out of exactly three inputs, all present in a SeatView:
 *   1. the public log (asks with hit/miss, claim reveals, player_out, ...),
 *   2. the public per-seat card counts,
 *   3. the viewer's own hand.
 *
 * ## Model: deal-time variables
 *
 * Every card movement after the deal is public: a hit names the card and both
 * seats, a claim reveals all six actual holders and removes the cards. So the
 * only hidden quantity per card is WHO IT WAS DEALT TO. We track, per card c:
 *
 *   pos(c)  — public current location: ORIGINAL (never moved since the deal),
 *             a known seat (publicly transferred there), or GONE (claimed).
 *   X_c     — the deal-time holder: a candidate set over the 6 seats, possibly
 *             collapsed to a single fixed seat.
 *
 * While pos(c) is ORIGINAL, "s holds c right now" is equivalent to "X_c = s";
 * the moment c moves, its present location is a public constant forever after.
 * Every historical fact is translated into a constraint over the X variables
 * AT INGESTION TIME using the pos() map as of that log event, which makes the
 * stored facts immutable — transfers and claims never invalidate them. That is
 * how set-constraint bookkeeping "survives" card movement: a disjunct is
 * removed once its card is proven dealt elsewhere, the constraint is dropped
 * once some disjunct is proven true (satisfied) or none remain (exhausted).
 *
 * Facts ingested while walking the log (RULES.md §2/§3 semantics):
 *  - ask(a, t, c, miss): a did not hold c (askOwnCardAllowed off) and t did not
 *    hold c at that moment; a held >= 1 card of book(c) \ {c} at that moment.
 *  - ask(a, t, c, hit): t held c (if c was unmoved: X_c = t — the deal holder
 *    is revealed); the same >= 1-of-book constraint on a; then c moves to a.
 *  - claim: every actual holder is revealed (fixing X for unmoved cards), the
 *    six cards leave play.
 *  - running hand sizes (replayed from the log) bound everything: whenever a
 *    seat's replayed count equals its count of certainly-located cards, every
 *    still-unfixed card is NOT with that seat (historical count exhaustion —
 *    this also covers player_out, count 0).
 *
 * After the walk the viewer's own hand is injected (fully known: YES for me on
 * live held cards, NO for me elsewhere), and a propagation loop runs to
 * fixpoint over the CURRENT public counts:
 *  - count exhaustion: a seat whose count equals its certain cards holds
 *    nothing else; a seat whose free slots equal its remaining possible cards
 *    holds all of them;
 *  - single-candidate elimination: one possible seat left => that seat has it;
 *  - set-constraint forcing: when every disjunct of a constraint except one is
 *    dead, the survivor is fixed (asker provably still holds that card's book
 *    slot from the deal).
 *
 * The builder never throws: contradictory input (possible under the easy
 * tier's truncated log, or a malformed view) degrades to weaker knowledge
 * instead of failing. On consistent full views every certainty is sound —
 * tests/bots/knowledge.test.ts checks holderOf against ground truth at every
 * step of 300 full games.
 */
import type { BookId, Card, PublicEvent, Seat } from '../types.ts'
import { ALL_BOOKS, ALL_CARDS, bookCards, cardBook, seatTeam } from '../cards.ts'
import { legalAsksFromView } from '../helpers.ts'
import type { Knowledge, KnowledgeOptions, RankedAsk, SeatView } from './types.ts'

const N = ALL_CARDS.length // 48
const CARD_INDEX: ReadonlyMap<Card, number> = new Map(ALL_CARDS.map((c, i) => [c, i]))
const FULL_MASK = 0b111111
const ORIGINAL = -1
const GONE = -2
const SEATS: readonly Seat[] = [0, 1, 2, 3, 4, 5]

function bit(s: Seat): number {
  return 1 << s
}

function popcount6(m: number): number {
  let n = 0
  for (let s = 0; s < 6; s++) if (m & (1 << s)) n++
  return n
}

function soleSeat(m: number): Seat {
  for (let s = 0 as Seat; s < 6; s++) if (m === 1 << s) return s as Seat
  return 0
}

/** Mutable working state while building. */
interface Work {
  /** ORIGINAL | seat | GONE — public current location per card. */
  pos: number[]
  /** Deal-holder candidate mask per card (meaningful while xfix is unset). */
  cand: number[]
  /** Deal holder once fixed, else -1. */
  xfix: number[]
  /** Live at-least-one-of-set constraints over deal variables. */
  constraints: { seat: Seat; cards: number[] }[]
}

function fixX(w: Work, ci: number, s: Seat): void {
  if (w.xfix[ci] !== -1) return // keep the first derivation; conflicts = inconsistent input
  w.xfix[ci] = s
  w.cand[ci] = bit(s)
}

function clearCand(w: Work, ci: number, s: Seat): void {
  if (w.xfix[ci] !== -1) return
  const next = w.cand[ci] & ~bit(s)
  if (next === 0 || next === w.cand[ci]) {
    // Never empty a candidate set (inconsistent input under truncated logs);
    // leave the last belief in place rather than fabricating certainty.
    return
  }
  w.cand[ci] = next
  if (popcount6(next) === 1) fixX(w, ci, soleSeat(next))
}

/**
 * Historical count exhaustion at the current walk position: for each seat whose
 * replayed hand size equals the number of cards certainly located there, every
 * still-unfixed ORIGINAL card cannot be (and so was never) with that seat.
 */
function exhaustCounts(w: Work, runningCounts: number[]): void {
  for (const s of SEATS) {
    let certain = 0
    for (let ci = 0; ci < N; ci++) {
      if (w.pos[ci] === s || (w.pos[ci] === ORIGINAL && w.xfix[ci] === s)) certain++
    }
    if (runningCounts[s] === certain) {
      for (let ci = 0; ci < N; ci++) {
        if (w.pos[ci] === ORIGINAL && w.xfix[ci] === -1) clearCand(w, ci, s)
      }
    }
  }
}

/**
 * Record "asker held >= 1 card of `book` (minus the asked card, unless the
 * bluff toggle allowed asking an own card on a miss) at this walk position",
 * translated to deal variables via the current pos() map.
 */
function addAskConstraint(
  w: Work,
  asker: Seat,
  book: BookId,
  askedCi: number,
  includeAsked: boolean,
): void {
  const alive: number[] = []
  for (const c of bookCards(book)) {
    const ci = CARD_INDEX.get(c)
    if (ci === undefined) continue
    if (ci === askedCi && !includeAsked) continue
    if (w.pos[ci] === asker) return // publicly with the asker right now: satisfied
    if (w.pos[ci] !== ORIGINAL) continue // elsewhere or gone: dead disjunct
    if (w.xfix[ci] === asker) return // dealt to the asker and unmoved: satisfied
    if (w.xfix[ci] !== -1) continue // dealt elsewhere: dead
    if ((w.cand[ci] & bit(asker)) === 0) continue // asker already excluded: dead
    alive.push(ci)
  }
  if (alive.length === 0) return // exhausted/inconsistent — no information kept
  if (alive.length === 1) {
    fixX(w, alive[0], asker)
    return
  }
  w.constraints.push({ seat: asker, cards: alive })
}

/** Walk one public event, updating the working state. */
function ingest(w: Work, ev: PublicEvent, runningCounts: number[], opts: Required<KnowledgeOptions>, ownCardToggle: boolean, trackCounts: boolean): void {
  switch (ev.type) {
    case 'ask': {
      const ci = CARD_INDEX.get(ev.card)
      if (ci === undefined) return
      // Under a truncated window a resolved book's cards are pre-marked GONE
      // even though this (older) ask predates the claim: out of play, skip.
      if (w.pos[ci] === GONE) return
      const book = cardBook(ev.card)
      if (ev.hit) {
        // Target held the card at this moment; if it never moved before, the
        // deal holder is revealed outright.
        if (w.pos[ci] === ORIGINAL) fixX(w, ci, ev.target)
        if (opts.useConstraints) addAskConstraint(w, ev.asker, book, ci, false)
        w.pos[ci] = ev.asker // public transfer target -> asker
        if (trackCounts) {
          runningCounts[ev.target]--
          runningCounts[ev.asker]++
          exhaustCounts(w, runningCounts)
        }
      } else {
        if (w.pos[ci] === ORIGINAL) {
          if (!ownCardToggle) clearCand(w, ci, ev.asker)
          clearCand(w, ci, ev.target)
        }
        if (opts.useConstraints) addAskConstraint(w, ev.asker, book, ci, ownCardToggle)
      }
      return
    }
    case 'claim': {
      for (const c of bookCards(ev.book)) {
        const ci = CARD_INDEX.get(c)
        if (ci === undefined) continue
        const actual = ev.actualHolders[c]
        if (w.pos[ci] === ORIGINAL && actual !== undefined) fixX(w, ci, actual)
        if (w.pos[ci] !== GONE && trackCounts && actual !== undefined) runningCounts[actual]--
        w.pos[ci] = GONE
      }
      if (trackCounts) exhaustCounts(w, runningCounts)
      return
    }
    case 'player_out': {
      if (trackCounts) exhaustCounts(w, runningCounts)
      return
    }
    default:
      return // game_started / pass / designate / endgame / game_over carry no card facts
  }
}

/** Propagate to fixpoint over the CURRENT counts + constraints + candidates. */
function propagate(w: Work, counts: readonly number[]): void {
  for (let round = 0; round < 96; round++) {
    let changed = false

    // Count exhaustion + count forcing per seat (current position).
    for (const s of SEATS) {
      let certain = 0
      const poss: number[] = []
      for (let ci = 0; ci < N; ci++) {
        if (w.pos[ci] === s || (w.pos[ci] === ORIGINAL && w.xfix[ci] === s)) certain++
        else if (w.pos[ci] === ORIGINAL && w.xfix[ci] === -1 && (w.cand[ci] & bit(s)) !== 0) poss.push(ci)
      }
      const need = (counts[s] ?? 0) - certain
      if (need <= 0) {
        for (const ci of poss) {
          clearCand(w, ci, s)
          changed = true
        }
      } else if (poss.length === need) {
        for (const ci of poss) {
          fixX(w, ci, s)
          changed = true
        }
      }
      // poss.length < need would be inconsistent input; keep what we have.
    }

    // Single-candidate elimination (also triggered eagerly inside clearCand).
    for (let ci = 0; ci < N; ci++) {
      if (w.pos[ci] === ORIGINAL && w.xfix[ci] === -1 && popcount6(w.cand[ci]) === 1) {
        fixX(w, ci, soleSeat(w.cand[ci]))
        changed = true
      }
    }

    // Set-constraint forcing: prune dead disjuncts; fix a lone survivor.
    const surviving: { seat: Seat; cards: number[] }[] = []
    for (const k of w.constraints) {
      let satisfied = false
      const alive: number[] = []
      for (const ci of k.cards) {
        if (w.xfix[ci] === k.seat) {
          satisfied = true
          break
        }
        if (w.xfix[ci] !== -1) continue
        if ((w.cand[ci] & bit(k.seat)) === 0) continue
        alive.push(ci)
      }
      if (satisfied) {
        changed = true
        continue // dropped: satisfied by a known YES
      }
      if (alive.length === 0) {
        changed = true
        continue // dropped: information exhausted
      }
      if (alive.length === 1) {
        fixX(w, alive[0], k.seat)
        changed = true
        continue
      }
      if (alive.length !== k.cards.length) changed = true
      surviving.push({ seat: k.seat, cards: alive })
    }
    w.constraints = surviving

    if (!changed) return
  }
}

/**
 * Rebuild the knowledge state for `view.seat` from the public log, the public
 * counts, and the viewer's own hand. Pure and deterministic; never throws on
 * malformed input (degrades to weaker knowledge instead).
 */
export function buildKnowledge(view: SeatView, options: KnowledgeOptions = {}): Knowledge {
  const opts: Required<KnowledgeOptions> = {
    logWindow: options.logWindow ?? Number.POSITIVE_INFINITY,
    useConstraints: options.useConstraints ?? true,
  }
  const ownCardToggle = view.config?.toggles?.askOwnCardAllowed === true
  const log: readonly PublicEvent[] = Array.isArray(view.log) ? view.log : []
  const windowed = opts.logWindow < log.length
  const events = windowed ? log.slice(log.length - opts.logWindow) : log

  const w: Work = {
    pos: new Array<number>(N).fill(ORIGINAL),
    cand: new Array<number>(N).fill(FULL_MASK),
    xfix: new Array<number>(N).fill(-1),
    constraints: [],
  }

  // Resolved books are public table state (view.books), not memory: their
  // cards are out of play regardless of how much log the viewer retains.
  // Under a truncated window the claim event may fall outside it, so GONE is
  // seeded from view.books BEFORE the walk. Under a full walk the claim events
  // handle it chronologically (seeding first would wrongly discard the real
  // asks that preceded the claim); books are re-applied after as a safety net
  // for views whose log is inconsistent with their books.
  const markResolvedGone = (): void => {
    for (const b of ALL_BOOKS) {
      if (!view.books?.[b]) continue
      for (const c of bookCards(b)) {
        const ci = CARD_INDEX.get(c)
        if (ci !== undefined) w.pos[ci] = GONE
      }
    }
  }

  // With a truncated window the replayed running counts would be wrong, so
  // historical count exhaustion is only applied when the whole log is walked.
  const trackCounts = !windowed
  if (windowed) markResolvedGone()
  const runningCounts = [8, 8, 8, 8, 8, 8]
  for (const ev of events) ingest(w, ev, runningCounts, opts, ownCardToggle, trackCounts)
  markResolvedGone()

  // Own hand: fully known. Held live cards are mine (if unmoved, they were
  // dealt to me); every other unmoved card was never mine.
  const me = view.seat
  const held = new Set<Card>(Array.isArray(view.hand) ? view.hand : [])
  for (let ci = 0; ci < N; ci++) {
    const c = ALL_CARDS[ci]
    if (w.pos[ci] === GONE) continue
    if (held.has(c)) {
      if (w.pos[ci] === ORIGINAL) {
        if (w.xfix[ci] !== me) {
          w.xfix[ci] = me
          w.cand[ci] = bit(me)
        }
      } else {
        w.pos[ci] = me // trust the hand over an inconsistent (truncated) log
      }
    } else {
      if (w.pos[ci] === me) w.pos[ci] = ORIGINAL // inconsistent truncated log; forget
      if (w.pos[ci] === ORIGINAL) {
        if (w.xfix[ci] === me) {
          w.xfix[ci] = -1
          w.cand[ci] = FULL_MASK & ~bit(me)
        } else {
          clearCand(w, ci, me)
        }
      }
    }
  }

  const counts = Array.isArray(view.counts) ? view.counts : [0, 0, 0, 0, 0, 0]
  propagate(w, counts)

  // Materialize the plain serializable Knowledge object.
  const holders: Partial<Record<Card, Seat>> = {}
  const cands: Partial<Record<Card, Seat[]>> = {}
  const gone: Card[] = []
  const certainAt = [0, 0, 0, 0, 0, 0]
  for (let ci = 0; ci < N; ci++) {
    const c = ALL_CARDS[ci]
    if (w.pos[ci] === GONE) {
      gone.push(c)
      continue
    }
    let holder: Seat | null = null
    if (w.pos[ci] !== ORIGINAL) holder = w.pos[ci] as Seat
    else if (w.xfix[ci] !== -1) holder = w.xfix[ci] as Seat
    if (holder !== null) {
      holders[c] = holder
      cands[c] = [holder]
      certainAt[holder]++
    } else {
      const list: Seat[] = []
      for (const s of SEATS) if ((w.cand[ci] & bit(s)) !== 0) list.push(s)
      cands[c] = list
    }
  }
  const unknownSlots = SEATS.map((s) => Math.max(0, (counts[s] ?? 0) - certainAt[s]))
  const constraints = w.constraints.map((k) => ({
    seat: k.seat,
    cards: k.cards.map((ci) => ALL_CARDS[ci]),
  }))
  return { seat: me, counts: [...counts], holders, cands, gone, unknownSlots, constraints }
}

/* ----------------------------------------------------------- query fns --- */

/** The certainly-known current holder of a live card, else null (gone => null). */
export function holderOf(k: Knowledge, card: Card): Seat | null {
  return k.holders[card] ?? null
}

/** Current candidate holders of a card (certain => one entry; gone => []). */
export function candidates(k: Knowledge, card: Card): Seat[] {
  const c = k.cands[card]
  return c ? [...c] : []
}

/** All live cards certainly located at `seat`, in canonical order. */
export function certainCards(k: Knowledge, seat: Seat): Card[] {
  const out: Card[] = []
  for (const c of ALL_CARDS) if (k.holders[c] === seat) out.push(c)
  return out
}

/* ------------------------------------------------------------ rankAsks --- */

const SUIT_SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }

/** "9H" -> "9♥" for human-readable coach reasons. */
function pc(card: Card): string {
  return `${card[0]}${SUIT_SYMBOL[card[1]] ?? card[1]}`
}

/**
 * Probability estimate that `target` currently holds `card`: the target's
 * unidentified slots over the total unidentified slots of all candidate seats
 * (every unknown slot is, to first order, equally likely to be this card).
 */
export function askHitProbability(k: Knowledge, card: Card, target: Seat): number {
  return pHit(k, card, target)
}

/**
 * HARD-tier refinement of askHitProbability: surviving set-constraints are
 * folded in. If `target` provably was dealt at least one card of a set S and
 * `card` is one of the members still possibly with `target`, then
 * P(target holds card) is at least about 1/|S alive| on top of the slot prior:
 *   refined = max(base, base + (1 - base) / |S alive|)
 * over the tightest such constraint. First-order (ignores overlap between
 * constraints), monotone (never below base), and zero-cost when no constraint
 * mentions the card. This is the "deeper inference" edge the hard tier has
 * over medium's slot prior.
 */
export function refinedHitProbability(k: Knowledge, card: Card, target: Seat): number {
  const base = pHit(k, card, target)
  if (base === 0 || base === 1) return base
  let best = base
  for (const kc of k.constraints) {
    if (kc.seat !== target) continue
    // Only members that could still be with the target right now matter.
    const alive = kc.cards.filter((u) => {
      const cu = k.cands[u]
      return cu !== undefined && cu.length > 1 && cu.includes(target)
    })
    if (alive.length === 0 || !alive.includes(card)) continue
    const boosted = base + (1 - base) / alive.length
    if (boosted > best) best = boosted
  }
  return Math.min(1 - 1e-9, best) // never claim certainty from a probabilistic boost
}

/** Probability estimate that `target` currently holds `card`, given knowledge. */
function pHit(k: Knowledge, card: Card, target: Seat): number {
  const cand = k.cands[card]
  if (!cand || cand.length === 0) return 0
  if (!cand.includes(target)) return 0
  if (cand.length === 1) return 1
  // Weight each candidate seat by its unidentified-card slots: every unknown
  // slot is (to first order) equally likely to be this card.
  let total = 0
  for (const s of cand) total += k.unknownSlots[s]
  if (total <= 0) return 1 / cand.length
  return k.unknownSlots[target] / total
}

/** How many of the book's six cards the viewer's team certainly accounts for. */
function teamKnownOfBook(k: Knowledge, book: BookId): number {
  const myTeam = seatTeam(k.seat)
  let n = 0
  for (const c of bookCards(book)) {
    const h = k.holders[c]
    if (h !== undefined && seatTeam(h) === myTeam) n++
  }
  return n
}

/**
 * Score every legal ask for the viewing seat against prebuilt knowledge.
 * Deterministic: sorted score-desc, then canonical card order, then target.
 *
 * Scoring (documented for the Phase-4 coach overlay):
 *   score = 70*pHit + 18*progress + 12*narrowing (+20 when the hit is CERTAIN)
 *   - pHit: probability the target holds the card; known misses contribute 0.
 *     The +20 certainty bonus makes a certain hit (>= 102) strictly dominate
 *     every uncertain ask (< 100), so "certain hits first" holds by sort order.
 *   - progress: fraction of the asked book already certainly on the asker's
 *     team — winning a card of a nearly-secured book is worth more.
 *   - narrowing: 1/(candidates-1) — a miss on a 2-candidate card pins the
 *     card outright, so tight candidate sets make even a miss informative.
 */
export function rankAsksWith(view: SeatView, k: Knowledge): RankedAsk[] {
  const asks = legalAsksFromView(view)
  const out: RankedAsk[] = []
  for (const a of asks) {
    const cand = k.cands[a.card] ?? []
    const p = pHit(k, a.card, a.target)
    const book = cardBook(a.card)
    const known = teamKnownOfBook(k, book)
    const progress = known / 6
    const narrowing = cand.length > 1 ? 1 / (cand.length - 1) : 1
    const certainBonus = p === 1 ? 20 : 0
    const score = Math.round((70 * p + 18 * progress + 12 * narrowing + certainBonus) * 100) / 100
    let reason: string
    if (p === 1) {
      reason = `Seat ${a.target} is known to hold ${pc(a.card)}`
    } else if (p === 0) {
      reason = `Seat ${a.target} is known not to hold ${pc(a.card)} — this ask hands over the turn`
    } else {
      const pct = Math.round(p * 100)
      const narrowNote =
        cand.length === 2
          ? 'a miss pins it on the other seat'
          : `a miss narrows ${pc(a.card)} to ${cand.length - 1} seats`
      reason = `${pct}% that seat ${a.target} holds ${pc(a.card)} (${cand.length} candidate seats); ${narrowNote}`
    }
    out.push({ target: a.target, card: a.card, score, reason })
  }
  out.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score
    const cx = CARD_INDEX.get(x.card) ?? 0
    const cy = CARD_INDEX.get(y.card) ?? 0
    if (cx !== cy) return cx - cy
    return x.target - y.target
  })
  return out
}

/**
 * Every legal ask for the viewing seat, scored. Public entry point for the
 * Phase-4 coach overlay: build knowledge from the view, then rank.
 */
export function rankAsks(view: SeatView): RankedAsk[] {
  return rankAsksWith(view, buildKnowledge(view))
}
