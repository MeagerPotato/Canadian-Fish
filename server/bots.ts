/**
 * bots.ts — server entry to the Phase-3 inference bots.
 *
 * The Phase-2 placeholder internals were replaced by a delegate to the pure
 * engine module lib/engine/bots (knowledge-state inference + difficulty
 * tiers). The exported signature is unchanged — the edge function and
 * tests/server call decide(view, difficulty, seed) exactly as before — and
 * the contract still holds: the bot sees ONLY a SeatView (public state + its
 * own hand; hidden hands are unreachable by construction), is fully
 * deterministic via the engine's mulberry32 over `seed`, never throws, and
 * never returns an action reduce() would reject.
 */
export type { SeatView } from '../lib/engine/bots/index.ts'
export { decide } from '../lib/engine/bots/index.ts'
