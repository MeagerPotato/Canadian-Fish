/**
 * Claim trainer — puzzles are fully locatable from seat 0's own view (every
 * card of the book has a certain holder, all on team 0, matching engine
 * ground truth), and the scorer mirrors engine claim outcome semantics:
 * 6/6 → the team scores; any wrong location → void.
 */
import { describe, expect, it } from 'vitest'
import { bookCards, buildKnowledge, holderOf, newGame, reduce, seatTeam, seatView, sortHand } from '../../lib/engine/index.ts'
import type { Card, GameState, Seat } from '../../lib/engine/index.ts'
import { generateClaimRound, gradeClaim, type ClaimPuzzle } from '../../src/drills/claim.ts'
import { botAction } from '../../src/drills/sim.ts'

const SEED_COUNT = 10

/** Replay the puzzle's game to the exact snapshotted position. */
function replay(p: ClaimPuzzle): GameState {
  let state = newGame(p.gameSeed)
  for (let i = 0; i < 1000 && state.log.length < p.log.length; i++) {
    const a = botAction(state)
    if (a === null) break
    const r = reduce(state, a)
    if (!r.ok) throw new Error(`replay rejected: ${r.error.code}`)
    state = r.state
  }
  return state
}

describe('drills/claim', () => {
  it('is deterministic per seed', () => {
    expect(generateClaimRound('CL-D')).toEqual(generateClaimRound('CL-D'))
  })

  it(
    'puzzles are engine-verified fully locatable, all six on team 0',
    { timeout: 300_000 },
    () => {
      for (let i = 0; i < SEED_COUNT; i++) {
        const round = generateClaimRound(`CL-${i}`)
        expect(round.puzzles).toHaveLength(2)
        for (const p of round.puzzles) {
          const state = replay(p)
          expect(state.log).toEqual(p.log)
          expect(sortHand(state.hands[0])).toEqual(p.hand)
          expect(state.books[p.book]).toBeUndefined()
          const k = buildKnowledge(seatView(state, 0 as Seat))
          for (const c of bookCards(p.book)) {
            // Certain from my view, matches ground truth, and on my team.
            expect(holderOf(k, c)).toBe(p.truth[c])
            expect(state.hands[p.truth[c]]).toContain(c)
            expect(seatTeam(p.truth[c])).toBe(0)
          }
        }
      }
    },
  )

  it(
    'scorer matches the engine: 6/6 scores for team 0, any wrong seat voids',
    { timeout: 300_000 },
    () => {
      const round = generateClaimRound('CL-ENGINE')
      for (const p of round.puzzles) {
        const state = replay(p)
        const atTurn: GameState = { ...state, turn: 0 as Seat } // claims are on your own turn
        // Correct claim.
        const right = gradeClaim(p, { ...p.truth })
        expect(right.won).toBe(true)
        expect(right.correct).toBe(6)
        expect(right.outcome).toBe('team0')
        expect(right.score).toBe(10)
        const rOk = reduce(atTurn, { type: 'claim', seat: 0 as Seat, book: p.book, assignments: { ...p.truth } })
        expect(rOk.ok).toBe(true)
        if (rOk.ok) {
          const ev = rOk.state.books[p.book]
          expect(ev?.outcome).toBe('team0')
        }
        // One wrong location (still all on team 0) → void, and the grade agrees.
        const cards = [...bookCards(p.book)]
        const flipCard: Card = cards[0]
        const actual = p.truth[flipCard]
        const wrongSeat = ([0, 2, 4] as Seat[]).find((s) => s !== actual)
        expect(wrongSeat).toBeDefined()
        const wrongPicks: Record<Card, Seat> = { ...p.truth, [flipCard]: wrongSeat as Seat }
        const wrong = gradeClaim(p, wrongPicks)
        expect(wrong.won).toBe(false)
        expect(wrong.correct).toBe(5)
        expect(wrong.outcome).toBe('void')
        expect(wrong.score).toBe(5)
        const rVoid = reduce(atTurn, { type: 'claim', seat: 0 as Seat, book: p.book, assignments: wrongPicks })
        expect(rVoid.ok).toBe(true)
        if (rVoid.ok) {
          const ev = rVoid.state.books[p.book]
          expect(ev?.outcome).toBe('void')
        }
      }
    },
  )
})
