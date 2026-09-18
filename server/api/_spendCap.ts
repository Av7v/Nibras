/**
 * Per-volunteer hard spend cap for the AI backend (task #148, redesigned
 * 2026-08-19 for Amal's per-volunteer budget). Each pilot volunteer has
 * their OWN access token (see `_accessControl.ts`) and their OWN hard,
 * PERSISTENT budget — default $1.50 per token. Every AI call's cost is
 * estimated (TTS characters, LLM tokens, or STT audio-seconds), summed
 * PER TOKEN, and a token is hard-stopped the moment its next call would
 * cross $1.50. The running totals are persisted to a JSON ledger so a
 * restart cannot reset anyone's budget.
 *
 * This is a LIFETIME budget, not a monthly one: "$1.50 per volunteer"
 * for the pilot, no automatic time-based reset. To top a volunteer back
 * up, clear their entry from the ledger file or raise the constant. (If
 * a periodic reset is ever wanted, it's a small change here.)
 *
 * DEFENCE IN DEPTH, stated honestly — three layers, not one:
 *   1. Per-token cap (this file): the primary, per-volunteer limit.
 *   2. Optional backend GLOBAL cap (this file, off unless
 *      `globalCapUsd` is set): a backstop against extra/misconfigured
 *      tokens minting spend beyond the intended 5 x $1.50.
 *   3. The xAI ACCOUNT-LEVEL spend limit (set in the xAI Console — the
 *      EXACT hard backstop that holds even against a bug, a bypass, or
 *      multiple instances that don't share this ledger). With 5 tokens
 *      x $1.50 = $7.50 max here, set the account cap a bit above that,
 *      well under Amal's $30 credit. See server/README.md.
 *
 * The ledger keys on a SHA-256 HASH of the token, never the raw token,
 * so the on-disk file never contains a usable credential. Estimates are
 * deliberately conservative (over-count), so the real xAI bill is always
 * <= the ledger and a cap trips a little early rather than late.
 *
 * Pricing constants are GROUNDED against docs.x.ai/developers/pricing
 * (confirmed 2026-08-19): grok-4.6 text = $2.00 / 1M input tokens,
 * $6.00 / 1M output tokens (prompts under 200K); TTS `/v1/tts` = $15.00
 * / 1M input characters; STT `/v1/stt` = $0.10 / hour (batch). If xAI
 * changes these — or a different STT provider is chosen (see the STT
 * provider decision in server/README.md) — update the constants below.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// --- xAI pricing (docs.x.ai/developers/pricing, 2026-08-19) ---
const USD_PER_INPUT_TOKEN = 2.0 / 1_000_000
const USD_PER_OUTPUT_TOKEN = 6.0 / 1_000_000
const USD_PER_TTS_CHAR = 15.0 / 1_000_000
/** STT = xAI `/v1/stt`, $0.10/hour batch (Amal's chosen provider — Option A,
 * same AI_VOICE_API_KEY, no new vendor; docs.x.ai/developers/pricing,
 * confirmed 2026-08-19), expressed per second below. Used by `/stt` — the
 * per-token cap sums it in via `estimateSttCostUsd`. */
const USD_PER_STT_SECOND = 0.1 / 3600

// --- Conservative estimation knobs (over-estimate on purpose) ---
const CHARS_PER_TOKEN = 2.5 // low divisor = MORE tokens counted (Arabic ~2-3 chars/token, English ~4). Over-counts on purpose.
const CHAT_SYSTEM_PROMPT_TOKENS = 400 // fixed overhead for mindmap's system prompt
// Pre-auth OUTPUT ceiling = completion + REASONING tokens. grok-4.6
// reasoning dominates and is billed as output: a real Arabic mind-map
// measured 3833 reasoning + 130 completion = ~3963 tokens
// (proof-148-realmoney-mindmap.mjs, 2026-08-19). Set ~3x above that so
// the pre-auth gate rarely under-blocks; the ledger is trued up to
// ACTUAL usage (incl. reasoning) after the call, so accuracy never
// depends on this being exactly right.
const CHAT_MAX_OUTPUT_TOKENS = 12000

