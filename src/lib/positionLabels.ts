import type { Position, ReaderDocument } from './documents'
import { isolateLtr } from './bidi'

/** A translate function shaped like react-i18next's `t` — kept generic
 * so this stays a plain, testable function rather than a hook, while
 * still producing localized labels. */
type Translate = (key: string, opts?: Record<string, unknown>) => string

const UNIT_KEY: Record<ReaderDocument['sourceType'], string> = {
  pdf: 'reader.unitPage',
  epub: 'reader.unitChapter',
  txt: 'reader.unitSection',
  // Task #465 — a .docx has no comparable built-in navigation unit of
  // its own (unlike a PDF's pages or an EPUB's spine chapters), so it
  // gets the same artificial-chunk "section" unit txt/pasted/example
  // already use, not a new unit of its own.
  docx: 'reader.unitSection',
  pasted: 'reader.unitSection',
  example: 'reader.unitSection',
}

/** "42% through" for a single-section document; "Page 3 · 42%" or
 * (EPUB, when a chapter title is known) "Introduction · 42%" once a
 * document is paginated. */
export function describePosition(document: ReaderDocument, position: Position, t: Translate): string {
  const percent = Math.round(position.fraction * 100)
  if (document.sections.length <= 1) {
    return t('reader.percentThrough', { percent: isolateLtr(`${percent}%`) })
  }
  const section = document.sections[position.sectionIndex]
  const location =
    section?.title ||
    t('reader.locationNumbered', {
      unit: t(UNIT_KEY[document.sourceType]),
      number: isolateLtr(position.sectionIndex + 1),
    })
  return t('reader.positionLabel', { location, percent: isolateLtr(`${percent}%`) })
}

/** "Page 3 of 12" / "Chapter 3 of 12: Introduction" / "Section 3 of 12". */
export function describeProgress(document: ReaderDocument, sectionIndex: number, t: Translate): string {
  const unit = t(UNIT_KEY[document.sourceType])
  const total = document.sections.length
  const title = document.sections[sectionIndex]?.title
  const base = t('reader.progressLabel', { unit, current: isolateLtr(sectionIndex + 1), total: isolateLtr(total) })
  return title ? `${base}: ${title}` : base
}
