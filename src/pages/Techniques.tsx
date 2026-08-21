import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TECHNIQUES, type TechniqueCategory } from '../content/techniques'
import { ChevronIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

const CATEGORY_ORDER: TechniqueCategory[] = ['reading', 'comprehension', 'focus']
export const CATEGORY_TITLE_KEY: Record<TechniqueCategory, string> = {
  reading: 'techniques.categoryReading',
  comprehension: 'techniques.categoryComprehension',
  focus: 'techniques.categoryFocus',
}
const CATEGORY_BLURB_KEY: Record<TechniqueCategory, string> = {
  reading: 'techniques.categoryReadingBlurb',
  comprehension: 'techniques.categoryComprehensionBlurb',
  focus: 'techniques.categoryFocusBlurb',
}

/**
 * Techniques — now a two-level drill-down (2026-08-14, task #128,
 * Amal via team-lead: «ودي لما نفتحها تكون ٣ أقسام»… «وبعدها ندخل على
 * كل قسم بصفحته»). This top page is the LANDING: 3 category entry
 * cards, each linking to its own page (`TechniqueCategoryView.tsx`),
 * which lists that category's techniques with the same `TechniqueCard`
 * grid this page used to render inline, per section.
 *
 * History, so this doesn't quietly repeat a rejected design: #33 built
 * almost this exact two-level shape (category cards -> a per-category
 * page) but ALSO added colored per-category card borders and a content
 * icon on every technique card; Amal rejected the WHOLE thing the next
 * day as «مو إبداعية» ("not creative") and it was reverted to one flat
 * page (#44), deliberately DELETING the old page rather than leaving
 * it unrouted — an explicit rejection, not a pause. This build brings
 * back the two-level NAVIGATION specifically (asked for again, by
 * name, in #128's own follow-up message), while deliberately NOT
 * reintroducing the colored borders or the per-technique icon — plain
 * cards, matching `TechniqueCard.tsx`'s own already-reverted style.
 * Flagged to team-lead for visibility, not silently assumed either way.
 *
 * The category blurb/count/"not found" copy below already existed in
 * en.json/ar.json (`categoryXBlurb`, `techniqueCount_*`,
 * `categoryNotFound*`) with ZERO live callers anywhere in the app —
 * orphaned from #33's own build, never deleted when #44 reverted the
 * JSX. Reused verbatim here rather than re-authored (already
 * bilingual; Arabic already carries the full 6-form plural set).
 *
 * Title + subtitle are both centered (Amal, same #128 message —
 * «يكون كلمة تقنيات والسطر الي تحتها بالنص») — the title already was
 * (#44); the subtitle is the one genuinely new change here.
 */
export function Techniques() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10">
      <h1 className="mb-2 text-center text-[1.75rem] font-bold text-ink">{t('techniques.title')}</h1>
      <p className="mx-auto mb-10 max-w-[46rem] text-center text-[0.9375rem] text-ink-muted">{t('techniques.subtitle')}</p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CATEGORY_ORDER.map((category) => {
          const count = TECHNIQUES.filter((tech) => tech.category === category).length
          return (
            <li
              key={category}
              className="relative rounded-card border border-line bg-card p-6 text-center transition-colors hover:border-line-strong"
            >
              <h2 className="mb-2 text-[1.125rem] font-bold text-ink">
                <Link to={`/techniques/category/${category}`} className={`${focusRing} rounded-control`}>
                  <span className="after:absolute after:inset-0 after:rounded-[inherit]">{t(CATEGORY_TITLE_KEY[category])}</span>
                </Link>
              </h2>
              <p className="m-0 mb-4 text-[0.875rem] leading-relaxed text-ink-muted">{t(CATEGORY_BLURB_KEY[category])}</p>
              <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-accent">
                {t('techniques.techniqueCount', { count })}
                <ChevronIcon className="size-3.5 rtl:-scale-x-100" />
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
