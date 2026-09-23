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

/**
 * Frictionless committee/judging access (go-live, 2026-09-22, Amal-
 * approved): a judge opens a LINK that carries the shared committee code,
 * and this seeds it into the SAME sessionStorage store the gate already
 * reads — so the judge never sees the "enter your access code" prompt,
 * while the backend endpoint stays gated against anyone WITHOUT the link
 * (no code -> the server's access gate 401s). Call ONCE at startup
 * (main.tsx), before React renders, so the code is in place before the
 * first AI call and <AccessGate> never opens for a judge.
 *
 * Reads the code from EITHER the URL hash (`#access=CODE`, PREFERRED — a
 * fragment is never sent to the server, so the code stays out of the
 * frontend host's / any proxy's request logs) OR the query string
 * (`?access=CODE`, a fallback for link handlers that strip fragments).
 * After seeding, the `access` parameter is STRIPPED from the address bar
 * via history.replaceState so the code isn't left visible, bookmarked, or
 * re-shared showing — defense-in-depth (it's already in the link Amal
 * sent; this just avoids it lingering). Any OTHER params are preserved.
 *
 * The committee code is NOT a strong secret — a public SPA cannot hold one
 * (see server/api/_accessControl.ts's own note); it is a real speed-bump
 * paired with the server's rate limiter + the hard $60 global spend cap
 * that bound the damage. Its value lives ONLY in the link Amal distributes
 * plus the server's AI_COMMITTEE_CODE env — never in this source or the
 * built bundle.
 */
export function applyAccessCodeFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    // Hash first (preferred, kept out of server logs), then query string.
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const code = (hashParams.get('access') ?? url.searchParams.get('access') ?? '').trim()
    if (!code) return
    setAccessToken(code)
    // Remove the code from BOTH carriers, preserve everything else, then
    // rewrite the address bar without the code.
    hashParams.delete('access')
    url.searchParams.delete('access')
    const rebuiltHash = hashParams.toString()
    url.hash = rebuiltHash ? `#${rebuiltHash}` : ''
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    // Malformed URL / storage disabled / no history API — never block app
    // startup over the convenience link. A judge can still enter the code
    // via the gate; storage-disabled is already handled by setAccessToken.
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
