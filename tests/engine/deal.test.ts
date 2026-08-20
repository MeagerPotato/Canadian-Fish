import { describe, expect, it } from 'vitest'
import {
  ALL_CARDS,
  cardCompare,
  checkInvariants,
  dealHands,
  defaultConfig,
  newGame,
  rngFromSeed,
} from '../../lib/engine/index.ts'

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = rngFromSeed('alpha')
    const b = rngFromSeed('alpha')
    const c = rngFromSeed('beta')
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    const seqC = Array.from({ length: 20 }, () => c())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('deal', () => {
  it('deals 6 sorted hands of 8 covering all 48 cards', () => {
    const hands = dealHands('deal-seed')
    expect(hands).toHaveLength(6)
    for (const h of hands) {
      expect(h).toHaveLength(8)
      expect([...h].sort(cardCompare)).toEqual(h)
    }
    const all = hands.flat()
    expect(new Set(all).size).toBe(48)
    expect([...all].sort(cardCompare)).toEqual([...ALL_CARDS])
  })

  it('same seed => byte-identical game state; different seed => different deal', () => {
    const g1 = newGame('seed-x')
    const g2 = newGame('seed-x')
    const g3 = newGame('seed-y')
    expect(g1).toEqual(g2)
    expect(JSON.stringify(g1)).toBe(JSON.stringify(g2))
    expect(JSON.stringify(g1.hands)).not.toBe(JSON.stringify(g3.hands))
  })

  it('newGame starts in playing with the requested starting seat and clean log', () => {
    const g = newGame('s', defaultConfig, 3)
    expect(g.phase).toBe('playing')
    expect(g.turn).toBe(3)
    expect(g.score).toEqual([0, 0])
    expect(g.books).toEqual({})
    expect(g.moveIndex).toBe(0)
    expect(g.log).toEqual([{ type: 'game_started', startingSeat: 3 }])
    expect(newGame('s').turn).toBe(0)
    expect(checkInvariants(g)).toEqual([])
  })

  it('defaultConfig has 6 players and every toggle off', () => {
    expect(defaultConfig.playerCount).toBe(6)
    expect(Object.values(defaultConfig.toggles).every((t) => t === false)).toBe(true)
    expect(Object.keys(defaultConfig.toggles)).toHaveLength(9)
  })
})
