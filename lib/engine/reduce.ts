/**
 * newGame + reduce — the pure heart of the engine.
 * Implements RULES.md exactly: §2 ask legality (error order), §3 claim resolution,
 * §4 out-of-cards / endgame cascade. Never throws, never mutates its input;
 * changed paths are new objects (structural sharing elsewhere).
 */
import type {
  BookId,
  BookResult,
  Card,
  EngineError,
  ErrorCode,
  GameAction,
  GameState,
  PublicEvent,
  ReduceResult,
  RulesConfig,
  Seat,
  Team,
} from './types.ts'
import { bookCards, cardBook, isCard, seatTeam, sortHand, teamSeats } from './cards.ts'
import { dealHands } from './deal.ts'

export const defaultConfig: RulesConfig = {
  playerCount: 6,
  toggles: {
    jokers: false,
    rankQuartet: false,
    mandatoryDeclare: false,
    announceLastCard: false,
    highBooksDouble: false,
    askOwnCardAllowed: false,
    declarerChoosesNext: false,
    claimAnyTurn: false,
    strictMemory: false,
  },
}

/** Start a new deterministic game. Same seed (and config/startingSeat) => identical state. */
export function newGame(seed: string, config: RulesConfig = defaultConfig, startingSeat: Seat = 0): GameState {
  return {
    config,
    seed,
    phase: 'playing',
    turn: startingSeat,
    hands: dealHands(seed),
    books: {},
    score: [0, 0],
    log: [{ type: 'game_started', startingSeat }],
    moveIndex: 0,
  }
}

function err(code: ErrorCode, message: string): { ok: false; error: EngineError } {
  return { ok: false, error: { code, message } }
}

function isSeat(x: unknown): x is Seat {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 5
}

function teamCardCount(hands: readonly (readonly Card[])[], t: Team): number {
  return teamSeats(t).reduce<number>((n, s) => n + hands[s].length, 0)
}

/** Book point value (highBooksDouble toggle: HIGH books score 2). */
function bookPoints(config: RulesConfig, book: BookId): number {
  return config.toggles.highBooksDouble && book.startsWith('HIGH') ? 2 : 1
}

function accept(state: GameState, patch: Partial<GameState>, events: PublicEvent[]): ReduceResult {
  return {
    ok: true,
    state: {
      ...state,
      ...patch,
      log: [...state.log, ...events],
      moveIndex: state.moveIndex + 1,
    },
    events,
  }
}

/** Pure reducer. Validates per RULES.md and returns the new state + public events, or a coded error. */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  switch (action.type) {
    case 'ask':
      return reduceAsk(state, action)
    case 'claim':
      return reduceClaim(state, action)
    case 'pass':
      return reducePass(state, action)
    case 'designate':
      return reduceDesignate(state, action)
    default:
      return err('INVALID_ACTION', `unknown action type ${String((action as { type?: unknown }).type)}`)
  }
}

/* ------------------------------------------------------------------ ask --- */

function reduceAsk(state: GameState, action: { seat: Seat; target: Seat; card: Card }): ReduceResult {
  const { seat, target, card } = action
  // RULES.md §2, checks in listed order.
  if (state.phase !== 'playing') return err('WRONG_PHASE', `cannot ask in phase ${state.phase}`)
  if (seat !== state.turn) return err('NOT_YOUR_TURN', `it is seat ${state.turn}'s turn, not seat ${seat}'s`)
  if (state.hands[seat].length === 0) return err('ASKER_OUT', `seat ${seat} has no cards`)
  if (!isSeat(target)) return err('INVALID_ACTION', `target ${String(target)} is not a seat`)
  if (seatTeam(target) === seatTeam(seat) && target !== seat)
    return err('TARGET_TEAMMATE', `seat ${target} is a teammate of seat ${seat}`)
  if (target === seat) return err('TARGET_SELF', 'cannot ask yourself')
  if (state.hands[target].length === 0) return err('TARGET_OUT', `seat ${target} has no cards`)
  // The two book-relative checks below presuppose a real card; a fake card has no book.
  if (typeof card !== 'string' || !isCard(card)) return err('INVALID_CARD', `${String(card)} is not one of the 48 cards`)
  const book = cardBook(card)
  const hand = state.hands[seat]
  if (!hand.some((c) => cardBook(c) === book))
    return err('NO_CARD_OF_BOOK', `seat ${seat} holds no card of book ${book}`)
  if (!state.config.toggles.askOwnCardAllowed && hand.includes(card))
    return err('ASKING_OWN_CARD', `seat ${seat} already holds ${card}`)

  const hit = state.hands[target].includes(card)
  const events: PublicEvent[] = [{ type: 'ask', asker: seat, target, card, hit }]

  if (!hit) {
    // Miss: turn passes to the player who was asked (row 10).
    return accept(state, { turn: target }, events)
  }

  // Hit: card moves target -> asker, both hands re-sorted; asker keeps the turn (row 9).
  const hands = state.hands.map((h, i) => {
    if (i === seat) return sortHand([...h, card])
    if (i === target) return h.filter((c) => c !== card)
    return h
  })
  let phase: GameState['phase'] = state.phase
  if (hands[target].length === 0) {
    events.push({ type: 'player_out', seat: target })
    const targetTeam = seatTeam(target)
    if (teamCardCount(hands, targetTeam) === 0) {
      // Whole team emptied by the hit; unresolved books necessarily remain
      // (the taken card's book is unresolved). Asker has cards and keeps the turn (§4).
      phase = 'endgame'
      events.push({ type: 'endgame', claimingTeam: seatTeam(seat) })
    }
  }
  return accept(state, { hands, phase }, events)
}

