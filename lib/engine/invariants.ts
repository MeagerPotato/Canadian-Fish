/**
 * Structural invariants — run after every fuzz step. Returns [] when healthy,
 * else human-readable violation strings.
 */
import type { GameState, Team } from './types.ts'
import { ALL_BOOKS, ALL_CARDS, bookCards, cardCompare, isCard, seatTeam, teamSeats } from './cards.ts'

export function checkInvariants(s: GameState): string[] {
  const v: string[] = []
  const push = (msg: string) => v.push(msg)

  if (s.config.playerCount !== 6) push(`playerCount is ${String(s.config.playerCount)}, expected 6`)
  if (s.hands.length !== 6) push(`hands has ${s.hands.length} entries, expected 6`)
  if (!Number.isInteger(s.turn) || s.turn < 0 || s.turn > 5) push(`turn ${String(s.turn)} is not a seat`)
  if (!Number.isInteger(s.moveIndex) || s.moveIndex < 0) push(`moveIndex ${String(s.moveIndex)} invalid`)
  if (s.log.length === 0 || s.log[0].type !== 'game_started') push('log must start with game_started')

  // Card conservation: hands + cards of resolved books (voids included) === the 48, no duplicates.
  const seen = new Map<string, string>()
  const record = (card: string, where: string) => {
    if (!isCard(card)) push(`${card} (${where}) is not a real card`)
    const prev = seen.get(card)
    if (prev) push(`card ${card} duplicated: ${prev} and ${where}`)
    else seen.set(card, where)
  }
  s.hands.forEach((h, i) => {
    h.forEach((c) => record(c, `hand ${i}`))
    const sorted = [...h].sort(cardCompare)
    if (h.some((c, k) => c !== sorted[k])) push(`hand ${i} is not canonically sorted`)
  })
  const expected: [number, number] = [0, 0]
  for (const b of ALL_BOOKS) {
    const r = s.books[b]
    if (!r) continue
    bookCards(b).forEach((c) => record(c, `resolved book ${b}`))
    if (r.book !== b) push(`book result under key ${b} names ${r.book}`)
    if (!Number.isInteger(r.claimer) || r.claimer < 0 || r.claimer > 5) push(`book ${b}: claimer invalid`)
    const cards = bookCards(b)
    const aKeys = Object.keys(r.assignments)
    const hKeys = Object.keys(r.actualHolders)
    if (aKeys.length !== 6 || !cards.every((c) => c in r.assignments))
      push(`book ${b}: assignments do not cover its 6 cards`)
    if (hKeys.length !== 6 || !cards.every((c) => c in r.actualHolders))
      push(`book ${b}: actualHolders do not cover its 6 cards`)
    const claimerTeam = seatTeam(r.claimer)
    for (const c of cards) {
      const a = r.assignments[c]
      if (!Number.isInteger(a) || a < 0 || a > 5 || seatTeam(a) !== claimerTeam)
        push(`book ${b}: card ${c} assigned off-team (seat ${String(a)})`)
    }
    // Outcome must be consistent with the recorded actual holders + assignments.
    const oppHolds = cards.some((c) => seatTeam(r.actualHolders[c]) !== claimerTeam)
    const allCorrect = cards.every((c) => r.actualHolders[c] === r.assignments[c])
    const want = oppHolds
      ? claimerTeam === 0
        ? 'team1'
        : 'team0'
      : allCorrect
        ? claimerTeam === 0
          ? 'team0'
          : 'team1'
        : 'void'
    if (r.outcome !== want) push(`book ${b}: outcome ${r.outcome}, expected ${want}`)
    if (r.outcome !== 'void') {
      const t = r.outcome === 'team0' ? 0 : 1
      expected[t] += s.config.toggles.highBooksDouble && b.startsWith('HIGH') ? 2 : 1
    }
  }
  const resolvedCount = ALL_BOOKS.filter((b) => s.books[b]).length
  const accounted = s.hands.reduce((n, h) => n + h.length, 0) + resolvedCount * 6
  if (accounted !== ALL_CARDS.length)
    push(`card conservation broken: ${accounted} cards accounted for, expected ${ALL_CARDS.length}`)
  if (s.score[0] !== expected[0] || s.score[1] !== expected[1])
    push(`score [${s.score.join(',')}] does not match resolved books [${expected.join(',')}]`)
  if (s.score[0] < 0 || s.score[1] < 0) push('negative score')

  // Unresolved books' cards must all be in hands (implied by conservation, but check directly).
  for (const b of ALL_BOOKS) {
    if (s.books[b]) continue
    for (const c of bookCards(b)) {
      if (!s.hands.some((h) => h.includes(c))) push(`card ${c} of unresolved book ${b} is in no hand`)
    }
  }

  // Phase/turn consistency (only meaningful when the basic structure holds).
  if (s.hands.length !== 6 || !Number.isInteger(s.turn) || s.turn < 0 || s.turn > 5) return v
  const teamCount = (t: Team) => teamSeats(t).reduce<number>((n, x) => n + s.hands[x].length, 0)
  const turnSeat = s.turn
  const turnTeam = seatTeam(turnSeat)
  switch (s.phase) {
    case 'playing':
      if (s.hands[turnSeat].length === 0) push('playing: turn seat has no cards')
      if (teamCount(0) === 0 || teamCount(1) === 0) push('playing: a whole team is out of cards')
      if (resolvedCount === 8) push('playing: all books resolved but phase not finished')
      break
    case 'awaitPass':
      if (s.hands[turnSeat].length !== 0) push('awaitPass: turn seat still has cards')
      if (teamSeats(turnTeam).every((x) => s.hands[x].length === 0))
        push('awaitPass: no teammate with cards to receive the pass')
      break
    case 'awaitDesignate':
      if (teamCount(turnTeam) !== 0) push('awaitDesignate: turn team still has cards')
      if (teamCount(turnTeam === 0 ? 1 : 0) === 0) push('awaitDesignate: opponents also out of cards')
      if (resolvedCount === 8) push('awaitDesignate: all books already resolved')
      break
    case 'endgame':
      if (resolvedCount === 8) push('endgame: all books resolved but phase not finished')
      if (teamCount(0) !== 0 && teamCount(1) !== 0) push('endgame: neither team is out of cards')
      if (teamCount(turnTeam) === 0) push('endgame: turn belongs to the empty team')
      break
    case 'finished':
      if (resolvedCount !== 8) push(`finished: only ${resolvedCount} books resolved`)
      if (s.hands.some((h) => h.length > 0)) push('finished: a hand still has cards')
      break
  }
  return v
}
