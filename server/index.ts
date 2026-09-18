/**
 * Runnable local backend for Nibras's AI endpoints. Started as just
 * `POST /voice` (task #106, 2026-08-13); task #151 (2026-08-14) added
 * `POST /mindmap` — the first two of server/README.md's documented
 * endpoints to actually run, rather than stay reference-only scaffold.
 * This file is transport + guards ONLY — HTTP parsing, CORS, rate
 * limiting, request validation — and delegates each endpoint's actual
 * logic to its own `api/*.ts` handler (`handleVoiceRequest`,
 * `handleMindMapRequest` — both platform-agnostic on purpose: a future
 * serverless function would call these same functions from its own
 * handler shape, nothing here would need to change). See each
 * handler's own header for its provider/contract details.
 *
 * Run it: `node --env-file=server/.env server/index.ts` (or
 * `npm run server`, which does the same thing) — `--env-file` is
 * Node's own built-in loader (stable since Node 22), so
 * `AI_VOICE_API_KEY` reaches `process.env` with zero extra
 * dependencies. Node 24's native TypeScript support (type-stripping)
 * runs this file directly, no ts-node/tsx/build step.
 *
 * BIND HOST: defaults to 127.0.0.1 (loopback) for local runs, so a dev
 * machine is never network-reachable. Set HOST=0.0.0.0 for the approved
 * public deploy (#216), where this same service ALSO serves the built
 * client (dist/) so the client and API share ONE origin (no CORS). HTTPS
 * and secrets-at-rest come from the host platform (see server/README.md's
 * deploy section), not this file.
 *
 * Security/cost guards (mandatory per the brief — a public paid
 * endpoint with none of these is a real financial-risk surface) —
 * shared by EVERY route below, not just `/voice`. Order in the request
 * pipeline: rate limit -> access gate -> spend cap -> handler.
 * - POST-only, an explicit route allowlist (`/voice`, `/mindmap`) —
 *   anything else is 404/405.
 * - Origin allowlist (CORS) — nibrasapp.com + localhost/127.0.0.1 only.
 *   NOTE CORS is a BROWSER control only; a curl/script ignores it. The
 *   access gate below, not CORS, is what actually stops a non-browser
 *   caller from spending the budget. (localhost is also what makes THIS
 *   local proof work: the Vite client and this server run on different
 *   ports, which the same-origin policy treats as cross-origin.)
 * - Request body size cap + a per-route text-length cap, enforced
 *   BEFORE the full body is even buffered for the size cap (a
 *   Content-Length pre-check, then a hard byte ceiling while
 *   streaming) — not just after JSON.parse.
 * - Access gate (#148, `_accessControl.ts`): every AI request must
 *   carry a valid shared bearer token (`AI_ACCESS_TOKENS`, one per
 *   volunteer). FAILS CLOSED when unset — an unconfigured gate rejects
 *   everything (503) rather than silently opening the endpoint.
 * - Per-volunteer hard spend cap (#148, `_spendCap.ts`): each call's
 *   cost is estimated and summed PER ACCESS TOKEN in a FILE-PERSISTED
 *   ledger, so a restart can't reset anyone's budget. A call that would
 *   cross that volunteer's `PER_TOKEN_CAP_USD` (default $1.50) is refused
 *   (402, with a `reason` the client turns into an honest "session limit
 *   reached" message) before it bills. A backend `GLOBAL_CAP_USD`
 *   backstop (default $10 = 5 x $1.50 + margin) caps the sum across all
 *   tokens; the xAI account-level billing cap is the exact backstop
 *   above both (README).
 * - Per-client rate limit (#148, `_rateLimiter.ts`): fixed window,
 *   shared across every route (one bucket per client, not per-route),
 *   keyed on the CORRECTLY derived client IP (proxy-aware) rather than
 *   the raw socket peer — so it stays correct behind one proxy/CDN
 *   instead of lumping everyone into the proxy's single IP. In-memory +
 *   per-instance by default (fine for the single-instance pilot; the
 *   money guarantee rests on the persistent spend cap + the account cap,
 *   not on this); a shared store implements the same interface for a
 *   multi-instance deploy.
 * - The API key is read once from `process.env.AI_VOICE_API_KEY` (by
 *   `_xaiTts.ts`/`_xaiChat.ts`, unchanged) and is never logged,
 *   echoed, or included in any response. The access token is likewise
 *   never logged. Request headers and bodies are never logged either —
 *   only method + path + status + timing, on every request.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { extname, normalize, resolve, sep } from 'node:path'
import { handleVoiceRequest } from './api/voice.ts'
import { handleMindMapRequest } from './api/mindmap.ts'
import { handleSttRequest } from './api/stt.ts'
import { handleSummarizeRequest } from './api/summarize.ts'
import { handleExplainRequest } from './api/explain.ts'
import { handleTranslateRequest } from './api/translate.ts'
import { handleAskRequest, MAX_QUESTION_CHARS } from './api/ask.ts'
import { isAskPageId, getAskContext, type AskPageId } from './api/_askContext.ts'
import { normalizeSttMime } from './api/_xaiStt.ts'
import type { XaiTtsRequest } from './api/_xaiTts.ts'
import { createAccessControl, parseAccessTokens } from './api/_accessControl.ts'
import { createRateLimiter, getClientIp } from './api/_rateLimiter.ts'
import { actualChatCostUsd, createSpendCap, estimateChatCostUsd, estimateMindMapCostUsd, estimateSttCostUsd, estimateVoiceCostUsd, type SpendBlockReason } from './api/_spendCap.ts'

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const PORT = Number(process.env.PORT) || 8787
const HOST = (process.env.HOST ?? '').trim() || '127.0.0.1' // loopback by default; unset/blank -> loopback; set HOST=0.0.0.0 (explicit, non-blank) only for the approved deploy (see file header)

// nibrasapp.com (+ www) for the real future deploy, localhost/127.0.0.1
// on any port for this local proof (the Vite client's own dev/preview
// port differs from this server's, so it's genuinely cross-origin).
const ALLOWED_ORIGIN = /^https:\/\/(www\.)?nibrasapp\.com$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const MAX_BODY_BYTES = 50_000 // covers the text routes' caps below + JSON overhead
const MAX_TEXT_CHARS = 15_000 // mirrors _xaiTts.ts's own MAX_CHARS — rejected here too, before ever reaching the provider call
const MAX_MINDMAP_CHARS = 4_000 // mirrors mindmap.ts's own MAX_MINDMAP_CHARS — see that file for why this is tighter than MAX_TEXT_CHARS

// /stt carries base64-encoded audio, so it needs a much larger body cap
// than the text routes. 3 MB of body ≈ ~2.2 MB base64 ≈ ~1.6 MB audio —
// plenty for a short reading clip (a 60s MP3 is well under that).
const MAX_STT_BODY_BYTES = 3_000_000
// Conservative pre-authorization ceiling for an STT call's audio length.
// STT bills per audio-second; the ledger is trued up to the provider's
// reported `duration` after the call, so this only needs to be a sane
// upper bound for the pre-check (a reading clip is far shorter). At
// $0.10/hr, 120s ≈ $0.0033 — trivial.
const MAX_STT_SECONDS = 120

/** Read a numeric env var, honouring an explicit 0 (so a cap/limit CAN
 * be set to zero as a deliberate kill-switch) and falling back only when
 * unset/blank/non-numeric — unlike `Number(x) || fallback`, which would
 * turn a real 0 back into the default. */
