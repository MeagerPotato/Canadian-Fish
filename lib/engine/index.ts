/**
 * Public surface of the Canadian Fish rules engine.
 * Pure TypeScript — no framework or platform imports anywhere in lib/engine/.
 */
export type {
  Suit,
  Rank,
  Card,
  Half,
  BookId,
  Seat,
  Team,
  RulesConfig,
  Phase,
  BookResult,
  PublicEvent,
  GameState,
  GameAction,
  ErrorCode,
  EngineError,
  ReduceResult,
  PublicState,
} from './types.ts'
export {
  SUITS,
  RANKS,
  LOW_RANKS,
  HIGH_RANKS,
  ALL_CARDS,
  ALL_BOOKS,
  ALL_SEATS,
  isCard,
  cardBook,
  bookCards,
  cardCompare,
  sortHand,
  seatTeam,
  teamSeats,
} from './cards.ts'
export { hashSeed, mulberry32, rngFromSeed, randInt } from './rng.ts'
export { shuffle, dealHands } from './deal.ts'
export { defaultConfig, newGame, reduce } from './reduce.ts'
export { publicView, seatView } from './views.ts'
export { checkInvariants } from './invariants.ts'
export { legalAsks, legalActionsSummary } from './helpers.ts'
