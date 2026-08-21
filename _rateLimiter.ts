/**
 * Per-client rate limiter for the AI backend (task #148). Reworks the
 * original in-line limiter (server/index.ts) which keyed on
 * `req.socket.remoteAddress`. That is correct for the loopback local
 * proof, but WRONG the moment the server sits behind a proxy/CDN — every
 * request then arrives from the proxy's single IP, so one shared bucket
 * either locks everyone out together or (if that IP is exempted
 * anywhere) enforces nothing. It also resets on restart.
 *
 * Two pieces, both isolated here so a shared/persistent limiter can drop
 * in later without touching transport code:
 *   1. `getClientIp` — derive the REAL client IP correctly for the
 *      deployment, defaulting to the safe direct-connection behaviour so
 *      a misconfiguration can never accidentally trust a spoofable
 *      header.
 *   2. `createRateLimiter` — the fixed-window counter, unchanged in
 *      behaviour from the original but keyed on whatever `getClientIp`
 *      returns and factored behind a `RateLimiter` interface (so a
 *      Redis/KV implementation of the same interface swaps in for a
 *      multi-instance deploy — see server/README.md).
 *
 * SCOPE, honestly: this default implementation is in-memory and
 * per-instance (it resets on restart and does not coordinate across
 * multiple instances). For the 5-volunteer single-instance pilot that is
 * fine — and crucially the MONEY guarantee does not rest on it: the hard
 * spend cap (`_spendCap.ts`) is file-persistent and the xAI account-level
 * billing cap is the exact backstop. The limiter's job is only to blunt
 * hammering, and a restart merely grants a fresh window, never a cost
 * blow-out.
 */
import type { IncomingMessage } from 'node:http'

export interface ClientIpConfig {
  /** When false (default), use the raw socket peer — correct for a
   * direct connection and for the loopback local proof. When true,
   * derive the client IP from a trusted proxy header (see
   * `clientIpHeader`). Only enable when the server genuinely sits behind
   * exactly the proxy that sets that header; otherwise the header is a
   * spoofing vector. */
  trustProxy: boolean
  /** Header the trusted proxy sets with the real client IP. Default
   * `x-forwarded-for`. Prefer a platform's dedicated SINGLE-IP header
   * where one exists (Cloudflare `cf-connecting-ip`, generic `x-real-ip`,
   * Fly `fly-client-ip`) — those are set by the platform from the real
   * TCP peer and cannot be spoofed by the client. */
  clientIpHeader: string
  /** For a LIST-valued header (`x-forwarded-for`), which entry is the
   * real client. `'last'` (default) = the right-most = the hop the
   * trusted proxy itself appended, so a client-supplied left-most value
   * is ignored rather than trusted. `'first'` for platforms that
   * prepend/overwrite the real client as the left-most entry. Ignored
   * for single-IP headers. */
  listPosition: 'first' | 'last'
}

/** Resolve the IP the limiter should key on. Fails SAFE at every step:
 * an unset `trustProxy`, a missing header, or an empty header value all
 * fall back to the socket peer — never to "no key / unlimited". */
export function getClientIp(req: IncomingMessage, cfg: ClientIpConfig): string {
  const socketIp = req.socket.remoteAddress ?? 'unknown'
  if (!cfg.trustProxy) return socketIp

  const raw = req.headers[cfg.clientIpHeader.toLowerCase()]
  const value = Array.isArray(raw) ? raw.join(',') : raw
  if (!value) return socketIp

  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return socketIp

  const picked = cfg.listPosition === 'first' ? parts[0] : parts[parts.length - 1]
  return picked || socketIp
}

export interface RateLimiter {
  /** True when this key has exceeded the limit within the current
   * window. Increments the key's counter as a side effect. */
  isLimited(key: string): boolean
}

/** In-memory fixed-window limiter. Same window semantics as the original
 * (a hard count per key per window, no sliding/leaky refinement — plenty
 * for blunting abuse). Opportunistically evicts expired buckets so the
 * map can't grow without bound on a long-running instance. */
export function createRateLimiter(opts: { maxRequests: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, { count: number; windowStart: number }>()
  // Cheap, amortised cleanup: only sweep once the map is non-trivially
  // large, and only touch genuinely-expired entries. Keeps a busy public
  // instance from leaking memory across many distinct client IPs without
  // adding a timer.
  const CLEANUP_THRESHOLD = 5000
  function sweepExpired(now: number) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > opts.windowMs) buckets.delete(key)
    }
  }
  return {
    isLimited(key) {
      const now = Date.now()
      if (buckets.size > CLEANUP_THRESHOLD) sweepExpired(now)
      const bucket = buckets.get(key)
      if (!bucket || now - bucket.windowStart > opts.windowMs) {
        buckets.set(key, { count: 1, windowStart: now })
        return false
      }
      bucket.count++
      return bucket.count > opts.maxRequests
    },
  }
}
