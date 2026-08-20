import { describe, expect, it } from 'vitest'
import { codeFromHex } from '../../server/room.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { post, sixHumans } from './util.ts'

describe('PublicRoomState wire shape (client contract, PROTOCOL §4)', () => {
  it('every broadcast payload carries exactly the documented fields', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })
    const payloads = deps.payloadsFor(code) as PublicRoomState[]
    expect(payloads.length).toBeGreaterThanOrEqual(7)
    for (const p of payloads) {
      expect(Object.keys(p).sort()).toEqual([
        'code',
        'game',
        'hostSeat',
        'paused',
        'pendingVote',
        'seats',
        'status',
        'version',
      ])
      expect(p.code).toBe(code)
      expect(p.seats).toHaveLength(6)
      for (const s of p.seats) {
        expect(Object.keys(s).sort()).toEqual(['connected', 'filled', 'isBot', 'name', 'seat'])
      }
      expect(typeof p.paused).toBe('boolean')
      expect(typeof p.version).toBe('number')
    }
    const last = payloads[payloads.length - 1]
    expect(last.status).toBe('playing')
    expect(Object.keys(last.game ?? {}).sort()).toEqual([
      'books',
      'config',
      'counts',
      'log',
      'moveIndex',
      'phase',
      'score',
      'turn',
    ])
  })

  it('heartbeats without a public change bump the version but broadcast nothing', async () => {
    const deps = new MemDeps()
    const { code, tokens } = await sixHumans(deps)
    await post(deps, '/api/start', { code, token: tokens[0] })
    const versionBefore = deps.rowByCode(code).version
    const broadcastsBefore = deps.broadcasts.length
    const hb1 = await post(deps, '/api/heartbeat', { code, token: tokens[0] })
    const hb2 = await post(deps, '/api/heartbeat', { code, token: tokens[1] })
    expect(hb1.status).toBe(200)
    expect(hb1.body.version).toBe(versionBefore + 1)
    expect(hb2.body.version).toBe(versionBefore + 2)
    expect(deps.rowByCode(code).version).toBe(versionBefore + 2)
    expect(deps.broadcasts.length).toBe(broadcastsBefore) // silence: nothing changed
  })
})

describe('room codes', () => {
  it('codeFromHex rejection-samples the 31-symbol alphabet deterministically', () => {
    // f8 (248) and ff (255) are rejected; 00 -> 'A', 1e (30) -> '9', 1f (31) -> 'A'.
    expect(codeFromHex('f8ff001e1f0203040506')).toBe('A9ACDE')
    expect(codeFromHex('00'.repeat(32))).toBe('AAAAAA')
    expect(codeFromHex('f8')).toBeNull() // not enough accepted bytes
    expect(codeFromHex('zz00000000000000')).toBeNull() // non-hex input
  })
})
