/**
 * The /learn walkthrough script is a real game: every scripted action must
 * replay through the pure engine, the annotations must describe the events the
 * engine actually produces, and the story must end in a finished game.
 */
import { describe, expect, test } from 'vitest'
import { checkInvariants, newGame, reduce } from '../../lib/engine/index.ts'
import { LEARN_SCRIPT, LEARN_SEED, buildLearnGame } from '../../src/learn/script.ts'

describe('learn script', () => {
  test('every action replays through reduce with ok: true', () => {
    let state = newGame(LEARN_SEED)
    for (const [i, step] of LEARN_SCRIPT.entries()) {
      const result = reduce(state, step.action)
      expect(result.ok, `step ${i} (${step.action.type}) should be legal`).toBe(true)
      if (!result.ok) return
      expect(checkInvariants(result.state), `invariants after step ${i}`).toEqual([])
      state = result.state
    }
    expect(state.phase).toBe('finished')
  })

  test('one annotation per action', () => {
    const actions = LEARN_SCRIPT.map((s) => s.action)
    const annotations = LEARN_SCRIPT.map((s) => s.annotation)
    expect(annotations.length).toBe(actions.length)
    for (const a of annotations) {
      expect(a.title.length).toBeGreaterThan(0)
      expect(a.body.length).toBeGreaterThan(0)
    }
  })

  test('each annotation declares the event type the engine produces', () => {
    const { frames } = buildLearnGame()
    expect(frames.length).toBe(LEARN_SCRIPT.length)
    for (const frame of frames) {
      const ann = frame.step.annotation
      expect(frame.events.length).toBeGreaterThan(0)
      expect(frame.events[0].type, `step ${frame.index} primary event`).toBe(ann.event)
      if (ann.outcome !== undefined) {
        const claim = frame.events[0]
        expect(claim.type).toBe('claim')
        if (claim.type === 'claim') {
          expect(claim.outcome, `step ${frame.index} claim outcome`).toBe(ann.outcome)
        }
      }
      const producedTypes = frame.events.map((e) => e.type)
      for (const extra of ann.also ?? []) {
        expect(producedTypes, `step ${frame.index} expects a ${extra} event`).toContain(extra)
      }
    }
  })

  test('the walkthrough covers every teaching moment, in order', () => {
    const { frames, final } = buildLearnGame()
    const flat = frames.flatMap((f) => f.events)
    const indexOf = (pred: (e: (typeof flat)[number]) => boolean) => flat.findIndex(pred)

    const hit = indexOf((e) => e.type === 'ask' && e.hit)
    const miss = indexOf((e) => e.type === 'ask' && !e.hit)
    const correct = indexOf((e) => e.type === 'claim' && e.outcome === 'team0')
    const stolen = indexOf((e) => e.type === 'claim' && e.outcome === 'team1')
    const voided = indexOf((e) => e.type === 'claim' && e.outcome === 'void')
    const pass = indexOf((e) => e.type === 'pass')
    const endgame = indexOf((e) => e.type === 'endgame')
    const over = indexOf((e) => e.type === 'game_over')

    for (const [name, i] of Object.entries({ hit, miss, correct, stolen, voided, pass, endgame, over })) {
      expect(i, `missing teaching moment: ${name}`).toBeGreaterThanOrEqual(0)
    }
    expect(hit).toBeLessThan(miss)
    expect(miss).toBeLessThan(correct)
    expect(correct).toBeLessThan(stolen)
    expect(stolen).toBeLessThan(voided)
    expect(voided).toBeLessThan(pass)
    expect(pass).toBeLessThan(endgame)
    expect(endgame).toBeLessThan(over)

    // Finished game with a decisive winner and all 8 books resolved.
    expect(final.phase).toBe('finished')
    expect(Object.keys(final.books).length).toBe(8)
    const gameOver = flat[over]
    expect(gameOver.type === 'game_over' && gameOver.winner).toBe(0)
  })
})
