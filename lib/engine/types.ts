/**
 * Core types for the Canadian Fish (Literature) rules engine.
 * Pure data — no imports, no side effects. See RULES.md for the pinned rule set.
 */

export type Suit = 'C' | 'D' | 'H' | 'S'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'
/** 48 cards — a standard deck minus the four 8s (RULES.md row 2). */
export type Card = `${Rank}${Suit}`
export type Half = 'LOW' | 'HIGH'
/** LOW = 2..7, HIGH = 9..A of one suit (RULES.md row 3). */
export type BookId = `${Half}-${Suit}`
export type Seat = 0 | 1 | 2 | 3 | 4 | 5
/** team = seat % 2; seats 0,2,4 = team 0, seats 1,3,5 = team 1. */
export type Team = 0 | 1

/** Engine configuration. All variant toggles are OFF by default (RULES.md §5). */
export interface RulesConfig {
  playerCount: 6
  toggles: {
    jokers: boolean
    rankQuartet: boolean
    mandatoryDeclare: boolean
    announceLastCard: boolean
    highBooksDouble: boolean
    askOwnCardAllowed: boolean
    declarerChoosesNext: boolean
    claimAnyTurn: boolean
    strictMemory: boolean
  }
}

export type Phase = 'playing' | 'awaitPass' | 'awaitDesignate' | 'endgame' | 'finished'

/** Outcome record of a resolved (scored or void) book. */
export interface BookResult {
  book: BookId
  outcome: 'team0' | 'team1' | 'void'
  claimer: Seat
  /** The claimer's stated locations (own team only). */
  assignments: Record<Card, Seat>
  /** True holders at the moment of the claim (pre-removal), always revealed. */
  actualHolders: Record<Card, Seat>
}

export type PublicEvent =
  | { type: 'game_started'; startingSeat: Seat }
  | { type: 'ask'; asker: Seat; target: Seat; card: Card; hit: boolean }
  | {
      type: 'claim'
      claimer: Seat
      book: BookId
      assignments: Record<Card, Seat>
      actualHolders: Record<Card, Seat>
      outcome: 'team0' | 'team1' | 'void'
    }
  | { type: 'pass'; from: Seat; to: Seat }
  | { type: 'designate'; from: Seat; to: Seat }
  | { type: 'player_out'; seat: Seat }
  | { type: 'endgame'; claimingTeam: Team }
  | { type: 'game_over'; score: [number, number]; winner: 0 | 1 | 'tie' }

export interface GameState {
  config: RulesConfig
  seed: string
  phase: Phase
  turn: Seat
  hands: Card[][]
  books: Partial<Record<BookId, BookResult>>
  score: [number, number]
  log: PublicEvent[]
  moveIndex: number
}

export type GameAction =
  | { type: 'ask'; seat: Seat; target: Seat; card: Card }
  | { type: 'claim'; seat: Seat; book: BookId; assignments: Record<Card, Seat> }
  | { type: 'pass'; seat: Seat; to: Seat }
  | { type: 'designate'; seat: Seat; to: Seat }

export type ErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'ASKER_OUT'
  | 'TARGET_TEAMMATE'
  | 'TARGET_SELF'
  | 'TARGET_OUT'
  | 'NO_CARD_OF_BOOK'
  | 'ASKING_OWN_CARD'
  | 'INVALID_CARD'
  | 'BOOK_RESOLVED'
  | 'BAD_ASSIGNMENTS'
  | 'ASSIGN_OPPONENT'
  | 'PASS_TARGET_OUT'
  | 'PASS_TARGET_NOT_TEAMMATE'
  | 'DESIGNATE_TARGET_INVALID'
  | 'INVALID_ACTION'

export type EngineError = { code: ErrorCode; message: string }

export type ReduceResult =
  | { ok: true; state: GameState; events: PublicEvent[] }
  | { ok: false; error: EngineError }

/** Public projection of the game — never contains any hidden hand card identity. */
export interface PublicState {
  phase: Phase
  turn: Seat
  counts: number[]
  score: [number, number]
  books: Partial<Record<BookId, BookResult>>
  log: PublicEvent[]
  moveIndex: number
  config: RulesConfig
}
