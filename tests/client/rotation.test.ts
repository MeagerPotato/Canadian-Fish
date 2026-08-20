import { describe, expect, it } from 'vitest'
import { buildTableSeats, mustAct, seatRing, winnerText } from '../../src/viewmodels/table.ts'
import type { PublicRoomState } from '../../src/api/types.ts'
import { publicState } from './util.ts'

function room(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    code: 'ABCDEF',
    status: 'playing',
    hostSeat: 0,
    seats: [0, 1, 2, 3, 4, 5].map((seat) => ({
      seat,
      filled: true,
      name: `N${seat}`,
      isBot: false,
      connected: true,
    })),
    paused: false,
    pendingVote: null,
    game: null,
    version: 1,
    ...overrides,
  }
}

describe('seat ring rotation', () => {
  it('starts the ring at my seat and proceeds in seat order', () => {
    expect(seatRing(0).map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5])
    expect(seatRing(3).map((p) => p.seat)).toEqual([3, 4, 5, 0, 1, 2])
    expect(seatRing(5).map((p) => p.seat)).toEqual([5, 0, 1, 2, 3, 4])
  })

  it('pins my seat at bottom-center', () => {
    for (const mySeat of [0, 2, 5] as const) {
      const ring = seatRing(mySeat)
      const mine = ring[0]
      expect(mine.seat).toBe(mySeat)
      expect(mine.leftPct).toBeCloseTo(50, 5)
      const maxTop = Math.max(...ring.map((p) => p.topPct))
      expect(mine.topPct).toBe(maxTop)
    }
  })

  it('places the opposite seat (ring 3) at the top of the arc', () => {
    const ring = seatRing(1)
    const top = ring[3]
    expect(top.seat).toBe(4)
    const minTop = Math.min(...ring.map((p) => p.topPct))
    expect(top.topPct).toBe(minTop)
    expect(top.leftPct).toBeCloseTo(50, 5)
  })

  it('spreads the ring symmetrically left/right', () => {
    const ring = seatRing(0)
    expect(ring[1].leftPct + ring[5].leftPct).toBeCloseTo(100, 1)
    expect(ring[2].leftPct + ring[4].leftPct).toBeCloseTo(100, 1)
    expect(new Set(ring.map((p) => p.seat)).size).toBe(6)
  })
})

describe('buildTableSeats', () => {
  it('maps counts, turn, you and team letters onto the rotated ring', () => {
    const game = publicState({ turn: 4, counts: [3, 0, 5, 8, 2, 1] })
    const seats = buildTableSeats(room(), game, 2)
    expect(seats[0].seat).toBe(2)
    expect(seats[0].isYou).toBe(true)
    expect(seats[0].teamLetter).toBe('A')
    const seat4 = seats.find((s) => s.seat === 4)!
    expect(seat4.isTurn).toBe(true)
    expect(seat4.count).toBe(2)
    const seat1 = seats.find((s) => s.seat === 1)!
    expect(seat1.teamLetter).toBe('B')
    expect(seat1.out).toBe(true)
  })
})

describe('mustAct + winner', () => {
  it('requires action exactly when it is my seat in an actionable phase', () => {
    expect(mustAct(publicState({ turn: 2 }), 2)).toBe(true)
    expect(mustAct(publicState({ turn: 2 }), 3)).toBe(false)
    expect(mustAct(publicState({ phase: 'awaitPass', turn: 1 }), 1)).toBe(true)
    expect(mustAct(publicState({ phase: 'awaitDesignate', turn: 1 }), 1)).toBe(true)
    expect(mustAct(publicState({ phase: 'endgame', turn: 5 }), 5)).toBe(true)
    expect(mustAct(publicState({ phase: 'finished', turn: 0 }), 0)).toBe(false)
    expect(mustAct(null, 0)).toBe(false)
  })

  it('maps final scores to A/B/tie', () => {
    expect(winnerText([5, 3])).toBe('A')
    expect(winnerText([2, 6])).toBe('B')
    expect(winnerText([4, 4])).toBe('tie')
  })
})
