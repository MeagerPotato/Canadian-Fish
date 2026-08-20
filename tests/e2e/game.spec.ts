/**
 * GATE 2 — six real browser clients (one browser, six contexts = six phones)
 * create a room on the LIVE backend, join it, and play a COMPLETE game of
 * Canadian Fish to 8 resolved books entirely through the shipped UI
 * (PROTOCOL.md §7 testids). Along the way it verifies mid-game reload
 * recovery (< 3 s) and — the core security assertion — that no client's
 * captured traffic (HTTP bodies + websocket frames) ever contains another
 * seat's hand.
 *
 * Driver design: the test aggregates the six clients' OWN knowledge (each
 * seat's hand fetched via GET /api/state with that context's own token) to
 * pick moves; every assertion uses only public state or the acting seat's
 * own view. The policy prefers guaranteed-hit asks and correct claims so the
 * game converges, with a small budget of deliberate misses so both teams act
 * and the miss/turn-handoff path is exercised.
 */
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

/* ------------------------------------------------------------------ cards -- */

const SUITS = ['C', 'D', 'H', 'S'] as const
const LOW_RANKS = ['2', '3', '4', '5', '6', '7'] as const
const HIGH_RANKS = ['9', 'T', 'J', 'Q', 'K', 'A'] as const
const LOW_SET = new Set<string>(LOW_RANKS)
const ALL_BOOKS: string[] = (['LOW', 'HIGH'] as const).flatMap((h) => SUITS.map((s) => `${h}-${s}`))
const ALL_CARDS: string[] = SUITS.flatMap((s) => [...LOW_RANKS, ...HIGH_RANKS].map((r) => `${r}${s}`))
const CARD_ORDER = new Map<string, number>(ALL_CARDS.map((c, i) => [c, i]))

function bookCards(book: string): string[] {
  const half = book.slice(0, book.indexOf('-'))
  const suit = book.slice(-1)
  return (half === 'LOW' ? LOW_RANKS : HIGH_RANKS).map((r) => `${r}${suit}`)
}

function cardBook(card: string): string {
  return `${LOW_SET.has(card[0]) ? 'LOW' : 'HIGH'}-${card[1]}`
}

function teamOf(seat: number): number {
  return seat % 2
}

function teamSeatsOf(team: number): number[] {
  return team === 0 ? [0, 2, 4] : [1, 3, 5]
}

function sortedCards(hand: readonly string[]): string[] {
  return [...hand].sort((a, b) => (CARD_ORDER.get(a) ?? 0) - (CARD_ORDER.get(b) ?? 0))
}

/* ------------------------------------------------------------- wire types -- */

interface BookResult {
  outcome: 'team0' | 'team1' | 'void'
}

interface PubGame {
  phase: 'playing' | 'awaitPass' | 'awaitDesignate' | 'endgame' | 'finished'
  turn: number
  counts: number[]
  score: [number, number]
  books: Record<string, BookResult | undefined>
  log: unknown[]
  moveIndex: number
}

interface PubRoom {
  code: string
  status: string
  hostSeat: number
  seats: { seat: number; filled: boolean }[]
  paused: boolean
  game: PubGame | null
  version: number
}

interface StateOk {
  ok: true
  you: { seat: number; name: string }
  hand: string[]
  room: PubRoom
}

/* -------------------------------------------------------- traffic capture -- */

interface WsBroadcast {
  topic: string
  event: string
  payload: unknown
}

interface Capture {
  /** Every /api/* HTTP response body the page itself received. */
  api: { url: string; body: string }[]
  /** Every inbound websocket frame payload (supabase realtime), as UTF-8 text. */
  ws: string[]
  /** Structurally decoded user broadcasts (binary phoenix frames, kind 4). */
  wsBroadcasts: WsBroadcast[]
  /** Outstanding body reads — awaited before the privacy assertions. */
  pending: Promise<void>[]
}

/**
 * Decode a realtime binary user-broadcast frame (the wire format
 * @supabase/realtime-js Serializer uses for broadcast deliveries):
 * [kind=4][topicSize][eventSize][metaSize][encoding] topic event meta payload.
 */
