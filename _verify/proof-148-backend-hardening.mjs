// Standing proof for task #148 — the pre-public backend abuse surface:
// the access gate, the PER-VOLUNTEER hard spend cap ($1.50 per token),
// and the proxy-correct rate limiter (server/api/_accessControl.ts,
// _spendCap.ts, _rateLimiter.ts, wired in server/index.ts).
//
// FULLY OFFLINE + ZERO COST, by design. It never loads server/.env, never
// contacts api.x.ai, and never spends a cent: the spawned server instances
// run with a DUMMY key and a $0 cap, so every request is rejected by a
// guard BEFORE any provider call. That is exactly what makes this a
// standing regression (safe to run any time), unlike proof-xai-backend-e2e
// (real key, real paid calls).
//
// Two layers, each falsification-resistant (every guard is checked in
// BOTH directions, so neither a "block everything" nor an "allow
// everything" break can pass):
//   1. Direct unit tests of each guard module's exported functions.
//   2. A real running server (spawned on isolated ports, never touching
//      Amal's 8787/5173/4173/4200) driven over real HTTP, asserting the
//      distinct status each guard returns: 401 (bad/no token),
//      503 (fail-closed / unconfigured gate), 402 + reason (per-token or
//      global spend cap), 429 (rate limit), plus 204 (CORS preflight).
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  actualChatCostUsd,
  createSpendCap,
  estimateChatCostUsd,
  estimateMindMapCostUsd,
  estimateSttCostUsd,
  estimateVoiceCostUsd,
} from '../server/api/_spendCap.ts'
import { createAccessControl, parseAccessTokens } from '../server/api/_accessControl.ts'
import { createRateLimiter, getClientIp } from '../server/api/_rateLimiter.ts'
import { extractUsage } from '../server/api/_xaiChat.ts'
import { normalizeSttMime } from '../server/api/_xaiStt.ts'
import { stripDashes } from '../server/api/_text.ts'

const PROJECT_ROOT = '/Users/amalalharbi/Desktop/AI/projects/nibras'
const NODE_BIN_DIR = `${process.env.HOME}/Desktop/AI/tools/node/bin`
const TMP = mkdtempSync(join(tmpdir(), 'nibras-148-'))

// Collect the LABELS of failed checks (not just a count) so the final
// summary always names exactly WHICH check failed — a gate that prints
// "1 CHECK(S) FAILED" with no line is not diagnosable, and among 100+ OK
// lines the inline FAIL scrolls away. The summary echo below is the fix.
const failedChecks = []
function check(label, condition, detail) {
  if (condition) {
    console.log(`  OK  ${label}`)
  } else {
    const line = `${label}${detail !== undefined ? ' — ' + detail : ''}`
    failedChecks.push(line)
    console.log(`  FAIL  ${line}`)
  }
}

const approx = (a, b) => Math.abs(a - b) < 1e-9

