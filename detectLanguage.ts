import type { DocumentSection } from './documents'

/**
 * A document's script is a property of its *content*, not of whatever
 * UI language the reader happens to have selected — an Arabic-UI
 * reader opening an English PDF should still get Latin typography and
 * left-to-right text, not Arabic settings forced onto English text.
 * (Found by actually opening a real English PDF while the UI was in
 * Arabic and seeing exactly that mismatch, before this fix.)
 *
 * A single document is also not necessarily *one* script throughout —
 * for a bilingual-first product, a section/page/chapter quoting the
 * other language is a realistic case, not a corner case (confirmed
 * with this project's own mixed-language test PDF, where an Arabic
 * page was still being forced into Latin typography because only the
 * document's dominant language was checked). tagSectionLanguages
 * detects each section's own script individually.
 */

// The `g` flag is load-bearing: without it, String.match() returns at
// most one match, so arabicCount would always be 0 or 1 regardless of
// how much Arabic is actually present — confirmed the hard way (every
// section of a real mixed-language test PDF came back tagged 'en',
// including an 80%-Arabic page, until this was fixed).
const ARABIC_RE = /[؀-ۿݐ-ݿ]/g

/** Samples the first ~2000 characters (enough to judge, cheap even for
 * a whole book) and falls back to `fallback` when there isn't enough
 * alphabetic signal to be confident (e.g. a mostly-numeric or very
 * short text). */
export function detectLanguage(text: string, fallback: 'en' | 'ar'): 'en' | 'ar' {
  const sample = text.slice(0, 2000)
  const arabicCount = (sample.match(ARABIC_RE) || []).length
  const letterCount = (sample.match(/[a-zA-Z؀-ۿݐ-ݿ]/g) || []).length
  if (letterCount < 20) return fallback
  return arabicCount / letterCount > 0.3 ? 'ar' : 'en'
}

/** Detects each section's own language, falling back to `docLang`
 * when an individual section has too little text to judge on its own
 * (e.g. a near-empty page). */
export function tagSectionLanguages<T extends DocumentSection>(sections: T[], docLang: 'en' | 'ar'): T[] {
  return sections.map((s) => ({ ...s, lang: detectLanguage(s.text, docLang) }))
}