function decodeUserBroadcast(bytes: Uint8Array): WsBroadcast | null {
  if (bytes.length < 5 || bytes[0] !== 4) return null
  const topicSize = bytes[1]
  const eventSize = bytes[2]
  const metaSize = bytes[3]
  const encoding = bytes[4] // 1 = JSON payload
  let offset = 5
  const decoder = new TextDecoder()
  const topic = decoder.decode(bytes.subarray(offset, offset + topicSize))
  offset += topicSize
  const event = decoder.decode(bytes.subarray(offset, offset + eventSize))
  offset += eventSize
  offset += metaSize
  if (encoding !== 1) return { topic, event, payload: null }
  try {
    return { topic, event, payload: JSON.parse(decoder.decode(bytes.subarray(offset))) as unknown }
  } catch {
    return null
  }
}

function instrument(page: Page, cap: Capture): void {
  page.on('response', (response) => {
    if (!response.url().includes('/api/')) return
    cap.pending.push(
      response.text().then(
        (body) => {
          cap.api.push({ url: response.url(), body })
        },
        () => {
          /* body unavailable (aborted navigation) — nothing to record */
        },
      ),
    )
  })
  page.on('websocket', (ws) => {
    ws.on('framereceived', (frame) => {
      const payload = frame.payload
      if (typeof payload === 'string') {
        cap.ws.push(payload)
      } else {
        // Node Buffer (binary frame): keep the UTF-8 text for the string scans
        // and the structural decode for the broadcast walk.
        const bytes = payload as unknown as Uint8Array
        cap.ws.push(String(payload))
        const decoded = decodeUserBroadcast(bytes)
        if (decoded) cap.wsBroadcasts.push(decoded)
      }
    })
  })
}

/** Resolve the public anon key from the first /api request the app itself sends. */
function captureAnonKey(page: Page): Promise<string> {
  return new Promise<string>((resolve) => {
    const onRequest = (request: Request) => {
      if (!request.url().includes('/api/')) return
      const key = request.headers()['apikey']
      if (key) {
        page.off('request', onRequest)
        resolve(key)
      }
    }
    page.on('request', onRequest)
  })
}

const ORIGIN = 'http://localhost:8788'

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/* ------------------------------------------------------------------- test -- */

