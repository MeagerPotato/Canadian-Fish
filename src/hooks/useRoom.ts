/**
 * Room lifecycle — PROTOCOL.md §5 exactly.
 *
 * - token in localStorage → GET /state immediately (reconnect target < 3 s);
 *   no token → join form.
 * - Subscribe to `room:{CODE}`; apply broadcast payloads iff version > current.
 * - Refetch /state on (re)subscribe and on visibility regain; refetch (debounced
 *   ~150 ms) when new log entries include a hit ask involving my seat or any claim.
 * - Heartbeat every 20 s while mounted.
 *
 * Mount the consuming component with `key={code}` — per-room state resets by
 * remounting, never by effect-driven resets.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Seat } from '../../lib/engine/index.ts'
import {
  apiAction,
  apiHeartbeat,
  apiJoin,
  apiLobbySwap,
  apiStart,
  apiState,
  apiVoteBot,
  friendlyMessage,
} from '../api/client.ts'
import { subscribeRoom } from '../api/realtime.ts'
import { clearToken, getToken, saveName, saveToken } from '../api/storage.ts'
import type { ClientAction, PublicRoomState } from '../api/types.ts'
import { NO_VERSION, handRefetchNeeded, shouldApplyBroadcast, shouldApplyFetch } from '../viewmodels/sync.ts'

export type RoomStage = 'loading' | 'join' | 'ready' | 'notFound' | 'error'

export interface ActOutcome {
  ok: boolean
  /** Friendly message for inline display when not ok. */
  message?: string
}

export interface RoomController {
  stage: RoomStage
  room: PublicRoomState | null
  you: { seat: Seat; name: string } | null
  hand: Card[]
  banner: string | null
  dismissBanner: () => void
  realtimeDown: boolean
  joinBusy: boolean
  joinError: string | null
  join: (name: string) => Promise<void>
  retry: () => void
  act: (action: ClientAction) => Promise<ActOutcome>
  swapSeats: (a: number, b: number) => Promise<void>
  startGame: () => Promise<void>
  voteBot: (targetSeat: number) => Promise<void>
}

const HEARTBEAT_MS = 20_000
const REFETCH_DEBOUNCE_MS = 150

