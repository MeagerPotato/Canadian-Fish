/**
 * PB storage helper — set/get/beats-PB logic against a mocked store
 * (localStorage never touched; the KV surface is injected).
 */
import { describe, expect, it } from 'vitest'
import { beatsPB, loadPB, pbKey, recordPB, type KV } from '../../src/drills/pb.ts'

function memStore(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

describe('drills/pb', () => {
  it('uses the pinned localStorage key shape cf:pb:{drill}', () => {
    expect(pbKey('recall')).toBe('cf:pb:recall')
    expect(pbKey('legality')).toBe('cf:pb:legality')
  })

  it('loads null from an empty store and a number after a record', () => {
    const store = memStore()
    expect(loadPB('recall', store)).toBeNull()
    const first = recordPB('recall', 12, store)
    expect(first).toEqual({ pb: 12, improved: true })
    expect(loadPB('recall', store)).toBe(12)
    expect(store.map.get('cf:pb:recall')).toBe('12')
  })

  it('only improves on a strictly higher score', () => {
    const store = memStore()
    recordPB('counting', 5, store)
    expect(recordPB('counting', 4, store)).toEqual({ pb: 5, improved: false })
    expect(recordPB('counting', 5, store)).toEqual({ pb: 5, improved: false })
    expect(recordPB('counting', 6, store)).toEqual({ pb: 6, improved: true })
    expect(loadPB('counting', store)).toBe(6)
  })

  it('keeps drills separate and survives garbled values', () => {
    const store = memStore()
    recordPB('recall', 9, store)
    expect(loadPB('claim', store)).toBeNull()
    store.map.set(pbKey('claim'), 'not-a-number')
    expect(loadPB('claim', store)).toBeNull()
    expect(recordPB('claim', 3, store).improved).toBe(true)
    expect(loadPB('recall', store)).toBe(9)
  })

  it('beatsPB: any score beats an empty slate; ties never beat', () => {
    expect(beatsPB(0, null)).toBe(true)
    expect(beatsPB(-2, null)).toBe(true)
    expect(beatsPB(7, 7)).toBe(false)
    expect(beatsPB(8, 7)).toBe(true)
    expect(beatsPB(6, 7)).toBe(false)
  })

  it('degrades gracefully with no store at all', () => {
    expect(loadPB('recall', null)).toBeNull()
    expect(recordPB('recall', 4, null)).toEqual({ pb: 4, improved: true })
  })
})