function numEnv(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// --- Abuse/cost guards (#148) — access gate, hard spend cap, and the
// proxy-correct rate limiter, each isolated in its own api/_*.ts module
// (see those files' headers). Instantiated once here from env; this file
// only orchestrates the ORDER they run in (see the request pipeline
// below). ---

// Access gate: comma-separated shared tokens (one per volunteer, so a
// single one can be revoked without disrupting the rest). UNSET => fail
// closed: every AI request is refused (503), never silently open.
const accessControl = createAccessControl(parseAccessTokens(process.env.AI_ACCESS_TOKENS))

// Per-volunteer hard spend cap (USD), file-persistent so a restart can't
// reset anyone's budget. Default $1.50 PER access token (Amal's design),
// PLUS a backend GLOBAL backstop across all tokens (default $10 = 5 x
// $1.50 + margin). Both are config constants; '0' on either is a hard
// kill-switch. The xAI account-level billing cap is the EXACT backstop
// above these (see server/README.md).
const PER_TOKEN_CAP_USD = numEnv('PER_TOKEN_CAP_USD', 1.5)
const GLOBAL_CAP_USD = numEnv('GLOBAL_CAP_USD', 10)
const USAGE_FILE = process.env.USAGE_FILE || fileURLToPath(new URL('./.usage/usage.json', import.meta.url))

// 2026-09-15 (Amal-approved, via team-lead, task #537): the internal
// token used to PRODUCE the guide videos hit its own $1.50 cap after 237
// real TTS calls, blocking 3 held audio regens. Amal approved a generous
// cap for THIS one non-volunteer, dev/production token — CRITICAL: the
// $1.50 PER_TOKEN_CAP_USD default above is untouched, so every volunteer
// / committee code is still governed by exactly the same protective
// limit it always was. The override is keyed by the token's SHA-256 hash
// (`AI_PRODUCTION_TOKEN_HASH`, non-secret — it's a one-way hash, the same
// kind the ledger itself already stores in plaintext), never the raw
// token, so no credential needs to live in a second place. Unset (as it
// MUST be before real go-live — see #526/#435) => `perTokenCapOverridesUsd`
// is undefined => byte-identical to pre-#537 behaviour.
const PRODUCTION_TOKEN_CAP_USD = numEnv('PRODUCTION_TOKEN_CAP_USD', 10)
const productionTokenHash = process.env.AI_PRODUCTION_TOKEN_HASH
const perTokenCapOverridesUsd = productionTokenHash ? { [productionTokenHash]: PRODUCTION_TOKEN_CAP_USD } : undefined

const spendCap = createSpendCap({
  perTokenCapUsd: PER_TOKEN_CAP_USD,
  globalCapUsd: GLOBAL_CAP_USD,
  usageFile: USAGE_FILE,
  perTokenCapOverridesUsd,
})

// Rate limiter: fixed window per client. Keyed on the correctly derived
// client IP (clientIpConfig below), not the raw socket peer, so it stays
// correct behind one proxy.
const RATE_LIMIT_WINDOW_MS = numEnv('RATE_LIMIT_WINDOW_MS', 60_000)
const RATE_LIMIT_MAX_REQUESTS = numEnv('RATE_LIMIT_MAX_REQUESTS', 20) // per client per window — generous for real interactive use, restrictive against hammering
const rateLimiter = createRateLimiter({ maxRequests: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS })

// How to find the real client IP. Default: trust the socket peer (correct
// for the loopback proof and any direct connection). Behind a proxy/CDN,
// set TRUST_PROXY=1 and CLIENT_IP_HEADER to the header that proxy sets
// (e.g. cf-connecting-ip on Cloudflare, x-real-ip generically); for a
// list-valued x-forwarded-for, CLIENT_IP_LIST_POSITION picks first/last
// (default last = the hop the trusted proxy appended, ignoring a
// client-spoofed left-most value). See _rateLimiter.ts + README.
const clientIpConfig = {
  trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY ?? ''),
  clientIpHeader: process.env.CLIENT_IP_HEADER || 'x-forwarded-for',
  listPosition: process.env.CLIENT_IP_LIST_POSITION === 'first' ? ('first' as const) : ('last' as const),
}

