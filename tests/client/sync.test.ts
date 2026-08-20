import { describe, expect, it } from 'vitest'
import type { Card, PublicEvent, Seat } from '../../lib/engine/index.ts'
import { NO_VERSION, handRefetchNeeded, shouldApplyBroadcast, shouldApplyFetch } from '../../src/viewmodels/sync.ts'

describe('broadcast version gate', () => {
  it('applies only strictly newer broadcast payloads', () => {
    expect(shouldApplyBroadcast(NO_VERSION, 0)).toBe(true)
    expect(shouldApplyBroadcast(5, 6)).toBe(true)
    expect(shouldApplyBroadcast(5, 5)).toBe(false)
    expect(shouldApplyBroadcast(5, 4)).toBe(false)
  })

  it('lets an authoritative fetch refresh at the same version but never regress', () => {
    expect(shouldApplyFetch(5, 5)).toBe(true)
    expect(shouldApplyFetch(5, 7)).toBe(true)
    expect(shouldApplyFetch(5, 4)).toBe(false)
  })
})

describe('hand refetch detection', () => {
  const base: PublicEvent[] = [
    { type: 'game_started', startingSeat: 0 },
    { type: 'ask', asker: 1, target: 2, card: '9H', hit: false },
  ]

  it('ignores misses and hits between other seats', () => {
    const miss: PublicEvent[] = [...base, { type: 'ask', asker: 0, target: 3, card: '2C', hit: false }]
    expect(handRefetchNeeded(base.length, miss, 0)).toBe(false)

    const othersHit: PublicEvent[] = [...base, { type: 'ask', asker: 1, target: 2, card: '2C', hit: true }]
    expect(handRefetchNeeded(base.length, othersHit, 0)).toBe(false)
  })

  it('refetches on a hit ask involving my seat, either side', () => {
    const iTook: PublicEvent[] = [...base, { type: 'ask', asker: 0, target: 3, card: '2C', hit: true }]
    expect(handRefetchNeeded(base.length, iTook, 0)).toBe(true)

    const takenFromMe: PublicEvent[] = [...base, { type: 'ask', asker: 3, target: 0, card: '2C', hit: true }]
    expect(handRefetchNeeded(base.length, takenFromMe, 0)).toBe(true)
  })

  it('refetches on any claim and on a log reset, but not when nothing new arrived', () => {
    const claim: PublicEvent[] = [
      ...base,
      {
        type: 'claim',
        claimer: 5,
        book: 'LOW-H',
        assignments: {} as Record<Card, Seat>,
        actualHolders: {} as Record<Card, Seat>,
        outcome: 'team1',
      },
    ]
    expect(handRefetchNeeded(base.length, claim, 0)).toBe(true)
    expect(handRefetchNeeded(base.length, [base[0]], 0)).toBe(true)
    expect(handRefetchNeeded(base.length, base, 0)).toBe(false)
    expect(handRefetchNeeded(base.length, [...base, { type: 'player_out', seat: 4 }], 0)).toBe(false)
  })
})
