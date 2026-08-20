import { describe, expect, it } from 'vitest'
import type { Card, PublicEvent, Seat } from '../../lib/engine/index.ts'
import { humanizeLog, latestLine } from '../../src/viewmodels/log.ts'
import { names } from './util.ts'

const HOLDERS = { '2H': 0, '3H': 0, '4H': 2, '5H': 2, '6H': 4, '7H': 4 } as Record<Card, Seat>

function claim(outcome: 'team0' | 'team1' | 'void', claimer: Seat = 0): PublicEvent {
  return { type: 'claim', claimer, book: 'LOW-H', assignments: HOLDERS, actualHolders: HOLDERS, outcome }
}

describe('log humanization', () => {
  it('renders asks with names, the card glyph, and hit/miss', () => {
    const hit = humanizeLog([{ type: 'ask', asker: 0, target: 1, card: '9H', hit: true }], names)[0]
    expect(hit.text).toBe('Maya asked Sam for 9♥ — hit.')
    expect(hit.kind).toBe('ask-hit')

    const miss = humanizeLog([{ type: 'ask', asker: 3, target: 4, card: 'TC', hit: false }], names)[0]
    expect(miss.text).toBe('Lena asked Kit for 10♣ — no.')
    expect(miss.kind).toBe('ask-miss')
  })

  it('renders claim outcomes: won, lost, void — always with the reveal', () => {
    const won = humanizeLog([claim('team0')], names)[0]
    expect(won.kind).toBe('claim-won')
    expect(won.text).toContain('Maya claimed LOW ♥')
    expect(won.text).toContain('Team A scores')

    const lost = humanizeLog([claim('team1')], names)[0]
    expect(lost.kind).toBe('claim-lost')
    expect(lost.text).toContain('Team B scores')

    const voided = humanizeLog([claim('void')], names)[0]
    expect(voided.kind).toBe('claim-void')
    expect(voided.text).toContain('void')

    expect(won.detail).toHaveLength(6)
    expect(won.detail![0]).toBe('2♥ — Maya')
    expect(won.detail![4]).toBe('6♥ — Kit')
  })

  it('renders routing and terminal events', () => {
    const lines = humanizeLog(
      [
        { type: 'game_started', startingSeat: 0 },
        { type: 'pass', from: 0, to: 2 },
        { type: 'designate', from: 1, to: 2 },
        { type: 'player_out', seat: 5 },
        { type: 'endgame', claimingTeam: 1 },
        { type: 'game_over', score: [4, 4], winner: 'tie' },
      ],
      names,
    )
    expect(lines[0].text).toBe('Game over — 4–4. A tie.')
    expect(lines[1].text).toContain('Team B must claim')
    expect(lines[2].text).toBe('Ola is out of cards.')
    expect(lines[3].text).toBe('Sam designated Ira to claim the rest.')
    expect(lines[4].text).toBe('Maya passed the turn to Ira.')
    expect(lines[5].text).toBe('Cards dealt — Maya leads.')
  })

  it('puts the newest entry first and exposes the latest line', () => {
    const log: PublicEvent[] = [
      { type: 'game_started', startingSeat: 0 },
      { type: 'ask', asker: 0, target: 1, card: '9H', hit: true },
    ]
    const lines = humanizeLog(log, names)
    expect(lines[0].kind).toBe('ask-hit')
    expect(lines[1].kind).toBe('info')
    expect(latestLine(log, names)!.text).toBe('Maya asked Sam for 9♥ — hit.')
    expect(latestLine([], names)).toBeNull()
  })

  it('announces a decisive game over with the winning team and score', () => {
    const line = humanizeLog([{ type: 'game_over', score: [5, 3], winner: 0 }], names)[0]
    expect(line.text).toBe('Game over — Team A wins 5–3.')
    expect(line.kind).toBe('game-over')
  })
})
