/**
 * Deno edge entry for the room server. Builds the real Supabase-backed Deps and
 * delegates every request to the portable router in server/handlers.ts.
 *
 * Excluded from the repo's tsc/eslint (Deno globals + npm: specifier); Deno
 * checks it at deploy time. All logic lives in server/ — keep this file small.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { route } from '../../../server/handlers.ts'
import type { Deps, RoomRow, RoomState, RoomStatus } from '../../../server/deps.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const deps: Deps = {
  async loadRoomByCode(code) {
    const { data, error } = await db
      .from('rooms')
      .select('id,code,status,state,version')
      .eq('code', code)
      .maybeSingle()
    if (error || !data) return null
    return {
      id: data.id as string,
      code: data.code as string,
      status: data.status as RoomStatus,
      state: data.state as RoomState,
      version: data.version as number,
    } satisfies RoomRow
  },

  async insertRoom(row) {
    const { data, error } = await db
      .from('rooms')
      .insert({ code: row.code, status: row.status, state: row.state, version: 0 })
      .select('id')
      .single()
    if (error || !data) return { ok: false, reason: 'DUPLICATE_CODE' }
    return { ok: true, id: data.id as string }
  },

  async saveRoomCAS(id, expectedVersion, status, state, newVersion) {
    // Optimistic CAS: update guarded on id + version; success iff exactly 1 row.
    const { data, error } = await db
      .from('rooms')
      .update({ status, state, version: newVersion, last_activity: new Date().toISOString() })
      .eq('id', id)
      .eq('version', expectedVersion)
      .select('id')
    return !error && Array.isArray(data) && data.length === 1
  },

  async bumpRateLimit(bucket) {
    // PostgREST cannot express an atomic upsert-increment without an RPC, so:
    // fetch + version-guarded update (2 attempts) with an insert fallback. A
    // rare interleaving can miscount by one, which is acceptable for limiting.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data } = await db.from('rate_limits').select('count').eq('bucket', bucket).maybeSingle()
      if (!data) {
        const ins = await db
          .from('rate_limits')
          .insert({ bucket, count: 1, window_start: new Date().toISOString() })
        if (!ins.error) return 1
        continue // lost the insert race — retry the update path
      }
      const prev = data.count as number
      const upd = await db
        .from('rate_limits')
        .update({ count: prev + 1 })
        .eq('bucket', bucket)
        .eq('count', prev)
        .select('count')
      if (!upd.error && Array.isArray(upd.data) && upd.data.length === 1) return prev + 1
    }
    // Both CAS attempts raced: unguarded best-effort increment (documented above).
    const { data } = await db.from('rate_limits').select('count').eq('bucket', bucket).maybeSingle()
    const prev = data ? (data.count as number) : 0
    await db.from('rate_limits').update({ count: prev + 1 }).eq('bucket', bucket)
    return prev + 1
  },

  async broadcast(topic, payloads) {
    if (payloads.length === 0) return
    try {
      await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: payloads.map((payload) => ({ topic, event: 'room', payload })),
        }),
      })
    } catch (err) {
      // The mutation is already persisted; clients resync via GET /state. A
      // failed realtime push must not make the caller believe the move failed.
      console.error('broadcast failed', err)
    }
  },

  async countRooms() {
    const { count } = await db.from('rooms').select('id', { count: 'exact', head: true })
    return count ?? 0
  },

  now: () => Date.now(),

  randomToken() {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return hex(bytes)
  },

  async sha256hex(input) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return hex(new Uint8Array(digest))
  },
}

Deno.serve((req: Request) => route(req, deps))
