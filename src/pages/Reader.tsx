import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useReadingSettings } from '../hooks/useReadingSettings'
import { useDocuments } from '../hooks/useDocuments'
import { useContentTranslation } from '../hooks/useContentTranslation'
import { useHeaderSlot } from '../components/HeaderSlot'
import { SettingsPanel } from '../components/reader/SettingsPanel'
import { AiAssistantPanel } from '../components/reader/AiAssistantPanel'
import { BookmarksNotes } from '../components/reader/BookmarksNotes'
import { CalmSpace } from '../components/reader/CalmSpace'
import { ReadingBuddyPlayer } from '../components/reader/ReadingBuddyPlayer'
import { ReadingRuler } from '../components/reader/ReadingRuler'
import { SectionNav } from '../components/reader/SectionNav'
import { FileOpenButton } from '../components/reader/FileOpenButton'
import { BreathIcon, ChevronIcon, ClipboardIcon, SlidersIcon } from '../components/icons'
import { focusRing } from '../lib/focus'
import { getCurrentFraction, hashSections, scrollToFraction, type Position, type SourceType } from '../lib/documents'
import { chunkPlainText } from '../lib/textChunking'
import { detectLanguage, tagSectionLanguages } from '../lib/detectLanguage'
import { isAiBackendConfigured } from '../lib/aiService'
import type { ParsedFile } from '../lib/fileParsers'
import {
  ARABIC_TYPEFACE_LABEL_KEY,
  FONT_STACKS,
  LATIN_TYPEFACE_LABEL_KEY,
  TINTS,
  TINT_LABEL_KEY,
} from '../lib/readingSettings'
import { EXAMPLE_TEXTS, type ExampleText } from '../content/exampleTexts'

/** The Reader (Text Formatter) — v1's flagship screen: paste/type text
 * OR open a whole PDF/EPUB/.txt (parsed entirely client-side), a
 * live-personalized paginated reading view, the script-aware Reading
 * Settings panel, and Resume + Bookmarks + Notes, all on-device. */
