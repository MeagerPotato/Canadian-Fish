/**
 * Client-test fixtures — hand-built PublicState snapshots (no DOM, no network).
 */
import type { PublicState, Seat } from '../../lib/engine/index.ts'
import { defaultConfig } from '../../lib/engine/index.ts'

export function publicState(patch: Partial<PublicState> = {}): PublicState {
  return {
    phase: 'playing',
    turn: 0,
    counts: [8, 8, 8, 8, 8, 8],
    score: [0, 0],
    books: {},
    log: [],
    moveIndex: 0,
    config: defaultConfig,
    ...patch,
  }
}

const NAMES = ['Maya', 'Sam', 'Ira', 'Lena', 'Kit', 'Ola']

export function names(seat: Seat): string {
  return NAMES[seat]
}
