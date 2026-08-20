/**
 * Public-view-only proof (Gate 3): the bot decision function runs on exactly
 * the public payload the wire sends a client — nothing more is reachable, and
 * nothing observable happens beyond reading it.
 */
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { decide, hashSeed, seatView } from '../../lib/engine/index.ts'
import type { GameAction, SeatView } from '../../lib/engine/index.ts'
import { deepFreeze } from '../engine/util.ts'
import { collectPositions } from './util.ts'

const DIFFS = ['easy', 'medium', 'hard'] as const

/** The complete documented public surface of a SeatView. */
const PUBLIC_KEYS = new Set([
  'phase',
  'turn',
  'counts',
  'score',
  'books',
  'log',
  'moveIndex',
  'config',
  'seat',
  'hand',
])

function jsonClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Recursive read-tracking proxy; records every property path root accessed. */
function trackingProxy<T extends object>(obj: T, roots: Set<string>, depth = 0): T {
  return new Proxy(obj, {
    get(t, prop, recv) {
      const v = Reflect.get(t, prop, recv)
      if (typeof prop === 'string' && depth === 0) roots.add(prop)
      if (v !== null && typeof v === 'object') {
        return trackingProxy(v as object, roots, depth + 1) as typeof v
      }
      return v
    },
  })
}

describe('public-view-only proof', () => {
  const positions = collectPositions(200)

  it(
    '(a) decide never throws on 200 deep-frozen mid-game seat views x 3 difficulties, and freezing never changes the action',
    () => {
      for (let i = 0; i < positions.length; i++) {
        const state = positions[i]
        const seed = hashSeed(`frozen-${i}`)()
        for (const diff of DIFFS) {
          const frozen = deepFreeze(seatView(state, state.turn))
          const plain = seatView(state, state.turn)
          let fromFrozen: GameAction | null = null
          expect(() => {
            fromFrozen = decide(frozen, diff, seed)
          }).not.toThrow()
          // A swallowed mutation attempt would divert to the fallback and
          // (in general) diverge from the unfrozen run — equality proves the
          // function never needed to write to its input.
          expect(fromFrozen).toEqual(decide(plain, diff, seed))
        }
      }
    },
    120_000,
  )

  it(
    '(b) decide reads only the documented public SeatView surface and acts identically on a JSON-wire clone',
    () => {
      for (let i = 0; i < 60; i++) {
        const state = positions[(i * 3) % positions.length]
        const seed = hashSeed(`proxy-${i}`)()
        for (const diff of DIFFS) {
          // Proxy a fresh wire clone: a Proxy over an object graph frozen by
          // the earlier freeze test would violate the proxy invariant for
          // non-configurable properties (a test artifact, not a bot concern).
          const base = jsonClone(seatView(state, state.turn))
          const roots = new Set<string>()
          const proxied = trackingProxy(base, roots)
          const viaProxy = decide(proxied as SeatView, diff, seed)
          const direct = decide(seatView(state, state.turn), diff, seed)
          const viaJson = decide(jsonClone(seatView(state, state.turn)), diff, seed)
          expect(viaProxy).toEqual(direct)
          expect(viaJson).toEqual(direct)
          for (const key of roots) {
            expect(PUBLIC_KEYS.has(key), `accessed non-public property "${key}"`).toBe(true)
          }
          expect(roots.size).toBeGreaterThan(0)
        }
      }
    },
    120_000,
  )

  it('(c) lib/engine/bots imports no GameState-consuming engine function', () => {
    // Enumerated at transform time: any future file in the module is covered.
    const sources = import.meta.glob('../../lib/engine/bots/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const files = Object.keys(sources)
    expect(files.length).toBeGreaterThanOrEqual(4)
    const allowedSpecifiers = new Set([
      '../types.ts',
      '../cards.ts',
      '../rng.ts',
      '../helpers.ts',
      './types.ts',
      './knowledge.ts',
      './decide.ts',
    ])
    const forbiddenIdents = /\b(newGame|publicView|seatView|reduce|dealHands|legalAsks|checkInvariants|shuffle)\b/
    for (const f of files) {
      const src = sources[f]
      const importRe = /(?:import|export)\s+([^;]*?)\s+from\s+'([^']+)'/g
      let m: RegExpExecArray | null
      let imports = 0
      while ((m = importRe.exec(src)) !== null) {
        imports++
        const clause = m[1]
        const spec = m[2]
        expect(allowedSpecifiers.has(spec), `${f}: import from "${spec}" not allowed`).toBe(true)
        expect(
          forbiddenIdents.test(clause),
          `${f}: imports a GameState-consuming identifier in "${clause}"`,
        ).toBe(false)
      }
      expect(imports).toBeGreaterThan(0)
      // No dynamic imports or requires sneaking state in.
      expect(src.includes('import(')).toBe(false)
      expect(src.includes('require(')).toBe(false)
    }
  })
})
