import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocumentSection, ReaderDocument } from '../lib/documents'
import { isAiBackendConfigured, translate } from '../lib/aiService'

export type TranslationStatus = 'idle' | 'translating' | 'error'

/**
 * Auto-translates the Reader's currently-open document when the app's
 * UI language is SWITCHED while it's open (task #112, 2026-08-14,
 * Amal: «خليها تلقائية بدال زر الترجمة» — automatic, not a button).
 * Extracted from Reader.tsx into its own hook purely for size/
 * organization — Reader.tsx was already large before this, and this
 * piece (cache + effect + orchestration) is self-contained enough to
 * test and reason about on its own, even with a single consumer today.
 *
 * NON-DESTRUCTIVE, the explicit safety requirement that makes
 * "automatic" acceptable: the document's own `sections` (from
 * useDocuments) are NEVER mutated — this hook only ever ADDS a
 * parallel, in-memory translated copy alongside the original, keyed by
 * `${docId}:${targetLang}` in a `useRef` Map (a pure cache, doesn't
 * need to itself trigger re-renders). Switching the UI language BACK
 * to the document's own original language shows the untouched
 * original again — no re-translate, no loss, because nothing was ever
 * overwritten in the first place. Switching to a language already
 * translated this session reuses the cache instantly, no repeat paid
 * call. A translated section keeps the SAME array length/order/title
 * as the original (only `text`/`lang` change per section) specifically
 * so `currentSectionIndex` — and therefore bookmarks/notes, which
 * reference it — stays valid regardless of which language is showing.
 *
 * Deliberately does NOT translate on a plain document OPEN, even if
 * the UI language already differs from the document's own language at
 * that moment (a normal, already-supported case — see Reader.tsx's own
 * `isContentArabic`, which has always let content and UI language
 * differ) — only a genuine language CHANGE while a document is already
 * open counts as "switching," matching the brief exactly and avoiding
 * an unwanted paid call just from opening a document in a differently-
 * configured UI.
 *
 * Demo-now/real-when-keyed, but with NO demo/canned path at all (see
 * lib/aiService.ts's own `translate()` comment for why a fake
 * translation would be actively dishonest here) — this hook now does
 * NOTHING AT ALL on a language switch whenever no backend is
 * configured (task #143, 2026-08-14): Reader.tsx's own language-
 * switch effect owns that scenario completely (reset the view + a
 * per-language auto-reopen), superseding this hook's earlier
 * "leave the original text up with an 'unavailable' notice"
 * behavior, which read as exactly the "nothing switches" gap Amal
 * flagged. This hook is therefore only ever active on an AI-backend
 * build (branch B of #143's hybrid split) — B is unchanged from #112.
 */
export function useContentTranslation(document: ReaderDocument | undefined) {
  const { i18n } = useTranslation()
  const cacheRef = useRef(new Map<string, DocumentSection[]>())
  const prevLangRef = useRef(i18n.language)
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

  useEffect(() => {
    const newLang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    const changed = prevLangRef.current !== i18n.language
    prevLangRef.current = i18n.language
    // Only a genuine switch, and only with real content open — see this
    // hook's own header comment for why a plain open doesn't count.
    if (!changed || !document) return

    setShowOriginalOverride(false)

    if (newLang === document.lang) {
      setActiveLang(null)
      setStatus('idle')
      return
    }

    const cacheKey = `${document.id}:${newLang}`
    if (cacheRef.current.has(cacheKey)) {
      setActiveLang(newLang)
      setStatus('idle')
      return
    }

    // Task #143 (2026-08-14): on the on-device build, a genuine
    // language switch is now Reader.tsx's OWN responsibility entirely
    // — it resets the open-document view and offers a per-language
    // auto-reopen instead of this hook's old "leave the original text
    // up with an 'unavailable' notice" behavior. Setting `status`
    // here would be dead/misleading: Reader.tsx's reset makes
    // `currentDocument` (and therefore this hook's `document` param)
    // undefined in the same update, so the notice this used to drive
    // could never usefully render anyway. A clean early return keeps
    // `status` at its default 'idle' rather than a value nothing ever
    // shows.
    if (!isAiBackendConfigured()) {
      return
    }

    let cancelled = false
    setStatus('translating')
    ;(async () => {
      try {
        const translatedSections = await Promise.all(
          document.sections.map(async (section): Promise<DocumentSection> => {
            const sourceLang = section.lang ?? document.lang
            const { translatedText } = await translate(section.text, sourceLang, newLang)
            return { title: section.title, text: translatedText, lang: newLang }
          }),
        )
        if (cancelled) return
        cacheRef.current.set(cacheKey, translatedSections)
        setActiveLang(newLang)
        setStatus('idle')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
    // document is read fresh inside the effect body (`.sections`,
    // `.lang`) but intentionally NOT listed here — only its stable
    // `.id` is (via the reset effect above already handling document
    // CHANGES); depending on the whole object would re-fire this
    // effect on every unrelated document mutation elsewhere in the app
    // (a bookmark added, a note saved, position auto-save — all of
    // which create a new object reference for the same document via
    // useDocuments' own immutable-update pattern) even though nothing
    // translation-relevant changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, document?.id, document?.lang])

  const cachedSections = activeLang && document ? cacheRef.current.get(`${document.id}:${activeLang}`) : undefined
  const isShowingTranslation = Boolean(cachedSections) && !showOriginalOverride

  return {
    /** Undefined means "use the document's own original sections" —
     * only set while a cached translation is active and not overridden. */
    sections: isShowingTranslation ? cachedSections : undefined,
    isShowingTranslation,
    status,
    showOriginalOverride,
    toggleShowOriginal: () => setShowOriginalOverride((v) => !v),
  }
}
