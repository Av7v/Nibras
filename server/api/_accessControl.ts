/**
 * Access gate for the AI backend (task #148, the #107 P1-c abuse
 * surface). The server has CORS (server/index.ts's Origin allowlist),
 * but CORS is enforced by BROWSERS only — a `curl`/script that reaches
 * the public URL ignores it entirely and can spend Amal's xAI budget
 * freely. This module is the real gate: every AI request must carry a
 * valid shared access token, or it is rejected before any provider call.
 *
 * Isolated the same way `_xaiTts.ts`/`_xaiChat.ts` are: a small pure
 * module with no transport knowledge, so the token source (env today; a
 * KV/secret store later) and the check can evolve independently of
 * server/index.ts's HTTP plumbing.
 *
 * FAIL CLOSED: if no tokens are configured at all, `isConfigured()` is
 * false and the server rejects EVERY AI request (503). An unconfigured
 * gate on a public paid endpoint is exactly the hole #148 exists to
 * close, so "no config" must never silently mean "open to the world".
 *
 * The token is NOT a provider key and is NOT a strong secret when the
 * client is a public static SPA (anyone who opens the deployed site's
 * devtools can read whatever token the bundle carries). It is a real
 * speed-bump against opportunistic/automated abuse (bare-URL curl,
 * scrapers) and it pairs with the two guards that actually bound the
 * DAMAGE regardless of who calls — the per-IP rate limiter and the hard
 * monthly spend cap. See server/README.md's "Access gate" note for the
 * honest tradeoff and the stronger options (a passphrase gate page, or a
 * host-level auth proxy) proposed for if/when the pilot widens.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

/** Parse the comma-separated `AI_ACCESS_TOKENS` env value into a clean
 * list. Comma-separated ON PURPOSE: one token per volunteer means a
 * single leaked/rotated token can be revoked without disrupting the
 * others (drop it from the list, restart). Empty / whitespace-only
 * entries are dropped so a trailing comma can't create a "" token that
 * would match a client sending an empty bearer. */
export function parseAccessTokens(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** SHA-256 every token before comparing. Two payoffs: (1) `timingSafeEqual`
 * requires equal-length buffers and throws otherwise — hashing makes both
 * sides a fixed 32 bytes, so a token's LENGTH never leaks via a
 * length-mismatch throw; (2) the compare runs over digest bytes, not the
 * raw secret. */
function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest()
}

/** The stable ledger/override id for a token: its SHA-256 as hex — the
 * EXACT value `identify()` returns for a request carrying that token
 * (both run through `sha256()` above). Exported so server/index.ts can
 * pre-compute the id of a NAMED code (e.g. the shared committee/judging
 * code) to key a spend-cap override on it, and be guaranteed that key
 * matches the id the spend cap is later handed for the same code — a
 * single source of truth for "token -> id", never a second, hand-rolled
 * hashing that could silently drift out of sync with the gate. */
export function hashToken(token: string): string {
  return sha256(token).toString('hex')
}

/** Pull the token out of an `Authorization: Bearer <token>` header. Case-
 * insensitive on the scheme, tolerant of surrounding whitespace. Returns
 * null for anything that isn't a well-formed bearer. */
function extractBearer(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : null
}

export interface AccessControl {
  /** True when at least one token is configured. When false the caller
   * MUST fail closed (reject every AI request). */
  isConfigured(): boolean
  /** Constant-time check of the request's bearer token against the
   * allowlist. False when unconfigured, missing, malformed, or unknown. */
  isAuthorized(req: IncomingMessage): boolean
  /** Constant-time authorize AND identify: returns a STABLE per-token id
   * (the token's SHA-256 hex — never the raw token) when the request
   * carries a valid token, else null. The per-volunteer spend cap keys
   * on this id so each volunteer's own $1.50 budget is tracked
   * separately. Same token → same id; different tokens → different ids. */
  identify(req: IncomingMessage): string | null
}

export function createAccessControl(tokens: string[]): AccessControl {
  const hashed = tokens.map(sha256)

  function identify(req: IncomingMessage): string | null {
    if (hashed.length === 0) return null
    const presented = extractBearer(req.headers['authorization'])
    if (!presented) return null
    const presentedHash = sha256(presented)
    // Compare against EVERY configured token with no early return on the
    // first match, so the number of tokens tried (and thus which token
    // matched, or that none did) is not observable via timing.
    let ok = false
    for (const h of hashed) {
      if (timingSafeEqual(presentedHash, h)) ok = true
    }
    // The id is the presented token's own hash (equal to the matched
    // configured token's hash), as hex — stable, non-reversible, safe to
    // use as a ledger key and never the raw secret.
    return ok ? presentedHash.toString('hex') : null
  }

  return {
    isConfigured() {
      return hashed.length > 0
    },
    isAuthorized(req) {
      return identify(req) !== null
    },
    identify,
  }
}
