/**
 * Public surface of the deterministic inference bots (SPEC.md §5, Phase 3).
 * Pure TypeScript over the public SeatView only — no GameState ever enters
 * this module (enforced by tests/bots/public-view.test.ts).
 */
export type {
  SeatView,
  BotDifficulty,
  Knowledge,
  KnowledgeConstraint,
  KnowledgeOptions,
  RankedAsk,
} from './types.ts'
export {
  buildKnowledge,
  holderOf,
  candidates,
  certainCards,
  rankAsks,
  rankAsksWith,
  askHitProbability,
  refinedHitProbability,
} from './knowledge.ts'
export { decide } from './decide.ts'