/** Handles CORS headers + OPTIONS preflight. Returns true if the
 * request was fully handled here (preflight) and the caller should do
 * nothing further. */
function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  // Authorization is needed for the #148 access-gate bearer token; adding
  // it here is what lets the browser's preflight approve the header.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** Honest 402 for a spend-cap block. The `reason` lets the client show
 * the right message — a per-volunteer "this session's limit is reached"
 * vs a service-wide limit — instead of failing silently. The English
 * `error` is a fallback; the client maps `reason` to its own bilingual
 * copy (coordinate the AR/EN wording with the language specialists). */
function sendSpendCapError(res: ServerResponse, reason: SpendBlockReason) {
  const error =
    reason === 'token_cap_reached'
      ? "You've reached the AI limit included with your access code."
      : 'The AI service has reached its usage limit. Please try again later.'
  sendJson(res, 402, { error, reason })
}

async function readJsonBody(req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> {
  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (contentLength > maxBytes) {
    throw new HttpError(413, 'Request body too large')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length
    if (total > maxBytes) {
      throw new HttpError(413, 'Request body too large')
    }
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf-8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

function validateVoiceRequest(body: unknown): XaiTtsRequest {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.text !== 'string' || b.text.trim() === '') throw new HttpError(400, '"text" must be a non-empty string')
  if (b.text.length > MAX_TEXT_CHARS) throw new HttpError(413, `"text" exceeds ${MAX_TEXT_CHARS} characters`)
  if (b.lang !== 'en' && b.lang !== 'ar') throw new HttpError(400, '"lang" must be "en" or "ar"')
  if (b.gender !== 'male' && b.gender !== 'female') throw new HttpError(400, '"gender" must be "male" or "female"')
  const rate = typeof b.rate === 'number' ? b.rate : 1
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new HttpError(400, '"rate" must be a number between 0.5 and 2')
  return { text: b.text, lang: b.lang, gender: b.gender, rate }
}

function validateMindMapRequest(body: unknown): { text: string; lang: 'en' | 'ar' } {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.text !== 'string' || b.text.trim() === '') throw new HttpError(400, '"text" must be a non-empty string')
  if (b.text.length > MAX_MINDMAP_CHARS) throw new HttpError(413, `"text" exceeds ${MAX_MINDMAP_CHARS} characters`)
  if (b.lang !== 'en' && b.lang !== 'ar') throw new HttpError(400, '"lang" must be "en" or "ar"')
  return { text: b.text, lang: b.lang }
}

/** `/stt` request: base64 audio + its mime type + language. The audio is
 * decoded to a Buffer here (bounded by MAX_STT_BODY_BYTES on the raw body)
 * and never logged. */
function validateSttRequest(body: unknown): { audio: Buffer; mimeType: string; lang: 'en' | 'ar' } {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.audio !== 'string' || b.audio.trim() === '') throw new HttpError(400, '"audio" must be a base64 string')
  // Real MediaRecorder emits a CODEC-SUFFIXED type (e.g. "audio/webm;codecs=opus");
  // normalize to the supported BARE type and forward THAT onward (what
  // _xaiStt.ts's EXT_BY_MIME + xAI expect). A strict match on the suffixed
  // string 400s every real recording — caught by nibras-eng's real client.
  const mimeType = normalizeSttMime(b.mimeType)
  if (!mimeType) throw new HttpError(400, '"mimeType" must be a supported audio type')
  if (b.lang !== 'en' && b.lang !== 'ar') throw new HttpError(400, '"lang" must be "en" or "ar"')
  const audio = Buffer.from(b.audio, 'base64')
  if (audio.byteLength === 0) throw new HttpError(400, '"audio" did not decode to any bytes')
  return { audio, mimeType, lang: b.lang }
}

