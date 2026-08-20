/**
 * Pure viewmodel builders for the /learn walkthrough — turn a LearnFrame into
 * everything the slide renders: seat ring, action line, hands and claim matrix.
 */
import type { BookId, Card, GameState, Seat } from '../../lib/engine/index.ts'
import { ALL_SEATS, cardBook, seatTeam } from '../../lib/engine/index.ts'
import { bookLabel, cardLabel, seatTeamLetter } from '../viewmodels/format.ts'
import type { LearnFrame } from './script.ts'

export interface RingSeatVM {
  seat: Seat
  team: 'A' | 'B'
  /** Cards held BEFORE the action. */
  count: number
  /** The player acting this step. */
  active: boolean
  /** The target of an ask / recipient of a pass. */
  target: boolean
  out: boolean
  /** Position on the ring, in percent of the container. */
  left: number
  top: number
}

/** Six seats on an ellipse; seat 0 top-center, clockwise. */
export function ringSeats(frame: LearnFrame): RingSeatVM[] {
  const { before, step } = frame
  const actor = step.action.seat
  const target =
    step.action.type === 'ask' ? step.action.target : step.action.type === 'pass' ? step.action.to : null
  return ALL_SEATS.map((seat) => {
    const angle = (seat / 6) * Math.PI * 2 - Math.PI / 2
    return {
      seat,
      team: seatTeamLetter(seat),
      count: before.hands[seat].length,
      active: seat === actor,
      target: seat === target,
      out: before.hands[seat].length === 0,
      left: 50 + 41 * Math.cos(angle),
      top: 50 + 36 * Math.sin(angle),
    }
  })
}

/** Compact mono action line, e.g. "P2 → P5 · ASK 4♦ · HIT". */
export function actionLine(frame: LearnFrame): string {
  const a = frame.step.action
  switch (a.type) {
    case 'ask': {
      const first = frame.events[0]
      const hit = first.type === 'ask' ? first.hit : false
      return `P${a.seat} → P${a.target} · ASK ${cardLabel(a.card)} · ${hit ? 'HIT' : 'MISS'}`
    }
    case 'claim': {
      const first = frame.events[0]
      const outcome = first.type === 'claim' ? first.outcome : 'void'
      const verdict = outcome === 'team0' ? 'TEAM A SCORES' : outcome === 'team1' ? 'TEAM B SCORES' : 'VOID'
      return `P${a.seat} · CLAIM ${bookLabel(a.book)} · ${verdict}`
    }
    case 'pass':
      return `P${a.seat} → P${a.to} · PASS THE TURN`
    case 'designate':
      return `P${a.seat} → P${a.to} · DESIGNATE`
  }
}

export interface HandVM {
  seat: Seat
  team: 'A' | 'B'
  label: string
  cards: Card[]
  /** Cards to visually mark (the asked card / cards of the asked book). */
  marked: Set<Card>
}

/** Face-up hands relevant to this step (lesson mode — nothing is hidden). */
export function relevantHands(frame: LearnFrame): HandVM[] {
  const { before, step } = frame
  const a = step.action
  const hand = (seat: Seat, marked: Set<Card>, note: string): HandVM => ({
    seat,
    team: seatTeamLetter(seat),
    label: `P${seat} · TEAM ${seatTeamLetter(seat)}${note}`,
    cards: before.hands[seat],
    marked,
  })
  if (a.type === 'ask') {
    const book = cardBook(a.card)
    const askerMarks = new Set(before.hands[a.seat].filter((c) => cardBook(c) === book))
    const targetMarks = new Set(before.hands[a.target].filter((c) => c === a.card))
    return [hand(a.seat, askerMarks, ' — ASKS'), hand(a.target, targetMarks, ' — ASKED')]
  }
  if (a.type === 'pass' || a.type === 'designate') {
    return [hand(a.to, new Set<Card>(), ' — RECEIVES THE TURN')]
  }
  return []
}

export interface ClaimRowVM {
  card: Card
  /** Seat the claimant named. */
  said: Seat
  /** Seat that actually held the card. */
  actual: Seat
  right: boolean
  /** True when the actual holder is on the opposing team. */
  opponent: boolean
}

export interface ClaimMatrixVM {
  book: BookId
  bookLabel: string
  outcome: 'team0' | 'team1' | 'void'
  rows: ClaimRowVM[]
}

/** The claim matrix — named seat vs actual holder for each of the six cards. */
export function claimMatrix(frame: LearnFrame): ClaimMatrixVM | null {
  const a = frame.step.action
  if (a.type !== 'claim') return null
  const ev = frame.events[0]
  if (ev.type !== 'claim') return null
  const claimerTeam = seatTeam(a.seat)
  const rows: ClaimRowVM[] = Object.keys(ev.actualHolders).map((key) => {
    const card = key as Card
    const said = ev.assignments[card]
    const actual = ev.actualHolders[card]
    return { card, said, actual, right: said === actual, opponent: seatTeam(actual) !== claimerTeam }
  })
  return { book: ev.book, bookLabel: bookLabel(ev.book), outcome: ev.outcome, rows }
}

export interface BookChipVM {
  book: BookId
  label: string
  state: 'open' | 'team0' | 'team1' | 'void'
}

/** All eight books with their resolution state at a point in the game. */
export function bookChips(state: GameState): BookChipVM[] {
  const order: BookId[] = ['LOW-C', 'HIGH-C', 'LOW-D', 'HIGH-D', 'LOW-H', 'HIGH-H', 'LOW-S', 'HIGH-S']
  return order.map((book) => ({
    book,
    label: bookLabel(book),
    state: state.books[book]?.outcome ?? 'open',
  }))
}
