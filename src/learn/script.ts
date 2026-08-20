/**
 * The deterministic scripted teaching game behind /learn.
 *
 * A real game of the engine: `newGame(LEARN_SEED)` deals the exact hands this
 * script was written against, and every step is a legal `GameAction` replayed
 * through the pure `reduce`. The walkthrough shows, in order: a hit (turn
 * continues), a miss (turn passes), the ask-legality gates (RULES.md §2), a
 * correct claim, an opponent-scored claim, a void claim, the claim-out pass,
 * and the whole-team-out endgame with a winner. One annotation per step;
 * tests/learn/script.test.ts replays the whole thing and checks every
 * annotation against the events the engine actually produces.
 */
import type { Card, GameAction, GameState, PublicEvent, Seat } from '../../lib/engine/index.ts'
import { newGame, reduce } from '../../lib/engine/index.ts'

export const LEARN_SEED = 'learn-552'

/** Claim-assignments literal without exhaustive-key friction (keys are the 6 book cards). */
function asg(pairs: { [card: string]: Seat }): Record<Card, Seat> {
  return pairs as Record<Card, Seat>
}

export interface LearnAnnotation {
  /** Short headline for the step (mono eyebrow voice). */
  title: string
  /** Coaching prose — what just happened and which rule made it so. */
  body: string
  /** The type of the FIRST public event this action must produce. */
  event: PublicEvent['type']
  /** For claims: the outcome the engine must report. */
  outcome?: 'team0' | 'team1' | 'void'
  /** Extra event types that must also appear in the same reduce result. */
  also?: PublicEvent['type'][]
}

export interface LearnStep {
  action: GameAction
  annotation: LearnAnnotation
}

