import { describe, expect, it } from 'vitest'
import type { Card } from '../../lib/engine/index.ts'
import { legalAsksFromView } from '../../lib/engine/index.ts'
import { buildAskOptions } from '../../src/viewmodels/ask.ts'
import { publicState } from './util.ts'

const HAND: Card[] = ['2H', '3H', '9C']

describe('ask options (mirrors RULES §2)', () => {
  it('is closed when it is not my turn or not the playing phase', () => {
    expect(buildAskOptions(publicState({ turn: 1 }), 0, HAND).canAsk).toBe(false)
    expect(buildAskOptions(publicState({ phase: 'endgame' }), 0, HAND).canAsk).toBe(false)
    expect(buildAskOptions(publicState({ phase: 'awaitPass' }), 0, HAND).canAsk).toBe(false)
    expect(buildAskOptions(publicState(), 0, []).canAsk).toBe(false)
  })

  it('lists only opponents as targets, disabled when they are out of cards', () => {
    const options = buildAskOptions(publicState({ counts: [8, 8, 8, 0, 8, 8] }), 0, HAND)
    expect(options.canAsk).toBe(true)
    expect(options.targets.map((t) => t.seat)).toEqual([1, 3, 5])
    expect(options.targets.find((t) => t.seat === 3)!.enabled).toBe(false)
    expect(options.targets.find((t) => t.seat === 1)!.enabled).toBe(true)

    const asB = buildAskOptions(publicState({ turn: 1 }), 1, HAND)
    expect(asB.targets.map((t) => t.seat)).toEqual([0, 2, 4])
  })

  it('offers exactly the books I hold a card of, in canonical order', () => {
    const options = buildAskOptions(publicState(), 0, HAND)
    expect(options.books.map((b) => b.book)).toEqual(['HIGH-C', 'LOW-H'])
    expect(options.books.find((b) => b.book === 'LOW-H')!.held).toEqual(['2H', '3H'])
    expect(options.books.find((b) => b.book === 'HIGH-C')!.held).toEqual(['9C'])
  })

  it('offers only cards of the chosen book that I do not hold', () => {
    const options = buildAskOptions(publicState(), 0, HAND)
    expect(options.cardsByBook['LOW-H']).toEqual(['4H', '5H', '6H', '7H'])
    expect(options.cardsByBook['HIGH-C']).toEqual(['TC', 'JC', 'QC', 'KC', 'AC'])
    expect(options.cardsByBook['LOW-H']).not.toContain('2H')
  })

  it('disables a book I hold completely and blocks asking when nothing is askable', () => {
    const fullBook: Card[] = ['2H', '3H', '4H', '5H', '6H', '7H']
    const options = buildAskOptions(publicState(), 0, fullBook)
    expect(options.books).toHaveLength(1)
    expect(options.books[0].enabled).toBe(false)
    expect(options.cardsByBook['LOW-H']).toEqual([])
    expect(options.canAsk).toBe(false)
    expect(options.reason).toMatch(/complete half-suits/i)
  })

  it('blocks asking when no opponent has cards', () => {
    const options = buildAskOptions(publicState({ counts: [8, 0, 8, 0, 8, 0] }), 0, HAND)
    expect(options.canAsk).toBe(false)
    expect(options.reason).toMatch(/no opponent/i)
  })

  it('agrees with the engine helper: enabled targets × askable cards = legal asks', () => {
    const game = publicState({ counts: [8, 8, 8, 0, 8, 8] })
    const options = buildAskOptions(game, 0, HAND)
    const fromVM = new Set(
      options.targets
        .filter((t) => t.enabled)
        .flatMap((t) => options.books.flatMap((b) => (options.cardsByBook[b.book] ?? []).map((c) => `${t.seat}:${c}`))),
    )
    const fromEngine = new Set(
      legalAsksFromView({
        seat: 0,
        hand: HAND,
        counts: game.counts,
        phase: game.phase,
        turn: game.turn,
        config: game.config,
      }).map((l) => `${l.target}:${l.card}`),
    )
    expect(fromVM).toEqual(fromEngine)
    expect(fromEngine.size).toBe(2 * 9)
  })
})
