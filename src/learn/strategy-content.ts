/**
 * /strategy content — every external claim here is carried over from the
 * strategy research digest (scratchpad research-strategy.md), which drew only
 * on the sources listed in SOURCES below. Attributions and URLs travel with
 * each item; items resting on a single source are flagged. CardRules+ material
 * was deliberately excluded (low provenance). App behavior statements cite
 * RULES.md, not an external source.
 */

export const ACCESS_DATE = '2026-08-20'

export type SourceId =
  | 'pagat'
  | 'develin'
  | 'wikipedia'
  | 'oldwiki'
  | 'se'
  | 'cornell'
  | 'amylei'
  | 'evanchen'
  | 'brynmawr'
  | 'dorsa'
  | 'somani'
  | 'gamerules'
  | 'littplay'
  | 'litaf'

export interface Source {
  id: SourceId
  /** Short inline label, e.g. "pagat". */
  short: string
  /** Full listing for the Sources section. */
  full: string
  url: string
  note?: string
}

export const SOURCES: Source[] = [
  {
    id: 'pagat',
    short: 'pagat',
    full: 'John McLeod, "Literature", pagat.com — strategy notes credited in part to Ali Salahuddin and Brett Stevens',
    url: 'https://www.pagat.com/quartet/literature.html',
  },
  {
    id: 'develin',
    short: 'Develin',
    full: 'Mike Develin, "Canadian Fish", ch. 9 of his card-games collection (bantha.org)',
    url: 'http://www.bantha.org/~develin/cardgames.html#ch9',
    note: 'the deepest single strategy text; HTTPS broken on this host, plain HTTP',
  },
  {
    id: 'wikipedia',
    short: 'Wikipedia',
    full: 'Wikipedia, "Literature (card game)"',
    url: 'https://en.wikipedia.org/wiki/Literature_(card_game)',
  },
  {
    id: 'oldwiki',
    short: 'old-Wikipedia mirror',
    full: 'Older Wikipedia "Literature" text preserved at en-academic.com',
    url: 'https://en-academic.com/dic.nsf/enwiki/1167730',
  },
  {
    id: 'se',
    short: 'Board Games SE',
    full: 'Board Games Stack Exchange, question 31946 (answer by Shivam Maheshwari, 2020)',
    url: 'https://boardgames.stackexchange.com/questions/31946/',
  },
  {
    id: 'cornell',
    short: 'Cornell Sun',
    full: 'Grace Chen, "Grace’s Grove: A New Card Game: Fish", The Cornell Daily Sun, 2018-03-08',
    url: 'https://www.cornellsun.com/2018/03/08/graces-grove-a-new-card-game-fish/',
  },
  {
    id: 'amylei',
    short: 'MIT fish',
    full: 'amy-lei/fish — an MIT student implementation of Fish',
    url: 'https://github.com/amy-lei/fish',
  },
  {
    id: 'evanchen',
    short: 'Evan Chen',
    full: 'Evan Chen, MOP (USA olympiad camp) pages — Fish as a camp institution',
    url: 'https://web.evanchen.cc/mop.html',
  },
  {
    id: 'brynmawr',
    short: 'Bryn Mawr',
    full: 'Bryn Mawr Distressing Math Collective, "Rules of Fish" (Hannah Griggs ’18 & Rachel Miller ’18)',
    url: 'https://www.brynmawr.edu/math/rules-fish',
  },
  {
    id: 'dorsa',
    short: 'Dorsa',
    full: 'Donna Dorsa, "Literature Game Strategy", Deposit Genius, 2018-06-25',
    url: 'https://depositgenius.com/literature-strategy-canadian-fish/',
    note: 'casino-affiliate site; moderate reliability',
  },
  {
    id: 'somani',
    short: 'Somani',
    full: 'Neel Somani, "literature" — a Literature engine with Q-learning bots',
    url: 'https://github.com/neelsomani/literature',
  },
  {
    id: 'gamerules',
    short: 'gamerules.com',
    full: 'Nakoa Davis, "Literature card game", gamerules.com',
    url: 'https://gamerules.com/rules/literature-card-game/',
  },
  {
    id: 'littplay',
    short: 'littplay',
    full: 'gyash24x7/littplay — an Indian "Lit" implementation (7s-out, ace-low deck)',
    url: 'https://github.com/gyash24x7/littplay',
  },
  {
    id: 'litaf',
    short: 'Litaf',
    full: 'Litaf — a web Literature implementation (54-card default, first to 5)',
    url: 'https://play-litaf.onrender.com',
  },
]

