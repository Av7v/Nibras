import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Technique } from '../../content/techniques'
import { ChevronIcon } from '../icons'
import { SpeakerButton } from './SpeakerButton'
import { focusRing } from '../../lib/focus'

const CATEGORY_LABEL_KEY: Record<Technique['category'], string> = {
  reading: 'techniques.categoryReading',
  comprehension: 'techniques.categoryComprehension',
  focus: 'techniques.categoryFocus',
}

/**
 * A compact grid card: category badge + title + summary, a per-card
 * read-aloud button, and a "stretched link" over the title so the
 * whole card is clickable while the accessible name stays just the
 * title text (same pattern proven for the Reader's bookmark/note
 * lists). Reverted 2026-08-13 (Amal, «رجعها بتصميمها القديم مو
 * إبداعية») to this original flat-grid shape — the per-technique
 * content icon and the category-nested link both belonged to the
 * 3-category redesign she rejected after seeing it; back to a plain
 * category text badge and a direct /techniques/:id link. ONE
 * deliberate change vs the true original: the title is centered
 * (Amal, same feedback message — «حط كل العناوين بالنص»).
 */
export function TechniqueCard({
  technique,
  isSpeaking,
  onToggleSpeak,
  isPreparing = false,
}: {
  technique: Technique
  isSpeaking: boolean
  onToggleSpeak: () => void
  isPreparing?: boolean
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const copy = technique[lang]

  return (
    <li className="relative rounded-card border border-line bg-card p-5 transition-colors hover:border-line-strong">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-control bg-accent-tint px-2.5 py-1 text-[0.75rem] font-semibold text-accent">
          {t(CATEGORY_LABEL_KEY[technique.category])}
        </span>
        <SpeakerButton lang={lang} isActive={isSpeaking} isPreparing={isPreparing} onToggle={onToggleSpeak} size="sm" />
      </div>

      <h3 className="mb-1.5 text-center text-[1.0625rem] font-bold text-ink">
        <Link to={`/techniques/${technique.id}`} className={`${focusRing} rounded-control`}>
          <span className="after:absolute after:inset-0 after:rounded-[inherit]">{copy.title}</span>
        </Link>
      </h3>
      <p className="m-0 pe-6 text-[0.875rem] leading-relaxed text-ink-muted">{copy.summary}</p>

      <ChevronIcon className="absolute end-5 bottom-5 size-4 text-line-strong rtl:-scale-x-100" />
    </li>
  )
}
