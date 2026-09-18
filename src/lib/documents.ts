/**
 * Resume + Bookmarks + Notes data model. On-device only (localStorage) —
 * no server, no accounts, per project privacy rules.
 *
 * A document is a list of `sections` — pages for a PDF (pdf.js's own
 * page boundaries), chapters for an EPUB (the EPUB's own spine order),
 * or artificial chunks for pasted/plain-text/Word (see
 * lib/textChunking.ts) — a .docx, unlike a PDF page or an EPUB
 * chapter, has no comparable built-in navigation unit of its own.
 * Using each format's *natural* unit means "Next"/"Prev" always lines
 * up with how that content is actually structured, instead of forcing
 * one generic pagination scheme onto everything.
 *
 * "Position" used to be a single 0–1 scroll fraction (Increment 2b),
 * back when a document was one long flowing block. Now that documents
 * can be paginated, a position is `{ sectionIndex, fraction }` — a
 * fraction of scroll *within the current section* — so resume and
 * bookmarks land on the right page/chapter, not just a fraction of a
 * whole book that no longer renders as one block.
 */

export type SourceType = 'pasted' | 'txt' | 'pdf' | 'epub' | 'docx' | 'example'

export interface DocumentSection {
  title?: string
  text: string
  /** This section's own script, when it's known to differ from (or
   * simply confirms) the document's overall `lang` — a document is
   * mostly one language, but a section quoting the other language
   * should still get correct typography/direction for its own text.
   * Falls back to the document-level `lang` when absent (e.g. older
   * saved documents from before per-section detection existed). */
  lang?: 'en' | 'ar'
}

export interface Position {
  sectionIndex: number
  fraction: number // 0–1, within that section
}

export interface Bookmark {
  id: string
  position: Position
  createdAt: number
}

export interface DocNote {
  id: string
  position: Position
  text: string
  createdAt: number
}

export interface ReaderDocument {
  id: string
  title?: string
  sourceType: SourceType
  lang: 'en' | 'ar'
  sections: DocumentSection[]
  createdAt: number
  updatedAt: number
  position: Position
  bookmarks: Bookmark[]
  notes: DocNote[]
  /** Which Library folder (see lib/libraryFolders.ts) this document is
   * filed under — absent/undefined means "Uncategorized". Deliberately
   * NOT touched by updatedAt: filing a book into a folder is an
   * organizational action, not "you just read this," so it must never
   * make an untouched book look like recent reading activity. */
  folderId?: string
  /** Set only for sourceType 'example' — the shared `id` from
   * content/exampleTexts.ts's ExampleText (e.g. 'reading'), NOT this
   * document's own hash-based `id` above. The English and Arabic
   * members of one example pair are otherwise two completely unrelated
   * documents (their `hashSections` ids are computed from their own,
   * totally different, text) — this is the ONLY link between them, and
   * it's what Reader.tsx's language-switch effect uses to jump straight
   * to the SAME example's other-language sibling, for free, with no AI
   * call and no risk of ever popping the access gate (2026-09-15,
   * live-preview interactive-audit fix). Absent on every other
   * sourceType and on any example-shaped document saved before this
   * field existed — both read as "no known sibling," which is exactly
   * correct for content that never had one to begin with. */
  exampleId?: string
}

export interface DocumentsState {
  lastDocumentId: string | null
  /** Task #143 (2026-08-14, Amal via team-lead: «شغل فريق يعدّلها» —
   * switching the UI language ar↔en in the Reader wasn't handling the
   * open reading cleanly). On the on-device (no AI backend) build, a
   * genuine UI-language switch resets the Reader's open-document VIEW
   * (see Reader.tsx's own language-switch effect) rather than silently
   * leaving old-language content on screen under a new-language UI.
   * This tracks, PER LANGUAGE, which document to auto-reopen (at its
   * own saved `position`) the next time that language becomes active
   * again — independent of `lastDocumentId` above, which stays the
   * single global "most recently touched, any language" pointer used
   * to seed the Reader on a fresh mount (unchanged by this task).
   * Never the source of truth for a document's own content/position/
   * bookmarks/notes — purely "which id to look up," same as
   * `lastDocumentId` itself. */
  lastDocumentIdByLang: { en: string | null; ar: string | null }
  documents: Record<string, ReaderDocument>
  /** Whether the guest has dismissed the "try an example" prompt in
   * the Reader — persists so it never reappears once cleared, even
   * though it doesn't correspond to any actual document (see
   * content/exampleTexts.ts). Examples themselves are never pre-seeded
   * here — they only enter `documents` once a guest deliberately opens
   * one, same as any real paste/file, so they can never inflate a
   * fresh device's stats before anyone has done anything. */
  examplesDismissed: boolean
}

const STORAGE_KEY = 'nibras-reader-documents'
// Lowered from 20 (Increment 2b) now that a "document" can be a whole
// book's worth of text rather than a pasted paragraph — localStorage
// has a small (commonly ~5-10MB per origin) quota; see the note in
// this increment's report re: a future move to IndexedDB if this
// turns out to be too tight in practice.
const MAX_DOCUMENTS = 10

/** Small, fast, non-cryptographic hash — used only as a client-side
 * dedup key (so re-opening the same book/text reunites with its saved
 * bookmarks/notes/position), never as a security boundary. Samples at
 * most ~5000 characters so hashing a whole novel stays fast. */
export function hashText(text: string): string {
  let hash = 0
  const step = Math.max(1, Math.floor(text.length / 5000))
  for (let i = 0; i < text.length; i += step) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return `doc_${Math.abs(hash)}_${text.length}`
}

export function hashSections(sections: DocumentSection[]): string {
  return hashText(sections.map((s) => s.text).join('\n'))
}

