/**
 * Shared helpers for the bot test suites: deterministic position generation
 * (via the engine fuzz policy) and hand-crafted SeatView fabrication.
 */
import { defaultConfig, newGame, reduce, rngFromSeed } from '../../lib/engine/index.ts'
import type { Card, GameState, PublicEvent, Seat, SeatView } from '../../lib/engine/index.ts'
import { policyAction } from '../engine/policy.ts'

/**
 * A deterministic stream of `count` reachable positions sampled from seeded
 * random-policy games. Rare phases (awaitPass / awaitDesignate / endgame) are
 * always kept; 'playing' states are sampled so positions span the whole game.
 */
export function collectPositions(count: number): GameState[] {
  const out: GameState[] = []
  for (let g = 0; out.length < count && g < count * 3 + 50; g++) {
    const seed = `botpos-${g}`
    const rng = rngFromSeed(`${seed}:policy`)
    const sample = rngFromSeed(`${seed}:sample`)
    let state = newGame(seed)
    let steps = 0
    while (state.phase !== 'finished' && steps < 5000 && out.length < count) {
      const r = reduce(state, policyAction(state, rng))
      if (!r.ok) throw new Error(`collectPositions: policy rejected (${r.error.code})`)
      state = r.state
      steps++
      const rare = state.phase !== 'playing' && state.phase !== 'finished'
      if (rare || (state.phase === 'playing' && sample() < 0.08)) out.push(state)
    }
  }
  if (out.length < count) throw new Error(`collectPositions: only ${out.length}/${count} positions`)
  return out
}

/** Phase histogram of a position set (used to pin coverage in assertions). */
export function phaseCounts(positions: readonly GameState[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const p of positions) c[p.phase] = (c[p.phase] ?? 0) + 1
  return c
}

/** Fabricate a SeatView directly (for scripted knowledge scenarios). */
export function mkView(v: {
  seat: Seat
  hand: Card[]
  counts: number[]
  log: PublicEvent[]
  turn?: Seat
  phase?: SeatView['phase']
  books?: SeatView['books']
  score?: [number, number]
}): SeatView {
  return {
    phase: v.phase ?? 'playing',
    turn: v.turn ?? v.seat,
    counts: v.counts,
    score: v.score ?? [0, 0],
    books: v.books ?? {},
    log: v.log,
    moveIndex: Math.max(0, v.log.length - 1),
    config: defaultConfig,
    seat: v.seat,
    hand: v.hand,
  }
}

export const gs: PublicEvent = { type: 'game_started', startingSeat: 0 }

export function ask(asker: Seat, target: Seat, card: Card, hit: boolean): PublicEvent {
  return { type: 'ask', asker, target, card, hit }
}
