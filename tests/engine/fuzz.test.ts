import { describe, expect, it } from 'vitest'
import { ALL_BOOKS, checkInvariants, newGame, reduce, rngFromSeed } from '../../lib/engine/index.ts'
import { policyAction } from './policy.ts'

const GAMES = 10_000
const MAX_STEPS = 5_000
const TIMEOUT = 300_000

describe('fuzz: 10,000 random full games', () => {
  it(
    `plays ${GAMES} seeded games to completion with invariants after every reduce`,
    () => {
      let totalSteps = 0
      const started = Date.now()
      for (let i = 0; i < GAMES; i++) {
        const seed = `fuzz-${i}`
        const rng = rngFromSeed(`${seed}:policy`)
        let state = newGame(seed)
        let steps = 0
        while (state.phase !== 'finished' && steps < MAX_STEPS) {
          const action = policyAction(state, rng)
          const r = reduce(state, action)
          if (!r.ok) {
            throw new Error(
              `seed ${seed} step ${steps}: policy action rejected ` +
                `(${r.error.code}: ${r.error.message}) action=${JSON.stringify(action)}`,
            )
          }
          state = r.state
          const violations = checkInvariants(state)
          if (violations.length > 0) {
            throw new Error(`seed ${seed} step ${steps}: invariants violated: ${violations.join(' | ')}`)
          }
          steps++
        }
        totalSteps += steps
        if (state.phase !== 'finished') {
          throw new Error(`seed ${seed}: did not finish within ${MAX_STEPS} steps (phase ${state.phase})`)
        }
        const resolved = ALL_BOOKS.filter((b) => state.books[b])
        if (resolved.length !== 8) {
          throw new Error(`seed ${seed}: finished with ${resolved.length} resolved books`)
        }
        const voidCount = resolved.filter((b) => state.books[b]?.outcome === 'void').length
        if (state.score[0] + state.score[1] + voidCount !== 8) {
          throw new Error(
            `seed ${seed}: score ${state.score[0]}+${state.score[1]} + ${voidCount} voids !== 8 books`,
          )
        }
        if (!state.hands.every((h) => h.length === 0)) {
          throw new Error(`seed ${seed}: finished with cards still in hand`)
        }
        if (state.moveIndex !== steps) {
          throw new Error(`seed ${seed}: moveIndex ${state.moveIndex} !== accepted actions ${steps}`)
        }
      }
      const elapsed = ((Date.now() - started) / 1000).toFixed(1)
      const perGame = (totalSteps / GAMES).toFixed(1)
      console.log(`fuzz: ${GAMES} games, ${totalSteps} reduces (${perGame} avg/game) in ${elapsed}s`)
      expect(totalSteps).toBeGreaterThan(0)
    },
    TIMEOUT,
  )
})
