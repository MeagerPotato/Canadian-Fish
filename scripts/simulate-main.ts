/**
 * simulate-main.ts — Gate 3 win-rate harness (SPEC.md §5 / §9, Phase 3).
 *
 * Round-robin bot-vs-bot pairings over full engine games:
 *   seats {0,2,4} play difficulty A (team A), seats {1,3,5} difficulty B.
 * 1000 games per pairing, seeds `sim-{pairing}-{i}`, starting seat rotating
 * i % 6 so first-move advantage alternates fairly between the teams.
 * decide() is seeded exactly like the server chain: hash(gameSeed:moveIndex).
 *
 * Fully deterministic: the same run always prints the same results table
 * (wall-clock columns aside). Run via `npm run sim` (scripts/simulate.mjs).
 */
import { decide, hashSeed, newGame, reduce } from '../lib/engine/index.ts'
import { legalAsks, seatView } from '../lib/engine/index.ts'
import { ALL_BOOKS, bookCards } from '../lib/engine/index.ts'
import type { BotDifficulty, Card, GameAction, GameState, Seat } from '../lib/engine/index.ts'

const GAMES_PER_PAIRING = 1000
const STEP_CAP = 5000

const PAIRINGS: [BotDifficulty, BotDifficulty][] = [
  ['hard', 'easy'],
  ['hard', 'medium'],
  ['medium', 'easy'],
  ['easy', 'easy'],
  ['medium', 'medium'],
  ['hard', 'hard'],
]

interface PairingResult {
  pairing: string
  a: BotDifficulty
  b: BotDifficulty
  aWins: number
  bWins: number
  ties: number
  games: number
  totalMoves: number
  totalVoids: number
  wallMs: number
  illegalFallbacks: number
  cappedGames: number
}

/**
 * Engine-legal fallback used ONLY if decide() ever returned an illegal action
 * (counted; expected 0): first legal ask, else claim the first unresolved book
 * all-to-self, else first legal pass/designate.
 */
function emergencyLegalAction(state: GameState): GameAction {
  const seat = state.turn
  switch (state.phase) {
    case 'awaitPass': {
      const mates: Seat[] = (seat % 2 === 0 ? [0, 2, 4] : [1, 3, 5]) as Seat[]
      const to = mates.find((s) => s !== seat && state.hands[s].length > 0) ?? mates[0]
      return { type: 'pass', seat, to }
    }
    case 'awaitDesignate': {
      const opps: Seat[] = (seat % 2 === 0 ? [1, 3, 5] : [0, 2, 4]) as Seat[]
      const to = opps.find((s) => state.hands[s].length > 0) ?? opps[0]
      return { type: 'designate', seat, to }
    }
    default: {
      const asks = legalAsks(state, seat)
      if (asks.length > 0) return { type: 'ask', seat, target: asks[0].target, card: asks[0].card }
      const book = ALL_BOOKS.find((b) => !state.books[b]) ?? ALL_BOOKS[0]
      const assignments = {} as Record<Card, Seat>
      for (const c of bookCards(book)) assignments[c] = seat
      return { type: 'claim', seat, book, assignments }
    }
  }
}

function runPairing(a: BotDifficulty, b: BotDifficulty): PairingResult {
  const pairing = `${a}-vs-${b}`
  const res: PairingResult = {
    pairing,
    a,
    b,
    aWins: 0,
    bWins: 0,
    ties: 0,
    games: GAMES_PER_PAIRING,
    totalMoves: 0,
    totalVoids: 0,
    wallMs: 0,
    illegalFallbacks: 0,
    cappedGames: 0,
  }
  const t0 = performance.now()
  for (let i = 0; i < GAMES_PER_PAIRING; i++) {
    const seed = `sim-${pairing}-${i}`
    let state = newGame(seed, undefined, (i % 6) as Seat)
    let steps = 0
    while (state.phase !== 'finished' && steps < STEP_CAP) {
      const diff = state.turn % 2 === 0 ? a : b
      const action = decide(
        seatView(state, state.turn),
        diff,
        hashSeed(`${seed}:${state.moveIndex}`)(),
      )
      let r = reduce(state, action)
      if (!r.ok) {
        res.illegalFallbacks++
        r = reduce(state, emergencyLegalAction(state))
        if (!r.ok) break // give up on this game (still counted below)
      }
      state = r.state
      steps++
    }
    res.totalMoves += steps
    if (state.phase !== 'finished') {
      res.cappedGames++
      continue
    }
    for (const bk of ALL_BOOKS) {
      if (state.books[bk]?.outcome === 'void') res.totalVoids++
    }
    if (state.score[0] > state.score[1]) res.aWins++
    else if (state.score[1] > state.score[0]) res.bWins++
    else res.ties++
  }
  res.wallMs = Math.round(performance.now() - t0)
  return res
}

function pad(s: string | number, w: number, right = false): string {
  const t = String(s)
  return right ? t.padEnd(w) : t.padStart(w)
}

export function main(): void {
  console.log(
    `Canadian Fish — Gate 3 bot win-rate simulation (${GAMES_PER_PAIRING} games/pairing, ` +
      `seats 0/2/4 = A, 1/3/5 = B, starting seat rotates i%6)`,
  )
  console.log('')
  const header =
    `${pad('pairing', 18, true)}${pad('teamA wins', 12)}${pad('teamB wins', 12)}${pad('ties', 7)}` +
    `${pad('A win%', 9)}${pad('avg moves', 11)}${pad('avg void', 10)}${pad('wall ms', 10)}`
  console.log(header)
  console.log('-'.repeat(header.length))
  const results: PairingResult[] = []
  for (const [a, b] of PAIRINGS) {
    const r = runPairing(a, b)
    results.push(r)
    const decided = r.aWins + r.bWins
    const aPct = decided === 0 ? '-' : ((100 * r.aWins) / decided).toFixed(1)
    console.log(
      `${pad(r.pairing, 18, true)}${pad(r.aWins, 12)}${pad(r.bWins, 12)}${pad(r.ties, 7)}` +
        `${pad(aPct, 9)}${pad((r.totalMoves / r.games).toFixed(1), 11)}` +
        `${pad((r.totalVoids / r.games).toFixed(2), 10)}${pad(r.wallMs, 10)}`,
    )
  }
  console.log('-'.repeat(header.length))
  const tot = results.reduce(
    (acc, r) => ({
      games: acc.games + r.games,
      moves: acc.moves + r.totalMoves,
      voids: acc.voids + r.totalVoids,
      ms: acc.ms + r.wallMs,
      illegal: acc.illegal + r.illegalFallbacks,
      capped: acc.capped + r.cappedGames,
    }),
    { games: 0, moves: 0, voids: 0, ms: 0, illegal: 0, capped: 0 },
  )
  console.log(
    `totals: ${tot.games} games, ${tot.moves} moves ` +
      `(avg ${(tot.moves / tot.games).toFixed(1)}/game), ` +
      `${tot.voids} void books (avg ${(tot.voids / tot.games).toFixed(2)}/game), ` +
      `wall ${(tot.ms / 1000).toFixed(1)}s`,
  )
  console.log(
    `illegal-action fallbacks: ${tot.illegal} (expected 0) · ` +
      `games hitting the ${STEP_CAP}-step cap: ${tot.capped} (expected 0)`,
  )
}