/** Estimated USD for a `/voice` (TTS) call — near-exact, xAI bills TTS
 * per input character and `textLength` is the (length-capped) text sent. */
export function estimateVoiceCostUsd(textLength: number): number {
  return textLength * USD_PER_TTS_CHAR
}

/** Conservative pre-authorization estimate for ANY grok-chat call
 * (/mindmap, /summarize, /explain, /translate): (system-prompt + user
 * text) input tokens + a generous output ceiling that COVERS reasoning
 * tokens (grok-4.6 reasons heavily — see the #148 finding). The ledger is
 * trued up to the ACTUAL usage after the call (`actualChatCostUsd`), so
 * this only needs to be a safe upper bound for the gate, not exact. */
export function estimateChatCostUsd(inputChars: number, maxOutputTokens: number = CHAT_MAX_OUTPUT_TOKENS): number {
  const inputTokens = CHAT_SYSTEM_PROMPT_TOKENS + inputChars / CHARS_PER_TOKEN
  return inputTokens * USD_PER_INPUT_TOKEN + maxOutputTokens * USD_PER_OUTPUT_TOKEN
}

/** Estimated USD for a `/mindmap` (chat) call — the generic chat estimate
 * with the default output ceiling. */
export function estimateMindMapCostUsd(textLength: number): number {
  return estimateChatCostUsd(textLength)
}

/** Estimated USD for a `/stt` (transcription) call — billed per audio
 * second. Ready for when `/stt` is wired (provider decision pending). */
export function estimateSttCostUsd(audioSeconds: number): number {
  return audioSeconds * USD_PER_STT_SECOND
}

/** EXACT USD for a chat call from xAI's own reported token usage (task
 * #148): input tokens at the input rate + (completion + reasoning) tokens
 * at the output rate.
 *
 * CRITICAL (measured 2026-08-19, proof-148-realmoney-mindmap.mjs): xAI
 * reports `reasoning_tokens` SEPARATELY from `completion_tokens` (one
 * Arabic mind-map: completion=130, reasoning=3833) and BILLS them at the
 * output rate. Billing only `completionTokens` under-counted ~12x. So
 * reasoning MUST be added to the output count here. index.ts records THIS
 * after a successful mindmap call, having gated on the conservative
 * `estimateMindMapCostUsd` beforehand. */
export function actualChatCostUsd(promptTokens: number, completionTokens: number, reasoningTokens = 0): number {
  return promptTokens * USD_PER_INPUT_TOKEN + (completionTokens + reasoningTokens) * USD_PER_OUTPUT_TOKEN
}

interface TokenUsage {
  estSpendUsd: number
  calls: number
}
interface Ledger {
  /** keyed by SHA-256 hex of the access token — never the raw token. */
  tokens: Record<string, TokenUsage>
}

/** Why a call was refused. `token_cap_reached` = this volunteer's own
 * $1.50 budget is spent (the expected, honest "session limit" case);
 * `global_cap_reached` = the optional backend global backstop tripped. */
export type SpendBlockReason = 'token_cap_reached' | 'global_cap_reached'

export interface SpendCap {
  readonly perTokenCapUsd: number
  /** Infinity when the optional backend global cap is disabled. */
  readonly globalCapUsd: number
  getTokenSpendUsd(tokenId: string): number
  getGlobalSpendUsd(): number
  /** The cap that ACTUALLY applies to this token: its override if one is
   * configured for it, else the shared `perTokenCapUsd`. Exposed so a
   * caller can read back "what cap is this token really under" without
   * re-deriving the override lookup itself. */
  getEffectiveCapUsd(tokenId: string): number
  /** null if the call is allowed; otherwise the reason it is blocked.
   * The per-token cap is checked first (the primary, per-volunteer
   * limit); the global backstop second. Checked BEFORE the provider call
   * so an over-budget request never bills. */
  checkAllowed(tokenId: string, estCostUsd: number): SpendBlockReason | null
  /** Record a (conservative) estimated spend for a SUCCESSFUL call and
   * persist it. Never called for a failed/blocked call. */
  record(tokenId: string, estCostUsd: number): void
  snapshot(): Ledger
}

