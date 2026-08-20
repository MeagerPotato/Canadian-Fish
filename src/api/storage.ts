/**
 * localStorage identity keys — PROTOCOL.md §5.
 * `cf:name` (display name) and `cf:room:{CODE}:token` (seat token per room).
 * All access is guarded: private browsing must not crash the app.
 */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — session continues in memory */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const NAME_KEY = 'cf:name'

function tokenKey(code: string): string {
  return `cf:room:${code.toUpperCase()}:token`
}

export function loadName(): string {
  return read(NAME_KEY) ?? ''
}

export function saveName(name: string): void {
  const trimmed = name.trim()
  if (trimmed.length > 0) write(NAME_KEY, trimmed)
}

export function getToken(code: string): string | null {
  return read(tokenKey(code))
}

export function saveToken(code: string, token: string): void {
  write(tokenKey(code), token)
}

export function clearToken(code: string): void {
  remove(tokenKey(code))
}