/** Shared validation for the text+lang chat routes (/summarize, /explain). */
function validateTextLangRequest(body: unknown): { text: string; lang: 'en' | 'ar' } {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.text !== 'string' || b.text.trim() === '') throw new HttpError(400, '"text" must be a non-empty string')
  if (b.text.length > MAX_TEXT_CHARS) throw new HttpError(413, `"text" exceeds ${MAX_TEXT_CHARS} characters`)
  if (b.lang !== 'en' && b.lang !== 'ar') throw new HttpError(400, '"lang" must be "en" or "ar"')
  return { text: b.text, lang: b.lang }
}

/** `/ask` request: a validated pageId (must be in the server-owned
 * _askContext allowlist — an unknown page is refused rather than answered
 * from empty context, task #369) + the reader's free-text question + the
 * page language. The question is UNTRUSTED (see ask.ts's prompt-injection
 * note); it is length-capped here and the model is told to treat it as
 * data, not instructions. */
function validateAskRequest(body: unknown): { pageId: AskPageId; question: string; lang: 'en' | 'ar' } {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (!isAskPageId(b.pageId)) throw new HttpError(400, '"pageId" is not a known Nibras page')
  if (typeof b.question !== 'string' || b.question.trim() === '') throw new HttpError(400, '"question" must be a non-empty string')
  if (b.question.length > MAX_QUESTION_CHARS) throw new HttpError(413, `"question" exceeds ${MAX_QUESTION_CHARS} characters`)
  if (b.lang !== 'en' && b.lang !== 'ar') throw new HttpError(400, '"lang" must be "en" or "ar"')
  return { pageId: b.pageId, question: b.question, lang: b.lang }
}