export interface StrategyItem {
  /** Bolded lead-in. */
  lead: string
  text: string
  sources: SourceId[]
  /** How this maps to our table, per RULES.md (app fact, no external citation). */
  inApp?: string
}

export interface StrategySection {
  id: string
  title: string
  sub: string
  intro?: string
  items: StrategyItem[]
}

export const SECTIONS: StrategySection[] = [
  {
    id: 'asking',
    title: 'Asking',
    sub: 'Every question is a broadcast',
    intro:
      'An ask tells all six players three things: you hold that half-suit, you lack that exact card, and you thought the target might have it. Strong play is deciding which broadcasts are worth their price.',
    items: [
      {
        lead: 'The deliberate failed ask.',
        text: 'Asking for a card you know is absent still tells teammates you hold that half-suit — paid for with the turn. Develin adds the sober caveat: the opponents learn exactly as much as your partners do.',
        sources: ['pagat', 'develin'],
      },
      {
        lead: 'Sequencing leaks.',
        text: 'Fail asking someone for the 2, then later ask the same player for the 3, and the table can read you as holding the book but neither card. Vary targets and cards, and exhaust all opponents on one card before switching to the next.',
        sources: ['pagat'],
      },
      {
        lead: 'The zero-downside ask.',
        text: 'Asking into a half-suit your team already entirely holds reveals nothing an opponent can use — the cheapest way to signal or to fish for the turn.',
        sources: ['develin'],
      },
      {
        lead: 'Lying low.',
        text: 'With many cards of one book, consider not asking into it at all. Let the others fight over it, accumulate placement information from their questions, and claim the whole thing once it is mapped.',
        sources: ['develin', 'dorsa'],
      },
      {
        lead: 'The echo.',
        text: 'If someone asks you for a card in a book where you hold others, consider asking them right back in that book — their ask proved they hold it. The risk: your reply reveals your second card of the book.',
        sources: ['develin', 'dorsa'],
      },
      {
        lead: "Re-ask a teammate's failed card.",
        text: 'When a teammate asked for a card and missed, your asking the same card later has elevated odds: their failed ask proved they hold the book, not that card — so the card sits with fewer possible holders.',
        sources: ['develin'],
      },
      {
        lead: 'Never ask a known miss.',
        text: "Somani's bot engine encodes the community baseline: an ask you can already deduce will miss is a donated turn — take it only when every alternative is worse.",
        sources: ['somani'],
      },
    ],
  },
  {
    id: 'lockout',
    title: 'Lockout & blackballing',
    sub: 'Deciding who never gets the turn',
    intro:
      'The turn only changes hands on a miss (or a claim-out). That makes "who do we allow to hold the turn" a team decision, and starving a dangerous seat is a core line of play.',
    items: [
      {
        lead: 'Blackball the dangerous seat.',
        text: 'When one opponent visibly knows too much, the whole team quietly conspires to never miss into them: ask the other two opponents, even at worse odds, so the dangerous seat never gets to act.',
        sources: ['pagat', 'develin', 'dorsa'],
      },
      {
        lead: 'Targeted voiding.',
        text: "Strip an opponent's last card of a half-suit and they can never legally ask into it again — you have locked them out of the book even though its cards are still in play.",
        sources: ['pagat'],
      },
      {
        lead: 'Turn starvation is the game, not a bug.',
        text: 'Develin is blunt that deliberately keeping the turn away from the other team is central strategy — and that mutual blackballing between two skilled teams is precisely what produces deadlocks.',
        sources: ['develin'],
      },
    ],
  },
  {
    id: 'signalling',
    title: 'Teammate signalling — a genuine schism',
    sub: 'The one thing the communities do not agree on',
    intro:
      'Here the two traditions split for real. The pagat line documents a named, prearranged signalling convention; Develin and the US student rules ban prearranged conventions outright. Both positions are presented as written — pick a table culture before you pick a convention.',
    items: [
      {
        lead: 'The Salahuddin convention.',
        text: 'The only named, codified system in any source, recorded on pagat (origin: a Kerala-via-Columbia family line, then the University of Toronto, 1993–95). Player A deliberately fails asking for the 2♥ — A is now marked as holding minor hearts. A’s partner B, who holds the 2♥, confirms by asking for a different minor heart on their next turn; if B changes the subject instead, B denies holding it. The choice of ask is the channel — no words, no gestures.',
        sources: ['pagat'],
      },
      {
        lead: 'The prohibitionist school.',
        text: 'Develin’s Canadian Fish forbids conventions explicitly: only genuine in-game inference is fair. The US student "Fish" rules take the same stance, and the older Wikipedia text banned communication verbal or otherwise. Under these rules the Salahuddin scheme is cheating, full stop.',
        sources: ['develin', 'se', 'amylei', 'cornell', 'oldwiki'],
      },
      {
        lead: 'The quarantine.',
        text: 'A telling side-note: Develin’s own collection contains Spielen, a game built entirely on prearranged codes — the community did not reject coded signalling as uninteresting, it quarantined it into a different game.',
        sources: ['develin'],
      },
    ],
  },
  {
    id: 'claims',
    title: 'Claim timing',
    sub: 'Certainty is the bar; speed is the follow-through',
    items: [
      {
        lead: 'Never uncertain, never late.',
        text: 'Do not claim on a hunch — and once a book is certain, claim it promptly, so teammates stop spending asks on cards that no longer matter.',
        sources: ['pagat', 'develin'],
      },
      {
        lead: "Develin's risk math.",
        text: 'If your team holds all six cards, the only way to lose the book is your own misdeclaration; the benefit of declaring early is usually small. Conclusion: the bar is certainty, and rushing buys you almost nothing.',
        sources: ['develin'],
      },
      {
        lead: 'Withhold for the control transfer.',
        text: 'The corollary: a fully-known book is a banked asset. Held back, it keeps you ask-worthy — and when you finally claim yourself empty, the claim-out pass lets you hand the turn to the teammate of your choice at exactly the right moment.',
        sources: ['develin', 'wikipedia'],
      },
      {
        lead: 'Who claims in the endgame.',
        text: 'When one team is out of cards and the other must claim everything, the teammate with the most cards — and the most information — should be the one holding the turn.',
        sources: ['develin', 'dorsa'],
      },
      {
        lead: 'The US dialect changes the math.',
        text: 'In student "Fish", declares happen at any time by anyone, and a wrong declare awards the set to the other team regardless of who holds what. There, racing to cash a known set before an opponent steals the declare is real strategy — a pressure our turn-based baseline does not have.',
        sources: ['se', 'amylei', 'cornell'],
      },
      {
        lead: 'The abort window.',
        text: 'Bryn Mawr’s house rules let a claimer abort a declare up until the first card is named — a formalized cold-feet clause.',
        sources: ['brynmawr'],
        inApp: 'Our table has no abort: submitting the claim resolves it (RULES.md §3).',
      },
    ],
  },
  {
    id: 'stalemate',
    title: 'Stalemates & the endgame law',
    sub: 'When nobody wants to miss',
    intro:
      'Two teams that both refuse to miss into each other can freeze the game. The community machinery for breaking the ice ranges from an elegant named play to blunt house rules.',
    items: [
      {
        lead: 'The stalemate breaker.',
        text: 'Wikipedia records the named play: a team withholds a set it fully knows. When a teammate is stuck — certain of opponents’ cards but unable to win the turn — the current player declares the reserved set, empties their hand, and uses the claim-out pass to deliver the turn to the stuck teammate.',
        sources: ['wikipedia'],
        inApp: 'Fully supported here: claims empty you, and RULES.md row 20 gives you the pass.',
      },
      {
        lead: 'The endgame law.',
        text: 'pagat’s rule, which our table implements: when one team runs out of cards, the team with cards must claim every remaining book. The turn-holder does it alone if they have cards; if the turn sits with the empty team, they choose which opponent must claim everything — a choice made with spite or respect for skill.',
        sources: ['pagat'],
        inApp: 'RULES.md §4: endgame and designate phases, exactly as described.',
      },
      {
        lead: 'Deadlock, diagnosed.',
        text: 'Develin identifies mutual blackballing as the cause: both teams starving each other of the turn is correct play from both sides, so a stall is not a failure of the players but a property of the game.',
        sources: ['develin'],
      },
      {
        lead: 'House machinery.',
        text: 'Anti-deadlock furniture from the field: Bryn Mawr plays with a sanctioned pause button and a no-history rule (only the last question and answer are public); gamerules.com settles drawn matches best-of-three; Develin’s harshest tool is the misask penalty — asking for a card you hold, or into a book you lack, forfeits that book instantly.',
        sources: ['brynmawr', 'gamerules', 'develin'],
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memory techniques',
    sub: 'The real resource being spent',
    items: [
      {
        lead: 'Triage.',
        text: 'Do not memorize books you were dealt nothing in — pagat’s advice is to "save your brain cells" for the half-suits you can actually contest.',
        sources: ['pagat', 'develin', 'dorsa'],
      },
      {
        lead: 'Perfect on few beats fuzzy on all.',
        text: 'Develin prefers exact knowledge of a few suits over vague impressions of everything — and recommends actively flushing resolved books from memory to free the space.',
        sources: ['develin'],
      },
      {
        lead: 'Mnemonic songs.',
        text: 'Dorsa suggests binding players to cards with little rhymes or songs — the only source to propose a concrete mnemonic device.',
        sources: ['dorsa'],
      },
      {
        lead: 'The practice loop.',
        text: 'The Cornell account of learning Fish: memorize every exchange, and infer as much from the questions not asked as from the ones asked.',
        sources: ['cornell'],
      },
      {
        lead: 'Notes are banned everywhere.',
        text: 'pagat is explicit that no written records are allowed — memory is the point. Bryn Mawr’s pause button doubles as the only sanctioned recall time on record.',
        sources: ['pagat', 'brynmawr'],
        inApp:
          'Our UI has no notes field by design (RULES.md row 18); the public log is shown because everything in it was public when it happened. A purist last-ask-only mode is reserved as flag T10 (strictMemory), but it is not built: the flag is declared on the engine config and read nowhere, so the app has one log mode and it is the full one.',
      },
    ],
  },
]

/**
 * Variants — attributed, each with an honest note on what this app actually does.
 *
 * `inApp` describes shipped behaviour. A flag that merely exists on `RulesConfig.toggles` is NOT
 * shipped behaviour: only T5 (`highBooksDouble`) and T6 (`askOwnCardAllowed`) are read by any code
 * (RULES.md §5). Naming any other flag here as though it plays the variant is a false claim on a
 * live public page, so those entries say plainly that the flag is declared but not implemented.
 */
export interface VariantItem {
  lead: string
  text: string
  sources: SourceId[]
  inApp?: string
}

export const VARIANTS: VariantItem[] = [
  {
    lead: '48-card baseline.',
    text: 'The 8s-out deck, six players in threes (or eight in fours), is the pagat baseline — with origins traced to Tamil Nadu (Chennai, 1940s–50s) and Kerala engineering hostels, and the names Fish, Canadian Fish and Russian Fish in North America.',
    sources: ['pagat'],
    inApp: 'Our default (RULES.md rows 1–4).',
  },
  {
    lead: '54 cards with jokers.',
    text: 'Add two jokers and keep the 8s as a ninth eights-and-jokers set — the US student standard, and the default in the Litaf implementation (first to 5 sets).',
    sources: ['pagat', 'cornell', 'se', 'litaf'],
    inApp:
      'Not built. Flag T1 (jokers) is declared on the engine config but read nowhere, so setting it changes nothing — the deck is a fixed 48 cards and eight half-suit sets. This app plays the 48-card baseline only.',
  },
  {
    lead: '7s-out, ace-low ("Lit").',
    text: 'The Indian deck removes the 7s instead, splitting each suit A–6 and 8–K; players in India call the game Lit.',
    sources: ['pagat', 'littplay', 'se'],
    inApp: 'Not in this app.',
  },
  {
    lead: 'Rank-quartet sets and the 2s-out deck.',
    text: 'The older Wikipedia text preserves a 13-set variant where a set is all four cards of one rank, and a 2s-out deck with LOW running 3–8.',
    sources: ['oldwiki'],
    inApp:
      'Neither is built. Flag T2 (rankQuartet) is declared on the engine config but read nowhere — sets are always half-suits — and the 2s-out deck does not exist.',
  },
  {
    lead: 'Weighted scoring.',
    text: 'pagat lists scoring majors 2 / minors 1 to cut ties, and a 52-card version with 7-card major sets.',
    sources: ['pagat'],
    inApp:
      'HIGH-books-double is engine toggle T5 — one of the two toggles that is genuinely implemented (the scorer reads it), though it is off by default with no UI exposure in v1.',
  },
  {
    lead: 'Out-of-turn declares.',
    text: 'Letting anyone declare at any time — with a wrong declare awarded to the opponents — is the US student dialect, listed as a variant on pagat and required by Develin’s own-team-only declare discussion.',
    sources: ['develin', 'se', 'amylei', 'cornell', 'pagat'],
    inApp:
      'Not built. Flag T8 (claimAnyTurn) is declared on the engine config but read nowhere: claims are legal on your own turn only, and resolution stays RULES.md §3.',
  },
  {
    lead: 'The Bryn Mawr dialect.',
    text: 'Teams drawn by high/low cards, abortable claims, a pause button, and the no-history rule — a complete self-consistent house culture.',
    sources: ['brynmawr'],
    inApp:
      'Flag T10 (strictMemory) is the nearest relative on paper, but it is declared and unread — the UI always shows the full public log.',
  },
  {
    lead: 'Fish as an institution.',
    text: 'At MOP, the USA olympiad training camp, a double-elimination Fish tournament is a fixture of camp life.',
    sources: ['evanchen'],
  },
  {
    lead: 'Best-of-three.',
    text: 'gamerules.com resolves tied games by playing a best-of-three match.',
    sources: ['gamerules'],
    inApp: 'Our engine records a 4–4 (or void-shortened equal) game as a tie (RULES.md row 23).',
  },
]

export interface WorkedExample {
  id: string
  title: string
  /** e.g. "Adapted from Develin". */
  from: string
  sources: SourceId[]
  paragraphs: string[]
  /** Cards to render as glyphs above the example, if helpful. */
  cards?: string[]
  /** A card to visually set apart (the deduced/target card). */
  focus?: string
}

export const EXAMPLES: WorkedExample[] = [
  {
    id: 'blackball',
    title: 'The blackball deduction',
    from: 'Adapted from Develin',
    sources: ['develin'],
    cards: ['2C', '3C', '4C', '5C', '6C'],
    focus: '7C',
    paragraphs: [
      'An opponent has visibly collected the 2–6 of clubs. They ask you for the 7♣ — miss. Later they ask one of your teammates — miss again.',
      'Everyone at the table can finish the syllogism: the 7♣ is with your third teammate. The opponent needs exactly one card, knows where it is, and will take it the moment they hold the turn.',
      'The play is collective: from this moment, nobody on your team may ever miss into that opponent. Ask the other two seats even at worse odds — a blackball is only as strong as its weakest teammate.',
    ],
  },
  {
    id: 'endgame-ev',
    title: 'A 50-50 worth taking',
    from: 'Adapted from Develin',
    sources: ['develin'],
    paragraphs: [
      'Late game. You could keep grinding your own suit — or claim clubs now on a 50% guess between two placements, which would empty your hand and let you pass the turn to a chosen teammate.',
      'That teammate, once in control, can strip a known diamond-seeker and lock the diamonds for your team. The gamble line banks the diamonds always and the clubs half the time.',
      'Develin’s comparison: any line that refuses the gamble must be worth more than one-and-a-half books to beat it — his 150-percent test. Expected value, not comfort, picks the claim.',
    ],
  },
  {
    id: 'echo',
    title: 'The echo, by convention',
    from: 'Adapted from pagat (the Salahuddin convention)',
    sources: ['pagat'],
    cards: ['2H'],
    paragraphs: [
      'You deliberately ask an opponent for the 2♥ knowing it will miss. The table now knows you hold minor hearts; your partner knows to watch.',
      'Your partner holds the 2♥. On their next turn they ask for a different minor heart — that is the confirmation. Had they changed the subject entirely, that would be the denial.',
      'Remember the schism: at a Develin-style or US student table, agreeing to this reading beforehand is exactly what the rules prohibit. Run it only where conventions are welcome.',
    ],
  },
]

/** How our practice bots actually play — internal facts, no external citation. */
export const BOTS_NOTES: string[] = [
  'They read only the public view — the same log, counts and claims you see. No bot ever peeks at a hand.',
  'Knowledge propagates from every event: an ask proves the asker holds that half-suit and lacks that card; a hit moves a known card; a miss eliminates a holder. Constraints chain until placements become certain.',
  'Claims are made at certainty — when every one of the six placements is forced by the public record. Hard bots also take risk-weighted EV claims when five of six cards are known and the odds justify it.',
  'Hard bots play the stalemate breaker: when every legal ask is a known miss, they cash a held book and move the turn instead of donating information.',
  'And they never ask a known miss unless forced — the same baseline the community arrived at.',
]