test('six phones play a complete game against the live backend', async ({ browser }) => {
  const pages: Page[] = []
  const captures: Capture[] = []
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const cap: Capture = { api: [], ws: [], wsBroadcasts: [], pending: [] }
    instrument(page, cap)
    pages.push(page)
    captures.push(cap)
  }

  let code = ''
  let anonKey = ''
  const tokens: string[] = []

  /* -------------------------------------------------- test-side knowledge -- */
  // hands[seat] comes ONLY from that seat's own context/token; pub is the
  // latest public room snapshot (also from an own-token /state call).
  const hands: string[][] = [[], [], [], [], [], []]
  let pub: PubRoom | null = null
  // Every serialization of a seat's hand the test ever knew (for the privacy
  // "another seat's hand never appears in my traffic" assertion).
  const knownHandStrings: Set<string>[] = [0, 1, 2, 3, 4, 5].map(() => new Set<string>())

  function recordHand(seat: number, hand: string[]): void {
    hands[seat] = hand
    if (hand.length >= 3) {
      knownHandStrings[seat].add(JSON.stringify(hand))
      knownHandStrings[seat].add(JSON.stringify(sortedCards(hand)))
    }
  }

  async function fetchState(ctxIndex: number): Promise<StateOk> {
    const res = await pages[ctxIndex].request.get(
      `${ORIGIN}/api/state?code=${code}&token=${encodeURIComponent(tokens[ctxIndex])}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    )
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string; message?: string } }
    if (body.ok !== true) {
      throw new Error(`ctx ${ctxIndex} /state failed: HTTP ${res.status()} ${JSON.stringify(body.error ?? body)}`)
    }
    return body as unknown as StateOk
  }

  async function refreshAll(): Promise<void> {
    const states = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => fetchState(i)))
    for (const st of states) recordHand(st.you.seat, st.hand)
    pub = states.reduce((a, b) => (b.room.version > a.room.version ? b : a)).room
  }

  function game(): PubGame {
    if (!pub?.game) throw new Error('no game in room state')
    return pub.game
  }

  function holderOf(card: string): number {
    for (let s = 0; s < 6; s++) if (hands[s].includes(card)) return s
    throw new Error(`card ${card} is in no known hand — knowledge desync`)
  }

  /** First unresolved book whose 6 cards are all held by `team` (union of its 3 hands). */
  function teamCompleteBook(team: number): string | null {
    const union = new Set<string>(teamSeatsOf(team).flatMap((s) => hands[s]))
    for (const book of ALL_BOOKS) {
      if (game().books[book]) continue
      if (bookCards(book).every((c) => union.has(c))) return book
    }
    return null
  }

  /** Cards the seat may legally ask for: of a book it touches, not held by it. */
  function askableCards(seat: number): string[] {
    const held = new Set(hands[seat])
    const myBooks = new Set(hands[seat].map(cardBook))
    return ALL_CARDS.filter((c) => myBooks.has(cardBook(c)) && !held.has(c))
  }

  function opponentsWithCards(seat: number): number[] {
    return teamSeatsOf(1 - teamOf(seat)).filter((s) => game().counts[s] > 0)
  }

  /* -------------------------------------------------------- UI executors -- */

  async function uiAsk(page: Page, target: number, card: string): Promise<void> {
    await page.getByTestId('ask-open').click()
    await page.getByTestId(`ask-target-${target}`).click()
    await page.getByTestId(`ask-book-${cardBook(card)}`).click()
    await page.getByTestId(`ask-card-${card}`).click()
    await page.getByTestId('ask-submit').click()
  }

  async function uiClaim(page: Page, claimer: number, book: string): Promise<void> {
    await page.getByTestId('claim-open').click()
    await page.getByTestId(`claim-book-${book}`).click()
    for (const card of bookCards(book)) {
      const holder = holderOf(card)
      if (teamOf(holder) !== teamOf(claimer)) {
        throw new Error(`claim ${book}: card ${card} held by opponent seat ${holder} — driver picked a bad book`)
      }
      await page.getByTestId(`claim-card-${card}-seat-${holder}`).click()
    }
    await page.getByTestId('claim-submit').click()
  }

  /** Poll /state (acting seat's own token) until the move landed. */
  async function pollMoveApplied(seat: number, prevMoveIndex: number): Promise<StateOk> {
    const deadline = Date.now() + 25_000
    for (;;) {
      await sleep(200)
      const st = await fetchState(seat)
      recordHand(st.you.seat, st.hand)
      const mi = st.room.game?.moveIndex ?? -1
      if (mi > prevMoveIndex) {
        pub = st.room
        return st
      }
      if (Date.now() > deadline) {
        const lastAction = captures[seat].api.filter((r) => r.url.includes('/api/action')).at(-1)
        throw new Error(
          `seat ${seat}: action did not apply within 25 s (moveIndex still ${mi}); ` +
            `last /api/action response: ${lastAction ? lastAction.body : 'none'}`,
        )
      }
    }
  }

  /* -------------------------------------------------------------- driver -- */

  let totalIterations = 0
  let askCount = 0
  let missBudget = 8 // deliberate misses to hand the turn across teams (coverage)
  const tally = { asks: 0, hits: 0, misses: 0, claims: 0, passes: 0, designates: 0 }

  async function claimSanity(actorSeat: number, st: StateOk): Promise<void> {
    const g = st.room.game
    if (!g) return
    // Counts shown on a NON-acting context converge to the authoritative counts.
    const watcher = pages[(actorSeat + 1) % 6]
    for (let s = 0; s < 6; s++) {
      await expect(watcher.getByTestId(`count-${s}`), `watcher count-${s} after claim`).toHaveText(String(g.counts[s]), {
        timeout: 30_000,
      })
    }
    // score A + score B + voids === books resolved (authoritative and on-screen).
    const resolved = ALL_BOOKS.filter((b) => g.books[b]).length
    const voids = ALL_BOOKS.filter((b) => g.books[b]?.outcome === 'void').length
    expect(g.score[0] + g.score[1] + voids, 'score + voids = resolved books (state)').toBe(resolved)
    const scoreA = Number(await watcher.getByTestId('score-a').textContent())
    const scoreB = Number(await watcher.getByTestId('score-b').textContent())
    expect(scoreA + scoreB + voids, 'score + voids = resolved books (UI)').toBe(resolved)
  }

  /** Run up to `maxIterations` driver iterations; returns true when the game finished. */
  async function drive(maxIterations: number): Promise<boolean> {
    for (let n = 0; n < maxIterations; n++) {
      await refreshAll()
      if (game().phase === 'finished') return true
      if (pub?.paused) {
        console.log('room is paused — waiting for it to resume')
        await sleep(2000)
        continue
      }
      totalIterations++
      if (totalIterations > 400) throw new Error('driver cap exceeded: game did not finish within 400 iterations')

      const g = game()
      const turn = g.turn
      const page = pages[turn]

      // The acting client's UI must reflect the authoritative state before we drive it.
      await expect(page.getByTestId('phase'), `acting ctx ${turn} phase sync`).toHaveText(g.phase, { timeout: 30_000 })
      await expect(page.getByTestId('turn-seat'), `acting ctx ${turn} turn sync`).toHaveText(String(turn), {
        timeout: 30_000,
      })
      const logBefore = await page.getByTestId('log-entry').count()

      let desc: string
      let claimed = false
      if (g.phase === 'awaitPass') {
        const to = teamSeatsOf(teamOf(turn)).find((s) => s !== turn && g.counts[s] > 0)
        if (to === undefined) throw new Error(`awaitPass but no teammate of seat ${turn} has cards`)
        await page.getByTestId(`pass-to-${to}`).click()
        desc = `pass -> seat ${to}`
        tally.passes++
      } else if (g.phase === 'awaitDesignate') {
        const to = opponentsWithCards(turn)[0]
        if (to === undefined) throw new Error(`awaitDesignate but no opponent of seat ${turn} has cards`)
        await page.getByTestId(`designate-${to}`).click()
        desc = `designate -> seat ${to}`
        tally.designates++
      } else {
        // playing | endgame
        const completeBook = teamCompleteBook(teamOf(turn))
        const askable = askableCards(turn)
        const opps = opponentsWithCards(turn)
        const canAsk = g.phase === 'playing' && hands[turn].length > 0 && askable.length > 0 && opps.length > 0
        if (g.phase === 'endgame' || completeBook !== null || !canAsk) {
          if (completeBook === null) {
            throw new Error(
              `driver stuck: seat ${turn} must claim (phase=${g.phase}, canAsk=${String(canAsk)}) ` +
                'but its team holds no complete unresolved book',
            )
          }
          await uiClaim(page, turn, completeBook)
          desc = `claim ${completeBook}`
          claimed = true
          tally.claims++
        } else {
          askCount++
          const hitOptions = askable.filter((c) => teamOf(holderOf(c)) !== teamOf(turn))
          let target: number | undefined
          let card: string | undefined
          let kind = ''
          if (missBudget > 0 && askCount % 3 === 0) {
            // Deliberate legal miss: hands the turn to the other team so both
            // sides act through their own UI (row 10 coverage).
            const missTarget = opps.reduce((a, b) => (g.counts[b] > g.counts[a] ? b : a))
            const missCard = askable.find((c) => !hands[missTarget].includes(c))
            if (missCard !== undefined) {
              target = missTarget
              card = missCard
              kind = 'miss'
              missBudget--
              tally.misses++
            }
          }
          if (card === undefined && hitOptions.length > 0) {
            card = hitOptions[0]
            target = holderOf(card)
            kind = 'hit'
            tally.hits++
          }
          if (card === undefined || target === undefined) {
            // Fallback: any legal ask (miss fine).
            target = opps[0]
            card = askable[0]
            kind = 'fallback'
          }
          await uiAsk(page, target, card)
          desc = `ask -> seat ${target} for ${card} (${kind})`
          tally.asks++
        }
      }

      const st = await pollMoveApplied(turn, g.moveIndex)
      // UI assertion: the public log grew on (at least) the acting context.
      await expect
        .poll(() => page.getByTestId('log-entry').count(), {
          timeout: 30_000,
          message: `acting ctx ${turn} log should grow after the action`,
        })
        .toBeGreaterThan(logBefore)

      const after = st.room.game
      console.log(
        `[iter ${totalIterations}] seat ${turn} (${g.phase}) ${desc} => phase=${after?.phase} turn=${after?.turn} ` +
          `score=${after?.score[0]}-${after?.score[1]} books=${ALL_BOOKS.filter((b) => after?.books[b]).length}/8`,
      )
      if (claimed) await claimSanity(turn, st)
      if (after?.phase === 'finished') return true
      await sleep(250) // pacing: stays far under the 30 actions / 10 s / token limit
    }
    return false
  }

  /* ----------------------------------------------------------- the steps -- */

  await test.step('a. six phones: create + join into one full lobby', async () => {
    const p0 = pages[0]
    const anonKeyPromise = captureAnonKey(p0)
    await p0.goto('/')
    await p0.getByTestId('create-name').fill('P0')
    await p0.getByTestId('create-room').click()
    await p0.waitForURL(/\/r\/[A-Z0-9]{6}$/)
    anonKey = await anonKeyPromise
    await expect(p0.getByTestId('room-code')).toBeVisible({ timeout: 20_000 })
    code = ((await p0.getByTestId('room-code').textContent()) ?? '').trim()
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    console.log(`room code: ${code}`)

    for (let i = 1; i < 6; i++) {
      const p = pages[i]
      await p.goto('/')
      await p.getByTestId('join-code').fill(code)
      await p.getByTestId('join-name').fill(`P${i}`)
      await p.getByTestId('join-room').click()
      await p.waitForURL(`**/r/${code}`)
      await expect(p.getByTestId('room-code')).toBeVisible({ timeout: 20_000 })
    }

    for (let i = 0; i < 6; i++) {
      const token = await pages[i].evaluate((key) => window.localStorage.getItem(key), `cf:room:${code}:token`)
      if (!token) throw new Error(`context ${i}: no token under cf:room:${code}:token`)
      tokens.push(token)
    }
    // Sequential joins take the lowest free seat: context i === seat i.
    for (let i = 0; i < 6; i++) {
      const st = await fetchState(i)
      expect(st.you.seat, `context ${i} seat`).toBe(i)
    }
    // Every lobby shows all six seats filled, with the right team split.
    for (let i = 0; i < 6; i++) {
      for (let s = 0; s < 6; s++) {
        const seat = pages[i].getByTestId(`seat-${s}`)
        await expect(seat, `ctx ${i}: seat ${s} filled`).toHaveAttribute('data-filled', 'true', { timeout: 30_000 })
        await expect(seat).toHaveAttribute('data-team', s % 2 === 0 ? 'A' : 'B')
      }
    }
  })

  await test.step('b. host deals — all six clients reach the table', async () => {
    const start = pages[0].getByTestId('start-game')
    await expect(start).toBeEnabled({ timeout: 20_000 })
    await start.click()
    for (let i = 0; i < 6; i++) {
      await expect(pages[i].getByTestId('hand'), `ctx ${i} shows the table`).toBeVisible({ timeout: 30_000 })
      await expect(pages[i].getByTestId('phase')).toHaveText('playing', { timeout: 30_000 })
    }
  })

  await test.step('c. play the opening (10 driver iterations)', async () => {
    const finished = await drive(10)
    expect(finished, 'game should not finish within the first 10 iterations').toBe(false)
  })

  const reloadTimes: Record<number, number> = {}

  await test.step('d. mid-game reload recovery (seats 2 and 5, one per team)', async () => {
    for (const seat of [2, 5]) {
      await refreshAll()
      const expectedTurn = game().turn
      const expectedHand = hands[seat]
      const page = pages[seat]
      const t0 = Date.now()
      await page.reload()
      let elapsed = -1
      while (Date.now() - t0 < 15_000) {
        const ok = await page
          .evaluate(
            ({ cards, turn }) => {
              const handEl = document.querySelector('[data-testid="hand"]')
              if (!handEl) return false
              const shown = Array.from(handEl.querySelectorAll('[data-testid^="card-"]')).map((el) =>
                (el.getAttribute('data-testid') ?? '').slice('card-'.length),
              )
              if (shown.length !== cards.length) return false
              const have = new Set(shown)
              if (!cards.every((c) => have.has(c))) return false
              const turnEl = document.querySelector('[data-testid="turn-seat"]')
              return turnEl !== null && turnEl.textContent === String(turn)
            },
            { cards: expectedHand, turn: expectedTurn },
          )
          .catch(() => false)
        if (ok) {
          elapsed = Date.now() - t0
          break
        }
        await sleep(100)
      }
      expect(elapsed, `seat ${seat}: reload recovered (hand + turn-seat)`).toBeGreaterThanOrEqual(0)
      expect(elapsed, `seat ${seat}: reload recovery under 3000 ms`).toBeLessThan(3000)
      reloadTimes[seat] = elapsed
      console.log(`reload recovery: seat ${seat} restored hand (${expectedHand.length} cards) + turn in ${elapsed} ms`)
    }
  })

  await test.step('e. play to 8 resolved books', async () => {
    const finished = await drive(400)
    expect(finished, 'game reached phase=finished').toBe(true)
    console.log(
      `game finished after ${totalIterations} driver iterations ` +
        `(asks=${tally.asks} [hits=${tally.hits} deliberate-misses=${tally.misses}], ` +
        `claims=${tally.claims}, passes=${tally.passes}, designates=${tally.designates})`,
    )
  })

  await test.step('f. payload privacy: no hand ever crosses the wire to the wrong client', async () => {
    await Promise.all(captures.flatMap((c) => c.pending))
    const violations: string[] = []
    for (let x = 0; x < 6; x++) {
      const cap = captures[x]
      let stateBodies = 0
      let otherBodies = 0
      let broadcastRoomFrames = 0
      let handStringsChecked = 0

      for (const { url, body } of cap.api) {
        if (url.includes('/api/state')) {
          stateBodies++
          let parsed: { ok?: boolean; you?: { seat?: number }; hand?: unknown; room?: unknown }
          try {
            parsed = JSON.parse(body) as typeof parsed
          } catch {
            violations.push(`ctx ${x}: unparseable /state body`)
            continue
          }
          if (parsed.ok !== true) continue // transport error bodies carry no state
          // (1) /state only ever serves the requesting token's own seat + hand.
          if (parsed.you?.seat !== x) violations.push(`ctx ${x}: /state you.seat=${String(parsed.you?.seat)}`)
          if (!Array.isArray(parsed.hand)) violations.push(`ctx ${x}: /state hand is not an array`)
          // (2) hand appears at the top level only — never inside room.
          const roomStr = JSON.stringify(parsed.room)
          if (roomStr.includes('"hand"') || roomStr.includes('"hands"')) {
            violations.push(`ctx ${x}: /state room sub-object contains a hand key`)
          }
        } else {
          otherBodies++
          // (1) no non-state endpoint (create/join/action/heartbeat/start) ships a hand.
          if (body.includes('"hand"') || body.includes('"hands"')) {
            violations.push(`ctx ${x}: non-state response carries a hand key: ${url}`)
          }
        }
      }

      // (3) no websocket frame (text or binary, scanned as UTF-8) ever carries
      // a hand/hands key.
      for (const frame of cap.ws) {
        if (frame.includes('"hand"') || frame.includes('"hands"')) {
          violations.push(`ctx ${x}: websocket frame contains a hand key: ${frame.slice(0, 200)}`)
        }
      }
      // (5) structural walk of every broadcast `room` payload: counts + log
      // present, hands never. Broadcast deliveries arrive as binary phoenix
      // frames (decoded at capture time); text frames use the phoenix v2 array
      // envelope [join_ref, ref, topic, event, payload] — walk both.
      const roomPayloads: unknown[] = cap.wsBroadcasts.filter((b) => b.event === 'room').map((b) => b.payload)
      for (const frame of cap.ws) {
        let msg: unknown
        try {
          msg = JSON.parse(frame)
        } catch {
          continue // binary frames (already decoded above) are not JSON text
        }
        let event: unknown
        let payload: unknown
        if (Array.isArray(msg)) {
          event = msg[3]
          payload = msg[4]
        } else if (typeof msg === 'object' && msg !== null) {
          event = (msg as { event?: unknown }).event
          payload = (msg as { payload?: unknown }).payload
        }
        if (event !== 'broadcast') continue
        const inner = payload as { event?: unknown; payload?: unknown } | undefined
        if (inner?.event === 'room') roomPayloads.push(inner.payload)
      }
      for (const room of roomPayloads) {
        broadcastRoomFrames++
        if (typeof room !== 'object' || room === null) {
          violations.push(`ctx ${x}: broadcast room payload is not an object`)
          continue
        }
        const gameObj = (room as { game?: unknown }).game
        if (gameObj === null || gameObj === undefined) continue // lobby snapshots
        if (typeof gameObj !== 'object') {
          violations.push(`ctx ${x}: broadcast game is not an object`)
          continue
        }
        const gRec = gameObj as Record<string, unknown>
        if (!Array.isArray(gRec.counts)) violations.push(`ctx ${x}: broadcast game has no counts array`)
        if (!Array.isArray(gRec.log)) violations.push(`ctx ${x}: broadcast game has no log array`)
        if ('hands' in gRec || 'hand' in gRec) violations.push(`ctx ${x}: broadcast game carries hands`)
      }
      // The walk must actually cover traffic: every client is subscribed for
      // the whole game and must have received room broadcasts.
      if (broadcastRoomFrames === 0) {
        violations.push(
          `ctx ${x}: no broadcast room payloads recognized among ${cap.ws.length} frames — ` +
            `walk is blind (sample: ${cap.ws.slice(0, 2).map((f) => f.slice(0, 120)).join(' | ')})`,
        )
      }

      // (4) no other seat's known hand (as an exact JSON array) in any of X's traffic.
      const blob = cap.api.map((r) => r.body).join('\n') + '\n' + cap.ws.join('\n')
      for (let y = 0; y < 6; y++) {
        if (y === x) continue
        for (const s of knownHandStrings[y]) {
          handStringsChecked++
          if (blob.includes(s)) violations.push(`ctx ${x}: traffic contains seat ${y}'s hand ${s}`)
        }
      }

      console.log(
        `privacy ctx ${x} (seat ${x}): scanned ${cap.api.length} /api bodies ` +
          `(${stateBodies} state + ${otherBodies} other), ${cap.ws.length} ws frames ` +
          `(${broadcastRoomFrames} broadcast room payloads), ${handStringsChecked} foreign hand serializations absent`,
      )
    }
    expect(violations, 'payload privacy violations').toEqual([])
  })

  await test.step('g. finale: identical game-over on all six clients', async () => {
    const final = await fetchState(0)
    const g = final.room.game
    if (!g) throw new Error('finished room lost its game state')
    expect(g.phase).toBe('finished')
    expect(final.room.status).toBe('finished')
    const resolved = ALL_BOOKS.filter((b) => g.books[b]).length
    const voids = ALL_BOOKS.filter((b) => g.books[b]?.outcome === 'void').length
    expect(resolved, 'all 8 books resolved').toBe(8)
    expect(g.score[0] + g.score[1] + voids, 'score + voids = 8').toBe(8)
    const expectedWinner = g.score[0] > g.score[1] ? 'A' : g.score[1] > g.score[0] ? 'B' : 'tie'

    const winners: (string | null)[] = []
    for (let i = 0; i < 6; i++) {
      const page = pages[i]
      await expect(page.getByTestId('game-over'), `ctx ${i} game-over`).toBeVisible({ timeout: 30_000 })
      winners.push(await page.getByTestId('winner').textContent())
      await expect
        .poll(() => page.getByTestId('log-entry').count(), {
          timeout: 30_000,
          message: `ctx ${i} final log length`,
        })
        .toBe(g.log.length)
    }
    expect(winners.every((w) => w === expectedWinner), `winner "${expectedWinner}" on all six clients`).toBe(true)
    console.log(
      `final: winner=${expectedWinner} score A ${g.score[0]} - ${g.score[1]} B (voids=${voids}), ` +
        `log entries=${g.log.length}, reload recovery ms=${JSON.stringify(reloadTimes)}`,
    )
  })

  await Promise.all(pages.map((p) => p.context().close()))
})