/* ---------------------------------------------------------------- claim --- */

function reduceClaim(
  state: GameState,
  action: { seat: Seat; book: BookId; assignments: Record<Card, Seat> },
): ReduceResult {
  const { seat, book, assignments } = action
  // RULES.md §3 legality, in listed order.
  if (state.books[book]) return err('BOOK_RESOLVED', `book ${book} is already resolved`)
  if (state.phase !== 'playing' && state.phase !== 'endgame')
    return err('WRONG_PHASE', `cannot claim in phase ${state.phase}`)
  if (seat !== state.turn) return err('NOT_YOUR_TURN', `it is seat ${state.turn}'s turn, not seat ${seat}'s`)
  const cards = bookCards(book)
  if (cards.length !== 6) return err('INVALID_ACTION', `${String(book)} is not a book`)
  // Assignments must cover exactly the 6 cards of the book.
  const keys = assignments && typeof assignments === 'object' ? Object.keys(assignments) : null
  if (
    keys === null ||
    keys.length !== 6 ||
    !cards.every((c) => Object.prototype.hasOwnProperty.call(assignments, c))
  )
    return err('BAD_ASSIGNMENTS', `assignments must cover exactly the 6 cards of ${book}`)
  const claimerTeam = seatTeam(seat)
  for (const c of cards) {
    const s = assignments[c]
    if (!isSeat(s) || seatTeam(s) !== claimerTeam)
      return err('ASSIGN_OPPONENT', `card ${c} assigned to seat ${String(s)}, not on team ${claimerTeam}`)
  }

  // Resolution (§3). Actual holders recorded from the true pre-removal state.
  const actualHolders = {} as Record<Card, Seat>
  let opponentHolds = false
  let allCorrect = true
  for (const c of cards) {
    const holder = state.hands.findIndex((h) => h.includes(c)) as Seat | -1
    if (holder === -1) {
      // Unreachable for an unresolved book (48-card conservation), but never throw.
      return err('INVALID_ACTION', `card ${c} of unresolved book ${book} is not in any hand`)
    }
    actualHolders[c] = holder
    if (seatTeam(holder) !== claimerTeam) opponentHolds = true
    if (assignments[c] !== holder) allCorrect = false
  }
  const opposingTeam: Team = claimerTeam === 0 ? 1 : 0
  const outcome: BookResult['outcome'] = opponentHolds
    ? opposingTeam === 0
      ? 'team0'
      : 'team1'
    : allCorrect
      ? claimerTeam === 0
        ? 'team0'
        : 'team1'
      : 'void'

  const result: BookResult = {
    book,
    outcome,
    claimer: seat,
    assignments: { ...assignments },
    actualHolders,
  }
  const books = { ...state.books, [book]: result }
  const score: [number, number] = [state.score[0], state.score[1]]
  if (outcome === 'team0') score[0] += bookPoints(state.config, book)
  else if (outcome === 'team1') score[1] += bookPoints(state.config, book)

  // Remove the 6 cards from all hands; note newly emptied seats.
  const cardSet = new Set<Card>(cards)
  const hands = state.hands.map((h) => (h.some((c) => cardSet.has(c)) ? h.filter((c) => !cardSet.has(c)) : h))
  const events: PublicEvent[] = [
    { type: 'claim', claimer: seat, book, assignments: result.assignments, actualHolders, outcome },
  ]
  for (let s = 0; s < 6; s++) {
    if (state.hands[s].length > 0 && hands[s].length === 0) events.push({ type: 'player_out', seat: s as Seat })
  }

  // Post-claim cascade (§4 precedence).
  const resolved = Object.keys(books).length
  if (resolved === 8) {
    const winner: 0 | 1 | 'tie' = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : 'tie'
    events.push({ type: 'game_over', score: [score[0], score[1]], winner })
    return accept(state, { hands, books, score, phase: 'finished' }, events)
  }
  if (state.phase === 'endgame') {
    // Endgame: the designated/claiming seat keeps the turn until finished.
    return accept(state, { hands, books, score }, events)
  }
  const someTeamEmpty = teamCardCount(hands, 0) === 0 || teamCardCount(hands, 1) === 0
  if (someTeamEmpty) {
    if (hands[seat].length > 0) {
      // Claimant emptied the opposing team and still has cards: endgame, turn stays (§4).
      events.push({ type: 'endgame', claimingTeam: claimerTeam })
      return accept(state, { hands, books, score, phase: 'endgame' }, events)
    }
    if (teamCardCount(hands, claimerTeam) > 0) {
      // Claimant emptied themselves and the opposing team; pass resolves first, then endgame.
      return accept(state, { hands, books, score, phase: 'awaitPass' }, events)
    }
    // Claimant's whole team is out: they must designate an opponent to claim out the endgame.
    return accept(state, { hands, books, score, phase: 'awaitDesignate' }, events)
  }
  if (hands[seat].length === 0) {
    // Emptied by own claim: must pass to a teammate with cards (row 20).
    return accept(state, { hands, books, score, phase: 'awaitPass' }, events)
  }
  // Turn continues with the claimant (row 17).
  return accept(state, { hands, books, score }, events)
}

