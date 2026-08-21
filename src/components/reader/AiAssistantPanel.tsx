import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDemoAiResponse } from '../../content/demoAiResponses'
import { EXAMPLE_TEXTS } from '../../content/exampleTexts'
import { AccessTokenError, explain, isAiBackendConfigured, SpendCapError, summarize, type AiLang } from '../../lib/aiService'
import { focusRing } from '../../lib/focus'
import { ChatIcon } from '../icons'

type Mode = 'summary' | 'explanation'

/**
 * AI Assistant — summarize or explain the text currently shown in the
 * Reader. Third and last of the 3 AI-feature slices (Reading Buddy,
 * Mind Maps, this one), same DEMO-now/REAL-when-keyed pattern through
 * lib/aiService.ts.
 *
 * DEMO mode (today, no backend configured): only works on the 2 known
 * example texts (content/demoAiResponses.ts, hand-written canned
 * summaries/explanations) — matched by comparing the CURRENTLY
 * DISPLAYED text against content/exampleTexts.ts, not by document id
 * (an example opened via the Reader gets a content-hash id, same
 * reasoning already used for Mind Maps' "Your documents" honesty
 * scope). Arbitrary pasted/uploaded/sample text shows an honest "needs
 * an AI connection" message instead of the summarize/explain buttons —
 * never a fake generated response.
 * REAL mode (once VITE_AI_BACKEND_URL is set): works on ANY text, no
 * example-matching needed — aiService.summarize()/explain() call the
 * backend directly in that case, matching how they're already written.
 *
 * Always rendered (like ReadingBuddyPlayer), never hidden outright when
 * unavailable — same "explain honestly, don't just disappear" pattern
 * as Mind Maps and the Dashboard's other not-yet-built cards.
 */
