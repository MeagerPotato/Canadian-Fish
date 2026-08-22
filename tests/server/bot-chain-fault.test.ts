/**
 * The loud-failure half of the `runBotChain` fix (server/room.ts).
 *
 * `if (!r.ok) break` used to abandon the bot chain without a trace: the room stayed
 * `status: 'playing'`, the seat that had to move was a bot that could not move, and nothing —
 * no log line, no broadcast, no status — said so. The room hung there forever and GameOver
 * never rendered. These tests hand the chain a deliberately illegal action and prove the
 * failure is now observable three ways: an operator log line, a `BotChainFault` on the
 * broadcast, and a `stop: 'refused'` on the chain result.
 *
 * The bot module is mocked so the illegal action is injectable; by default the mock delegates to
 * the real `decide`, so the healthy control in this file is the genuine chain.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { legalAsks, newGame } from '../../lib/engine/index.ts'
import type { GameAction, GameState } from '../../lib/engine/index.ts'
import type { RoomState, SeatMeta } from '../../server/deps.ts'
import type { PublicRoomState } from '../../server/protocol.ts'
import { BOT_LAST_SEEN } from '../../server/protocol.ts'
import { MemDeps } from './memdeps.ts'
import { post } from './util.ts'

/** Armed by a test to make the next `decide` call return an action `reduce` will refuse. */
const rig = vi.hoisted(() => ({ illegal: null as GameAction | null }))

vi.mock('../../server/bots.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/bots.ts')>()
  return {
    ...actual,
    decide: (...args: Parameters<typeof actual.decide>) => rig.illegal ?? actual.decide(...args),
  }
})

// Imported after the mock declaration on purpose — vi.mock is hoisted above both.
const { runBotChain } = await import('../../server/room.ts')

const NOW = 1_750_000_000_000
const ROOM = { id: 'room-42', code: 'QRSTUV' }

function allBotRoom(game: GameState): RoomState {
  const seats: SeatMeta[] = Array.from({ length: 6 }, (_, s) => ({
    name: `Bot ${s}`,
    tokenHash: null,
    isBot: true,
    botDifficulty: 'medium' as const,
    lastSeen: BOT_LAST_SEEN,
  }))
  return { seats, game, roomSeed: 'fault-seed', hostSeat: 0, createdAt: NOW, pendingVote: null }
}

beforeEach(() => {
  rig.illegal = null
})

