/**
 * Deterministic medium-bot self-play used by the deduction / claim / counting
 * drill generators. Pure: same game seed => identical action sequence
 * (medium never consults the rng; the seed is passed for parity with the
 * server's bot chain).
 */
import type { GameAction, GameState } from '../../lib/engine/index.ts'
import { decide, hashSeed, newGame, reduce, seatView } from '../../lib/engine/index.ts'

/** The action the (medium) bot in the hot seat plays now; null when finished. */
export function botAction(state: GameState): GameAction | null {
  if (state.phase === 'finished') return null
  const view = seatView(state, state.turn)
  const moveSeed = hashSeed(`${state.seed}:mv${state.moveIndex}`)()
  return decide(view, 'medium', moveSeed)
}

export interface SimResult {
  state: GameState
  /** Every action applied, in order (replayable through reduce for checks). */
  actions: GameAction[]
}

/**
 * Play a fresh seeded game forward until `stop(state)` is true, the game
 * finishes, or `maxSteps` engine actions have been applied.
 */
export function simulate(gameSeed: string, stop: (s: GameState) => boolean, maxSteps = 600): SimResult {
  let state = newGame(gameSeed)
  const actions: GameAction[] = []
  for (let i = 0; i < maxSteps; i++) {
    if (stop(state)) break
    const action = botAction(state)
    if (action === null) break
    const r = reduce(state, action)
    if (!r.ok) break // decide() never emits illegal actions; belt and braces
    state = r.state
    actions.push(action)
  }
  return { state, actions }
}