export function AiAssistantPanel({ text, lang }: { text: string; lang: AiLang }) {
  const { t } = useTranslation()
  const matchingExample = EXAMPLE_TEXTS.find((ex) => ex.text === text)
  const demoResponse = matchingExample ? getDemoAiResponse(matchingExample.id, matchingExample.lang) : undefined
  const backendConfigured = isAiBackendConfigured()
  const available = backendConfigured || Boolean(demoResponse)

  const [mode, setMode] = useState<Mode | null>(null)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [explanationText, setExplanationText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // 'generic' = the pre-existing catch-all message. 'tokenCap'/
  // 'globalCap' = task #219's honest 402 handling, split by
  // SpendCapError's own `reason` (AI-on honesty pass, 2026-08-19, spec
  // in teamlead/ai-on-honesty-copy-spec.md): 'tokenCap' = this
  // volunteer's own per-code budget is spent, PERMANENT for the pilot
  // (never "try again later" — that would be dishonest); 'globalCap' =
  // the shared service-wide backstop, genuinely TEMPORARY. An
  // AccessTokenError sets NEITHER — the globally-mounted <AccessGate>
  // has already reopened itself with its own "enter your code" message
  // (aiService.ts's postJson calls reportInvalidToken() before
  // throwing), so showing a SECOND, local error here would be
  // redundant/competing messaging for the same one problem.
  const [errorKind, setErrorKind] = useState<'generic' | 'tokenCap' | 'globalCap' | null>(null)

  async function runSummarize() {
    setMode('summary')
    if (summaryText !== null) return
    setLoading(true)
    setErrorKind(null)
    try {
      if (backendConfigured) {
        setSummaryText((await summarize(text, lang)).summary)
      } else if (demoResponse) {
        setSummaryText(demoResponse.summary)
      }
    } catch (err) {
      if (err instanceof AccessTokenError) {
        // Handled globally — see the comment on errorKind above.
      } else if (err instanceof SpendCapError) {
        setErrorKind(err.reason === 'global_cap_reached' ? 'globalCap' : 'tokenCap')
      } else {
        setErrorKind('generic')
      }
    } finally {
      setLoading(false)
    }
  }

  async function runExplain() {
    setMode('explanation')
    if (explanationText !== null) return
    setLoading(true)
    setErrorKind(null)
    try {
      if (backendConfigured) {
        setExplanationText((await explain(text, lang)).explanation)
      } else if (demoResponse) {
        setExplanationText(demoResponse.explanation)
      }
    } catch (err) {
      if (err instanceof AccessTokenError) {
        // Handled globally — see the comment on errorKind above.
      } else if (err instanceof SpendCapError) {
        setErrorKind(err.reason === 'global_cap_reached' ? 'globalCap' : 'tokenCap')
      } else {
        setErrorKind('generic')
      }
    } finally {
      setLoading(false)
    }
  }

  const resultText = mode === 'summary' ? summaryText : mode === 'explanation' ? explanationText : null

  return (
    <section aria-labelledby="ai-assistant-heading" className="mt-7 rounded-card border border-line bg-card p-5">
      <h2 id="ai-assistant-heading" className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
        <ChatIcon className="size-[18px] text-accent" />
        {t('aiAssistant.title')}
        {/* «قريبًا / Coming soon» (Amal's decision, 2026-08-14 pre-pilot
            batch — "العرض مع ذكاء واكتب جنبه قريبا": keep showing the
            real, working (demo-mode) AI Assistant, don't hide it, but
            label it honestly as present-but-not-fully-live yet. Gated
            on the SAME `backendConfigured` switch as the existing
            "Demo" badge below (task #120's self-correcting pattern) —
            deliberately not a separate flag, so this label disappears
            on its own the moment a real backend is ever configured,
            with nothing to remember to undo by hand. FINAL copy
            decision (Skywalker + nibras-english + nibras-ar,
            2026-08-14, Option 1): reuses `dashboard.comingSoonBadge`
            (revived — was orphaned since ComingSoonToolCard/
            ComingSoonNavItem were both removed 2026-08-13) rather than
            a new AI-specific key, so there's ONE "coming soon" string
            across the whole app, not a second one to keep in sync.
            Two badge LEVELS coexist on purpose, not a duplicate: this
            one is feature-level ("the full, own-text version is
            coming"); `demoBadge` below is output-level ("this specific
            answer is a canned example"). */}
        {!backendConfigured && (
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
            {t('dashboard.comingSoonBadge')}
          </span>
        )}
      </h2>

      {!available ? (
        <p className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('aiAssistant.unavailableBody')}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runSummarize}
              aria-pressed={mode === 'summary'}
              className={`rounded-control border-[1.5px] border-line-strong px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${focusRing}`}
            >
              {t('aiAssistant.summarizeButton')}
            </button>
            <button
              type="button"
              onClick={runExplain}
              aria-pressed={mode === 'explanation'}
              className={`rounded-control border-[1.5px] border-line-strong px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${focusRing}`}
            >
              {t('aiAssistant.explainButton')}
            </button>
            {!backendConfigured && (
              <span className="ms-auto rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
                {t('aiAssistant.demoBadge')}
              </span>
            )}
          </div>

          <div role="status" aria-live="polite" className="mt-3">
            {loading && <p className="m-0 text-[0.875rem] italic text-ink-muted">{t('aiAssistant.loading')}</p>}
            {!loading && errorKind === 'generic' && <p className="m-0 text-[0.875rem] text-ink-muted">{t('aiAssistant.errorMessage')}</p>}
            {!loading && errorKind === 'tokenCap' && <p className="m-0 text-[0.875rem] text-ink-muted">{t('aiAssistant.limitReachedTokenCap')}</p>}
            {!loading && errorKind === 'globalCap' && <p className="m-0 text-[0.875rem] text-ink-muted">{t('aiAssistant.limitReachedGlobalCap')}</p>}
            {!loading && !errorKind && resultText && (
              <p className="m-0 text-[0.9375rem] leading-relaxed text-ink">{resultText}</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
