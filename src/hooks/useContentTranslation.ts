import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocumentSection, ReaderDocument } from '../lib/documents'
import { isAiBackendConfigured, translate } from '../lib/aiService'

export type TranslationStatus = 'idle' | 'translating' | 'error'

// Amal, 2026-09-14 (live-preview P1): a real xAI translate call measured
// anywhere from ~7s to ~23s in practice — plenty long enough that a
// reader switching languages mid-document, seeing only the existing
// small `reader.translating` status LINE while the passage below kept
// showing fully-legible, full-contrast, unchanged old-language text,
// reasonably concluded the switch "didn't do anything" and moved on
// before the (real, working) translation ever finished. The mechanism
// itself was never broken — Reader.tsx dims the stale passage to this
// opacity for the whole `translating` window so the passage ITSELF
// visibly looks "in progress," not just a small note above it. Same
// spirit as readingSettings.ts's DIMMER_MAX_OPACITY (still legible if a
// reader wants to keep going, just clearly de-emphasised) — a distinct
// constant because it answers a different question ("is this text
// stale/updating") than either of that file's own dimming constants.
export const TRANSLATING_OPACITY = 0.5

/**
 * Translates the Reader's currently-open document into the UI's
 * language, ON REQUEST (task #112 built this as automatic-on-switch;
 * 2026-09-15's live-preview interactive audit — Amal via team-lead —
 * reversed that specific piece: a language switch is a GLOBAL, page-
 * wide chrome action a reader takes for many reasons that have nothing
 * to do with "translate the specific document I happen to have open" —
 * firing a paid AI call and risking a same-instant AccessGate pop-up as
 * a silent SIDE EFFECT of that toggle surprised readers, exactly the
 * "did the switch even do anything?" gap this file's own git history
 * already fought once for the on-device build. See Reader.tsx's
 * language-switch effect for the OTHER half of this fix: the built-in
 * EXAMPLE now swaps to its other-language sibling directly and for
 * free (content/exampleTexts.ts's static pair), no AI/gate involved at
 * all, and a real opened/pasted document's own text is never touched
 * by a plain language switch any more — only this hook's `requestTranslate()`,
 * called from an explicit button the reader presses, ever calls the
 * real backend now.
 *
 * NON-DESTRUCTIVE (unchanged): the document's own `sections` (from
 * useDocuments) are NEVER mutated — this hook only ever ADDS a
 * parallel, in-memory translated copy alongside the original, keyed by
 * `${docId}:${targetLang}` in a `useRef` Map (a pure cache, doesn't
 * need to itself trigger re-renders). Requesting a translation into a
 * language already cached this session reuses it instantly, no repeat
 * paid call. A translated section keeps the SAME array length/order/
 * title as the original (only `text`/`lang` change per section)
 * specifically so `currentSectionIndex` — and therefore bookmarks/
 * notes, which reference it — stays valid regardless of which language
 * is showing.
 *
 * No demo/canned path (unchanged — see lib/aiService.ts's own
 * `translate()` comment for why a fake translation would be actively
 * dishonest here): `requestTranslate()` is a no-op when no backend is
 * configured, same as every other AI surface in the demo build.
 */
export function useContentTranslation(document: ReaderDocument | undefined) {
  const { i18n } = useTranslation()
  const cacheRef = useRef(new Map<string, DocumentSection[]>())
  const [status, setStatus] = useState<TranslationStatus>('idle')
  const [activeLang, setActiveLang] = useState<'en' | 'ar' | null>(null)
  const [showOriginalOverride, setShowOriginalOverride] = useState(false)

  // A fresh document (a new open, or none at all) always starts
  // showing its own original — no carryover from whatever the
  // PREVIOUS document happened to be showing.
  useEffect(() => {
    setActiveLang(null)
    setStatus('idle')
    setShowOriginalOverride(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id])

  // If the UI language changes to match the document's OWN language
  // while a translation is active, showing a "translation" into the
  // language the original is already written in is just confusing —
  // snap back to the (now directly readable) original automatically.
  // This is the one language-reactive effect left in this file; it
  // never calls the network, only clears local state.
  useEffect(() => {
    const newLang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    if (document && activeLang && newLang === document.lang) {
      setActiveLang(null)
      setShowOriginalOverride(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, document?.lang])

  const newLang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
  const cachedSections = activeLang && document ? cacheRef.current.get(`${document.id}:${activeLang}`) : undefined
  const isShowingTranslation = Boolean(cachedSections) && !showOriginalOverride

  /** True exactly when there's something worth offering a translate
   * button for: a real document is open, in a language that doesn't
   * match the current UI, and we're not already showing a translated
   * view of it. Reader.tsx uses this to decide whether to render the
   * offer/retry button at all. */
  const canOfferTranslate = Boolean(document) && document?.lang !== newLang && !isShowingTranslation

  /** Called from an explicit "Translate" button click — never from an
   * effect. Reuses a same-session cached translation instantly; only
   * calls the real backend on a genuine cache miss. */
  async function requestTranslate() {
    if (!document || document.lang === newLang) return
    setShowOriginalOverride(false)

    const cacheKey = `${document.id}:${newLang}`
    if (cacheRef.current.has(cacheKey)) {
      setActiveLang(newLang)
      setStatus('idle')
      return
    }

    if (!isAiBackendConfigured()) return

    setStatus('translating')
    try {
      const translatedSections = await Promise.all(
        document.sections.map(async (section): Promise<DocumentSection> => {
          const sourceLang = section.lang ?? document.lang
          const { translatedText } = await translate(section.text, sourceLang, newLang)
          return { title: section.title, text: translatedText, lang: newLang }
        }),
      )
      cacheRef.current.set(cacheKey, translatedSections)
      setActiveLang(newLang)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return {
    /** Undefined means "use the document's own original sections" —
     * only set while a cached translation is active and not overridden. */
    sections: isShowingTranslation ? cachedSections : undefined,
    isShowingTranslation,
    status,
    showOriginalOverride,
    toggleShowOriginal: () => setShowOriginalOverride((v) => !v),
    canOfferTranslate,
    requestTranslate,
  }
}
