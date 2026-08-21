import { useTranslation } from 'react-i18next'
import type { ReaderDocument } from '../../lib/documents'
import { describeProgress } from '../../lib/positionLabels'
import { ChevronIcon } from '../icons'
import { focusRingInset } from '../../lib/focus'

/** Prev/Next + a progress indicator, shown whenever the open document
 * has more than one section (page/chapter). Hidden entirely for a
 * short pasted text that only produced one section, so nothing changes
 * for the common "paste a paragraph" case. */
export function SectionNav({
  document,
  sectionIndex,
  onPrev,
  onNext,
}: {
  document: ReaderDocument
  sectionIndex: number
  onPrev: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const total = document.sections.length
  if (total <= 1) return null

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={sectionIndex === 0}
        className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-semibold text-ink-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-accent-tint enabled:hover:text-accent ${focusRingInset}`}
      >
        <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
        {t('reader.prev')}
      </button>

      <p className="m-0 text-center text-[0.8125rem] text-ink-muted">
        {describeProgress(document, sectionIndex, t)}
      </p>

      <button
        type="button"
        onClick={onNext}
        disabled={sectionIndex >= total - 1}
        className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-semibold text-ink-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-accent-tint enabled:hover:text-accent ${focusRingInset}`}
      >
        {t('reader.next')}
        <ChevronIcon className="size-4 rtl:-scale-x-100" />
      </button>
    </div>
  )
}
