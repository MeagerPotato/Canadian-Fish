/**
 * Personal-best storage for the practice drills — localStorage ONLY (SPEC.md
 * §8: nothing persists beyond the browser). Key shape: `cf:pb:{drill}`.
 * The store is injectable so the logic is unit-testable without a browser.
 */

/** The two localStorage methods the helper needs (mockable in tests). */
export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStore(): KV | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null // private browsing / storage disabled — PBs just don't persist
  }
}

export function pbKey(drill: string): string {
  return `cf:pb:${drill}`
}

/** The stored personal best, or null when unset/garbled/unavailable. */
export function loadPB(drill: string, store: KV | null = defaultStore()): number | null {
  if (!store) return null
  let raw: string | null
  try {
    raw = store.getItem(pbKey(drill))
  } catch {
    return null
  }
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Higher score wins; a first score always beats an empty slate. */
export function beatsPB(score: number, pb: number | null): boolean {
  return pb === null || score > pb
}

/**
 * Record `score` if it beats the stored PB. Returns the PB now on record and
 * whether this round improved it.
 */
export function recordPB(
  drill: string,
  score: number,
  store: KV | null = defaultStore(),
): { pb: number; improved: boolean } {
  const prev = loadPB(drill, store)
  if (!beatsPB(score, prev)) return { pb: prev ?? score, improved: false }
  if (store) {
    try {
      store.setItem(pbKey(drill), String(score))
    } catch {
      /* storage unavailable — the round still counts on screen */
    }
  }
  return { pb: score, improved: true }
}