export function useRoom(code: string): RoomController {
  const [stage, setStage] = useState<RoomStage>(() => (getToken(code) ? 'loading' : 'join'))
  const [room, setRoom] = useState<PublicRoomState | null>(null)
  const [you, setYou] = useState<{ seat: Seat; name: string } | null>(null)
  const [hand, setHand] = useState<Card[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [realtimeDown, setRealtimeDown] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const versionRef = useRef<number>(NO_VERSION)
  const logLenRef = useRef(0)
  const seatRef = useRef<Seat | null>(null)

  /**
   * Version-gated snapshot application. Returns true when the caller should
   * schedule a hand refetch (new hand-affecting log entries in a broadcast).
   */
  const applySnapshot = useCallback(
    (next: PublicRoomState, source: 'broadcast' | 'fetch', nextHand?: Card[]): boolean => {
      const current = versionRef.current
      const apply =
        source === 'broadcast' ? shouldApplyBroadcast(current, next.version) : shouldApplyFetch(current, next.version)
      if (!apply) return false
      const prevLogLen = logLenRef.current
      const nextLog = next.game?.log ?? []
      versionRef.current = next.version
      logLenRef.current = nextLog.length
      setRoom(next)
      if (nextHand) setHand(nextHand)
      const mySeat = seatRef.current
      return source === 'broadcast' && mySeat !== null && handRefetchNeeded(prevLogLen, nextLog, mySeat)
    },
    [],
  )

  const fetchState = useCallback(async () => {
    const token = getToken(code)
    if (!token) return
    const result = await apiState(code, token)
    if (result.ok) {
      seatRef.current = result.data.you.seat
      setYou(result.data.you)
      applySnapshot(result.data.room, 'fetch', result.data.hand)
      setStage('ready')
    } else if (result.error.code === 'ROOM_NOT_FOUND') {
      setStage('notFound')
    } else if (result.error.code === 'BAD_TOKEN') {
      clearToken(code)
      seatRef.current = null
      setYou(null)
      setStage('join')
    } else {
      setBanner(friendlyMessage(result.error))
      setStage((s) => (s === 'loading' ? 'error' : s))
    }
  }, [code, applySnapshot])

  // Mount: initial fetch, realtime subscription, heartbeat, visibility resync.
  useEffect(() => {
    let refetchTimer: number | null = null
    const scheduleRefetch = () => {
      if (refetchTimer !== null) return
      refetchTimer = window.setTimeout(() => {
        refetchTimer = null
        void fetchState()
      }, REFETCH_DEBOUNCE_MS)
    }

    // Kick off the initial /state fetch on the next tick (reconnect < 3 s).
    const kickoff = window.setTimeout(() => {
      if (getToken(code)) void fetchState()
    }, 0)

    const unsubscribe = subscribeRoom(code, {
      onRoom: (snapshot) => {
        if (applySnapshot(snapshot, 'broadcast')) scheduleRefetch()
      },
      onStatus: (status) => {
        setRealtimeDown(status === 'dropped')
        if (status === 'connected' && getToken(code)) scheduleRefetch()
      },
    })

    const heartbeat = window.setInterval(() => {
      const token = getToken(code)
      if (!token) return
      void apiHeartbeat(code, token).then((result) => {
        if (result.ok && result.data.version > versionRef.current) scheduleRefetch()
      })
    }, HEARTBEAT_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && getToken(code)) void fetchState()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearTimeout(kickoff)
      unsubscribe()
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      if (refetchTimer !== null) window.clearTimeout(refetchTimer)
    }
  }, [code, fetchState, applySnapshot])

  const join = useCallback(
    async (name: string) => {
      setJoinBusy(true)
      setJoinError(null)
      try {
        const result = await apiJoin(code, name, getToken(code))
        if (result.ok) {
          saveToken(code, result.data.playerToken)
          saveName(name)
          setStage('loading')
          await fetchState()
        } else if (result.error.code === 'ROOM_NOT_FOUND') {
          setStage('notFound')
        } else {
          setJoinError(friendlyMessage(result.error))
        }
      } finally {
        setJoinBusy(false)
      }
    },
    [code, fetchState],
  )

  const act = useCallback(
    async (action: ClientAction): Promise<ActOutcome> => {
      const token = getToken(code)
      if (!token) return { ok: false, message: 'You are not seated at this table.' }
      const result = await apiAction(code, token, action)
      if (result.ok) {
        // Fallback resync in case the broadcast is missed (realtime hiccup).
        window.setTimeout(() => void fetchState(), REFETCH_DEBOUNCE_MS)
        return { ok: true }
      }
      return { ok: false, message: friendlyMessage(result.error) }
    },
    [code, fetchState],
  )

  const swapSeats = useCallback(
    async (a: number, b: number) => {
      const token = getToken(code)
      if (!token) return
      const result = await apiLobbySwap(code, token, a, b)
      if (!result.ok) setBanner(friendlyMessage(result.error))
    },
    [code],
  )

  const startGame = useCallback(async () => {
    const token = getToken(code)
    if (!token) return
    const result = await apiStart(code, token)
    if (!result.ok) setBanner(friendlyMessage(result.error))
  }, [code])

  const voteBot = useCallback(
    async (targetSeat: number) => {
      const token = getToken(code)
      if (!token) return
      const result = await apiVoteBot(code, token, targetSeat, true)
      if (!result.ok) setBanner(friendlyMessage(result.error))
    },
    [code],
  )

  const dismissBanner = useCallback(() => setBanner(null), [])
  const retry = useCallback(() => {
    setBanner(null)
    setStage('loading')
    void fetchState()
  }, [fetchState])

  return useMemo(
    () => ({
      stage,
      room,
      you,
      hand,
      banner,
      dismissBanner,
      realtimeDown,
      joinBusy,
      joinError,
      join,
      retry,
      act,
      swapSeats,
      startGame,
      voteBot,
    }),
    [stage, room, you, hand, banner, dismissBanner, realtimeDown, joinBusy, joinError, join, retry, act, swapSeats, startGame, voteBot],
  )
}