function validateTranslateRequest(body: unknown): { text: string; from: 'en' | 'ar'; to: 'en' | 'ar' } {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.text !== 'string' || b.text.trim() === '') throw new HttpError(400, '"text" must be a non-empty string')
  if (b.text.length > MAX_TEXT_CHARS) throw new HttpError(413, `"text" exceeds ${MAX_TEXT_CHARS} characters`)
  if (b.from !== 'en' && b.from !== 'ar') throw new HttpError(400, '"from" must be "en" or "ar"')
  if (b.to !== 'en' && b.to !== 'ar') throw new HttpError(400, '"to" must be "en" or "ar"')
  // A same-language translate is a no-op that would still bill a paid LLM
  // call — reject it before the spend cap ever sees it (money-safety guard).
  if (b.from === b.to) throw new HttpError(400, '"from" and "to" must differ')
  return { text: b.text, from: b.from, to: b.to }
}

// --- Single-origin static client (#216) ---
// In a deploy this same service ALSO serves the built client (dist/) so
// client + API share ONE origin (no CORS). Override the directory with
// CLIENT_DIST_DIR (used by the static-serving regression test); defaults
// to ../dist next to server/. Absent (local dev, where Vite serves the
// client on :5173) → non-API GETs just 404, so local behaviour is unchanged.
const CLIENT_DIST_DIR = process.env.CLIENT_DIST_DIR || fileURLToPath(new URL('../dist', import.meta.url))

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/** Serve the built SPA (single-origin deploy). Serves the exact static
 * file when it exists; for an extension-less path that has no file (a
 * client-side route like /reader) falls back to index.html so deep links
 * and refreshes work; a MISSING file that HAS an extension (e.g. a stale
 * hashed asset) is a real 404, never masked by index.html. Path traversal
 * is blocked: the resolved target must stay inside CLIENT_DIST_DIR. GET/HEAD
 * only. When dist/ is absent (local dev) every read misses → 404, so local
 * behaviour is unchanged. */
async function serveStaticClient(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch {
    sendJson(res, 400, { error: 'Bad request' })
    return
  }
  const distRoot = resolve(CLIENT_DIST_DIR)
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const target = resolve(distRoot, normalize(rel))
  const withinDist = target === distRoot || target.startsWith(distRoot + sep)

  const sendFile = async (filePath: string): Promise<boolean> => {
    try {
      const data = await readFile(filePath)
      const type = MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const isHashedAsset = filePath.startsWith(resolve(distRoot, 'assets') + sep)
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': data.byteLength,
        // Vite fingerprints /assets/* so they cache hard; everything else
        // (esp. index.html) must revalidate so a redeploy is picked up.
        'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      res.end(req.method === 'HEAD' ? undefined : data)
      return true
    } catch {
      return false
    }
  }

  if (withinDist && (await sendFile(target))) return
  // SPA fallback ONLY for a route-shaped path (no file extension).
  if (!extname(rel) && (await sendFile(resolve(distRoot, 'index.html')))) return
  sendJson(res, 404, { error: 'Not found' })
}

// Explicit allowlist — every route shares the exact same CORS/rate-limit/
// body-handling pipeline below; only request validation + the actual
// handler differ per route (see the dispatch at the bottom of the
// try block).
const ROUTES = new Set(['/voice', '/mindmap', '/stt', '/summarize', '/explain', '/translate', '/ask'])