describe('a refused bot action is loud, not a silent hang', () => {
  it('logs the action, code, seat, phase and room id, and reports stop: refused', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const game = newGame('fault-unit') // turn is seat 0, which is a bot here
      expect(game.turn).toBe(0)
      // An action stamped with the wrong seat: the simplest reproduction of "the bot module
      // emitted something reduce() will not take", without depending on the bots' real choices.
      rig.illegal = { type: 'ask', seat: 3, target: 1, card: '2C' }

      const chain = runBotChain('playing', allBotRoom(game), NOW, ROOM)

      expect(chain.stop).toBe('refused')
      expect(chain.steps).toHaveLength(0)
      expect(chain.state.game).toEqual(game) // nothing half-applied
      expect(chain.fault).toEqual({
        reason: 'refused',
        seat: 0,
        phase: 'playing',
        moveIndex: 0,
        actionType: 'ask',
        code: 'NOT_YOUR_TURN',
      })

      expect(error).toHaveBeenCalledTimes(1)
      const [message, detail] = error.mock.calls[0] as [string, Record<string, unknown>]
      expect(message).toContain('bot chain refused')
      expect(detail).toMatchObject({
        room: ROOM.id,
        code: ROOM.code,
        seat: 0,
        turn: 0,
        phase: 'playing',
        moveIndex: 0,
        action: rig.illegal,
        errorCode: 'NOT_YOUR_TURN',
      })
      expect(typeof detail.errorMessage).toBe('string')
    } finally {
      error.mockRestore()
    }
  })

  it('surfaces the fault on the broadcast and leaves the room playing, not finished', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const deps = new MemDeps()
      const created = await post(deps, '/api/create-room', { name: 'Solo', fillBots: 5 })
      const code = created.body.code as string
      const token = created.body.playerToken as string
      expect((await post(deps, '/api/start', { code, token })).status).toBe(200)

      // Healthy control: the real bots ran (or handed off), so no snapshot grew a botFault key.
      for (const p of deps.payloadsFor(code) as PublicRoomState[]) {
        expect(Object.keys(p).sort()).toEqual([
          'code',
          'game',
          'hostSeat',
          'paused',
          'pendingVote',
          'seats',
          'status',
          'version',
        ])
      }
      expect(error).not.toHaveBeenCalled()

      // Hand the turn to a bot seat, then poison the bot.
      const row = deps.rowByCode(code)
      const before = row.state.game as GameState
      row.state.game = { ...before, turn: 2 }
      rig.illegal = { type: 'ask', seat: 5, target: 0, card: '2C' }

      const broadcastsBefore = deps.broadcasts.length
      const hb = await post(deps, '/api/heartbeat', { code, token })
      expect(hb.status).toBe(200)

      // 1. The operator log fired.
      expect(error).toHaveBeenCalledTimes(1)
      expect((error.mock.calls[0][1] as Record<string, unknown>).seat).toBe(2)

      // 2. Clients were told: a heartbeat that would otherwise have been silent broadcast the
      //    fault (nothing about connectivity changed).
      expect(deps.broadcasts.length).toBe(broadcastsBefore + 1)
      const payloads = deps.payloadsFor(code) as PublicRoomState[]
      const last = payloads[payloads.length - 1]
      expect(last.botFault).toEqual({
        reason: 'refused',
        seat: 2,
        phase: 'playing',
        moveIndex: before.moveIndex,
        actionType: 'ask',
        code: 'NOT_YOUR_TURN',
      })

      // 3. The refused action's card never reaches the wire — it was never announced, so
      //    publishing it would leak a hidden hand. Only the action *kind* travels.
      expect(JSON.stringify(last.botFault)).not.toContain('2C')

      // The room stays `playing`. It is NOT marked finished or errored, deliberately:
      //   - `finished` would fabricate an outcome — GameOver renders a winner from a game that
      //     has not ended, with hands and scores mid-play.
      //   - a new `'errored'` status is not available to fix this here: RoomStatus lives in
      //     server/deps.ts and the rooms table pins it with
      //     `check (status in ('lobby','playing','finished'))`
      //     (supabase/migrations/0001_init_rooms_rls_expiry.sql:9), so writing one would fail the
      //     CAS save and turn every request into a 409 — a worse, noisier hang.
      // Staying `playing` also keeps the stall self-healing: each heartbeat re-runs the chain,
      // which either recovers or re-raises the alarm.
      const after = deps.rowByCode(code)
      expect(after.status).toBe('playing')
      expect((after.state.game as GameState).moveIndex).toBe(before.moveIndex)
      expect(last.status).toBe('playing')
    } finally {
      error.mockRestore()
    }
  })

  it('surfaces the fault through /action too, without failing the human request', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const deps = new MemDeps()
      const created = await post(deps, '/api/create-room', { name: 'Solo', fillBots: 5 })
      const code = created.body.code as string
      const token = created.body.playerToken as string
      await post(deps, '/api/start', { code, token })
      const game = deps.rowByCode(code).state.game as GameState
      expect(game.turn).toBe(0) // the human seat; otherwise the ask below is not theirs to make

      // Seat 0's own ask is legal and must still be accepted; only the bots that follow break.
      const miss = legalAsks(game, 0).find((a) => !game.hands[a.target].includes(a.card))
      expect(miss).toBeDefined()
      rig.illegal = { type: 'ask', seat: 4, target: 0, card: '2C' }

      const r = await post(deps, '/api/action', {
        code,
        token,
        action: { type: 'ask', target: miss?.target, card: miss?.card },
      })
      expect(r.status).toBe(200) // the human's move landed
      expect(error).toHaveBeenCalledTimes(1)

      const payloads = deps.payloadsFor(code) as PublicRoomState[]
      const last = payloads[payloads.length - 1]
      expect(last.botFault?.reason).toBe('refused')
      expect(last.botFault?.code).toBe('NOT_YOUR_TURN')
      // The fault rides the LAST entry; the human's own step is a clean snapshot.
      expect(payloads[payloads.length - 2].botFault).toBeUndefined()
      expect((deps.rowByCode(code).state.game as GameState).moveIndex).toBe(game.moveIndex + 1)
    } finally {
      error.mockRestore()
    }
  })
})