export function Reader() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  const {
    latin,
    arabic,
    readingRuler,
    readingRulerColor,
    updateLatin,
    updateArabic,
    resetLatin,
    resetArabic,
    setReadingRuler,
    setReadingRulerColor,
  } = useReadingSettings()
  const {
    documents,
    lastDocumentId,
    lastDocumentIdByLang,
    examplesDismissed,
    openOrUpdateDocument,
    updatePosition,
    addBookmark,
    removeBookmark,
    addNote,
    removeNote,
    dismissResume,
    dismissExamples,
  } = useDocuments()

  // Resolved once at mount time, to seed the lazy initial state below.
  const [initialDoc] = useState(() => (lastDocumentId ? documents[lastDocumentId] : undefined))

  const [draftText, setDraftText] = useState(() =>
    initialDoc?.sourceType === 'pasted' ? initialDoc.sections.map((s) => s.text).join('\n\n') : '',
  )
  const [currentDocId, setCurrentDocId] = useState<string | null>(() => initialDoc?.id ?? null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(
    () => initialDoc?.position.sectionIndex ?? 0,
  )
  const [wasResumed, setWasResumed] = useState(() => Boolean(initialDoc))
  // Set whenever opening THIS document pushed the library over its
  // 10-book cap and silently dropped another one (nibras-qa P1-7) —
  // null means nothing was pruned. Session-only, not persisted: the
  // honesty duty is discharged by telling the reader right when it
  // happens, same as resumedNotice/sampleNotice below.
  const [prunedDocTitle, setPrunedDocTitle] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [calmSpaceOpen, setCalmSpaceOpen] = useState(false)
  const calmTriggerRef = useRef<HTMLButtonElement | null>(null)
  // Reading Ruler's pointer position, relative to the <article>'s own
  // box — null whenever the pointer isn't over it (feature off, or
  // mouse has left), so the ruler simply doesn't render rather than
  // sitting at a stale position. See components/reader/ReadingRuler.tsx.
  const [rulerY, setRulerY] = useState<number | null>(null)

  const articleRef = useRef<HTMLElement | null>(null)
  const pendingScrollRestore = useRef<{ fraction: number; behavior: ScrollBehavior } | null>(
    initialDoc ? { fraction: initialDoc.position.fraction, behavior: 'instant' } : null,
  )

  // Both header buttons in ONE fragment passed to a single
  // useHeaderSlot call — useHeaderSlot REPLACES the whole slot node, so
  // a second call here would clobber the settings button rather than
  // adding alongside it (see HeaderSlot.tsx's own file-level comment).
  useHeaderSlot(
    <>
      <button
        type="button"
        ref={calmTriggerRef}
        aria-label={t('calm.buttonAria')}
        onClick={() => setCalmSpaceOpen(true)}
        className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-transparent px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink ${focusRing}`}
      >
        <BreathIcon className="size-[18px]" />
        {t('calm.buttonLabel')}
      </button>
      <button
        type="button"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((open) => !open)}
        className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-transparent px-4 py-2 text-sm font-semibold text-ink-muted aria-expanded:border-accent aria-expanded:bg-accent-tint aria-expanded:text-accent ${focusRing}`}
      >
        <SlidersIcon className="size-[18px]" />
        {t('reader.openSettings')}
      </button>
    </>,
  )

  function closeCalmSpace() {
    setCalmSpaceOpen(false)
    calmTriggerRef.current?.focus()
  }

  // Restores scroll position whenever the visible section changes
  // (initial mount, resume, jump-to-bookmark-in-another-section, or a
  // plain Prev/Next). A single mechanism for all four. Also fires on
  // currentDocId changing (task #143, 2026-08-14, self-caught bug):
  // the language-switch effect's own reset-then-maybe-reopen sequence
  // can land back on the SAME sectionIndex value the state already
  // held (e.g. 0 -> 0 for two single-section documents) — that alone
  // wouldn't re-trigger this effect (React bails out when a dependency
  // is value-equal to before), silently stranding pendingScrollRestore
  // unconsumed and leaving the reopened document scrolled to the top
  // instead of its saved position. currentDocId reliably DOES change
  // in that exact case (null -> the reopened doc's real id), so adding
  // it here is a safe, purely-additive fix — it can only cause this
  // effect to also run in MORE situations where pendingScrollRestore is
  // already null, which its own internal guard already no-ops on.
  useLayoutEffect(() => {
    if (pendingScrollRestore.current !== null && articleRef.current) {
      const { fraction, behavior } = pendingScrollRestore.current
      scrollToFraction(articleRef.current, fraction, behavior)
      pendingScrollRestore.current = null
    }
  }, [currentSectionIndex, currentDocId])

  // Auto-saves position (debounced) while a real document is open.
  useEffect(() => {
    if (!currentDocId) return
    let timeout: number | undefined
    function onScroll() {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        if (articleRef.current) {
          updatePosition(currentDocId!, {
            sectionIndex: currentSectionIndex,
            fraction: getCurrentFraction(articleRef.current),
          })
        }
      }, 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timeout)
    }
  }, [currentDocId, currentSectionIndex, updatePosition])

  // Task #143 (2026-08-14, Amal via team-lead: «شغل فريق يعدّلها» — a
  // UI-language switch ar↔en in the Reader wasn't handling the open
  // reading cleanly). HYBRID split: this effect is the on-device
  // (no AI backend) half — branch B, the AI-backend build, is
  // untouched #112 auto-translate-in-place (useContentTranslation,
  // now a no-op here specifically — see that hook's own comment).
  // On a GENUINE switch (not the initial mount — prevLangRef starts
  // at the current language, exactly like useContentTranslation's own
  // pattern), reset the Reader's open-document VIEW to a clean state
  // in the new language, then look up whether THIS language has its
  // own previously-tracked document (lastDocumentIdByLang) and, if
  // so, auto-reopen it at its own saved position — symmetric in both
  // directions, since both languages populate the same map the same
  // way through openDocument.
  //
  // NON-NEGOTIABLE (never lose docs/bookmarks/notes/position): this
  // never touches `documents` or any document's own stored fields —
  // only this component's own local "what's currently displayed"
  // pointers (currentDocId/currentSectionIndex/draftText/wasResumed).
  // The outgoing document's position was already continuously
  // persisted by the auto-save effect above and by every explicit
  // navigation call site; resetting the local pointer here can't
  // undo that.
  const prevReaderLangRef = useRef(i18n.language)
  useEffect(() => {
    const changed = prevReaderLangRef.current !== i18n.language
    prevReaderLangRef.current = i18n.language
    if (!changed || isAiBackendConfigured()) return

    const newLang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    setDraftText('')
    setCurrentDocId(null)
    setCurrentSectionIndex(0)
    setWasResumed(false)

    const reopenId = lastDocumentIdByLang[newLang]
    const reopenDoc = reopenId ? documents[reopenId] : undefined
    if (reopenDoc) {
      setCurrentDocId(reopenDoc.id)
      setCurrentSectionIndex(reopenDoc.position.sectionIndex)
      pendingScrollRestore.current = { fraction: reopenDoc.position.fraction, behavior: 'instant' }
      setWasResumed(true)
    }
    // documents/lastDocumentIdByLang are read fresh inside the effect
    // body but intentionally NOT listed here, same reasoning as
    // useContentTranslation's own effect — only a genuine i18n.language
    // change should ever fire this, not every unrelated document
    // mutation (a bookmark added, position auto-saved, etc.) which
    // creates a new object reference for the same underlying data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  // A document's script is a property of its *content*, not whatever
  // UI language happens to be selected — an Arabic-UI reader opening
  // an English PDF must still get Latin typography and LTR text, not
  // Arabic settings forced onto English content. Confirmed the hard
  // way: opened a real English PDF with the UI in Arabic and watched
  // it render with Tajawal/RTL before this fix. `lang` is therefore
  // always passed in by the caller (detected from content), never
  // inferred from `isArabic` here.
  function openDocument(input: {
    sections: { title?: string; text: string }[]
    sourceType: SourceType
    title?: string
    lang: 'en' | 'ar'
  }) {
    const existing = documents[hashSections(input.sections)]
    const { id, prunedTitle } = openOrUpdateDocument(input)
    setCurrentDocId(id)
    setWasResumed(false)
    setPrunedDocTitle(prunedTitle)
    if (existing) {
      pendingScrollRestore.current = { fraction: existing.position.fraction, behavior: 'instant' }
      setCurrentSectionIndex(existing.position.sectionIndex)
    } else {
      pendingScrollRestore.current = { fraction: 0, behavior: 'instant' }
      setCurrentSectionIndex(0)
    }
  }

  function handleFormat() {
    const text = draftText.trim()
    if (!text) return
    const docLang = detectLanguage(text, isArabic ? 'ar' : 'en')
    openDocument({
      // Each chunk tagged with its own language too (not just the
      // whole paste) — a long paste can genuinely mix a quote in the
      // other language, same reasoning as file sections.
      sections: tagSectionLanguages(
        chunkPlainText(text).map((chunk) => ({ text: chunk })),
        docLang,
      ),
      sourceType: 'pasted',
      lang: docLang,
    })
  }

  function handleFileParsed(result: ParsedFile) {
    openDocument(result)
  }

  // Opens a pre-loaded example through the exact same path as a real
  // paste/file — it only becomes a real, counted document once a guest
  // deliberately does this (see content/exampleTexts.ts's file-level
  // comment on the honesty reasoning). Also dismisses the "try an
  // example" prompt — once you've tried one, showing it again after a
  // later "Start fresh" would just be clutter, not useful.
  function handleOpenExample(example: ExampleText) {
    openDocument({
      sections: tagSectionLanguages(chunkPlainText(example.text).map((chunk) => ({ text: chunk })), example.lang),
      sourceType: 'example',
      lang: example.lang,
      title: example.title,
    })
    dismissExamples()
  }

  // Only tracks the pointer while the Reading Ruler is actually on
  // (see the conditional handler props below) — no cost when it's off.
  function handleArticlePointerMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setRulerY(e.clientY - rect.top)
  }
  function handleArticlePointerLeave() {
    setRulerY(null)
  }

  function handleStartFresh() {
    // Task #143: also clears THIS document's own per-language
    // auto-reopen candidate (if it has one) — otherwise a later
    // switch-away-and-back to this same language would silently
    // re-resume the exact document Start Fresh just cleared.
    dismissResume(currentDocument?.lang)
    setDraftText('')
    setCurrentDocId(null)
    setCurrentSectionIndex(0)
    setWasResumed(false)
  }

  // Position is saved explicitly at each navigation call site (here,
  // and in jumpToPosition) rather than solely via the scroll-listener
  // effect below: a page/section short enough to need no scrolling
  // never fires a 'scroll' event, so relying only on that would leave
  // `sectionIndex` unsaved and resume would silently land back on the
  // wrong page. Confirmed the hard way with a real multi-page PDF.
  function goToSection(index: number) {
    pendingScrollRestore.current = { fraction: 0, behavior: 'instant' }
    setCurrentSectionIndex(index)
    if (currentDocId) updatePosition(currentDocId, { sectionIndex: index, fraction: 0 })
  }

  function jumpToPosition(position: Position) {
    if (position.sectionIndex === currentSectionIndex) {
      if (articleRef.current) scrollToFraction(articleRef.current, position.fraction)
    } else {
      pendingScrollRestore.current = { fraction: position.fraction, behavior: 'smooth' }
      setCurrentSectionIndex(position.sectionIndex)
    }
    if (currentDocId) updatePosition(currentDocId, position)
  }

  const currentDocument = currentDocId ? documents[currentDocId] : undefined
  const isSample = !currentDocument

  // Auto-translate-on-language-switch (task #112) — see the hook's own
  // header comment for the full non-destructive/cache/reversible
  // design. `translation.sections`, when set, is a PARALLEL translated
  // copy of the document's own sections, same length/order — never a
  // mutation of `currentDocument` itself.
  const translation = useContentTranslation(currentDocument)
  const effectiveSections = translation.sections ?? currentDocument?.sections
  const displayText = effectiveSections?.[currentSectionIndex]?.text ?? t('reader.sampleText')

  // The CONTENT's script — drives typography/settings/dir. Distinct
  // from `isArabic` (the UI chrome's language, an independent choice).
  // Prefers the *current section's own* detected language over the
  // document's overall one — a document is mostly one script, but a
  // section quoting the other language (a realistic case for a
  // bilingual-first product) still gets typography/direction correct
  // for its own text, not whichever script dominates the rest of the
  // document. Falls back to the document's language (for sections
  // saved before per-section detection existed) and finally to the UI
  // language only for the generic sample placeholder. Reads from
  // `effectiveSections` (translation-aware) so an active translation's
  // own language correctly drives RTL/typography/reading-settings too
  // — exactly the "existing isContentArabic path" task #112 asked to
  // reuse, not a parallel mechanism.
  const currentSection = effectiveSections?.[currentSectionIndex]
  const isContentArabic = currentDocument
    ? (currentSection?.lang ?? currentDocument.lang) === 'ar'
    : isArabic

  const paragraphStyle: CSSProperties = isContentArabic
    ? {
        fontFamily: FONT_STACKS[arabic.typeface],
        fontSize: `${arabic.fontSize}px`,
        lineHeight: arabic.lineHeight,
        maxWidth: `${arabic.lineWidth}ch`,
        wordSpacing: `${arabic.wordSpacing}em`,
        color: arabic.textColor,
      }
    : {
        fontFamily: FONT_STACKS[latin.typeface],
        fontSize: `${latin.fontSize}px`,
        lineHeight: latin.lineHeight,
        maxWidth: `${latin.lineWidth}ch`,
        wordSpacing: `${latin.wordSpacing}em`,
        letterSpacing: `${latin.letterSpacing}em`,
        color: latin.textColor,
      }

  const activeTint = isContentArabic ? arabic.tint : latin.tint
  // Same source values paragraphStyle above already reads — reused
  // here (not re-derived differently) so the ruler's height always
  // matches whatever the reader actually sees, in either script.
  const activeFontSize = isContentArabic ? arabic.fontSize : latin.fontSize
  const activeLineHeight = isContentArabic ? arabic.lineHeight : latin.lineHeight
  const typefaceLabel = isContentArabic
    ? t(ARABIC_TYPEFACE_LABEL_KEY[arabic.typeface])
    : t(LATIN_TYPEFACE_LABEL_KEY[latin.typeface])
  const metaText = t('reader.metaTemplate', {
    typeface: typefaceLabel,
    size: isContentArabic ? arabic.fontSize : latin.fontSize,
    lineHeight: (isContentArabic ? arabic.lineHeight : latin.lineHeight).toFixed(1),
    tint: t(TINT_LABEL_KEY[activeTint]),
  })

  // Task #129 (2026-08-14, Amal: «لما الصفحة تكون عربي خلي المثال
  // بالعربي») — the offered "try an example" list follows the current
  // UI language (`isArabic`, the chrome's own language toggle), NOT
  // the example's own content language (which stays fixed and keeps
  // driving the reading-settings script it's opened with, unchanged —
  // see `isContentArabic`'s own comment a few lines up for why those
  // two are deliberately independent). Arabic UI -> only the Arabic
  // example offered; English UI -> only the English one.
  const offeredExamples = EXAMPLE_TEXTS.filter((example) => example.lang === (isArabic ? 'ar' : 'en'))

  return (
    <main className="mx-auto grid w-full max-w-[1180px] flex-1 gap-7 px-6 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
      <section aria-labelledby="reading-heading">
        {/* Was a <span> — QA (P1-8/2026-08-13) found /reader's heading
            outline started at the h2 below with no h1 anywhere on the
            page. This is the page's own title, same role every OTHER
            page's h1 already plays (Library's "Library", Privacy's
            "Privacy Policy", etc.) — same visual styling as before,
            tag-only change, so nothing looks different. */}
        <h1 className="mb-2.5 block text-[0.8125rem] font-bold tracking-[0.08em] text-accent uppercase">
          {t('reader.kicker')}
        </h1>

        <div className="mb-4 rounded-control border-[1.5px] border-line-strong bg-card p-3">
          <label htmlFor="reader-input" className="sr-only">
            {t('reader.yourText')}
          </label>
          <textarea
            id="reader-input"
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={t('reader.placeholder')}
            className={`w-full resize-y rounded-control bg-transparent p-2 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
          />
          <div className="mt-1 flex items-center justify-between px-2">
            <ClipboardIcon className="size-[18px] text-ink-muted" />
            <button
              type="button"
              onClick={handleFormat}
              disabled={!draftText.trim()}
              className={`inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
            >
              {t('reader.format')}
              <ChevronIcon className="size-4 rtl:-scale-x-100" />
            </button>
          </div>
        </div>

        <FileOpenButton onParsed={handleFileParsed} uiLanguageFallback={isArabic ? 'ar' : 'en'} />

        {/* "Try an example" — only while there's nothing open yet, so
            it never competes with a real reading session, and only
            ever affects stats once actually clicked (see
            content/exampleTexts.ts). */}
        {!currentDocument && !examplesDismissed && (
          <div className="mb-4 rounded-control border border-line bg-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-semibold text-ink">{t('reader.tryExampleTitle')}</span>
              <button
                type="button"
                onClick={dismissExamples}
                className={`rounded-control text-[0.8125rem] text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-accent ${focusRing}`}
              >
                {t('reader.dismissExamples')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {offeredExamples.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => handleOpenExample(example)}
                  lang={example.lang}
                  dir={example.lang === 'ar' ? 'rtl' : 'ltr'}
                  className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent ${focusRing}`}
                >
                  {example.title}
                  <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
                    {t('profile.sourceExample')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentDocument && (
          <SectionNav
            document={currentDocument}
            sectionIndex={currentSectionIndex}
            onPrev={() => goToSection(currentSectionIndex - 1)}
            onNext={() => goToSection(currentSectionIndex + 1)}
          />
        )}

        <article
          ref={articleRef}
          className="relative rounded-card border border-line p-[30px_34px_34px] transition-colors"
          style={{ backgroundColor: TINTS[activeTint] }}
          onMouseMove={readingRuler ? handleArticlePointerMove : undefined}
          onMouseLeave={readingRuler ? handleArticlePointerLeave : undefined}
        >
          {readingRuler && rulerY !== null && (
            <ReadingRuler y={rulerY} fontSize={activeFontSize} lineHeight={activeLineHeight} color={readingRulerColor} />
          )}
          <h2
            id="reading-heading"
            className="mb-2.5 flex flex-wrap items-center gap-2 text-[0.8125rem] font-bold tracking-[0.08em] text-accent uppercase"
          >
            {currentDocument?.title || t('reader.readingViewKicker')}
            {/* Stays visible for as long as you're reading it — not just
                on the button you clicked to get here — so it's always
                clear this is a provided example, not your own text. */}
            {currentDocument?.sourceType === 'example' && (
              <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent normal-case">
                {t('profile.sourceExample')}
              </span>
            )}
          </h2>
          <p className="mb-4 text-[0.8125rem] tabular-nums text-ink-muted">{metaText}</p>

          {/* A real data-loss event (nibras-qa P1-7) — placed ahead of
              Reading Buddy/sample/resumed notices deliberately, so it
              can't be missed below other, lower-stakes context. Clears
              on the NEXT openDocument() call (a fresh open either finds
              nothing pruned -> null, or reports whatever it pruned this
              time) — same "stays visible for as long as you're on this
              reading view" convention as resumedNotice below, not a bug. */}
          {prunedDocTitle !== null && (
            <p className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('library.limitPrunedNotice', { title: prunedDocTitle || t('profile.untitledDocument') })}
            </p>
          )}

          {/* Reading Buddy — works on whatever's currently shown,
              sample text included, since Web Speech needs no backend. */}
          <ReadingBuddyPlayer text={displayText} lang={isContentArabic ? 'ar' : 'en'} />

          {isSample && (
            <p className="mb-3 text-[0.8125rem] italic text-ink-muted">{t('reader.sampleNotice')}</p>
          )}
          {!isSample && wasResumed && (
            <p className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('reader.resumedNotice')}{' '}
              <button
                type="button"
                onClick={handleStartFresh}
                className={`rounded-control not-italic underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-accent ${focusRing}`}
              >
                {t('reader.startFresh')}
              </button>
            </p>
          )}

          {/* Auto-translate-on-language-switch (task #112) — status
              notices, in priority order. `role="status"` (not a plain
              <p>) so a screen-reader user is told when the content
              itself just changed under them, not just visually. */}
          {!isSample && translation.status === 'translating' && (
            <p role="status" aria-live="polite" className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('reader.translating')}
            </p>
          )}
          {!isSample && translation.status === 'error' && (
            <p role="status" className="mb-3 text-[0.8125rem] text-ink-muted">
              {t('reader.translationError')}
            </p>
          )}
          {!isSample && translation.isShowingTranslation && (
            <p role="status" className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('reader.autoTranslatedNotice')}{' '}
              <button
                type="button"
                onClick={translation.toggleShowOriginal}
                className={`rounded-control not-italic underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-accent ${focusRing}`}
              >
                {t('reader.showOriginal')}
              </button>
            </p>
          )}
          {/* Only reachable once already showing the ORIGINAL via the
              toggle above (isShowingTranslation is false in that
              state) — offers the way back to the translation without
              needing to touch the app-language switch again. Distinct
              from the notice above so the two never both render at
              once (translation.showOriginalOverride is the one piece
              of state this pair genuinely branches on). */}
          {!isSample && !translation.isShowingTranslation && translation.showOriginalOverride && (
            <p role="status" className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('reader.showingOriginalNotice')}{' '}
              <button
                type="button"
                onClick={translation.toggleShowOriginal}
                className={`rounded-control not-italic underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-accent ${focusRing}`}
              >
                {t('reader.showTranslation')}
              </button>
            </p>
          )}

          {/* dir set explicitly here (not inherited from <html>) because
              the content's script can now differ from the UI language —
              e.g. an English PDF opened while the interface is in
              Arabic must still read left-to-right. */}
          <p
            className="m-0 text-start text-ink"
            dir={isContentArabic ? 'rtl' : 'ltr'}
            style={paragraphStyle}
          >
            {displayText}
          </p>
        </article>

        {/* AI Assistant — summarize/explain, works on whatever's
            currently shown (sample text included, same as
            ReadingBuddyPlayer) so it's never arbitrarily hidden; its
            own honesty logic decides demo-eligibility. Sits outside
            <article> since its output isn't part of the tinted/
            typography-controlled reading surface. */}
        <AiAssistantPanel text={displayText} lang={isContentArabic ? 'ar' : 'en'} />

        {!isSample && currentDocument && (
          <BookmarksNotes
            document={currentDocument}
            getPosition={() => ({
              sectionIndex: currentSectionIndex,
              fraction: articleRef.current ? getCurrentFraction(articleRef.current) : 0,
            })}
            onJump={jumpToPosition}
            onAddBookmark={(position) => addBookmark(currentDocument.id, position)}
            onRemoveBookmark={(bookmarkId) => removeBookmark(currentDocument.id, bookmarkId)}
            onAddNote={(position, text) => addNote(currentDocument.id, position, text)}
            onRemoveNote={(noteId) => removeNote(currentDocument.id, noteId)}
          />
        )}
      </section>

      {settingsOpen && (
        // isContentArabic, not isArabic: the settings offered (which
        // typeface choices, which value ranges) must match the open
        // document's own script, not the interface language.
        <SettingsPanel
          isArabic={isContentArabic}
          latin={latin}
          arabic={arabic}
          updateLatin={updateLatin}
          updateArabic={updateArabic}
          resetLatin={resetLatin}
          resetArabic={resetArabic}
          readingRuler={readingRuler}
          setReadingRuler={setReadingRuler}
          readingRulerColor={readingRulerColor}
          setReadingRulerColor={setReadingRulerColor}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {calmSpaceOpen && <CalmSpace onClose={closeCalmSpace} />}
    </main>
  )
}
