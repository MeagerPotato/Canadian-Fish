import { describe, expect, it } from 'vitest'
import type { BookResult, Card, Seat } from '../../lib/engine/index.ts'
import {
  buildClaimMatrix,
  canOpenClaim,
  claimBookOptions,
  claimComplete,
  claimMissingCount,
  toClaimPayload,
} from '../../src/viewmodels/claim.ts'
import { publicState } from './util.ts'

function resolved(book: 'LOW-H'): BookResult {
  return {
    book,
    outcome: 'team0',
    claimer: 0,
    assignments: {} as Record<Card, Seat>,
    actualHolders: {} as Record<Card, Seat>,
  }
}

describe('claim book options + gating', () => {
  it('lists all 8 books and disables resolved ones', () => {
    const game = publicState({ books: { 'LOW-H': resolved('LOW-H') } })
    const options = claimBookOptions(game)
    expect(options).toHaveLength(8)
    expect(options.find((b) => b.book === 'LOW-H')!.resolved).toBe(true)
    expect(options.filter((b) => !b.resolved)).toHaveLength(7)
  })

  it('opens only on my turn during playing or endgame', () => {
    expect(canOpenClaim(publicState({ turn: 2 }), 2)).toBe(true)
    expect(canOpenClaim(publicState({ phase: 'endgame', turn: 2 }), 2)).toBe(true)
    expect(canOpenClaim(publicState({ turn: 2 }), 4)).toBe(false)
    expect(canOpenClaim(publicState({ phase: 'awaitPass', turn: 2 }), 2)).toBe(false)
    expect(canOpenClaim(publicState({ phase: 'finished', turn: 2 }), 2)).toBe(false)
  })
})

describe('claim matrix', () => {
  it('covers exactly the six cards of the book in canonical order', () => {
    const matrix = buildClaimMatrix('LOW-H', 0, [])
    expect(matrix.rows.map((r) => r.card)).toEqual(['2H', '3H', '4H', '5H', '6H', '7H'])
  })

  it('restricts holders to my own team', () => {
    expect(buildClaimMatrix('HIGH-S', 2, []).teamSeats).toEqual([0, 2, 4])
    expect(buildClaimMatrix('HIGH-S', 3, []).teamSeats).toEqual([1, 3, 5])
  })

  it('presets my own held cards to me and leaves the rest open', () => {
    const matrix = buildClaimMatrix('LOW-H', 4, ['2H', '5H', '9C'])
    expect(matrix.rows.find((r) => r.card === '2H')!.preset).toBe(4)
    expect(matrix.rows.find((r) => r.card === '5H')!.preset).toBe(4)
    expect(matrix.rows.find((r) => r.card === '3H')!.preset).toBeNull()
  })

  it('requires every card assigned before the claim can be submitted', () => {
    const matrix = buildClaimMatrix('LOW-H', 0, ['2H'])
    const partial = { '2H': 0, '3H': 2, '4H': 2 } as Partial<Record<Card, Seat>>
    expect(claimComplete(matrix, partial)).toBe(false)
    expect(claimMissingCount(matrix, partial)).toBe(3)
    expect(toClaimPayload(matrix, partial)).toBeNull()

    const full = { '2H': 0, '3H': 2, '4H': 2, '5H': 4, '6H': 4, '7H': 0 } as Partial<Record<Card, Seat>>
    expect(claimComplete(matrix, full)).toBe(true)
    expect(claimMissingCount(matrix, full)).toBe(0)
    const payload = toClaimPayload(matrix, full)
    expect(payload).not.toBeNull()
    expect(Object.keys(payload!)).toHaveLength(6)
    expect(payload!['7H']).toBe(0)
  })
})
