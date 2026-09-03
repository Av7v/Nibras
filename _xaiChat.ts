/**
 * xAI (Grok) chat/text-completion provider adapter — the text-
 * generation counterpart to _xaiTts.ts's voice adapter, calling xAI's
 * `/v1/chat/completions` instead of `/v1/tts`. Isolated the same way:
 * a small, transport-agnostic function, key read once from
 * `process.env.AI_VOICE_API_KEY` (same key `translate.ts`'s own
 * comment already documents reusing — Amal's one xAI key covers text
 * calls too, no separate text-provider key exists), never logged,
 * echoed, or returned to the client.
 *
 * Endpoint + request/response shape verified against docs.x.ai
 * (2026-08-14, task #151): `POST /v1/chat/completions`,
 * `{model, messages:[{role,content}]}`, generated text at
 * `choices[0].message.content`. Model `grok-4.6` — docs.x.ai's own
 * currently-recommended general-purpose chat/code model.
 *
 * Uses xAI's real structured-outputs feature (`response_format:
 * {type:'json_schema', json_schema:{name, schema, strict:true}}`,
 * Draft 2020-12/Draft-07 JSON Schema — also confirmed against
 * docs.x.ai) so the model is constrained to a caller-supplied schema
 * server-side, rather than free-text JSON the caller has to hope
 * parses cleanly. Returns the RAW parsed JSON PLUS the provider's token
 * usage (for #148's exact spend accounting), unvalidated beyond "is this
 * valid JSON at all" — the caller (e.g. mindmap.ts) must still
 * shape-check the `data` before trusting it: xAI's own
 * "strict" guarantee is not a substitute for this backend's own
 * defense-in-depth, the same posture every other external input here
 * gets (see server/index.ts's own request validation, _xaiTts.ts's
 * error handling).
 */

export interface XaiChatJsonRequest {
  /** System/instruction prompt — the caller's own task-specific rules. */
  systemPrompt: string
  /** The user's own text to operate on (untrusted, caller's responsibility to cap length). */
  userText: string
  /** A short, identifier-safe name for the schema (xAI's own requirement — not shown to the user). */
  schemaName: string
  /** JSON Schema (Draft 2020-12 or Draft-07) the response must match. */
  schema: Record<string, unknown>
}

/** Real token usage from xAI's response, for EXACT spend accounting
 * (task #148: the chat path is trued-up to actuals after the call so a
 * reasoning-heavy generation can't under-count).
 *
 * MEASURED 2026-08-19 against grok-4.6 (proof-148-realmoney-mindmap.mjs):
 * xAI reports `reasoning_tokens` SEPARATELY from `completion_tokens`, and
 * far larger (one Arabic mind-map: completion=130, reasoning=3833). This
 * is NOT the OpenAI convention (there reasoning is a subset of
 * completion). xAI DOES bill reasoning tokens, at the output rate
 * (docs.x.ai/developers/pricing). So the billed OUTPUT for a chat call is
 * `completionTokens + reasoningTokens` — see `actualChatCostUsd`. Missing
 * this under-counted the cost ~12x. */
export interface XaiUsage {
  promptTokens: number
  completionTokens: number
  /** Billed as output, SEPARATE from completionTokens on xAI (see above). */
  reasoningTokens: number
  /** xAI's own total, when reported — kept for cross-checking. */
  totalTokens?: number
}

export interface XaiChatResult {
  /** The parsed JSON the model returned (still caller-validated). */
  data: unknown
  /** Provider-reported token usage, or null if the response omitted it. */
  usage: XaiUsage | null
}

/** Pull token usage out of a raw xAI chat-completions response. Pure +
 * exported so the parsing is unit-testable offline (see
 * proof-148-backend-hardening.mjs) rather than only exercised by a live
 * paid call. Returns null on any missing/malformed usage rather than
 * guessing — the caller then falls back to its conservative estimate. */
export function extractUsage(json: unknown): XaiUsage | null {
  const usage = (json as { usage?: unknown })?.usage
  if (!usage || typeof usage !== 'object') return null
  const u = usage as Record<string, unknown>
  const promptTokens = Number(u.prompt_tokens)
  const completionTokens = Number(u.completion_tokens)
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null
  const details = u.completion_tokens_details as Record<string, unknown> | undefined
  const reasoning = Number(details?.reasoning_tokens)
  const total = Number(u.total_tokens)
  return {
    promptTokens,
    completionTokens,
    // Default 0 when absent so the cost formula is always well-defined
    // (a non-reasoning model simply contributes 0 reasoning tokens).
    reasoningTokens: Number.isFinite(reasoning) ? reasoning : 0,
    ...(Number.isFinite(total) ? { totalTokens: total } : {}),
  }
}

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const MODEL = 'grok-4.6'

