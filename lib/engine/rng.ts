/**
 * Deterministic PRNG: mulberry32 seeded from a string via the xmur3 hash.
 * Same seed string => identical number stream on every platform (only 32-bit int ops).
 */

/** xmur3 string hash — produces a well-mixed 32-bit seed generator from a string. */
export function hashSeed(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32 — fast 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(a: number): () => number {
  let s = a >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** PRNG in [0, 1) seeded from an arbitrary string. */
export function rngFromSeed(seed: string): () => number {
  return mulberry32(hashSeed(seed)())
}

/** Uniform integer in [0, n). */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n)
}
