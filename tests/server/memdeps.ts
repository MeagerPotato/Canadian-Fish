/**
 * In-memory Deps for the server tests (PROTOCOL.md §8): Map-backed rooms with
 * real version-CAS semantics (including simulated conflicts), deterministic
 * now()/randomToken(), and captured broadcasts. Rooms are JSON round-tripped on
 * load/save to emulate the jsonb serialization boundary. Tests own the store
 * and may reach into rows directly via rowByCode().
 */
import type { Deps, RoomRow, RoomState, RoomStatus } from '../../server/deps.ts'

export interface BroadcastCall {
  topic: string
  payloads: unknown[]
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export class MemDeps implements Deps {
  private rows = new Map<string, RoomRow>()
  private nextId = 0
  private tokenCounter = 0
  broadcasts: BroadcastCall[] = []
  rate = new Map<string, number>()
  nowMs = 1_750_000_000_000
  saveCalls = 0
  /** While > 0, saveRoomCAS fails and a competing writer bumps the version. */
  failNextSaves = 0

  advance(ms: number): void {
    this.nowMs += ms
  }

  /** The LIVE stored row (not a copy) — tests may manipulate it directly. */
  rowByCode(code: string): RoomRow {
    for (const row of this.rows.values()) if (row.code === code) return row
    throw new Error(`no room ${code} in the store`)
  }

  /** Every broadcast payload sent to `room:{code}`, flattened, in order. */
  payloadsFor(code: string): unknown[] {
    return this.broadcasts.filter((b) => b.topic === `room:${code}`).flatMap((b) => b.payloads)
  }

  async loadRoomByCode(code: string): Promise<RoomRow | null> {
    for (const row of this.rows.values()) if (row.code === code) return clone(row)
    return null
  }

  async insertRoom(row: { code: string; status: RoomStatus; state: RoomState }) {
    for (const existing of this.rows.values()) {
      if (existing.code === row.code) return { ok: false as const, reason: 'DUPLICATE_CODE' as const }
    }
    const id = `room-${++this.nextId}`
    this.rows.set(id, clone({ id, code: row.code, status: row.status, state: row.state, version: 0 }))
    return { ok: true as const, id }
  }

  async saveRoomCAS(
    id: string,
    expectedVersion: number,
    status: RoomStatus,
    state: RoomState,
    newVersion: number,
  ): Promise<boolean> {
    this.saveCalls++
    const row = this.rows.get(id)
    if (!row) return false
    if (this.failNextSaves > 0) {
      this.failNextSaves--
      row.version += 1 // the simulated competing writer landed first
      return false
    }
    if (row.version !== expectedVersion) return false
    this.rows.set(id, clone({ ...row, status, state, version: newVersion }))
    return true
  }

  async bumpRateLimit(bucket: string): Promise<number> {
    const next = (this.rate.get(bucket) ?? 0) + 1
    this.rate.set(bucket, next)
    return next
  }

  async broadcast(topic: string, payloads: unknown[]): Promise<void> {
    this.broadcasts.push({ topic, payloads: clone(payloads) })
  }

  async countRooms(): Promise<number> {
    return this.rows.size
  }

  now(): number {
    return this.nowMs
  }

  randomToken(): string {
    // Deterministic but well-spread 32-byte hex stream (LCG per byte).
    this.tokenCounter++
    let x = (this.tokenCounter * 2654435761) % 4294967296
    const bytes: string[] = []
    for (let i = 0; i < 32; i++) {
      x = (x * 1103515245 + 12345) % 2147483648
      bytes.push((x & 0xff).toString(16).padStart(2, '0'))
    }
    return bytes.join('')
  }

  async sha256hex(input: string): Promise<string> {
    // Web Crypto (available in the Node test runtime): deterministic real SHA-256.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  }
}