// ---------------------------------------------------------------
// Section 1 — per-volunteer spend cap: cost math, per-token ledger,
// independence, persistence, global backstop, reason ordering
// ---------------------------------------------------------------
function runSpendCapSection() {
  console.log('\n== Section 1: per-volunteer spend cap (direct, no network) ==')

  // Cost math, grounded on the pricing constants in _spendCap.ts
  // (docs.x.ai: TTS $15/1M chars; grok-4.6 $2/1M in + $6/1M out; STT $0.10/hr).
  check('TTS cost is per-character: 1000 chars = $0.015', approx(estimateVoiceCostUsd(1000), 0.015), estimateVoiceCostUsd(1000))
  // Pre-auth ceiling now covers reasoning tokens (12000 output), so these
  // conservative estimates are higher than the pre-reasoning-fix values.
  check('Mind-map cost incl. fixed prompt + reasoning-covering output ceiling: empty text ≈ $0.0728', approx(estimateMindMapCostUsd(0), 0.0728), estimateMindMapCostUsd(0))
  check('Mind-map cost grows with input length: 4000 chars ≈ $0.076', approx(estimateMindMapCostUsd(4000), 0.076), estimateMindMapCostUsd(4000))
  // Generic chat estimate (shared by /summarize, /explain, /translate, /mindmap).
  check('estimateChatCostUsd(0) ≈ $0.0728 (fixed prompt + reasoning-covering ceiling)', approx(estimateChatCostUsd(0), 0.0728), estimateChatCostUsd(0))
  check('estimateChatCostUsd delegates for mindmap (same value)', approx(estimateChatCostUsd(4000), estimateMindMapCostUsd(4000)))
  // STT = xAI /v1/stt, $0.10/hr (Amal's chosen provider — Option A).
  check('STT cost is per audio-second: 3600s (1hr) = $0.10 (xAI /v1/stt)', approx(estimateSttCostUsd(3600), 0.1), estimateSttCostUsd(3600))
  check('STT cost scales: 60s ≈ $0.001667', approx(estimateSttCostUsd(60), 0.1 / 60), estimateSttCostUsd(60))

  // STT mime normalization — the gap nibras-eng's REAL client caught: real
  // MediaRecorder emits a CODEC-SUFFIXED type; the server must strip the
  // suffix, accept the bare type, and FORWARD the bare type onward.
  check('normalizeSttMime strips the codec suffix → bare (real MediaRecorder case)', normalizeSttMime('audio/webm;codecs=opus') === 'audio/webm')
  check('normalizeSttMime is case-insensitive', normalizeSttMime('AUDIO/WEBM;codecs=opus') === 'audio/webm')
  check('normalizeSttMime handles ogg/opus too', normalizeSttMime('audio/ogg;codecs=opus') === 'audio/ogg')
  check('normalizeSttMime accepts a bare supported type unchanged (bare-forward)', normalizeSttMime('audio/mpeg') === 'audio/mpeg')
  check('normalizeSttMime rejects an unsupported type → null (allowlist intact)', normalizeSttMime('application/json') === null)
  check('normalizeSttMime rejects a non-string → null', normalizeSttMime(123) === null)
  check('normalizeSttMime rejects empty → null', normalizeSttMime('') === null)

  // Deterministic em-dash strip on AI output (Amal's app-wide no-em-dash
  // rule; the prompts also forbid it, this is the guarantee). Both langs.
  check('stripDashes: " — " → ", " (English)', stripDashes('reading is calm — and clear', 'en') === 'reading is calm, and clear')
  check('stripDashes: "a—b" (no spaces) → "a, b"', stripDashes('vocabulary—repertoire', 'en') === 'vocabulary, repertoire')
  check('stripDashes: en-dash (–) also stripped', stripDashes('one – two', 'en') === 'one, two')
  check('stripDashes: Arabic uses the Arabic comma (،)', stripDashes('القراءة نور — وضياء', 'ar') === 'القراءة نور، وضياء')
  check('stripDashes: leaves dash-free text untouched', stripDashes('no dashes here', 'en') === 'no dashes here')

  // Per-token cap + independence.
  const file = join(TMP, 'per-token.json')
  const cap = createSpendCap({ perTokenCapUsd: 1.5, usageFile: file })
  check('Fresh token starts at $0', cap.getTokenSpendUsd('A') === 0)
  check('Under cap: a $1.00 call for token A is allowed', cap.checkAllowed('A', 1.0) === null)
  cap.record('A', 1.0)
  check('After recording, token A spend is $1.00', approx(cap.getTokenSpendUsd('A'), 1.0), cap.getTokenSpendUsd('A'))
  check('Token B is INDEPENDENT of A (still $0)', cap.getTokenSpendUsd('B') === 0)
  check('Token A still under its $1.50 cap for $0.40 ($1.40)', cap.checkAllowed('A', 0.4) === null)
  check('Token A OVER its cap for $0.60 → token_cap_reached ($1.60 > $1.50)', cap.checkAllowed('A', 0.6) === 'token_cap_reached')
  check('Token B is UNAFFECTED by A hitting its cap (its own $1.50 intact)', cap.checkAllowed('B', 1.0) === null)
  cap.record('A', 0.6) // push A over
  check('Once A is over, even a tiny A call is refused', cap.checkAllowed('A', 0.0001) === 'token_cap_reached')
  check('Global spend = sum across all tokens', approx(cap.getGlobalSpendUsd(), 1.6), cap.getGlobalSpendUsd())

  // Persistence per token across a "restart".
  const cap2 = createSpendCap({ perTokenCapUsd: 1.5, usageFile: file })
  check("A restart reads token A's spend back ($1.60, not reset)", approx(cap2.getTokenSpendUsd('A'), 1.6), cap2.getTokenSpendUsd('A'))
  check('A restart keeps token B independent ($0)', cap2.getTokenSpendUsd('B') === 0)

  // Optional global backstop.
  const gcap = createSpendCap({ perTokenCapUsd: 100, globalCapUsd: 1.0, usageFile: join(TMP, 'global.json') })
  gcap.record('X', 0.6)
  gcap.record('Y', 0.5) // global now $1.10 > $1.00, but each token is under its $100
  check('Under per-token but OVER the global backstop → global_cap_reached', gcap.checkAllowed('Z', 0.01) === 'global_cap_reached')

  // Reason ordering: when BOTH caps would trip, the per-token reason wins.
  const bcap = createSpendCap({ perTokenCapUsd: 0.5, globalCapUsd: 0.5, usageFile: join(TMP, 'both.json') })
  bcap.record('P', 0.6)
  check('When both caps would trip, per-token reason is reported first', bcap.checkAllowed('P', 0.01) === 'token_cap_reached')

  // Disabled global (default): never blocks, no matter how large.
  const nocap = createSpendCap({ perTokenCapUsd: 1e9, usageFile: join(TMP, 'noglobal.json') })
  check('Global backstop OFF by default: a huge call is not globally blocked', nocap.checkAllowed('Q', 1e6) === null)

  // Exact chat accounting (task #148 A) — the ledger is trued up to real
  // xAI usage after a mindmap call. CRITICAL: grok-4.6 bills REASONING
  // tokens as output and reports them SEPARATELY from completion, so the
  // cost MUST include them. actualChatCostUsd = prompt*$2/1M + (completion
  // + reasoning)*$6/1M.
  check('actualChatCostUsd: 1000 in + 2000 out (0 reasoning) = $0.014', approx(actualChatCostUsd(1000, 2000, 0), 0.014), actualChatCostUsd(1000, 2000, 0))
  check('actualChatCostUsd adds reasoning at the output rate: 1000 in + 2000 comp + 3000 reason = $0.032', approx(actualChatCostUsd(1000, 2000, 3000), 0.032), actualChatCostUsd(1000, 2000, 3000))
  // The REAL measured Arabic mind-map (proof-148-realmoney-mindmap.mjs,
  // 2026-08-19): prompt=609, completion=130, reasoning=3833. Baked in as a
  // standing regression so the ~12x reasoning under-count can never
  // silently return.
  check('REAL case: actualChatCostUsd(609,130,3833) ≈ $0.025 (reasoning included)', approx(actualChatCostUsd(609, 130, 3833), 0.024996), actualChatCostUsd(609, 130, 3833))
  check('Including reasoning is ~12x the completion-only figure (the bug this caught)', actualChatCostUsd(609, 130, 3833) > actualChatCostUsd(609, 130, 0) * 10)
  check('Pre-auth estimate now COVERS the real reasoning-heavy cost (no under-block)', estimateMindMapCostUsd(244) >= actualChatCostUsd(609, 130, 3833), `est=${estimateMindMapCostUsd(244).toFixed(5)} actual=${actualChatCostUsd(609, 130, 3833).toFixed(5)}`)

  // extractUsage — parses xAI's usage block incl. the separate reasoning count + total.
  const usageFull = extractUsage({ usage: { prompt_tokens: 609, completion_tokens: 130, completion_tokens_details: { reasoning_tokens: 3833 }, total_tokens: 4572 } })
  check('extractUsage reads prompt/completion tokens', usageFull?.promptTokens === 609 && usageFull?.completionTokens === 130)
  check('extractUsage captures the SEPARATE reasoning_tokens (billed as output)', usageFull?.reasoningTokens === 3833)
  check('extractUsage captures total_tokens for cross-checking', usageFull?.totalTokens === 4572)
  check('extractUsage defaults reasoning to 0 when absent (non-reasoning model → 0, not undefined)', extractUsage({ usage: { prompt_tokens: 10, completion_tokens: 20 } })?.reasoningTokens === 0)
  check('extractUsage returns null when usage is absent (caller falls back to estimate)', extractUsage({ choices: [] }) === null)
  check('extractUsage returns null on malformed usage (missing completion_tokens)', extractUsage({ usage: { prompt_tokens: 10 } }) === null)
}