const server = createServer(async (req, res) => {
  const startedAt = Date.now()
  try {
    if (applyCors(req, res)) return

    // API ALLOWLIST FIRST (#148/#216): a path in ROUTES is POST-only and
    // runs the FULL guard pipeline (rate limit -> access gate -> spend cap
    // -> handler) below. Static serving is only the NON-API fallback, so it
    // can NEVER shadow or un-gate an API route: a GET to an API path is 405
    // (never a file), a POST is always gated. A path NOT in the allowlist
    // never reaches the guard pipeline or a handler.
    if (!ROUTES.has(req.url ?? '')) {
      // Non-API path → single-origin deploy (#216): serve the built client
      // (dist/) for GET/HEAD; anything else (e.g. a POST to a non-route) is
      // 404. serveStaticClient is confined to dist/ (traversal-safe), so it
      // cannot serve server-only files (server/.env, server/*.ts). No-op
      // locally when dist/ is absent → those GETs just 404.
      if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStaticClient(req, res)
      } else {
        sendJson(res, 404, { error: 'Not found — only POST /voice, /mindmap, /stt, /summarize, /explain, /translate, /ask are implemented' })
      }
      return
    }

    // API path (in the allowlist): POST-only, then the guard pipeline below.
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Not found — only POST /voice, /mindmap, /stt, /summarize, /explain, /translate, /ask are implemented' })
      return
    }

    // Guard order (#148): rate limit -> access gate -> spend cap ->
    // handler. Rate limit first is the cheap outer wall that blunts a
    // flood before any auth compute or provider call. Each guard returns
    // a DISTINCT status (429 / 401|503 / 402) so a client — and the
    // standing proof — can tell exactly which one fired.

    // (1) Rate limit, keyed on the correctly-derived client IP.
    const clientIp = getClientIp(req, clientIpConfig)
    if (rateLimiter.isLimited(clientIp)) {
      sendJson(res, 429, { error: 'Too many requests — please slow down' })
      return
    }

    // (2) Access gate. Fail CLOSED when unconfigured (503); reject an
    // unknown/missing token (401). `identify` returns this volunteer's
    // token id (a hash, never the raw token) that the per-volunteer
    // spend cap keys on. The CORS preflight already returned above, so a
    // browser's credential-less OPTIONS is never blocked here.
    if (!accessControl.isConfigured()) {
      sendJson(res, 503, { error: 'AI backend is not accepting requests right now.' })
      return
    }
    const tokenId = accessControl.identify(req)
    if (!tokenId) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    // /stt carries base64 audio → a much larger body cap than the text routes.
    const body = await readJsonBody(req, req.url === '/stt' ? MAX_STT_BODY_BYTES : MAX_BODY_BYTES)

    // (3) Per-volunteer spend cap: estimate this call's cost from the
    // VALIDATED request, refuse if it would cross THIS token's budget (or
    // the optional global backstop) with a 402 + `reason` (honest
    // "session limit reached", never a silent failure), and record spend
    // ONLY after a successful provider call. Split per route so the
    // estimate uses each route's own cost model + its validated text.
    if (req.url === '/voice') {
      const voiceReq = validateVoiceRequest(body)
      const estCost = estimateVoiceCostUsd(voiceReq.text.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const result = await handleVoiceRequest(voiceReq)
      spendCap.record(tokenId, estCost)
      sendJson(res, 200, result)
    } else if (req.url === '/mindmap') {
      const mindMapReq = validateMindMapRequest(body)
      // Gate on the CONSERVATIVE estimate before the call (pre-authorize)...
      const estCost = estimateMindMapCostUsd(mindMapReq.text.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { response, usage } = await handleMindMapRequest(mindMapReq)
      // ...then true up to the EXACT cost from xAI's own token usage —
      // INCLUDING reasoning tokens, which grok-4.6 bills as output and
      // reports separately (measured ~3833 for one mind-map; omitting
      // them under-counted ~12x). Fall back to the estimate only if the
      // provider omitted usage entirely.
      const actualCost = usage ? actualChatCostUsd(usage.promptTokens, usage.completionTokens, usage.reasoningTokens) : estCost
      spendCap.record(tokenId, actualCost)
      sendJson(res, 200, response)
    } else if (req.url === '/stt') {
      // /stt — transcribe a short audio clip (Arabic listening). Gate on a
      // conservative pre-estimate (MAX_STT_SECONDS), then true up to the
      // EXACT cost from the provider's reported audio `duration` (STT bills
      // per second). The audio is never logged or stored (stt.ts/_xaiStt.ts).
      const sttReq = validateSttRequest(body)
      const estCost = estimateSttCostUsd(MAX_STT_SECONDS)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { text, durationSeconds } = await handleSttRequest(sttReq)
      spendCap.record(tokenId, estimateSttCostUsd(durationSeconds))
      sendJson(res, 200, { text, demo: false })
    } else if (req.url === '/summarize') {
      // Chat-text routes (/summarize, /explain, /translate): same pattern as
      // /mindmap — gate on the conservative chat estimate, then true up to
      // the EXACT cost from xAI usage INCLUDING reasoning tokens.
      const sumReq = validateTextLangRequest(body)
      const estCost = estimateChatCostUsd(sumReq.text.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { response, usage } = await handleSummarizeRequest(sumReq)
      spendCap.record(tokenId, usage ? actualChatCostUsd(usage.promptTokens, usage.completionTokens, usage.reasoningTokens) : estCost)
      sendJson(res, 200, response)
    } else if (req.url === '/explain') {
      const expReq = validateTextLangRequest(body)
      const estCost = estimateChatCostUsd(expReq.text.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { response, usage } = await handleExplainRequest(expReq)
      spendCap.record(tokenId, usage ? actualChatCostUsd(usage.promptTokens, usage.completionTokens, usage.reasoningTokens) : estCost)
      sendJson(res, 200, response)
    } else if (req.url === '/ask') {
      // /ask — the mascot's grounded page Q&A (#369). Same chat pattern:
      // estimate on (server-owned page context + the question), gate, call,
      // then true up to the exact cost incl. reasoning tokens. The context
      // is server-owned (validated pageId), never client-supplied.
      const askReq = validateAskRequest(body)
      const estCost = estimateChatCostUsd(askReq.question.length + getAskContext(askReq.pageId).facts.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { response, usage } = await handleAskRequest(askReq)
      spendCap.record(tokenId, usage ? actualChatCostUsd(usage.promptTokens, usage.completionTokens, usage.reasoningTokens) : estCost)
      sendJson(res, 200, response)
    } else {
      // /translate — reader auto-translate (#112), request shape {text, from, to}.
      const trReq = validateTranslateRequest(body)
      const estCost = estimateChatCostUsd(trReq.text.length)
      const blocked = spendCap.checkAllowed(tokenId, estCost)
      if (blocked) {
        sendSpendCapError(res, blocked)
        return
      }
      const { response, usage } = await handleTranslateRequest(trReq)
      spendCap.record(tokenId, usage ? actualChatCostUsd(usage.promptTokens, usage.completionTokens, usage.reasoningTokens) : estCost)
      sendJson(res, 200, response)
    }
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message })
    } else {
      // _xaiTts.ts/_xaiChat.ts's own errors are already key-free by
      // design, but on a provider-side failure they DO include a short
      // snippet of the raw provider error body (up to 200 chars, for
      // diagnostics) — that's still untrusted, provider-controlled
      // text this server never asked for and shouldn't hand a client
      // (#147 P2-c). Log the full detail server-side, where it's
      // actually useful, and respond with a generic, safe,
      // route-specific message only.
      const message = err instanceof Error ? err.message : 'Unknown server error'
      console.error(`[${req.url}] provider/internal error: ${message}`)
      const genericMessage =
        req.url === '/voice'
          ? 'Voice synthesis is temporarily unavailable. Please try again.'
          : req.url === '/stt'
            ? 'Transcription is temporarily unavailable. Please try again.'
            : req.url === '/mindmap'
              ? 'Mind map generation is temporarily unavailable. Please try again.'
              : 'The AI service is temporarily unavailable. Please try again.'
      sendJson(res, 502, { error: genericMessage })
    }
  } finally {
    // Deliberately minimal + safe: method, path, status, timing.
    // Never headers, never the body, never the key.
    console.log(`${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - startedAt}ms)`)
  }
})