/** #151 P2-a (nibras-web-reviewer): the fetch below had no timeout at
 * all, so a hung or indefinitely-slow provider call would spin forever,
 * taking the client's Generate button with it. Set GENEROUS, not tight.
 * Arabic mind-map generation genuinely measured ~35-37s end-to-end in
 * this exact adapter (proof-151-mindmap-generator.mjs), and real pilot
 * gens on 2026-08-22 ran EN 52s / AR 40s, all comfortably under a
 * minute. But xAI can have a slow moment, and because there is NO retry
 * a single call that drifts past the ceiling is a HARD failure for a
 * volunteer, not a retryable blip. So the ceiling sits well above every
 * real number observed (180s), purely to kill a genuinely stuck
 * request, never to cap a normal-but-slow one (team-lead, 2026-08-22,
 * raising an earlier 90s once it was confirmed a real server-side cap
 * on the xAI call). The client aborts ~10s ABOVE this (aiService.ts) so
 * this server timeout, with its honest error, wins the race. */
const REQUEST_TIMEOUT_MS = 180_000

/**
 * Calls xAI for a schema-constrained JSON response. Returns the parsed
 * JSON value (typed `unknown` deliberately — this adapter has no
 * opinion on any particular caller's schema shape); throws a key-free
 * Error on any failure, matching `_xaiTts.ts`'s own contract exactly
 * (the caller already turns any thrown Error into a generic
 * client-facing message + a server-side log, per server/index.ts).
 */
export async function generateStructuredJson(req: XaiChatJsonRequest): Promise<XaiChatResult> {
  const apiKey = process.env.AI_VOICE_API_KEY
  if (!apiKey) {
    throw new Error('AI_VOICE_API_KEY is not configured — see server/README.md')
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userText },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: req.schemaName, schema: req.schema, strict: true },
    },
  }

  let res: Response
  try {
    res = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    // AbortSignal.timeout() firing throws a DOMException named
    // 'TimeoutError' (confirmed directly, not assumed) — distinguished
    // here so a genuine hang is diagnosable server-side as exactly
    // that, not lumped in with an ordinary connection failure. Never
    // includes the key or headers either way.
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`xAI chat: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    throw new Error('xAI chat: network error contacting the provider')
  }

  if (!res.ok) {
    // Read a short, safe snippet of the error body for diagnostics —
    // same discipline as _xaiTts.ts (#147 P2-c: this raw snippet must
    // never reach the client verbatim; server/index.ts's own catch-all
    // already sanitizes it before responding).
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new Error(`xAI chat: provider returned ${res.status} ${res.statusText} ${detail}`.trim())
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error('xAI chat: provider returned a non-JSON response')
  }

  const content = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('xAI chat: provider returned no content')
  }

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    // Shouldn't happen with strict:true, but the provider's own
    // "guarantee" is exactly the kind of external claim this codebase
    // never trusts blindly (see this file's own header comment).
    throw new Error('xAI chat: provider returned invalid JSON despite strict mode')
  }
  return { data, usage: extractUsage(json) }
}

export interface XaiTextRequest {
  /** System/instruction prompt — the caller's own task-specific rules. */
  systemPrompt: string
  /** The user's own text to operate on (untrusted, caller caps length). */
  userText: string
}

export interface XaiTextResult {
  /** The model's plain-text output. */
  text: string
  /** Provider-reported token usage, or null if omitted. */
  usage: XaiUsage | null
}

/**
 * Calls xAI for a PLAIN-TEXT completion (no JSON schema) — the text
 * counterpart to `generateStructuredJson`, for `/summarize`, `/explain`,
 * `/translate`. Deliberately self-contained (a parallel of the function
 * above rather than a shared refactor) so the proven, live `/mindmap`
 * path is left completely untouched. Returns the text + token usage
 * (so the caller trues up cost INCLUDING reasoning tokens, task #148);
 * throws a key-free Error on any failure, same contract as above.
 */
export async function generateText(req: XaiTextRequest): Promise<XaiTextResult> {
  const apiKey = process.env.AI_VOICE_API_KEY
  if (!apiKey) {
    throw new Error('AI_VOICE_API_KEY is not configured — see server/README.md')
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userText },
    ],
  }

  let res: Response
  try {
    res = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`xAI chat: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    throw new Error('xAI chat: network error contacting the provider')
  }

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new Error(`xAI chat: provider returned ${res.status} ${res.statusText} ${detail}`.trim())
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error('xAI chat: provider returned a non-JSON response')
  }

  const content = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('xAI chat: provider returned no content')
  }
  return { text: content.trim(), usage: extractUsage(json) }
}
