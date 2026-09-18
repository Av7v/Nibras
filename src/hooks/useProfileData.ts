import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDocuments } from './useDocuments'
import { useReadingSettings } from './useReadingSettings'
import type { ReaderDocument, SourceType } from '../lib/documents'
import { ARABIC_TYPEFACE_LABEL_KEY, LATIN_TYPEFACE_LABEL_KEY, TINT_LABEL_KEY } from '../lib/readingSettings'
import { isolateLtr } from '../lib/bidi'

export const SOURCE_LABEL_KEY: Record<SourceType, string> = {
  pasted: 'profile.sourcePasted',
  txt: 'profile.sourceTxt',
  pdf: 'profile.sourcePdf',
  epub: 'profile.sourceEpub',
  docx: 'profile.sourceDocx', // Task #465 — Word (.docx) import
  example: 'profile.sourceExample',
}

/**
 * Single source of truth for the on-device "how's my reading going"
 * data shown on both /profile and the Dashboard home — real numbers
 * only, computed from the same hooks the Reader itself writes to.
 * Extracted 2026-08-12 (was deliberately duplicated between Profile.tsx
 * and the earlier DashboardPreview.tsx while the dashboard direction
 * was still an unapproved preview — see agent memory
 * feedback-staged-preview-isolation.md for why that duplication existed
 * in the first place). Now that the dashboard is the real app, the two
 * pages share this instead so they can't silently drift into showing
 * different counts for the same underlying localStorage data.
 *
 * Callers slice `rollup`/`docList` down to whatever length fits their
 * layout (Dashboard shows a short "recent" cut, Profile a summary,
 * Library the full list) — this hook always returns the full,
 * newest-first lists.
 *
 * Also re-exposes useDocuments' own add/remove mutators (added
 * 2026-08-13 for the Library page) rather than having Library call
 * useDocuments() a second time itself — a second call would create an
 * independent useState instance with its own localStorage-sync effect,
 * so a removal made through it would NOT be reflected in the docList
 * this hook already computed for the SAME page, going stale until a
 * reload. One useDocuments() call per page, always through this hook,
 * keeps read (docList) and write (add/remove) on the same state.
 */
export function useProfileData() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  const navigate = useNavigate()
  const { documents, resumeDocument, openOrUpdateDocument, removeDocument, setDocumentFolder } = useDocuments()
  const { latin, arabic } = useReadingSettings()

  const docList = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt)
  const bookmarkCount = docList.reduce((sum, d) => sum + d.bookmarks.length, 0)
  const noteCount = docList.reduce((sum, d) => sum + d.notes.length, 0)
  const lastReadAt = docList.length > 0 ? docList[0].updatedAt : null
  const mostRecent = docList[0]
  const lang: 'en' | 'ar' = isArabic ? 'ar' : 'en'

  function docTitle(doc: ReaderDocument) {
    return doc.title?.trim() || t('profile.untitledDocument')
  }

  // Sets the chosen document as the Reader's resume target, then
  // navigates — the Reader seeds its initial state from lastDocumentId
  // at mount, so this is enough for it to open at that document's own
  // saved position (see useDocuments.resumeDocument).
  function openInReader(id: string) {
    resumeDocument(id)
    navigate('/reader')
  }

  // The settings summary reflects the CURRENT UI language's script
  // profile — neither Profile nor Dashboard are reading content
  // themselves, so there's no per-document "which script is this text
  // in" the way the Reader has.
  const activeSettings = isArabic ? arabic : latin
  const typefaceLabel = t(
    isArabic ? ARABIC_TYPEFACE_LABEL_KEY[arabic.typeface] : LATIN_TYPEFACE_LABEL_KEY[latin.typeface],
  )
  const settingsSummary = t('reader.metaTemplate', {
    typeface: typefaceLabel,
    size: isolateLtr(`${activeSettings.fontSize}px`),
    lineHeight: isolateLtr(activeSettings.lineHeight.toFixed(1)),
    // #364 — a custom (wheel-picked) background has no preset name, same
    // fallback Reader.tsx's own metaText already uses, so this summary
    // never shows a stale tint name once the reader has picked a custom
    // colour from the wheel.
    tint: activeSettings.backgroundColor ? t('settings.bgColorCustom') : t(TINT_LABEL_KEY[activeSettings.tint]),
  })

  // Bookmarks + notes roll-up across every saved document, newest
  // first. Each row links back to its parent document (not the exact
  // scroll position — the Reader only restores a document's own last
  // position on resume, not an arbitrary bookmark's), so callers should
  // phrase links as "in {{title}}", not "jump to this bookmark", to
  // stay honest about what actually happens on click.
  const rollup = docList
    .flatMap((doc) => [
      ...doc.bookmarks.map((b) => ({
        kind: 'bookmark' as const,
        id: b.id,
        createdAt: b.createdAt,
        docId: doc.id,
        docTitle: docTitle(doc),
      })),
      ...doc.notes.map((n) => ({
        kind: 'note' as const,
        id: n.id,
        createdAt: n.createdAt,
        docId: doc.id,
        docTitle: docTitle(doc),
        text: n.text,
      })),
    ])
    .sort((a, b) => b.createdAt - a.createdAt)

  return {
    docList,
    bookmarkCount,
    noteCount,
    lastReadAt,
    mostRecent,
    lang,
    docTitle,
    openInReader,
    settingsSummary,
    rollup,
    openOrUpdateDocument,
    removeDocument,
    setDocumentFolder,
  }
}