function emptyState(): DocumentsState {
  return { lastDocumentId: null, lastDocumentIdByLang: { en: null, ar: null }, documents: {}, examplesDismissed: false }
}

/** Converts an Increment-2b-shaped document (flat `text` + numeric
 * `scrollPosition`) into the current shape, wrapping the old text as a
 * single section. Never discards a reader's existing bookmarks/notes
 * just because the schema grew. */
function migrateLegacyDocument(raw: unknown): ReaderDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.text !== 'string' || Array.isArray(r.sections)) return null // not legacy-shaped

  const legacyBookmarks = Array.isArray(r.bookmarks) ? r.bookmarks : []
  const legacyNotes = Array.isArray(r.notes) ? r.notes : []
  const toPosition = (fraction: unknown): Position => ({
    sectionIndex: 0,
    fraction: typeof fraction === 'number' ? fraction : 0,
  })

  return {
    id: typeof r.id === 'string' ? r.id : hashText(r.text),
    title: undefined,
    sourceType: 'pasted',
    lang: r.lang === 'ar' ? 'ar' : 'en',
    sections: [{ text: r.text }],
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
    position: toPosition(r.scrollPosition),
    bookmarks: legacyBookmarks.map((b) => {
      const bm = b as Record<string, unknown>
      return {
        id: typeof bm.id === 'string' ? bm.id : hashText(String(bm.createdAt ?? Math.random())),
        position: toPosition(bm.position),
        createdAt: typeof bm.createdAt === 'number' ? bm.createdAt : Date.now(),
      }
    }),
    notes: legacyNotes.map((n) => {
      const note = n as Record<string, unknown>
      return {
        id: typeof note.id === 'string' ? note.id : hashText(String(note.createdAt ?? Math.random())),
        position: toPosition(note.position),
        text: typeof note.text === 'string' ? note.text : '',
        createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
      }
    }),
  }
}

export function loadDocumentsState(): DocumentsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<DocumentsState>
    const documents: Record<string, ReaderDocument> = {}
    for (const [id, doc] of Object.entries(parsed.documents ?? {})) {
      const migrated = migrateLegacyDocument(doc)
      documents[id] = migrated ?? (doc as ReaderDocument)
    }
    // Older saved state (pre-#143) never had lastDocumentIdByLang at
    // all — default both languages to null rather than assuming the
    // field's shape, so an existing volunteer's device doesn't throw
    // on first load after this update.
    const savedByLang = parsed.lastDocumentIdByLang
    return {
      lastDocumentId: parsed.lastDocumentId ?? null,
      lastDocumentIdByLang: {
        en: typeof savedByLang?.en === 'string' ? savedByLang.en : null,
        ar: typeof savedByLang?.ar === 'string' ? savedByLang.ar : null,
      },
      documents,
      examplesDismissed: parsed.examplesDismissed === true,
    }
  } catch {
    return emptyState()
  }
}

export function saveDocumentsState(state: DocumentsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // best-effort — never let a save failure (e.g. quota) crash reading
  }
}

export interface PruneResult {
  documents: Record<string, ReaderDocument>
  /** The document(s) actually dropped this call, newest-dropped first —
   * empty when nothing needed pruning. In practice this is at most ONE
   * entry, since the only caller (useDocuments.openOrUpdateDocument)
   * always adds exactly one document per call and re-prunes every
   * time, so the count can only ever go from <=MAX_DOCUMENTS to
   * MAX_DOCUMENTS+1 before this runs. Returned (not just silently
   * dropped) so a caller can tell the reader what happened — a saved
   * book disappearing with zero explanation is a real honesty gap
   * (nibras-qa P1-7, 2026-08-13), not an acceptable side effect of a
   * technical storage-quota limit the reader was never told about. */
  dropped: ReaderDocument[]
}

/** Keeps at most MAX_DOCUMENTS, dropping the least-recently-updated
 * ones first. */
export function pruneDocuments(documents: Record<string, ReaderDocument>): PruneResult {
  const entries = Object.values(documents)
  if (entries.length <= MAX_DOCUMENTS) return { documents, dropped: [] }
  const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
  const keepIds = new Set(sorted.slice(0, MAX_DOCUMENTS).map((d) => d.id))
  const pruned: Record<string, ReaderDocument> = {}
  for (const [id, doc] of Object.entries(documents)) {
    if (keepIds.has(id)) pruned[id] = doc
  }
  return { documents: pruned, dropped: sorted.slice(MAX_DOCUMENTS) }
}

/** Captures "roughly what's at the vertical middle of the viewport, as
 * a fraction of the article's height" — a snapshot, not a continuous
 * tracker. Operates on whatever's currently rendered in the article
 * (i.e. the current section only). */
export function getCurrentFraction(articleEl: HTMLElement): number {
  const rect = articleEl.getBoundingClientRect()
  const articleTop = rect.top + window.scrollY
  const articleHeight = articleEl.offsetHeight || 1
  const viewportMiddle = window.scrollY + window.innerHeight / 2
  const raw = (viewportMiddle - articleTop) / articleHeight
  return Math.min(1, Math.max(0, raw))
}

/** Inverse of getCurrentFraction. `behavior` defaults to smooth (a
 * user-initiated Jump/Next/Prev benefits from the animation); pass
 * 'instant' for an on-mount/section-change restore, so it doesn't
 * visibly animate-scroll right after content changes underneath it. */
export function scrollToFraction(
  articleEl: HTMLElement,
  fraction: number,
  behavior: ScrollBehavior = 'smooth',
) {
  const rect = articleEl.getBoundingClientRect()
  const articleTop = rect.top + window.scrollY
  const targetY = articleTop + fraction * articleEl.offsetHeight - window.innerHeight / 2
  window.scrollTo({ top: Math.max(0, targetY), behavior })
}