server.listen(PORT, HOST, () => {
  const publicBind = HOST === '0.0.0.0' || HOST === '::' // the all-interfaces binds (network-reachable); a loopback/specific host is not
  console.log(`Nibras AI backend listening on http://${HOST}:${PORT} (${publicBind ? 'PUBLIC bind, reachable from the network' : 'loopback only, not reachable from the network'})`)
  console.log('Routes: POST /voice, /mindmap, /stt, /summarize, /explain, /translate, /ask. Non-API GETs serve the built client (dist/) when present.')
  if (!process.env.AI_VOICE_API_KEY) {
    console.log('WARNING: AI_VOICE_API_KEY is not set in this process — every /voice, /mindmap and /stt call will fail. Run with --env-file=server/.env (see server/README.md).')
  }
  if (!accessControl.isConfigured()) {
    console.log('WARNING: AI_ACCESS_TOKENS is not set — the access gate is FAILING CLOSED, so every /voice, /mindmap and /stt request is refused (503). Set AI_ACCESS_TOKENS (comma-separated, one token per volunteer) to allow the pilot clients. See server/README.md.')
  }
  console.log(
    `Spend cap: $${PER_TOKEN_CAP_USD.toFixed(2)} per volunteer token + $${GLOBAL_CAP_USD.toFixed(2)} backend global backstop (estimated, persistent), ledger at ${USAGE_FILE}. Set the xAI account-level billing cap too — it is the exact backstop (see server/README.md).`,
  )
})
