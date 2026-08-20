/**
 * Broadcast/version reconciliation — PROTOCOL.md §5, pure and unit-tested.
 *
 * SECURITY (SECURITY_REVIEW F1): the room broadcast channel is a public topic
 * that anyone holding the (public) anon key can write to. Broadcast payloads are
 * therefore UNTRUSTED and are never rendered and never advance our version —
 * they are only a hint that the server may have newer state. Everything shown to
 * the player comes from GET /state, which is keyed to our own playerToken.
 *
 * - A broadcast hint schedules an authoritative /state refetch when it claims a
 *   version newer than the one /state last gave us.
 * - /state responses (authoritative) apply when not older (equal refreshes hand).
 * - A /state refetch is also needed whenever new log entries could have changed
 *   my hand: a hit ask involving my seat, or any claim.
 */
import type { PublicEvent, Seat } from '../../lib/engine/index.ts'

/** version of nothing-yet-loaded */
export const NO_VERSION = -1

/**
 * Should an untrusted broadcast hint trigger an authoritative /state refetch?
 *
 * The hint's version is compared but never stored: a forged huge version costs
 * at most one extra fetch, and can never wedge the client (F1/F3) because only
 * /state advances `currentVersion`.
 */
export function shouldRefetchOnHint(currentVersion: number, hintVersion: number): boolean {
  return hintVersion > currentVersion
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
