/**
 * Drill 5 — Card counting (SPEC.md §8.5). Pure generator + scorer.
 *
 * ~15 ask events (hits move a card, misses don't) stream past at 1 / 1.2 s;
 * the player then names every seat's final hand size. The prefix contains
 * ONLY asks — no claims — so counts start at 8 each, change exactly ±1 per
 * hit, and always sum to 48. Score: +1 per exact seat.
 */
import type { GameAction, PublicEvent } from '../../lib/engine/index.ts'
import { newGame, reduce } from '../../lib/engine/index.ts'
import { botAction } from './sim.ts'

export const COUNTING_ASKS_PER_ROUND = 15
export const COUNTING_STREAM_MS = 1200

export type AskEvent = Extract<PublicEvent, { type: 'ask' }>

export interface CountingRound {
  seed: string
  /** The simulated game's seed (deterministic replay). */
  gameSeed: string
  /** The streamed items, in order — all asks. */
  events: AskEvent[]
  /** Every engine action applied (== the asks), for engine replay checks. */
  actions: GameAction[]
  /** Ground truth after the last event. Sums to 48. */
  finalCounts: number[]
}

/**
 * Deterministically find a medium-bot prefix of exactly `targetAsks` ask
 * actions with no claim (and a healthy hit/miss mix), trying sub-seeds until
 * one fits.
 */
export function generateCountingRound(seed: string, targetAsks = COUNTING_ASKS_PER_ROUND): CountingRound {
  let best: CountingRound | null = null
  for (let attempt = 0; attempt < 40; attempt++) {
    const gameSeed = `${seed}:t${attempt}`
    const built = tryPrefix(seed, gameSeed, targetAsks)
    if (built === null) continue
    const hits = built.events.filter((e) => e.hit).length
    const misses = built.events.length - hits
    if (hits >= 3 && misses >= 3) return built
    if (best === null) best = built // keep the first all-ask prefix as fallback
  }
  // A conforming prefix always exists in practice; fall back to the first
  // claim-free prefix found, else to however many asks the last game gave.
  return best ?? tryPrefix(seed, `${seed}:t0`, targetAsks, true)!
}

function tryPrefix(seed: string, gameSeed: string, targetAsks: number, lenient = false): CountingRound | null {
  let state = newGame(gameSeed)
  const actions: GameAction[] = []
  const events: AskEvent[] = []
  while (events.length < targetAsks) {
    const action = botAction(state)
    if (action === null) break
    if (action.type !== 'ask') {
      if (!lenient) return null // a claim mid-stream would break the count story
      break
    }
    const r = reduce(state, action)
    if (!r.ok) break
    state = r.state
    actions.push(action)
    for (const ev of r.events) if (ev.type === 'ask') events.push(ev)
  }
  if (!lenient && events.length < targetAsks) return null
  return {
    seed,
    gameSeed,
    events,
    actions,
    finalCounts: state.hands.map((h) => h.length),
  }
}

/** Recompute counts from the events alone (8 each; hit: target−1, asker+1). */
export function countsFromEvents(events: readonly AskEvent[]): number[] {
  const counts = [8, 8, 8, 8, 8, 8]
  for (const ev of events) {
    if (ev.hit) {
      counts[ev.target]--
      counts[ev.asker]++
    }
  }
  return counts
}

export interface CountingScore {
  /** One point per exactly-right seat (0-6). */
  score: number
  correct: number
  perSeat: boolean[]
  /** Longest run of consecutive exact seats (P0..P5 order). */
  bestStreak: number
}

export function scoreCounting(finalCounts: readonly number[], guesses: readonly (number | null)[]): CountingScore {
  const perSeat = finalCounts.map((n, s) => guesses[s] !== null && guesses[s] === n)
  const correct = perSeat.filter(Boolean).length
  let streak = 0
  let bestStreak = 0
  for (const ok of perSeat) {
    streak = ok ? streak + 1 : 0
    if (streak > bestStreak) bestStreak = streak
  }
  return { score: correct, correct, perSeat, bestStreak }
}
