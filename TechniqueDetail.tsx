import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { getTechniqueById, buildTtsText, type EvidenceLevel, type TechniqueCategory } from '../content/techniques'
import { SpeakerButton } from '../components/techniques/SpeakerButton'
import { SpeedField, VoiceGenderField } from '../components/VoiceControls'
import { ChevronIcon } from '../components/icons'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { VOICE_RATES } from '../lib/readingSettings'
import { focusRing } from '../lib/focus'

const CATEGORY_LABEL_KEY: Record<TechniqueCategory, string> = {
  reading: 'techniques.categoryReading',
  comprehension: 'techniques.categoryComprehension',
  focus: 'techniques.categoryFocus',
}
const EVIDENCE_LABEL_KEY: Record<EvidenceLevel, string> = {
  'well-established': 'techniques.evidenceWellEstablished',
  promising: 'techniques.evidencePromising',
  weak: 'techniques.evidenceWeak',
}

/**
 * Full detail for one technique: how-to steps, why it helps, and its
 * source — plus the same read-aloud control as the grid card. Its own
 * route (/techniques/:id) rather than a modal: real back-button
 * behavior and a fresh page context for screen readers, no focus-trap
 * to get right.
 *
 * Reverted 2026-08-13 (Amal, «رجعها بتصميمها القديم مو إبداعية») along
 * with Techniques.tsx/TechniqueCard.tsx — back to a plain :id route
 * (no :category segment), the back link always returns to /techniques,
 * and the content icon badge is gone. ONE deliberate change vs the
 * true original: the title is centered.
 */
export function TechniqueDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const { speakingId, preparingId, errorId, toggle } = useSpeakingController()
  // Task #127 — voice + speed, matching Reading Buddy. Task #145 —
  // both now come from the ONE global, persisted, live-reactive voice
  // preference (was local gender state + a per-instance persisted rate).
  const { gender, setGender, rate: voiceRate, setRate: setVoiceRate } = useVoicePreference()
  const { hasVoiceFor, hasGenderChoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  const genderChoiceAvailable = hasGenderChoiceFor(lang)

  const technique = id ? getTechniqueById(id) : undefined

  if (!technique) {
    return (
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10">
        <BackLink />
        <h1 className="mb-2 text-center text-[1.75rem] font-bold text-ink">{t('techniques.notFoundTitle')}</h1>
        <p className="text-ink-muted">{t('techniques.notFoundBody')}</p>
      </main>
    )
  }

  const backCategory = technique.category

  const copy = technique[lang]
  const isSpeaking = speakingId === technique.id

  return (
    <main className="mx-auto w-full max-w-[46rem] flex-1 px-6 py-10 sm:px-10">
      <BackLink category={backCategory} />

      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex items-center rounded-control bg-accent-tint px-2.5 py-1 text-[0.75rem] font-semibold text-accent">
          {t(CATEGORY_LABEL_KEY[technique.category])}
        </span>
        <span className="inline-flex items-center rounded-control border border-line-strong px-2.5 py-1 text-[0.75rem] font-semibold text-ink-muted">
          {t(EVIDENCE_LABEL_KEY[technique.evidence])}
        </span>
      </div>

      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="m-0 flex-1 text-center text-[1.75rem] font-bold text-ink">{copy.title}</h1>
        <SpeakerButton
          lang={lang}
          isActive={isSpeaking}
          isPreparing={preparingId === technique.id}
          onToggle={() => toggle(technique.id, buildTtsText(technique, lang), lang, { gender, rate: voiceRate })}
        />
      </div>

      {/* Voice + speed (task #127) — matching Reading Buddy, only shown
          once there's something to control (a real voice for `lang`). */}
      {voiceAvailable && (
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          {genderChoiceAvailable && (
            <VoiceGenderField
              legend={t('readingBuddy.voiceLabel')}
              value={gender}
              onChange={setGender}
              voice1Label={t('readingBuddy.voice1')}
              voice2Label={t('readingBuddy.voice2')}
            />
          )}
          <SpeedField legend={t('readingBuddy.speedLabel')} value={voiceRate} options={VOICE_RATES} onChange={setVoiceRate} />
        </div>
      )}

      {errorId === technique.id && (
        <p role="alert" className="mb-6 text-center text-[0.8125rem] text-ink-muted">
          {t('techniques.voiceUnavailable')}
        </p>
      )}

      <p className="mb-8 text-[1.0625rem] leading-relaxed text-ink">{copy.summary}</p>

      <section aria-labelledby="howto-heading" className="mb-8">
        <h2 id="howto-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('techniques.howToTitle')}
        </h2>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {copy.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex size-6 flex-none items-center justify-center rounded-full bg-accent-tint text-[0.8125rem] font-bold text-accent">
                {index + 1}
              </span>
              <span className="pt-0.5 text-[0.9375rem] leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why-heading" className="mb-2 rounded-card border border-line bg-card p-5">
        <h2 id="why-heading" className="mb-2 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('techniques.whyItHelpsTitle')}
        </h2>
        <p className="mb-3 text-[0.9375rem] leading-relaxed text-ink">{copy.whyItHelps}</p>
        {copy.evidenceNote && (
          <p className="mb-3 text-[0.8125rem] leading-relaxed text-ink-muted italic">{copy.evidenceNote}</p>
        )}
        <p className="m-0 text-[0.8125rem] leading-relaxed text-ink-muted">
          <strong className="font-semibold text-ink">{t('techniques.sourceLabel')}:</strong> {copy.source}
        </p>
      </section>
    </main>
  )
}

/**
 * Back link (task #128) — now a real breadcrumb-style "up one level"
 * rather than always jumping to the top: with a known `category` (the
 * normal case — every real technique has one), it returns to that
 * category's own page and labels itself with the category's name
 * (reusing the existing `techniques.categoryX` keys, already used for
 * this exact wording elsewhere — no new copy needed). Falls back to
 * the generic top-level "Techniques" link + label only for the
 * not-found case above, where there's no category to know.
 */
function BackLink({ category }: { category?: TechniqueCategory }) {
  const { t } = useTranslation()
  const to = category ? `/techniques/category/${category}` : '/techniques'
  const label = category ? t(CATEGORY_LABEL_KEY[category]) : t('techniques.backToTechniques')
  return (
    <Link
      to={to}
      className={`mb-6 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-ink-muted hover:text-accent ${focusRing}`}
    >
      <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
      {label}
    </Link>
  )
}