export const LEARN_SCRIPT: LearnStep[] = [
  {
    action: { type: 'ask', seat: 0, target: 1, card: 'QC' },
    annotation: {
      title: 'A hit — the turn continues',
      body: 'P0 opens by asking P1 for the Q♣. The ask is legal because P0 already holds a card of HIGH ♣ — and P1 really has it, so the card comes over face up. After a hit you keep the turn and ask again.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 3, card: '3D' },
    annotation: {
      title: 'A miss — the turn crosses over',
      body: 'P0 fishes again, asking P3 for the 3♦ — but P3 does not have it. A miss hands the turn to the player who was asked. Every question is public and every miss is a gamble.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 3, target: 2, card: '5C' },
    annotation: {
      title: 'What makes an ask legal',
      body: 'Now P3 asks P2 for the 5♣. Every ask must pass the same gates: you may only ask an opponent, never a teammate; you must hold at least one card of that half-suit yourself (P3 holds the 2♣); you may never ask for a card already in your hand; and the player you ask must still hold cards. Legal — but P2 does not have it, so the turn crosses back to Team A.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 1, card: '3S' },
    annotation: {
      title: 'Chaining hits',
      body: 'Hits keep the turn, so P2 hunts LOW ♠ card by card: the 3♠ sits with P1 and comes straight over. Watch the counts — every hit drains an opponent and feeds the asker.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 3, card: '4S' },
    annotation: {
      title: 'Chaining hits',
      body: 'Another hit: the 4♠ from P3. Team A now holds all six of LOW ♠ between P2 and P4 — and P2 knows it, because every card either started in hand or arrived through a public ask.',
      event: 'ask',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 2,
      book: 'LOW-S',
      assignments: asg({ '2S': 2, '3S': 2, '4S': 2, '5S': 4, '6S': 2, '7S': 4 }),
    },
    annotation: {
      title: 'The claim — all six, exactly placed',
      body: "Team A holds every card of LOW ♠, so P2 claims it: name the half-suit, then say exactly which teammate holds each of its six cards. All six placements are right, so Team A scores the book, its cards leave every hand — and the claimant's turn continues.",
      event: 'claim',
      outcome: 'team0',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 2,
      book: 'LOW-C',
      assignments: asg({ '2C': 2, '3C': 2, '4C': 2, '5C': 2, '6C': 2, '7C': 4 }),
    },
    annotation: {
      title: 'A claim can backfire',
      body: 'Flushed with success, P2 gambles on LOW ♣, betting the unseen cards sit with teammates. They do not: Team B still holds the 2♣, 4♣, 5♣ and 6♣. If the opposing team holds even one card of a claimed book, they score it — no matter where the rest sit. The cards still leave play, and P2 still keeps the turn.',
      event: 'claim',
      outcome: 'team1',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 5, card: '4D' },
    annotation: {
      title: 'Building a second book',
      body: 'Chastened, P2 goes back to collecting facts: the 4♦ of LOW ♦ comes over from P5. Hits cost the defender a card and tell the whole table where things are.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 3, card: '5D' },
    annotation: {
      title: 'Building a second book',
      body: 'The 5♦ from P3. P2 is still on the same unbroken turn that started four asks ago — a single strong seat can run away with a game.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 5, card: '6D' },
    annotation: {
      title: 'Building a second book',
      body: 'The 6♦ from P5. Notice P2 always names an exact card — “any diamond, please” is not a legal ask in this game.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 1, card: '7D' },
    annotation: {
      title: 'Building a second book',
      body: 'The 7♦ from P1, and Team B holds nothing of LOW ♦ any more. Every card of the book is on Team A — the claim is there for the taking.',
      event: 'ask',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 2,
      book: 'LOW-D',
      assignments: asg({ '2D': 2, '3D': 0, '4D': 2, '5D': 2, '6D': 2, '7D': 2 }),
    },
    annotation: {
      title: 'Right team, wrong seats — void',
      body: 'Team A genuinely holds all six of LOW ♦ — but P2 swaps the 2♦ and the 3♦. When your team has the whole book and any single placement is wrong, the book is void: removed from play, scored by nobody. Certainty, not confidence, is the bar for claiming.',
      event: 'claim',
      outcome: 'void',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 5, card: '2H' },
    annotation: {
      title: 'Vacuuming the table',
      body: "Still P2's turn, even after a voided claim. The 2♥ of LOW ♥ comes over from P5. In this app every ask and answer stays in the public log — at a real table all of this is held in memory, which is the whole game.",
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 5, card: '3H' },
    annotation: {
      title: 'Vacuuming the table',
      body: 'The 3♥, also from P5. Asking the same opponent again is fine — P2 keeps naming LOW ♥ cards while holding others of that book.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 3, card: '4H' },
    annotation: {
      title: 'Vacuuming the table',
      body: 'The 4♥ from P3. Team B can only watch: the turn never leaves a player who keeps hitting.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 2, target: 5, card: '7H' },
    annotation: {
      title: 'Vacuuming the table',
      body: 'The 7♥ from P5 — the last LOW ♥ card outside Team A. This time P2 will place all six correctly before claiming.',
      event: 'ask',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 2,
      book: 'LOW-H',
      assignments: asg({ '2H': 2, '3H': 2, '4H': 2, '5H': 2, '6H': 2, '7H': 2 }),
    },
    annotation: {
      title: 'Cashing a certain book',
      body: 'P2 claims LOW ♥ with every card placed from the public record of hits — all six are in P2’s own hand. Once a book is certain, cash it: it can no longer be lost, and teammates stop wasting asks on it.',
      event: 'claim',
      outcome: 'team0',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 2,
      book: 'HIGH-C',
      assignments: asg({ '9C': 2, TC: 2, JC: 0, QC: 0, KC: 4, AC: 4 }),
    },
    annotation: {
      title: 'Claimed out — but not silenced',
      body: "That claim of HIGH ♣ spends P2's last cards. Running yourself empty with your own claim does not stall the game: you must now hand the turn to a teammate who still has cards. Choosing the right teammate is a real strategic weapon.",
      event: 'claim',
      outcome: 'team0',
      also: ['player_out'],
    },
  },
  {
    action: { type: 'pass', seat: 2, to: 0 },
    annotation: {
      title: 'The claim-out pass',
      body: 'P2 passes the turn to P0 — the teammate holding cards of the one half-suit P2 could never legally ask into. This handoff is the engine of the famous stalemate breaker: empty yourself on purpose, and you choose who inherits the turn.',
      event: 'pass',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 1, card: '9D' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'P0 holds HIGH ♦ cards P2 never had, so the asks P2 could not make are legal for P0: the 9♦ comes over from P1. This is exactly why the pass went to P0 and not the other teammate.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 5, card: 'JD' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'The J♦ from P5. Team B is down to a handful of cards, and every one of them has been mapped by the asks that came before.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 5, card: 'QD' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'The Q♦ from P5. HIGH ♦ is now entirely on Team A — P0 banks it for later and keeps asking.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 5, card: 'KH' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: "The K♥ is P5's very last card, so P5 drops out of the round: a player with no cards can neither ask nor be asked, and play simply continues around the empty seat.",
      event: 'ask',
      also: ['player_out'],
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 3, card: 'AH' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'The A♥ from P3. With P5 out, P3 and P1 are the only opponents left who can legally be asked.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 3, card: '9S' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: "The 9♠ empties P3's hand too — a second opponent drops out. Team B's whole stock now sits in P1's hand.",
      event: 'ask',
      also: ['player_out'],
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 1, card: 'JS' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'The J♠ from P1. P0 is stripping HIGH ♠ exactly the way P2 stripped the low books — one named card at a time.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 1, card: 'QS' },
    annotation: {
      title: 'The new turn-holder hunts',
      body: 'The Q♠ from P1, who is down to a single card. Everyone at the table can count that card — and knows exactly what it must be.',
      event: 'ask',
    },
  },
  {
    action: { type: 'ask', seat: 0, target: 1, card: 'KS' },
    annotation: {
      title: 'Team B is out of cards',
      body: "P0 takes the K♠ — Team B's very last card. When a whole team runs dry, the asking stops: the team with cards must claim every remaining book, and the player holding the turn does it alone, without consulting teammates.",
      event: 'ask',
      also: ['player_out', 'endgame'],
    },
  },
  {
    action: {
      type: 'claim',
      seat: 0,
      book: 'HIGH-D',
      assignments: asg({ '9D': 0, TD: 0, JD: 0, QD: 0, KD: 0, AD: 4 }),
    },
    annotation: {
      title: 'Endgame claims',
      body: 'In the endgame only claims are legal. P0 states HIGH ♦: five cards in hand, and the A♦ with P4 — misplacing a card among teammates would still void the book, even now.',
      event: 'claim',
      outcome: 'team0',
    },
  },
  {
    action: {
      type: 'claim',
      seat: 0,
      book: 'HIGH-H',
      assignments: asg({ '9H': 4, TH: 0, JH: 0, QH: 4, KH: 0, AH: 0 }),
    },
    annotation: {
      title: 'Endgame claims',
      body: 'HIGH ♥ next, split between P0 and P4. The claim empties P4’s hand, but in the endgame that changes nothing: the designated claimer finishes the job alone.',
      event: 'claim',
      outcome: 'team0',
      also: ['player_out'],
    },
  },
  {
    action: {
      type: 'claim',
      seat: 0,
      book: 'HIGH-S',
      assignments: asg({ '9S': 0, TS: 0, JS: 0, QS: 0, KS: 0, AS: 0 }),
    },
    annotation: {
      title: 'Game over — count the books',
      body: 'P0 places the last book — all six of HIGH ♠ in their own hand — and the game ends. Every one of the eight half-suits has been scored or voided; the team with more books wins, and an equal count is a tie. Team A takes this one 6–1.',
      event: 'claim',
      outcome: 'team0',
      also: ['player_out', 'game_over'],
    },
  },
]

export interface LearnFrame {
  /** State BEFORE the action was applied. */
  before: GameState
  /** State AFTER the action. */
  after: GameState
  /** Public events the action produced. */
  events: PublicEvent[]
  step: LearnStep
  index: number
}

/**
 * Replay the script through the pure engine into per-step frames.
 * Throws if any step is illegal — which the unit test guarantees never happens.
 */
export function buildLearnGame(): { frames: LearnFrame[]; final: GameState } {
  let state = newGame(LEARN_SEED)
  const frames: LearnFrame[] = []
  LEARN_SCRIPT.forEach((step, index) => {
    const result = reduce(state, step.action)
    if (!result.ok) {
      throw new Error(`learn script step ${index} (${step.action.type}) illegal: ${result.error.code}`)
    }
    frames.push({ before: state, after: result.state, events: result.events, step, index })
    state = result.state
  })
  return { frames, final: state }
}
