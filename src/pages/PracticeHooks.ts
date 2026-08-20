/**
 * Shared hook for the drill pages: a ref that always carries the latest
 * value/callback. Updated in a post-render effect (never during render, per
 * react-hooks/refs), so document-level key listeners and long-lived timers
 * can call the freshest closure without re-arming on every state change.
 */
import { useEffect, useRef, type RefObject } from 'react'

export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/**
 * A round-start timestamp captured in a mount effect (render stays pure).
 * Read it only from event handlers/timers — it is 0 during the first paint.
 */
export function useStartedAt(): RefObject<number> {
  const ref = useRef(0)
  useEffect(() => {
    if (ref.current === 0) ref.current = Date.now()
  }, [])
  return ref
}
