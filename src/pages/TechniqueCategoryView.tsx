import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { TECHNIQUES, buildTtsText, type TechniqueCategory } from '../content/techniques'
import { TechniqueCard } from '../components/techniques/TechniqueCard'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { ChevronIcon } from '../components/icons'
import { focusRing } from '../lib/focus'
import { CATEGORY_TITLE_KEY } from './Techniques'

const CATEGORY_BLURB_KEY: Record<TechniqueCategory, string> = {
  reading: 'techniques.categoryReadingBlurb',
  comprehension: 'techniques.categoryComprehensionBlurb',
  focus: 'techniques.categoryFocusBlurb',
}
const VALID_CATEGORIES: readonly string[] = ['reading', 'comprehension', 'focus']

function isTechniqueCategory(value: string | undefined): value is TechniqueCategory {
  return value !== undefined && VALID_CATEGORIES.includes(value)
}

/**
 * One category's own page (task #128) — the middle level of the
 * Techniques drill-down: category landing (`Techniques.tsx`) -> HERE
 * -> a single technique's own detail (`TechniqueDetail.tsx`, its back
 * link now points back to THIS page — see that file's own comment).
 * Same `TechniqueCard` grid + read-aloud the flat page used to render
 * inline per section, just scoped to one category and given its own
 * route/URL so browser back/forward and a direct link both work.
 *
 * An unknown `:category` (bad URL, not a real navigation path in this
 * app) shows the same honest not-found pattern `TechniqueDetail.tsx`
 * already uses for a bad `:id`, reusing the `categoryNotFound*` keys
 * that were already sitting in both locale files, unused, from #33.
 */
export function TechniqueCategoryView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const { category } = useParams<{ category: string }>()
  const { speakingId, preparingId, errorId, toggle } = useSpeakingController()
  // Task #145/#194 — honor the ONE global, persisted voice preference
  // (Voice 1/Voice 2 + speed) the header control sets, exactly as the
  // technique DETAIL page already does. Without passing these through,
  // this category page's card read-aloud silently fell back to speak()'s
  // own defaults (first voice + rate 1), ignoring the reader's choice.
  const { gender, rate } = useVoicePreference()

  if (!isTechniqueCategory(category)) {
    return (
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10">
        <BackLink />
        <h1 className="mb-2 text-center text-[1.75rem] font-bold text-ink">{t('techniques.categoryNotFoundTitle')}</h1>
        <p className="text-center text-ink-muted">{t('techniques.categoryNotFoundBody')}</p>
      </main>
    )
  }

  const items = TECHNIQUES.filter((tech) => tech.category === category)

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10">
      <BackLink />
      <h1 className="mb-2 text-center text-[1.75rem] font-bold text-ink">{t(CATEGORY_TITLE_KEY[category])}</h1>
      <p className="mx-auto mb-10 max-w-[46rem] text-center text-[0.9375rem] text-ink-muted">{t(CATEGORY_BLURB_KEY[category])}</p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((technique) => (
          <TechniqueCard
            key={technique.id}
            technique={technique}
            isSpeaking={speakingId === technique.id}
            isPreparing={preparingId === technique.id}
            onToggleSpeak={() => toggle(technique.id, buildTtsText(technique, lang), lang, { gender, rate })}
          />
        ))}
      </ul>
      {errorId !== null && (
        <p role="alert" className="mt-4 text-center text-[0.8125rem] text-ink-muted">
          {t('techniques.voiceUnavailable')}
        </p>
      )}
    </main>
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/techniques"
      className={`mb-6 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-ink-muted hover:text-accent ${focusRing}`}
    >
      <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
      {t('techniques.backToTechniques')}
    </Link>
  )
}