function loadLedger(usageFile: string): Ledger {
  try {
    const parsed = JSON.parse(readFileSync(usageFile, 'utf-8')) as Partial<Ledger>
    if (parsed && typeof parsed.tokens === 'object' && parsed.tokens !== null) {
      const clean: Record<string, TokenUsage> = {}
      for (const [id, usage] of Object.entries(parsed.tokens)) {
        if (usage && typeof usage.estSpendUsd === 'number' && Number.isFinite(usage.estSpendUsd) && typeof usage.calls === 'number') {
          clean[id] = { estSpendUsd: usage.estSpendUsd, calls: usage.calls }
        }
      }
      return { tokens: clean }
    }
  } catch {
    // Missing or corrupt ledger — start clean. A wiped ledger can only
    // UNDER-count history; the account-level cap is the true backstop.
  }
  return { tokens: {} }
}

/** Atomic-ish persist: write a temp file then rename over the target, so
 * a crash mid-write can't leave a half-written ledger that later parses
 * to a wrong (possibly tiny) number and re-opens a budget. Synchronous
 * on purpose — write frequency is low (once per successful AI call) and
 * sync I/O sidesteps any read-modify-write interleave within the process. */
function persist(usageFile: string, ledger: Ledger): void {
  mkdirSync(dirname(usageFile), { recursive: true })
  const tmp = `${usageFile}.tmp`
  writeFileSync(tmp, JSON.stringify(ledger), 'utf-8')
  renameSync(tmp, usageFile)
}

export function createSpendCap(opts: {
  perTokenCapUsd: number
  globalCapUsd?: number
  usageFile: string
  /** 2026-09-15 (Amal-approved, via team-lead): an escape hatch for a
   * NAMED, non-volunteer token (e.g. the internal token used to produce
   * the guide videos) that legitimately needs more headroom than the
   * $1.50 per-VOLUNTEER default, WITHOUT touching that default for
   * everyone else. Keyed the same way the ledger itself is — a token's
   * SHA-256 hex id (see `_accessControl.ts`'s `identify()`) — so this
   * can be wired from a hash-only env var (`AI_PRODUCTION_TOKEN_HASH` in
   * server/index.ts): no raw token ever needs to pass through this
   * config. Absent/undefined => no overrides => byte-identical to the
   * pre-#537 behaviour (every token shares `perTokenCapUsd`). At real
   * go-live this must be unset so volunteer + committee codes are all
   * governed by the one protective default (see server/index.ts's own
   * note on this). */
  perTokenCapOverridesUsd?: Record<string, number>
}): SpendCap {
  const globalCapUsd = opts.globalCapUsd ?? Number.POSITIVE_INFINITY
  const ledger = loadLedger(opts.usageFile)

  const tokenSpend = (id: string): number => ledger.tokens[id]?.estSpendUsd ?? 0
  const globalSpend = (): number => Object.values(ledger.tokens).reduce((sum, t) => sum + t.estSpendUsd, 0)
  const effectiveCap = (id: string): number => opts.perTokenCapOverridesUsd?.[id] ?? opts.perTokenCapUsd

  return {
    perTokenCapUsd: opts.perTokenCapUsd,
    globalCapUsd,
    getTokenSpendUsd: tokenSpend,
    getGlobalSpendUsd: globalSpend,
    getEffectiveCapUsd: effectiveCap,
    checkAllowed(tokenId, estCostUsd) {
      if (tokenSpend(tokenId) + estCostUsd > effectiveCap(tokenId)) return 'token_cap_reached'
      if (globalSpend() + estCostUsd > globalCapUsd) return 'global_cap_reached'
      return null
    },
    record(tokenId, estCostUsd) {
      const current = ledger.tokens[tokenId] ?? { estSpendUsd: 0, calls: 0 }
      current.estSpendUsd += estCostUsd
      current.calls += 1
      ledger.tokens[tokenId] = current
      persist(opts.usageFile, ledger)
    },
    snapshot() {
      return { tokens: { ...ledger.tokens } }
    },
  }
}
