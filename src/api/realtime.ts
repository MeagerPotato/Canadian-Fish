/**
 * Realtime subscription — PROTOCOL.md §4.
 * One public broadcast channel per room: `room:{CODE}`, one event type `room`.
 * Clients never subscribe to postgres_changes. Auto-retries with backoff when
 * the channel drops.
 *
 * SECURITY (SECURITY_REVIEW F1): this is a PUBLIC topic — anyone with the
 * (public) anon key and the room code can publish to it. We therefore treat a
 * message as nothing more than "the server may have state newer than version N"
 * and deliberately DO NOT hand the payload to the app: the only thing that
 * escapes this module is the claimed version number. Rendered state always comes
 * from GET /state, which is authenticated by the caller's playerToken.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.ts'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

export type RealtimeStatus = 'connecting' | 'connected' | 'dropped'

export interface RoomSubscriptionHandlers {
  /**
   * An untrusted "state may have advanced to `hintVersion`" nudge. Never treat
   * it as data — the caller refetches /state to learn what actually happened.
   */
  onHint: (hintVersion: number) => void
  onStatus: (status: RealtimeStatus) => void
}

/**
 * Subscribe to a room's broadcast channel. Returns an unsubscribe function.
 * Re-subscribes automatically (2s, 4s, 8s… capped 15s) after errors/closures.
 */
export function subscribeRoom(code: string, handlers: RoomSubscriptionHandlers): () => void {
  const topic = `room:${code.toUpperCase()}`
  const supabase = getClient()
  let disposed = false
  let retryTimer: number | null = null
  let attempt = 0
  let channel: ReturnType<SupabaseClient['channel']> | null = null

  const clearRetry = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleRetry = () => {
    if (disposed || retryTimer !== null) return
    const delay = Math.min(15000, 2000 * 2 ** Math.min(attempt, 3))
    attempt += 1
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  const teardown = () => {
    if (channel) {
      const c = channel
      channel = null
      void supabase.removeChannel(c)
    }
  }

  const connect = () => {
    if (disposed) return
    teardown()
    handlers.onStatus('connecting')
    channel = supabase.channel(topic)
    channel.on('broadcast', { event: 'room' }, (message) => {
      // Read ONLY the version off an untrusted payload; discard everything else.
      const version = (message.payload as { version?: unknown } | undefined)?.version
      if (typeof version === 'number' && Number.isFinite(version)) handlers.onHint(version)
    })
    channel.subscribe((status) => {
      if (disposed) return
      if (status === 'SUBSCRIBED') {
        attempt = 0
        handlers.onStatus('connected')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onStatus('dropped')
        scheduleRetry()
      }
    })
  }

  connect()

  return () => {
    disposed = true
    clearRetry()
    teardown()
  }
}
