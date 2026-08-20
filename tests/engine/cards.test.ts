import { describe, expect, it } from 'vitest'
import {
  ALL_BOOKS,
  ALL_CARDS,
  bookCards,
  cardBook,
  cardCompare,
  isCard,
  seatTeam,
  sortHand,
} from '../../lib/engine/index.ts'
import type { Card, Seat } from '../../lib/engine/index.ts'

describe('cards & books', () => {
  it('has exactly 48 unique cards and no 8s', () => {
    expect(ALL_CARDS).toHaveLength(48)
    expect(new Set(ALL_CARDS).size).toBe(48)
    expect(ALL_CARDS.some((c) => c.startsWith('8'))).toBe(false)
  })

  it('has exactly 8 books of 6 cards covering the whole deck', () => {
    expect(ALL_BOOKS).toHaveLength(8)
    const union = ALL_BOOKS.flatMap((b) => bookCards(b))
    expect(union).toHaveLength(48)
    expect(new Set(union).size).toBe(48)
    for (const b of ALL_BOOKS) expect(bookCards(b)).toHaveLength(6)
  })

  it('maps cards to their half-suit book', () => {
    expect(cardBook('2H')).toBe('LOW-H')
    expect(cardBook('7H')).toBe('LOW-H')
    expect(cardBook('9H')).toBe('HIGH-H')
    expect(cardBook('AS')).toBe('HIGH-S')
    expect(cardBook('TC')).toBe('HIGH-C')
    for (const b of ALL_BOOKS) for (const c of bookCards(b)) expect(cardBook(c)).toBe(b)
  })

  it('bookCards lists LOW as 2..7 and HIGH as 9..A in rank order', () => {
    expect(bookCards('LOW-D')).toEqual(['2D', '3D', '4D', '5D', '6D', '7D'])
    expect(bookCards('HIGH-S')).toEqual(['9S', 'TS', 'JS', 'QS', 'KS', 'AS'])
  })

  it('validates card strings at runtime', () => {
    expect(isCard('2C')).toBe(true)
    expect(isCard('AS')).toBe(true)
    expect(isCard('8H')).toBe(false)
    expect(isCard('2X')).toBe(false)
    expect(isCard('')).toBe(false)
    expect(isCard('10H')).toBe(false)
  })

  it('assigns alternating teams: seats 0,2,4 = team 0; 1,3,5 = team 1', () => {
    const teams = ([0, 1, 2, 3, 4, 5] as Seat[]).map(seatTeam)
    expect(teams).toEqual([0, 1, 0, 1, 0, 1])
  })

  it('sorts hands canonically (suit-major, then rank) and deterministically', () => {
    const messy: Card[] = ['AS', '2C', '9C', 'TH', '2H', '7D']
    expect(sortHand(messy)).toEqual(['2C', '9C', '7D', '2H', 'TH', 'AS'])
    expect(sortHand(messy)).toEqual(sortHand([...messy].reverse()))
    expect([...ALL_CARDS].sort(cardCompare)).toEqual([...ALL_CARDS])
  })
})
