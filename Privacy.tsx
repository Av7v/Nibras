import { useTranslation } from 'react-i18next'
import { isAiBackendConfigured } from '../lib/aiService'
import { PRIVACY_SECTIONS, PRIVACY_SUMMARY, buildPrivacyTtsText } from '../content/privacyPolicy'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { SpeakerIcon, StopIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

const SPEAKING_ID = 'privacy-policy'

/**
 * The real bilingual Privacy Policy — content lives in
 * content/privacyPolicy.ts (grounded in Nibras's actual architecture,
 * see that file's own header comment). This page just renders it:
 * a scannable "In short" summary card, then the full policy as plain
 * sections, in the app's reading typography (same measure/leading as
 * TechniqueDetail.tsx's long-form content) — no separate content-
 * management here, so the policy can never silently drift from what
 * this component displays.
 *
 * Moved into the sidebar AppShell 2026-08-13 (nibras-qa P1-11) —
 * previously kept on a separate top-nav Layout as "not one of the
 * app's core tools", but QA found that made it read like a different
 * app mid-session with no real functional reason for the split.
 * SignIn moved alongside it, same reasoning.
 *
 * Read-aloud (task #86, 2026-08-14, Amal — «تخليها فيها قارئ») — one
 * whole-page "Listen to this policy" control, matching Mind Maps' own
 * "Listen to map" pill (a labeled button, not a bare icon — this is a
 * whole-document action, not a per-item one). Reuses the SAME simple
 * path every other static-content surface uses (SpeakerButton's own
 * mechanism via `useSpeakingController`/`useSpeechVoices`, browser
 * voice today) rather than CalmSpace/Reading Buddy's bespoke
 * `synthesizeVoice()` route — those two exist because they need
 * pacing/pitch control this plain document-listen doesn't; Privacy is
 * content-shaped like Techniques/Mind Maps/the Guide, not like a
 * pacer. Flagged to team-lead: this choice means Privacy's read-aloud
 * stays browser-voice-only even once a real backend is configured,
 * same as those other three surfaces already are — easy to change to
 * the CalmSpace-style route later if a real narrated voice is wanted
 * here specifically.
 */
export function Privacy() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const { speakingId, preparingId, errorId, toggle } = useSpeakingController()
  const { hasVoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  const isSpeaking = speakingId === SPEAKING_ID
  const isPreparing = preparingId === SPEAKING_ID

  return (
    <main className="mx-auto w-full max-w-[46rem] flex-1 px-6 py-10 sm:px-10">
      <span className="mb-2 block text-[0.8125rem] font-bold tracking-[0.08em] text-accent uppercase">
        {t('privacy.title')}
      </span>
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('privacy.pageTitle')}</h1>
      <p className="mb-4 text-[0.8125rem] text-ink-muted">
        {t('privacy.lastUpdatedLabel')}: {t('privacy.lastUpdatedDate')}
      </p>

      <div className="mb-8 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => toggle(SPEAKING_ID, buildPrivacyTtsText(lang, isAiBackendConfigured()), lang)}
          disabled={!voiceAvailable || isPreparing}
          aria-pressed={isSpeaking}
          aria-busy={isPreparing}
          title={voiceAvailable ? undefined : t('techniques.noVoice')}
          className={`inline-flex items-center gap-2 rounded-control border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${
            isSpeaking ? '' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'
          } ${focusRing}`}
        >
          {isPreparing ? (
            <SpeakerIcon className="size-4 motion-safe:animate-pulse" />
          ) : isSpeaking ? (
            <StopIcon className="size-4" />
          ) : (
            <SpeakerIcon className="size-4" />
          )}
          {isPreparing ? t('techniques.preparing') : isSpeaking ? t('techniques.stopListening') : t('privacy.listenToPolicy')}
        </button>
        {!isAiBackendConfigured() && voiceAvailable && (
          <span className="inline-flex items-center rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
            {t('readingBuddy.demoVoiceBadge')}
          </span>
        )}
      </div>

      {isPreparing && (
        <p className="mb-6 text-[0.8125rem] text-ink-muted">{t('privacy.preparingHint')}</p>
      )}

      {errorId === SPEAKING_ID && (
        <p role="alert" className="mb-6 text-[0.8125rem] text-ink-muted">
          {t('techniques.voiceUnavailable')}
        </p>
      )}

      <section aria-labelledby="privacy-summary-heading" className="mb-9 rounded-card border border-line bg-card p-5">
        <h2
          id="privacy-summary-heading"
          className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase"
        >
          {t('privacy.summaryTitle')}
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {PRIVACY_SUMMARY[lang].map((point, i) => (
            <li key={i} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-ink">
              <span aria-hidden="true" className="mt-[0.6em] size-1.5 flex-none rounded-full bg-accent" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {PRIVACY_SECTIONS.map((section) => {
        // Self-correcting AI-features claim (task #120, 2026-08-14): the
        // SAME switch that already drives every feature's own "Demo
        // voice" badge also drives which privacy copy renders here, so
        // "nothing is sent to an outside AI service" can never silently
        // go false the moment a real backend is configured — see
        // PrivacySection's own comment in content/privacyPolicy.ts.
        const realCopy = lang === 'ar' ? section.arReal : section.enReal
        const copy = realCopy && isAiBackendConfigured() ? realCopy : section[lang]
        return (
          <section key={section.id} aria-labelledby={`privacy-${section.id}-heading`} className="mb-9">
            <h2
              id={`privacy-${section.id}-heading`}
              className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase"
            >
              {copy.heading}
            </h2>
            {copy.body.map((paragraph, i) => (
              <p key={i} className="mb-3 text-[0.9375rem] leading-relaxed text-ink last:mb-0">
                {paragraph}
              </p>
            ))}
          </section>
        )
      })}

      <section aria-labelledby="privacy-contact-heading" className="rounded-card border border-line bg-card p-5">
        <h2 id="privacy-contact-heading" className="mb-2 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('privacy.contactLabel')}
        </h2>
        <p className="m-0 text-[0.9375rem] leading-relaxed text-ink-muted italic">
          {t('privacy.contactPlaceholder')}
        </p>
      </section>
    </main>
  )
}
