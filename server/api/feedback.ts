/**
 * "Rate Nibras" feedback recording (2026-09-23). A tiny, NON-AI handler:
 * it takes an already-validated submission and records it, so a reader's
 * feedback lands somewhere REAL instead of being silently dropped — the
 * dishonest "console-only stub" state that src/config/features.ts's
 * RATE_NIBRAS_ENABLED flag used to keep the feature hidden behind.
 *
 * Deliberately has NO provider/key knowledge and never touches the AI
 * access gate or the per-volunteer spend cap: feedback is free and must
 * work with no AI code configured. It lives OUTSIDE the AI-route pipeline
 * in server/index.ts (see that file's `/feedback` branch), sharing only
 * the generic guards every request gets — CORS, the shared rate limiter,
 * a strict body-size cap, and JSON-only parsing.
 *
 * Records TWO ways, on purpose:
 *  1. `console.info` a single-line JSON summary — the RELIABLE channel,
 *     retrievable from the host's logs (e.g. Render), which persist even
 *     when the container's disk is ephemeral. JSON.stringify guarantees a
 *     single line (newlines in a note are escaped), so a multi-line note
 *     can never break log parsing.
 *  2. Best-effort append to a JSON-lines file (FEEDBACK_FILE, default
 *     server/.feedback/feedback.jsonl, gitignored). Convenient for local
 *     review. On a platform like Render the container disk is EPHEMERAL —
 *     this file resets on every redeploy, so it is a convenience, not the
 *     system of record; the console line above is. A failed write NEVER
 *     fails the request (the console line already recorded it).
 *
 * Records nothing identifying — no IP, no account (there is none) — only
 * what the reader typed plus which page they were on, consistent with
 * Nibras's no-tracking privacy stance.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Max free-text note length (chars). Mirrored by the client textarea's
 * own maxLength and re-checked server-side in index.ts's validator. */
export const MAX_NOTE_CHARS = 2000
/** Max length of the `page` field (a short route like "/reader"); a sane
 * cap so a crafted request can't send an unbounded string. */
export const MAX_PAGE_CHARS = 200

export interface FeedbackSubmission {
  /** 1 = saddest face, 5 = happiest (RateNibras.tsx's 5-point scale). */
  rating: 1 | 2 | 3 | 4 | 5
  /** Trimmed by the client; '' when the optional box was left blank. */
  note: string
  lang: 'en' | 'ar'
  /** The route the reader was on (react-router pathname), for triage. */
  page: string
}

const FEEDBACK_FILE = process.env.FEEDBACK_FILE || fileURLToPath(new URL('../.feedback/feedback.jsonl', import.meta.url))

export async function handleFeedbackRequest(submission: FeedbackSubmission): Promise<{ ok: true }> {
  const record = {
    at: new Date().toISOString(),
    rating: submission.rating,
    lang: submission.lang,
    page: submission.page,
    note: submission.note,
  }
  const line = JSON.stringify(record)
  // (1) Reliable channel — always, one line.
  console.info(`[Nibras feedback] ${line}`)
  // (2) Convenience file — best-effort, must never crash the request.
  try {
    mkdirSync(dirname(FEEDBACK_FILE), { recursive: true })
    appendFileSync(FEEDBACK_FILE, line + '\n', 'utf-8')
  } catch (err) {
    console.warn(`[Nibras feedback] could not append to the local file (non-fatal): ${err instanceof Error ? err.message : String(err)}`)
  }
  return { ok: true }
}
