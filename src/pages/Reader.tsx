import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useReadingSettings } from '../hooks/useReadingSettings'
import { useDocuments } from '../hooks/useDocuments'
import { TRANSLATING_OPACITY, useContentTranslation } from '../hooks/useContentTranslation'
import { useFocusMode } from '../components/FocusMode'
import { useHeaderSlot } from '../components/HeaderSlot'
import { SettingsPanel } from '../components/reader/SettingsPanel'
import { AiAssistantPanel } from '../components/reader/AiAssistantPanel'
import { BookmarksNotes } from '../components/reader/BookmarksNotes'
import { CalmSpace } from '../components/reader/CalmSpace'
import { ReadingBuddyPlayer } from '../components/reader/ReadingBuddyPlayer'
import { ReadingRuler } from '../components/reader/ReadingRuler'
import { LineFocusRuler } from '../components/reader/LineFocusRuler'
import { WordHighlightRuler } from '../components/reader/WordHighlightRuler'
import { SectionNav } from '../components/reader/SectionNav'
import { FileOpenButton } from '../components/reader/FileOpenButton'
import { OpenFromLibraryButton } from '../components/reader/OpenFromLibraryButton'
import { ComingSoonAction } from '../components/reader/ComingSoonAction'
import { BreathIcon, CameraIcon, ChevronIcon, ClipboardIcon, FullscreenIcon, LinkIcon, SlidersIcon } from '../components/icons'
import { focusRing } from '../lib/focus'
import { getCurrentFraction, hashSections, scrollToFraction, type Position, type ReaderDocument, type SourceType } from '../lib/documents'
import { chunkPlainText } from '../lib/textChunking'
import { isolateLtr } from '../lib/bidi'
import { detectLanguage, tagSectionLanguages } from '../lib/detectLanguage'
import type { ParsedFile } from '../lib/fileParsers'
import {
  ARABIC_TYPEFACE_LABEL_KEY,
  DIMMER_MAX_OPACITY,
  FONT_STACKS,
  LATIN_TYPEFACE_LABEL_KEY,
  TINT_LABEL_KEY,
  effectiveReadingBg,
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
    readingRulerMode,
    wordSyncRulerColor,
    dimmerEnabled,
    dimmerIntensity,
    updateLatin,
    updateArabic,
    resetLatin,
    resetArabic,
    setReadingRuler,
    setReadingRulerColor,
    setReadingRulerMode,
    setWordSyncRulerColor,
    setDimmerEnabled,
    setDimmerIntensity,
  } = useReadingSettings()
  const {
    documents,
    lastDocumentId,
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
  // Task #360 — see components/FocusMode.tsx's own header comment for
  // why this is a separate in-app flag from the browser's real
  // Fullscreen API (requested alongside it below, best-effort).
  const { active: focusModeActive, setActive: setFocusModeActive } = useFocusMode()

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
      {/* Task #360 — the ONLY visible way back out of focus mode once
          it's on (AppShellHeader.tsx keeps this whole slot rendering
          even while the sidebar/breadcrumb/language/colour/voice
          controls are hidden) — see FocusMode.tsx + this file's own
          enterFocusMode/exitFocusMode for the full reasoning. */}
      <button
        type="button"
        aria-pressed={focusModeActive}
        onClick={() => (focusModeActive ? exitFocusMode() : enterFocusMode())}
        className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-transparent px-4 py-2 text-sm font-semibold text-ink-muted aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${focusRing}`}
      >
        <FullscreenIcon className="size-[18px]" />
        {focusModeActive ? t('reader.exitFocusMode') : t('reader.focusMode')}
      </button>
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

  // Task #360 — the browser's real Fullscreen API is requested
  // best-effort ALONGSIDE the in-app focus-mode flag, never gating it:
  // granted, it additionally hides the OS/browser's own chrome (tabs,
  // address bar); denied or unsupported (no direct user gesture, no
  // `allow="fullscreen"` inside an embedding iframe, etc.), focus mode
  // still works fully since the in-app flag alone already hides this
  // app's own sidebar/header. Neither call's promise is awaited for
  // its outcome — a rejection (e.g. a browser refusing without a
  // qualifying gesture) is caught and silently dropped, never
  // surfaced as an error, since the in-app half has already succeeded
  // synchronously by the time either promise settles.
  function enterFocusMode() {
    setFocusModeActive(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  function exitFocusMode() {
    setFocusModeActive(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  // Escape (or any OTHER way a browser offers out of native
  // fullscreen) fires this WITHOUT ever calling exitFocusMode above,
  // so it mirrors focus mode's own flag back off too, whenever native
  // fullscreen and the in-app flag ever come apart. One-directional by
  // design (only reacts to EXITING native fullscreen) — entering
  // native fullscreen through some other, unrelated trigger (an OS
  // shortcut, say) must never silently hide this app's own sidebar and
  // header, since the reader never asked for that.
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) setFocusModeActive(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [setFocusModeActive])

  // #398 review P2 (2026-09-14) — Escape must exit focus mode even when
  // native Fullscreen was blocked or never engaged (no qualifying user
  // gesture, or embedded inside an iframe with no allow="fullscreen").
  // In that case `document.fullscreenElement` never becomes truthy, so
  // the fullscreenchange listener above never fires and a plain Escape
  // press does nothing at all — the header's "Exit focus mode" button
  // (kept reachable on purpose, see its own comment above) is still a
  // working keyboard path, so this was never a true keyboard trap, but
  // Escape is the FIRST thing most keyboard users try to leave a
  // focused/fullscreen-like view, and it silently not working reads as
  // a dead keypress. Safe to run unconditionally alongside the listener
  // above when native fullscreen DID engage: the browser's own Escape
  // handling fires `fullscreenchange` asynchronously, so this listener
  // (synchronous, on the same keydown) just gets there first with the
  // identical effect — setFocusModeActive(false) is idempotent, and
  // exitFullscreen() is only called when something is actually
  // fullscreen, so there's no double-request or flicker either way.
  useEffect(() => {
    if (!focusModeActive) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setFocusModeActive(false)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [focusModeActive, setFocusModeActive])

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

  // Task #143 (2026-08-14) — REPLACED 2026-09-15 (live-preview
  // interactive-audit fix, Amal via team-lead). The original version
  // (still in git history) reset+reopened a per-language "last
  // document" on the on-device build, and left AI-backend builds to
  // #112's separate auto-translate-in-place effect. That auto-fire
  // turned out to be the real gap: flipping the GLOBAL language toggle
  // is a page-wide chrome action a reader takes for reasons that have
  // nothing to do with "translate the one document I happen to have
  // open" — doing that silently, as a side effect, risked a same-
  // instant paid call and (for an unauthenticated session) an
  // AccessGate pop-up the reader never asked for, which read as "the
  // switch didn't do anything." This effect now does exactly ONE
  // thing, unconditionally (no isAiBackendConfigured() branch at all —
  // this never touches the network either way):
  //
  //   - If the Reader is currently showing the built-in EXAMPLE
  //     (sourceType 'example'), jump to its OTHER-LANGUAGE sibling in
  //     content/exampleTexts.ts — a static, already-written, already-
  //     blessed pair; free, instant, no AI call, no gate risk. This is
  //     #129's original intent, made to hold even though the English
  //     and Arabic members are two unrelated documents by content hash
  //     (see ReaderDocument.exampleId's own doc comment for why that
  //     needed a dedicated field rather than reusing lastDocumentIdByLang).
  //
  //   - Anything else — a real pasted/opened document, or nothing open
  //     at all — is left EXACTLY as it is. #143's "never lose the
  //     reader's work" promise, now the default for every build, not
  //     just the on-device one. The page's own chrome (dir/RTL, every
  //     t()-driven label) already flips instantly via plain
  //     react-i18next reactivity elsewhere and needs nothing from here.
  //
  // Translating an opened document is now something a reader PULLS
  // explicitly (see useContentTranslation's `requestTranslate`, wired
  // to a button in the JSX below) — never something this effect PUSHES
  // on their behalf.
  const prevReaderLangRef = useRef(i18n.language)
  useEffect(() => {
    const changed = prevReaderLangRef.current !== i18n.language
    prevReaderLangRef.current = i18n.language
    if (!changed) return

    const newLang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
    const openDoc = currentDocId ? documents[currentDocId] : undefined
    if (openDoc?.sourceType === 'example' && openDoc.exampleId) {
      const sibling = EXAMPLE_TEXTS.find((e) => e.id === openDoc.exampleId && e.lang === newLang)
      if (sibling) {
        openDocument({
          sections: tagSectionLanguages(chunkPlainText(sibling.text).map((chunk) => ({ text: chunk })), sibling.lang),
          sourceType: 'example',
          lang: sibling.lang,
          title: sibling.title,
          exampleId: sibling.id,
        })
      }
    }
    // currentDocId/documents are read fresh inside the effect body but
    // intentionally NOT listed here — only a genuine i18n.language
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
    /** See ReaderDocument's own `exampleId` doc comment (lib/documents.ts). */
    exampleId?: string
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

  // #260 — open a book the reader already saved, through the SAME
  // openDocument path an uploaded file uses (finds the existing doc by
  // its section hash, so its saved reading position is restored too).
  function handleOpenFromLibrary(doc: ReaderDocument) {
    openDocument({ sections: doc.sections, sourceType: doc.sourceType, title: doc.title, lang: doc.lang })
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
      exampleId: example.id,
    })
    dismissExamples()
  }

  // Only tracks the pointer while the Reading Ruler's LINE or LINE-
  // FOCUS mode (#465) is actually on (see rulerTracksPointer below,
  // and the conditional handler props on the <article>) — no cost
  // otherwise, and no point at all while the word-sync mode (#361) is
  // selected instead, which doesn't use the pointer.
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

  const activeReading = isContentArabic ? arabic : latin
  const activeTint = activeReading.tint
  // #364 — the reading panel's ACTUAL background: the reader's free custom
  // colour if they picked one from the wheel, else the preset tint.
  const activeBg = effectiveReadingBg(activeReading)
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
    size: isolateLtr(`${isContentArabic ? arabic.fontSize : latin.fontSize}px`),
    lineHeight: isolateLtr((isContentArabic ? arabic.lineHeight : latin.lineHeight).toFixed(1)),
    // #364 — a custom (wheel-picked) colour has no preset name, so the
    // meta line reads "custom background" instead of a tint name.
    tint: activeReading.backgroundColor ? t('settings.bgColorCustom') : t(TINT_LABEL_KEY[activeTint]),
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

  // Task #465 — 'line' and 'lineFocus' both follow the live pointer
  // (the highlight band vs. the dim-around-it bands); 'wordSync' tracks
  // voice progress instead and never needs this. One shared flag so the
  // <article>'s onMouseMove/onMouseLeave below don't repeat the same
  // two-mode check twice.
  const rulerTracksPointer = readingRuler && (readingRulerMode === 'line' || readingRulerMode === 'lineFocus')

  return (
    <main className="mx-auto grid w-full max-w-[1180px] flex-1 gap-7 px-6 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
      <section aria-labelledby="reading-heading">
        {/* Was a <span> — QA (P1-8/2026-08-13) found /reader's heading
            outline started at the h2 below with no h1 anywhere on the
            page. This is the page's own title, same role every OTHER
            page's h1 already plays (Library's "Library", Privacy's
            "Privacy Policy", etc.). That first fix kept the ORIGINAL
            small "kicker" visual style (a tag-only change, deliberately
            not touching anything visual at the time) — #398 review P2
            (2026-09-14) flagged the result: every other page's h1 renders
            at 1.75rem/bold/dark ink, but this one still rendered as a
            0.8125rem uppercase accent-coloured eyebrow, a real visual
            inconsistency for a heading users (and screen-reader landmark
            navigation) rely on to look/read the same way page to page.
            Now matches every other page's own h1 exactly; the h2 just
            below (the CURRENT reading section's own label, e.g. "READING
            VIEW" or a document title) keeps its own smaller eyebrow
            style, which is the correct, now properly INVERTED hierarchy
            (a prominent h1, a subordinate h2), not a duplicate. */}
        <h1 className="mb-2.5 text-[1.75rem] font-bold text-ink">
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

        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <FileOpenButton onParsed={handleFileParsed} uiLanguageFallback={isArabic ? 'ar' : 'en'} className="" />
          <OpenFromLibraryButton documents={documents} onPick={handleOpenFromLibrary} />
        </div>

        {/* Task #465 (2026-09-14, Amal via team-lead) — roadmap
            placeholders for two more ways to bring text in that AREN'T
            built yet: OCR (a photo/scan) and a URL. Deliberately a
            separate, visually lighter row below the two REAL working
            buttons above (thinner border, no fill, smaller icon — see
            ComingSoonAction's own comment) rather than mixed into that
            same row, so the working controls stay visually primary and
            these read unambiguously as "not yet," never as a third
            equally-real option a reader might click expecting it to
            work. Each carries the SAME `comingSoonBadge` pill used
            elsewhere (AI Assistant, Mind Maps) — one honest label, not
            an app-specific one per spot. */}
        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <ComingSoonAction icon={CameraIcon} label={t('reader.readFromImage')} />
          <ComingSoonAction icon={LinkIcon} label={t('reader.readFromLink')} />
        </div>

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

        {/* Task #371 (2026-09-13, Amal): moved OUT of the reading-view
            <article> below and placed directly above it instead, so the
            voice bar sits on the PAGE's own background and picks up the
            page/accent theme (#367) — the reading panel below keeps its
            OWN independent colour (Flag #2), untouched by this move.
            Still works on whatever's currently shown, sample text
            included, since Web Speech needs no backend. */}
        <ReadingBuddyPlayer text={displayText} lang={isContentArabic ? 'ar' : 'en'} />

        <article
          ref={articleRef}
          className="relative rounded-card border border-line p-[30px_34px_34px] transition-colors"
          style={{ backgroundColor: activeBg }}
          onMouseMove={rulerTracksPointer ? handleArticlePointerMove : undefined}
          onMouseLeave={rulerTracksPointer ? handleArticlePointerLeave : undefined}
        >
          {readingRuler && readingRulerMode === 'line' && rulerY !== null && (
            <ReadingRuler y={rulerY} fontSize={activeFontSize} lineHeight={activeLineHeight} color={readingRulerColor} />
          )}
          {/* Task #465 — Line Focus: dims everything above/below the
              same pointer-tracked line the 'line' mode above highlights,
              instead of washing it. Mutually exclusive with 'line' by
              construction (readingRulerMode is one value), so exactly
              one of the two ever renders. */}
          {readingRuler && readingRulerMode === 'lineFocus' && rulerY !== null && (
            <LineFocusRuler y={rulerY} fontSize={activeFontSize} lineHeight={activeLineHeight} />
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

          {/* A real data-loss event (nibras-qa P1-7) — placed ahead of the
              sample/resumed notices below deliberately, so it can't be
              missed below other, lower-stakes context. (Reading Buddy
              itself moved out of this article for task #371, 2026-09-13 —
              see right above the article's own opening tag.) Clears
              on the NEXT openDocument() call (a fresh open either finds
              nothing pruned -> null, or reports whatever it pruned this
              time) — same "stays visible for as long as you're on this
              reading view" convention as resumedNotice below, not a bug. */}
          {prunedDocTitle !== null && (
            <p className="mb-3 text-[0.8125rem] italic text-ink-muted">
              {t('library.limitPrunedNotice', { title: prunedDocTitle || t('profile.untitledDocument') })}
            </p>
          )}

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

          {/* Translate-on-request (task #112, made EXPLICIT 2026-09-15 —
              see useContentTranslation.ts's own header comment for why)
              — status notices, in priority order. `role="status"` (not
              a plain <p>) so a screen-reader user is told when the
              content itself just changed under them, not just visually. */}
          {!isSample && translation.canOfferTranslate && translation.status !== 'translating' && (
            <p className="mb-3 text-[0.8125rem] text-ink-muted">
              {t('reader.offerTranslateNotice')}{' '}
              <button
                type="button"
                onClick={translation.requestTranslate}
                className={`rounded-control underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-accent ${focusRing}`}
              >
                {t('reader.translateAction')}
              </button>
            </p>
          )}
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

          {/* Task #465 fast-follow (quality P1-1, 2026-09-14) — the
              pointer-driven ruler modes ('line' and 'lineFocus') paint
              nothing at all until the pointer actually moves over the
              text (rulerY stays null until handleArticlePointerMove
              fires), so a reader who just turned one on in Settings and
              hasn't moved their mouse yet saw no feedback and reasonably
              assumed it was broken. Mirrors wordSync's own
              wordSyncIdleHint pattern below — same idea, different
              trigger (no pointer position yet, vs narration not playing
              yet) — and disappears the moment rulerY is set, handing off
              to the actual ReadingRuler/LineFocusRuler render above. */}
          {rulerTracksPointer && rulerY === null && (
            <p className="mb-3 text-[0.8125rem] text-ink-muted">
              {t(readingRulerMode === 'lineFocus' ? 'reader.lineFocusIdleHint' : 'reader.lineIdleHint')}
            </p>
          )}

          {/* dir set explicitly here (not inherited from <html>) because
              the content's script can now differ from the UI language —
              e.g. an English PDF opened while the interface is in
              Arabic must still read left-to-right. Task #361 — the
              word-sync ruler mode REPLACES this plain paragraph with
              its own renderer (same dir/style, so switching modes never
              changes the font/size/spacing/colour already chosen) since
              marking individual words means the text must be split into
              spans, which the line mode's floating band never needed. */}
          {/* Task #112/#143 live-preview P1 fix (2026-09-14): while a real
              translate call is in flight, the passage below is still
              showing STALE (pre-switch) text — dim it so that's obvious
              at a glance, not just conveyed by the small status line
              above. A real xAI call has measured anywhere from ~7s to
              ~23s, easily long enough that an unchanged, fully-legible
              passage reads as "the switch didn't do anything" if nothing
              about the passage itself signals it's mid-update. See
              useContentTranslation.ts's TRANSLATING_OPACITY comment. */}
          <div
            className="motion-safe:transition-opacity motion-safe:duration-300"
            style={{ opacity: translation.status === 'translating' ? TRANSLATING_OPACITY : 1 }}
          >
            {readingRuler && readingRulerMode === 'wordSync' ? (
              <WordHighlightRuler
                text={displayText}
                dir={isContentArabic ? 'rtl' : 'ltr'}
                style={paragraphStyle}
                color={wordSyncRulerColor}
              />
            ) : (
              <p
                className="m-0 text-start text-ink"
                dir={isContentArabic ? 'rtl' : 'ltr'}
                style={paragraphStyle}
              >
                {displayText}
              </p>
            )}
          </div>
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
          readingRulerMode={readingRulerMode}
          setReadingRulerMode={setReadingRulerMode}
          wordSyncRulerColor={wordSyncRulerColor}
          setWordSyncRulerColor={setWordSyncRulerColor}
          dimmerEnabled={dimmerEnabled}
          setDimmerEnabled={setDimmerEnabled}
          dimmerIntensity={dimmerIntensity}
          setDimmerIntensity={setDimmerIntensity}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {calmSpaceOpen && <CalmSpace onClose={closeCalmSpace} />}

      {/* Task #360 — the warm, glare-reducing dimmer overlay: a
          translucent scrim in the app's own warm --color-ink (already
          a warm brown, not a cool black) laid over the ENTIRE
          viewport at whatever strength the reader picked (Settings
          panel's "Screen dimmer" slider). `fixed inset-0` escapes
          Reader's own place in the DOM to cover the whole screen,
          header/sidebar included, the exact technique CalmSpace's/
          AccessGate's own backdrops above already use from a
          similarly-nested spot. The point is cutting the PERCEIVED
          brightness of the whole screen, not just the reading panel,
          so a modal opened while this is on (Calm Space, say) must
          stay tinted too, hence a z-index above every tier this app
          otherwise defines (z-50, the skip-link, was the previous
          ceiling). `pointer-events-none` so it never blocks a click,
          tap, or focus on anything underneath; the opacity itself is
          capped well short of 1 (DIMMER_MAX_OPACITY, ~0.7 at full
          strength) so content never goes fully unreadable.
          Task #398 review, item 4 (2026-09-14): that cap alone does
          NOT keep reading text at WCAG AA at high strength — this
          scrim sits over the text too, and computed contrast for the
          app's own DEFAULT reading colours already drops below 4.5:1
          past ~65% strength (down to ~2.4:1 at 100%). Deliberately NOT
          lowering the cap or auto-limiting the slider here: some
          light-sensitive readers want it this dark (e.g. while
          listening via Reading Buddy rather than reading), so the fix
          is a live warning instead — see SettingsPanel.tsx's own
          dimmerContrastLow check, right next to the strength slider,
          same warn-don't-block pattern the text-colour wheel already
          uses. */}
      {dimmerEnabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60] motion-safe:transition-opacity motion-safe:duration-300"
          style={{ backgroundColor: 'var(--color-ink)', opacity: (dimmerIntensity / 100) * DIMMER_MAX_OPACITY }}
        />
      )}
    </main>
  )
}