/* ----------------------------------------------------------------- pass --- */

function reducePass(state: GameState, action: { seat: Seat; to: Seat }): ReduceResult {
  const { seat, to } = action
  if (state.phase !== 'awaitPass') return err('WRONG_PHASE', `cannot pass in phase ${state.phase}`)
  if (seat !== state.turn) return err('NOT_YOUR_TURN', `it is seat ${state.turn}'s turn, not seat ${seat}'s`)
  if (!isSeat(to) || seatTeam(to) !== seatTeam(seat))
    return err('PASS_TARGET_NOT_TEAMMATE', `seat ${String(to)} is not a teammate of seat ${seat}`)
  if (state.hands[to].length === 0) return err('PASS_TARGET_OUT', `seat ${to} has no cards`)
  const events: PublicEvent[] = [{ type: 'pass', from: seat, to }]
  return handoff(state, to, events)
}

/* ------------------------------------------------------------ designate --- */

function reduceDesignate(state: GameState, action: { seat: Seat; to: Seat }): ReduceResult {
  const { seat, to } = action
  if (state.phase !== 'awaitDesignate') return err('WRONG_PHASE', `cannot designate in phase ${state.phase}`)
  if (seat !== state.turn) return err('NOT_YOUR_TURN', `it is seat ${state.turn}'s turn, not seat ${seat}'s`)
  if (!isSeat(to) || seatTeam(to) === seatTeam(seat) || state.hands[to].length === 0)
    return err('DESIGNATE_TARGET_INVALID', `seat ${String(to)} is not an opponent with cards`)
  const events: PublicEvent[] = [{ type: 'designate', from: seat, to }]
  return handoff(state, to, events)
}

/** Shared tail of pass/designate: turn = to; endgame if a whole team is out, else playing. */
function handoff(state: GameState, to: Seat, events: PublicEvent[]): ReduceResult {
  const someTeamEmpty = teamCardCount(state.hands, 0) === 0 || teamCardCount(state.hands, 1) === 0
  if (someTeamEmpty) {
    events.push({ type: 'endgame', claimingTeam: seatTeam(to) })
    return accept(state, { turn: to, phase: 'endgame' }, events)
  }
  return accept(state, { turn: to, phase: 'playing' }, events)
}
