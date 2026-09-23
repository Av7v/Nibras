/**
 * The client-side seam for "Rate Nibras" feedback (faces rating + an
 * optional suggestion box, src/components/RateNibras.tsx). Shaped
 * after lib/aiService.ts's own "one seam, everything goes through it,
 * never called ad hoc from UI code" idea, but kept as its OWN small
 * module rather than folded into aiService.ts: feedback is not an AI
 * feature. It must keep working with zero AI backend configured, must
 * never touch the AI access-token gate or a volunteer's AI spend cap
 * (server/README.md), and has nothing to do with a provider key.
 *
 * TODAY: submitFeedback() is a STUB. It makes no network call at all
 * — it logs the payload to the console (so a developer testing this
 * locally, with config/features.ts's RATE_NIBRAS_ENABLED flipped on,
 * can see exactly what WOULD have been sent) and resolves
 * successfully. The whole feature stays behind that flag (default
 * OFF) precisely because of this: a real reader must never be able to
 * submit feedback that quietly goes nowhere. See that flag's own
 * comment for the full reasoning.
 *
 * TO ACTIVATE LATER, once Amal/the handoff team decides where
 * feedback should actually land (e.g. a new `POST /feedback` route
 * added to the SAME server/index.ts the AI backend already documents,
 * a spreadsheet/Airtable webhook, or something else entirely — not
 * decided yet, so this module deliberately doesn't assume one):
 *
 *   1. Replace this function's body with a real POST, roughly:
 *
 *        const res = await fetch(`${FEEDBACK_ENDPOINT_URL}/feedback`, {
 *          method: 'POST',
 *          headers: { 'Content-Type': 'application/json' },
 *          body: JSON.stringify(payload),
 *        })
 *        if (!res.ok) throw new Error(`Feedback submit failed: ${res.status}`)
 *        return { ok: true, demo: false }
 *
 *      A plain `fetch` is enough here — unlike aiService.ts's own
 *      `postJson`, feedback needs no `Authorization` bearer token, no
 *      spend-cap handling, no 190s abort budget, since it never calls
 *      an AI provider and was never meant to be gated by the AI
 *      access code.
 *   2. Set `RATE_NIBRAS_ENABLED` to `true` in src/config/features.ts.
 *
 * RateNibras.tsx does not need to change either way — it already
 * `await`s this function and already has an honest, translated error
 * state for a rejected promise, so a real failure there (a genuine
 * network error, a 500, etc.) surfaces correctly the moment step 1
 * above ships.
 */

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
  /** True whenever this ran the stub path above rather than a real
   * network call — same honesty convention as aiService.ts's
   * `SummarizeResult`/`ExplainResult`/etc. Not currently surfaced in
   * RateNibras.tsx's UI (its thank-you message is worded to stay true
   * either way), kept on the result anyway so a future real
   * implementation and this stub share one type. */
  demo: boolean
}

export async function submitFeedback(payload: FeedbackPayload): Promise<SubmitFeedbackResult> {
  // STUB — see this file's own header for the exact activation steps.
  // Deliberately no network call: there is nowhere real to send this
  // yet, and pretending otherwise would be dishonest. This still logs
  // to the console (rather than doing nothing at all) so a developer
  // testing locally with the RATE_NIBRAS_ENABLED flag on can confirm
  // exactly what a real reader's submission would have contained.
  console.info('[Nibras feedback] stub only, not sent anywhere yet:', payload)
  return { ok: true, demo: true }
}
