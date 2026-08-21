/**
 * Per-volunteer AI access code (task #148/#219's client counterpart —
 * the P0 deploy-blocker team-lead flagged: the pre-public backend
 * fails closed on `AI_ACCESS_TOKENS`, so every AI call 401s until the
 * client sends one). See server/README.md's "Client access-token
 * contract" for the full server-side picture — this file is the
 * RECOMMENDED delivery option that doc itself names: an "enter your
 * access code" gate, not a `VITE_`-baked token.
 *
 * Why sessionStorage, not localStorage or a VITE_ build-time constant:
 * - A `VITE_`-baked token both LEAKS (readable in the shipped bundle's
 *   devtools/sources) AND collapses all 5 volunteers onto one shared
 *   $1.50 budget — the whole point of the per-token spend cap is
 *   distinct codes per volunteer.
 * - sessionStorage (not localStorage): the code isn't written to disk
 *   at all — it disappears when the tab/browser closes, which is more
 *   private for a shared/borrowed pilot device than a value that
 *   persists indefinitely. Per-volunteer re-entry each session is an
 *   acceptable, honest tradeoff for a short pilot, not an oversight.
 *
 * A tiny module-level pub/sub sits alongside the plain get/set/clear so
 * `<AccessGate>` (mounted once, globally) can react the INSTANT any
 * `postJson()` call anywhere in the app discovers the stored code is
 * invalid (401/403) — without every caller needing to know the gate
 * component exists or import it directly.
 */

const STORAGE_KEY = 'nibras.aiAccessCode'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    // Private-browsing/storage-disabled edge case — treat as "no code
    // saved yet" rather than crashing; the gate will just re-prompt
    // every time in that environment, which is a correct degradation.
    return null
  }
}

export function setAccessToken(token: string): void {
  const trimmed = token.trim()
  try {
    if (trimmed) sessionStorage.setItem(STORAGE_KEY, trimmed)
  } catch {
    // Same storage-disabled fallback as above — the code simply won't
    // persist across a call; postJson still sends it for THIS call
    // since the caller re-reads immediately after setting.
  }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // No-op if storage is unavailable — nothing to clear.
  }
}

/** `hadToken: true` = a real, previously-entered code was checked and
 * rejected — a genuine "that code isn't valid" moment. `false` = there
 * was never a code entered in the first place (a first-time volunteer,
 * or one who dismissed the gate) — this is just "you need one", not
 * "the one you gave me was wrong", and must NOT show the same
 * rejection copy (found live, task #219: without this distinction, a
 * volunteer's very FIRST prompt incorrectly showed "That access code
 * isn't valid" before they had ever typed anything). */
type InvalidTokenListener = (hadToken: boolean) => void
const invalidTokenListeners = new Set<InvalidTokenListener>()

/** Called by aiService.ts's postJson the moment a request comes back
 * 401/403 (an unknown/missing/rejected code) — clears the now-known-bad
 * code (if any) and tells every subscriber (in practice, the one
 * globally-mounted <AccessGate>) to reopen, distinguishing "your code
 * was wrong" from "you don't have one yet" so the right copy shows. */
export function reportInvalidToken(): void {
  const hadToken = getAccessToken() !== null
  clearAccessToken()
  for (const listener of invalidTokenListeners) listener(hadToken)
}

/** Subscribe to "the stored code just turned out to be invalid (or
 * never existed), reopen the gate." Returns an unsubscribe function
 * (the standard React useEffect-cleanup shape). */
export function onInvalidToken(listener: InvalidTokenListener): () => void {
  invalidTokenListeners.add(listener)
  return () => invalidTokenListeners.delete(listener)
}