// ---------------------------------------------------------------
// Section 2 — access control: parse + constant-time authorize + identify
// ---------------------------------------------------------------
function fakeReq(headers) {
  return { headers, socket: { remoteAddress: '9.9.9.9' } }
}

function runAccessControlSection() {
  console.log('\n== Section 2: access gate + per-token identify (direct, no network) ==')

  check('parseAccessTokens splits on commas + trims', JSON.stringify(parseAccessTokens(' a , b ,c ')) === JSON.stringify(['a', 'b', 'c']))
  check('parseAccessTokens drops empty/trailing entries (no "" token)', JSON.stringify(parseAccessTokens('a,,b,')) === JSON.stringify(['a', 'b']))
  check('parseAccessTokens of undefined is empty', parseAccessTokens(undefined).length === 0)

  const unconfigured = createAccessControl([])
  check('Unconfigured gate reports isConfigured() === false (server fails closed)', unconfigured.isConfigured() === false)
  check('Unconfigured gate authorizes NObody (even with a bearer)', unconfigured.isAuthorized(fakeReq({ authorization: 'Bearer anything' })) === false)
  check('Unconfigured gate identify() is null', unconfigured.identify(fakeReq({ authorization: 'Bearer anything' })) === null)

  const ac = createAccessControl(['tok-alpha', 'tok-beta'])
  check('Configured gate reports isConfigured() === true', ac.isConfigured() === true)
  check('Accepts a valid token (first in the list)', ac.isAuthorized(fakeReq({ authorization: 'Bearer tok-alpha' })) === true)
  check('Accepts a valid token (second in the list — per-volunteer tokens)', ac.isAuthorized(fakeReq({ authorization: 'Bearer tok-beta' })) === true)
  check('Case-insensitive scheme: "bearer" works', ac.isAuthorized(fakeReq({ authorization: 'bearer tok-alpha' })) === true)
  check('Rejects an unknown token', ac.isAuthorized(fakeReq({ authorization: 'Bearer wrong' })) === false)
  check('Rejects a missing Authorization header', ac.isAuthorized(fakeReq({})) === false)
  check('Rejects a malformed header (no Bearer scheme)', ac.isAuthorized(fakeReq({ authorization: 'tok-alpha' })) === false)
  check('Rejects an empty bearer value', ac.isAuthorized(fakeReq({ authorization: 'Bearer ' })) === false)

  // identify — the per-volunteer attribution the spend cap keys on.
  const idA = ac.identify(fakeReq({ authorization: 'Bearer tok-alpha' }))
  const idA2 = ac.identify(fakeReq({ authorization: 'Bearer tok-alpha' }))
  const idB = ac.identify(fakeReq({ authorization: 'Bearer tok-beta' }))
  check('identify returns a non-null id for a valid token', typeof idA === 'string' && idA.length === 64)
  check('identify is STABLE (same token → same id)', idA === idA2)
  check('identify DISTINGUISHES volunteers (different token → different id)', idA !== idB)
  check('identify never returns the raw token (a 64-char hex hash)', idA !== 'tok-alpha' && /^[0-9a-f]{64}$/.test(idA))
  check('identify returns null for an unknown token', ac.identify(fakeReq({ authorization: 'Bearer wrong' })) === null)
}

