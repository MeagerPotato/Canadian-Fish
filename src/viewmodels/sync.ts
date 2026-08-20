/**
 * Broadcast/version reconciliation — PROTOCOL.md §5, pure and unit-tested.
 *
 * - Broadcast snapshots apply iff strictly newer than the current version.
 * - /state responses (authoritative) apply when not older (equal refreshes hand).
 * - A /state refetch is needed whenever new log entries could have changed my
 *   hand: a hit ask involving my seat, or any claim.
 */
import type { PublicEvent, Seat } from '../../lib/engine/index.ts'

/** version of nothing-yet-loaded */
export const NO_VERSION = -1

/** Apply a broadcast payload only when it is strictly newer (stale ignored). */
export function shouldApplyBroadcast(currentVersion: number, incomingVersion: number): boolean {
  return incomingVersion > currentVersion
}

/** Apply an authoritative /state response unless it is strictly older. */
export function shouldApplyFetch(currentVersion: number, incomingVersion: number): boolean {
  return incomingVersion >= currentVersion
}

/** True when `entry` changes `mySeat`'s hand without telling us the cards. */
function entryAffectsHand(entry: PublicEvent, mySeat: Seat): boolean {
  if (entry.type === 'claim') return true
  if (entry.type === 'ask') return entry.hit && (entry.asker === mySeat || entry.target === mySeat)
  return false
}

/**
 * Given the previously-seen log length and the new full log, decide whether my
 * hand must be refetched. A log that shrank means a different game — resync.
 */
export function handRefetchNeeded(prevLogLength: number, log: readonly PublicEvent[], mySeat: Seat): boolean {
  if (log.length < prevLogLength) return true
  return log.slice(prevLogLength).some((entry) => entryAffectsHand(entry, mySeat))
}
