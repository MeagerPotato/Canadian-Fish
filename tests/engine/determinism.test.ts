import { describe, expect, it } from 'vitest'
import { newGame, reduce, rngFromSeed } from '../../lib/engine/index.ts'
import type { GameAction, GameState } from '../../lib/engine/index.ts'
import { policyAction } from './policy.ts'
import { asg, deepFreeze, distribute, forceState } from './util.ts'

function playRecorded(seed: string): { final: GameState; actions: GameAction[] } {
  const rng = rngFromSeed(`${seed}:policy`)
  let state = newGame(seed)
  const actions: GameAction[] = []
  for (let step = 0; step < 5000 && state.phase !== 'finished'; step++) {
    const action = policyAction(state, rng)
    const r = reduce(state, action)
    if (!r.ok) throw new Error(`policy emitted illegal action: ${r.error.code}`)
    actions.push(action)
    state = r.state
  }
  expect(state.phase).toBe('finished')
  return { final: state, actions }
}

describe('determinism', () => {
  it('same seed twice yields deep-equal, byte-identical states', () => {
    const a = newGame('det-seed')
    const b = newGame('det-seed')
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('replaying a recorded action list reproduces the identical final state', () => {
    const { final, actions } = playRecorded('det-replay')
    let state = newGame('det-replay')
    for (const action of actions) {
      const r = reduce(state, action)
      if (!r.ok) throw new Error(`replay diverged: ${r.error.code}`)
      state = r.state
    }
    expect(state).toEqual(final)
    expect(JSON.stringify(state)).toBe(JSON.stringify(final))
    expect(state.moveIndex).toBe(actions.length)
  })

  it('reduce never mutates its input (deep-frozen state, every action type)', () => {
    // Ask (hit and miss) on a frozen crafted state.
    const askState = deepFreeze(
      forceState(distribute({ 0: ['2H'], 1: ['3H'] }, [0, 1, 2, 3, 4, 5]), { turn: 0 }),
    )
    const askBefore = JSON.stringify(askState)
    expect(reduce(askState, { type: 'ask', seat: 0, target: 1, card: '3H' }).ok).toBe(true) // hit
    expect(reduce(askState, { type: 'ask', seat: 0, target: 3, card: '3H' }).ok).toBe(true) // miss
    expect(JSON.stringify(askState)).toBe(askBefore)

    // Claim / pass / designate on frozen crafted states.
    const claimState = deepFreeze(
      forceState(distribute({ 0: ['2H', '3H'], 2: ['4H', '5H'], 4: ['6H', '7H'] }), { turn: 0 }),
    )
    const claimBefore = JSON.stringify(claimState)
    const cr = reduce(claimState, {
      type: 'claim',
      seat: 0,
      book: 'LOW-H',
      assignments: asg([
        ['2H', 0],
        ['3H', 0],
        ['4H', 2],
        ['5H', 2],
        ['6H', 4],
        ['7H', 4],
      ]),
    })
    expect(cr.ok).toBe(true)
    expect(JSON.stringify(claimState)).toBe(claimBefore)

    const passState = deepFreeze(forceState(distribute({}, [1, 2, 3, 4, 5]), { turn: 0, phase: 'awaitPass' }))
    const passBefore = JSON.stringify(passState)
    expect(reduce(passState, { type: 'pass', seat: 0, to: 2 }).ok).toBe(true)
    expect(JSON.stringify(passState)).toBe(passBefore)

    const desigState = deepFreeze(forceState(distribute({}, [1, 3, 5]), { turn: 0, phase: 'awaitDesignate' }))
    const desigBefore = JSON.stringify(desigState)
    expect(reduce(desigState, { type: 'designate', seat: 0, to: 1 }).ok).toBe(true)
    expect(JSON.stringify(desigState)).toBe(desigBefore)
  })

  it('uses structural sharing: untouched hands keep their identity across reduce', () => {
    const s = forceState(distribute({ 0: ['2H'], 1: ['3H'] }, [0, 1, 2, 3, 4, 5]), { turn: 0 })
    const r = reduce(s, { type: 'ask', seat: 0, target: 1, card: '3H' })
    if (!r.ok) throw new Error(r.error.code)
    expect(r.state.hands[0]).not.toBe(s.hands[0])
    expect(r.state.hands[1]).not.toBe(s.hands[1])
    for (const i of [2, 3, 4, 5]) expect(r.state.hands[i]).toBe(s.hands[i])
    expect(r.state.books).toBe(s.books)
    expect(r.state.config).toBe(s.config)
  })
})