// ---------------------------------------------------------------
// Section 3 — rate limiter: client-IP derivation + window counting
// ---------------------------------------------------------------
async function runRateLimiterSection() {
  console.log('\n== Section 3: rate limiter (direct, no network) ==')

  const socketOnly = { trustProxy: false, clientIpHeader: 'x-forwarded-for', listPosition: 'last' }
  check(
    'Default (no proxy): uses the socket peer and IGNORES x-forwarded-for (unspoofable)',
    getClientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1' }), socketOnly) === '9.9.9.9',
  )
  const xffLast = { trustProxy: true, clientIpHeader: 'x-forwarded-for', listPosition: 'last' }
  check(
    'Trusted proxy, XFF last: takes the right-most hop (real client), NOT the spoofable left-most',
    getClientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }), xffLast) === '3.3.3.3',
  )
  const xffFirst = { trustProxy: true, clientIpHeader: 'x-forwarded-for', listPosition: 'first' }
  check(
    'Trusted proxy, XFF first: takes the left-most (for prepend-style hosts)',
    getClientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }), xffFirst) === '1.1.1.1',
  )
  const cf = { trustProxy: true, clientIpHeader: 'cf-connecting-ip', listPosition: 'last' }
  check(
    'Named single-IP header (cf-connecting-ip) is used and XFF is ignored',
    getClientIp(fakeReq({ 'cf-connecting-ip': '5.5.5.5', 'x-forwarded-for': '1.1.1.1' }), cf) === '5.5.5.5',
  )
  check(
    'Trusted proxy but header MISSING → fails safe to the socket peer (never "no key")',
    getClientIp(fakeReq({}), xffLast) === '9.9.9.9',
  )

  const rl = createRateLimiter({ maxRequests: 3, windowMs: 10_000 })
  const seq = [rl.isLimited('k'), rl.isLimited('k'), rl.isLimited('k'), rl.isLimited('k')]
  check('Limiter allows up to maxRequests then trips: [false,false,false,true]', JSON.stringify(seq) === JSON.stringify([false, false, false, true]))
  check('A different client key has its own bucket (not limited)', rl.isLimited('other-key') === false)

  const rl2 = createRateLimiter({ maxRequests: 1, windowMs: 25 })
  check('Second call within the window is limited', rl2.isLimited('w') === false && rl2.isLimited('w') === true)
  await new Promise((r) => setTimeout(r, 40))
  check('After the window elapses, the bucket resets (allowed again)', rl2.isLimited('w') === false)
}

