/**
 * The client-side seam for "Rate Nibras" feedback (a faces rating + an
 * optional suggestion box, src/components/RateNibras.tsx). Shaped after
 * lib/aiService.ts's own "one seam, everything goes through it, never
 * called ad hoc from UI code" idea, but kept as its OWN small module: it
 * is NOT an AI feature. It sends NO access-token bearer, is NOT bound by
 * any AI spend cap, and has nothing to do with a provider key — a plain
 * `fetch`, deliberately unlike aiService.ts's `postJson`.
 *
 * REAL now (2026-09-23): submitFeedback() POSTs the submission to the
 * backend's `POST /feedback` route (server/api/feedback.ts), which records
 * it (a one-line log entry + a best-effort local JSON-lines file). It
 * reuses the SAME backend base URL as the AI features (VITE_AI_BACKEND_URL,
 * via aiService.ts's `backendUrl` — the `/feedback` route lives on that
 * same server), but sends none of the AI machinery.
 *
 * HONESTY: this used to be a console-only STUB that resolved successfully
 * without sending anything — a silent drop, which is exactly why the
 * feature was kept hidden behind config/features.ts's RATE_NIBRAS_ENABLED.
 * Now that it genuinely sends:
 *  - When a backend IS configured, a real submission is made; a failed
 *    request (network / 4xx / 5xx) THROWS, which RateNibras.tsx catches
 *    and turns into its honest, translated error state (never a false
 *    "thank you").
 *  - When NO backend is configured (a demo build, VITE_AI_BACKEND_URL
 *    unset), it THROWS rather than faking success — returning ok here would
 *    reintroduce the same silent-drop dishonesty. The throw is caught by
 *    RateNibras.tsx's own try/catch, so it degrades gracefully with no
 *    crash. In the real AI-on deploy VITE_AI_BACKEND_URL is set, so this
 *    branch is not reached.
 */

import { backendUrl } from './aiService'

export interface FeedbackPayload {
  /** 1 = the saddest face, 5 = the happiest — see RateNibras.tsx's own
   * `FACES` array for the exact 5-point scale and its labels. */
  rating: 1 | 2 | 3 | 4 | 5
  /** Trimmed by the caller; '' when the reader left the optional
   * suggestion box blank. */
  note: string
  lang: 'en' | 'ar'
  /** The route the reader was on when they rated (e.g. "/reader"),
   * from react-router's useLocation().pathname — for later triage
   * only, never shown back to the reader. */
  page: string
}

export interface SubmitFeedbackResult {
  ok: boolean
  /** True whenever this ran a demo/no-network path rather than a real
   * submission — same honesty convention as aiService.ts's
   * `SummarizeResult`/`ExplainResult`/etc. Now always false on success
   * (a real send); the no-backend case throws instead of returning. Kept
   * on the result so a future variant and this one share one type. */
  demo: boolean
}

export async function submitFeedback(payload: FeedbackPayload): Promise<SubmitFeedbackResult> {
  const base = backendUrl()
  if (!base) {
    // No backend (demo build): fail honestly instead of faking success —
    // caught by RateNibras.tsx (-> its honest error state), so no crash.
    throw new Error('submitFeedback(): no backend configured — cannot send feedback in a demo build')
  }
  // Plain fetch: no Authorization header (feedback is free — the server's
  // /feedback route has no access gate), no spend-cap/abort machinery.
  const res = await fetch(`${base}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Feedback submit failed: ${res.status}`)
  return { ok: true, demo: false }
}