// ---------------------------------------------------------------
// Section 4 — the real server enforces all three guards over HTTP
// ---------------------------------------------------------------
async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`${url} did not become reachable within ${timeoutMs}ms`)
}

function spawnServer(port, env) {
  return spawn('node', ['server/index.ts'], {
    cwd: PROJECT_ROOT,
    // NB: no --env-file — this never loads server/.env. A dummy key + a
    // $0 cap keep every request offline (blocked before any provider call).
    env: {
      ...process.env,
      PATH: `${NODE_BIN_DIR}:${process.env.PATH ?? ''}`,
      PORT: String(port),
      AI_VOICE_API_KEY: 'dummy-not-a-real-key',
      ...env,
    },
    stdio: 'ignore',
  })
}

async function post(port, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? { text: 'hello world', lang: 'en', gender: 'female', rate: 1 }),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json }
}

async function get(port, path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`)
  const text = await res.text()
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text }
}

async function runHttpSection() {
  console.log('\n== Section 4: real server over HTTP (isolated ports, offline, $0 cap) ==')

  const A = 8798 // access gate + per-token cap
  const G = 8799 // global backstop (explicit $0)
  const B = 8800 // rate limiter
  const C = 8801 // fail closed
  const H = 8802 // DEFAULT global backstop ($10, unset) via a pre-seeded ledger
  // Pre-seed H's ledger with $11 of global spend (across an arbitrary token
  // key — the global cap sums all tokens) so a call from a DIFFERENT token
  // that is well under its own $100 per-token cap is still refused by the
  // DEFAULT $10 global backstop — proving that default is ON without setting it.
  const hLedger = join(TMP, 'H.json')
  writeFileSync(hLedger, JSON.stringify({ tokens: { seed: { estSpendUsd: 11, calls: 1 } } }), 'utf-8')

  const procA = spawnServer(A, { AI_ACCESS_TOKENS: 'tok-alpha,tok-beta', PER_TOKEN_CAP_USD: '0', USAGE_FILE: join(TMP, 'A.json') })
  const procG = spawnServer(G, { AI_ACCESS_TOKENS: 'tok', PER_TOKEN_CAP_USD: '100', GLOBAL_CAP_USD: '0', USAGE_FILE: join(TMP, 'G.json') })
  const procB = spawnServer(B, { AI_ACCESS_TOKENS: 'tok', PER_TOKEN_CAP_USD: '0', RATE_LIMIT_MAX_REQUESTS: '3', USAGE_FILE: join(TMP, 'B.json') })
  const procC = spawnServer(C, { PER_TOKEN_CAP_USD: '0', USAGE_FILE: join(TMP, 'C.json') }) // no AI_ACCESS_TOKENS → fail closed
  const procH = spawnServer(H, { AI_ACCESS_TOKENS: 'tok', PER_TOKEN_CAP_USD: '100', USAGE_FILE: hLedger }) // GLOBAL_CAP_USD unset → default $10

  try {
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${A}/voice`, 10000),
      waitForHttp(`http://127.0.0.1:${G}/voice`, 10000),
      waitForHttp(`http://127.0.0.1:${B}/voice`, 10000),
      waitForHttp(`http://127.0.0.1:${C}/voice`, 10000),
      waitForHttp(`http://127.0.0.1:${H}/voice`, 10000),
    ])

    // --- Instance A: access gate + PER-TOKEN cap ---
    const preflight = await fetch(`http://127.0.0.1:${A}/voice`, { method: 'OPTIONS', headers: { Origin: 'https://nibrasapp.com' } })
    check('A: CORS preflight (OPTIONS) returns 204 and is NOT gated', preflight.status === 204, preflight.status)
    check('A: preflight allows the Authorization header (needed for the bearer token)', (preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase().includes('authorization'))

    check('A: POST with NO token → 401 (CORS would NOT stop this; the gate does)', (await post(A, '/voice')).status === 401)
    check('A: POST with a WRONG token → 401', (await post(A, '/voice', { token: 'nope' })).status === 401)
    const rA = await post(A, '/voice', { token: 'tok-alpha' })
    check('A: VALID token, $0 per-token cap → 402 (auth PASSED, cap blocks before any xAI call)', rA.status === 402, rA.status)
    check('A: the 402 carries reason "token_cap_reached" (honest per-volunteer session-limit signal)', rA.body?.reason === 'token_cap_reached', JSON.stringify(rA.body))
    check('A: the second per-volunteer token also authorizes then hits its own cap → 402 token_cap_reached', (await post(A, '/voice', { token: 'tok-beta' })).body?.reason === 'token_cap_reached')
    check('A: the per-token cap applies to /mindmap too → 402 token_cap_reached', (await post(A, '/mindmap', { token: 'tok-alpha', body: { text: 'hello world', lang: 'en' } })).body?.reason === 'token_cap_reached')
    check('A: /stt with a REAL codec-suffixed mime (audio/webm;codecs=opus) is ACCEPTED past validation → 402 token_cap_reached, NOT a 400 (the gap nibras-eng caught)', (await post(A, '/stt', { token: 'tok-alpha', body: { audio: 'aGVsbG8=', mimeType: 'audio/webm;codecs=opus', lang: 'ar' } })).body?.reason === 'token_cap_reached')
    check('A: /stt with an UNSUPPORTED mime → 400 (allowlist guardrail intact)', (await post(A, '/stt', { token: 'tok-alpha', body: { audio: 'aGVsbG8=', mimeType: 'application/json', lang: 'ar' } })).status === 400)
    // The three chat-text routes are gated by the same pipeline (auth + per-token cap).
    check('A: /summarize is gated by the per-token cap → 402 token_cap_reached', (await post(A, '/summarize', { token: 'tok-alpha', body: { text: 'hello world', lang: 'en' } })).body?.reason === 'token_cap_reached')
    check('A: /explain is gated by the per-token cap → 402 token_cap_reached', (await post(A, '/explain', { token: 'tok-alpha', body: { text: 'hello world', lang: 'ar' } })).body?.reason === 'token_cap_reached')
    check('A: /translate is gated by the per-token cap → 402 token_cap_reached', (await post(A, '/translate', { token: 'tok-alpha', body: { text: 'hello world', from: 'en', to: 'ar' } })).body?.reason === 'token_cap_reached')
    check('A: /translate with from===to → 400 (money-safety: a same-language no-op never bills)', (await post(A, '/translate', { token: 'tok-alpha', body: { text: 'hello world', from: 'ar', to: 'ar' } })).status === 400)
    check('A: /summarize with NO token → 401 (gate applies to the new routes)', (await post(A, '/summarize', { body: { text: 'hi', lang: 'en' } })).status === 401)
    const getStatus = (await fetch(`http://127.0.0.1:${A}/voice`, { method: 'GET' })).status
    check('A: GET /voice → 405 (POST-only)', getStatus === 405, getStatus)
    const unknownRoute = (await fetch(`http://127.0.0.1:${A}/nope`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status
    check('A: POST /nope → 404 (route allowlist)', unknownRoute === 404, unknownRoute)

    // --- Instance G: global backstop (per-token high, global $0) ---
    const rG = await post(G, '/voice', { token: 'tok' })
    check('G: under per-token but the global backstop is $0 → 402 reason global_cap_reached', rG.status === 402 && rG.body?.reason === 'global_cap_reached', JSON.stringify(rG.body))

    // --- Instance H: DEFAULT $10 global backstop is ON (GLOBAL_CAP_USD unset) ---
    // Ledger pre-seeded to $11 > the default $10; this token is far under its
    // own $100 per-token cap, so ONLY the default global backstop can block it.
    const rH = await post(H, '/voice', { token: 'tok' })
    check('H: the DEFAULT $10 global backstop is active (unset) → 402 reason global_cap_reached', rH.status === 402 && rH.body?.reason === 'global_cap_reached', JSON.stringify(rH.body))

    // --- Instance B: rate limiter boundary ---
    const b1 = (await post(B, '/voice', { token: 'tok' })).status
    const b2 = (await post(B, '/voice', { token: 'tok' })).status
    const b3 = (await post(B, '/voice', { token: 'tok' })).status
    const b4 = (await post(B, '/voice', { token: 'tok' })).status
    check('B: rate limiter trips at the boundary — [402,402,402,429]', JSON.stringify([b1, b2, b3, b4]) === JSON.stringify([402, 402, 402, 429]), JSON.stringify([b1, b2, b3, b4]))

    // --- Instance C: fail closed (no tokens configured) ---
    check('C: unconfigured gate refuses EVERY request → 503 (even with a bearer), never silently open', (await post(C, '/voice', { token: 'anything' })).status === 503)
    check('C: unconfigured gate refuses a no-token request → 503', (await post(C, '/voice')).status === 503)
  } finally {
    procA.kill()
    procG.kill()
    procB.kill()
    procC.kill()
    procH.kill()
  }
}

// ---------------------------------------------------------------
// Section 5 — single-origin static client (#216): the SAME service serves
// the built SPA for non-API GETs (index.html, hashed assets, SPA fallback
// for client routes), WITHOUT shadowing an API route or leaking outside
// dist/, and with the API guards still firing on that same instance.
// ---------------------------------------------------------------
async function runStaticClientSection() {
  console.log('\n== Section 5: single-origin static client (dist/) over HTTP ==')

  // A tiny fake dist/ fixture: index.html + one hashed asset.
  const distDir = join(TMP, 'client-dist')
  mkdirSync(join(distDir, 'assets'), { recursive: true })
  writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>NIBRAS_SPA_ROOT</title><div id="root"></div>', 'utf-8')
  writeFileSync(join(distDir, 'assets', 'app-abc123.js'), 'console.log("nibras-asset")', 'utf-8')
  // A server-only secret file OUTSIDE dist/ (mimics server/.env being a
  // sibling of dist/) — the static server must NEVER be able to serve it.
  writeFileSync(join(TMP, 'server-secret.env'), 'AI_VOICE_API_KEY=xai-MUST-NEVER-BE-SERVED', 'utf-8')

  const S = 8803
  const procS = spawnServer(S, { AI_ACCESS_TOKENS: 'tok', PER_TOKEN_CAP_USD: '0', USAGE_FILE: join(TMP, 'S.json'), CLIENT_DIST_DIR: distDir })
  try {
    await waitForHttp(`http://127.0.0.1:${S}/`, 10000)

    const root = await get(S, '/')
    check('S: GET / serves index.html (200, text/html)', root.status === 200 && (root.headers['content-type'] ?? '').includes('text/html') && root.text.includes('NIBRAS_SPA_ROOT'), `${root.status} ${root.headers['content-type']}`)

    const asset = await get(S, '/assets/app-abc123.js')
    check('S: a hashed asset → 200, text/javascript, immutable cache', asset.status === 200 && (asset.headers['content-type'] ?? '').includes('javascript') && (asset.headers['cache-control'] ?? '').includes('immutable'), `${asset.status} ${asset.headers['content-type']} ${asset.headers['cache-control']}`)

    const route = await get(S, '/reader')
    check('S: a client route (/reader, no file) → SPA fallback to index.html (200)', route.status === 200 && route.text.includes('NIBRAS_SPA_ROOT'), `${route.status}`)

    const missing = await get(S, '/assets/does-not-exist.js')
    check('S: a MISSING hashed asset → 404, NOT masked by index.html', missing.status === 404 && !missing.text.includes('NIBRAS_SPA_ROOT'), `${missing.status}`)

    const apiGet = await get(S, '/voice')
    check('S: GET /voice is still 405 (static serving never shadows an API route)', apiGet.status === 405, `${apiGet.status}`)

    const traversal = await get(S, '/../../../../../../etc/passwd')
    check('S: path traversal cannot escape dist/ (no /etc/passwd content)', !traversal.text.includes('root:'), `${traversal.status}`)

    // THE CRITICAL ONE (tech-final): an encoded ../ escape aimed at a
    // server-only file OUTSIDE dist/ must NOT serve it (protects server/.env,
    // server/*.ts). %2e%2e is sent un-normalized by the client; the server
    // decodes then confines to dist/, so this resolves to the sibling secret
    // and is refused.
    const escEnv = await get(S, '/%2e%2e/server-secret.env')
    check('S: CANNOT serve a server-only file outside dist/ via encoded ../ (404, secret NOT in body)', escEnv.status === 404 && !escEnv.text.includes('xai-MUST-NEVER-BE-SERVED'), `${escEnv.status}`)

    // Static serving must not un-gate or shadow the API: a POST to a non-API
    // path is a 404 (never turned into a 200/file), and a POST to an API path
    // with no token is still 401 (the gate runs, not the file server).
    const postNonApi = await post(S, '/random-path', { token: 'tok' })
    check('S: POST to a non-API path → 404 (static never turns a POST into a 200/file)', postNonApi.status === 404, `${postNonApi.status}`)
    const noTok = await post(S, '/voice')
    check('S: POST /voice with NO token still 401 (static serving did not un-gate the API)', noTok.status === 401, `${noTok.status}`)

    const apiPost = await post(S, '/voice', { token: 'tok' })
    check('S: the API guard still fires on the SAME service → 402 token_cap_reached', apiPost.status === 402 && apiPost.body?.reason === 'token_cap_reached', `${apiPost.status}`)
  } finally {
    procS.kill()
  }
}

async function main() {
  runSpendCapSection()
  runAccessControlSection()
  await runRateLimiterSection()
  await runHttpSection()
  await runStaticClientSection()

  if (failedChecks.length === 0) {
    console.log('\nALL CHECKS PASSED')
  } else {
    console.log(`\n${failedChecks.length} CHECK(S) FAILED:`)
    for (const f of failedChecks) console.log(`  ✗ ${f}`)
  }
  process.exit(failedChecks.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(1)
})
