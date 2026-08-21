import { useEffect, useState } from 'react'
import {
  hashSections,
  loadDocumentsState,
  pruneDocuments,
  saveDocumentsState,
  type Bookmark,
  type DocNote,
  type DocumentSection,
  type Position,
  type ReaderDocument,
  type SourceType,
} from '../lib/documents'

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Persists Resume + Bookmarks + Notes state to localStorage on every
 * change. One instance per Reader page — same pattern as
 * useReadingSettings. */
export function useDocuments() {
  const [state, setState] = useState(() => loadDocumentsState())

  useEffect(() => {
    saveDocumentsState(state)
  }, [state])

  /** Creates the document if new, or refreshes it (and reunites with
   * its existing bookmarks/notes/position) if these exact sections
   * were opened before. Always marks it as the resume target. Returns
   * its id synchronously so the caller doesn't have to read state
   * back out — plus `prunedTitle`, set whenever adding this document
   * pushed the library over its 10-book cap and silently dropped
   * another one: `null` if nothing was pruned, otherwise the dropped
   * document's raw (possibly empty/untitled) title, so the caller can
   * show an honest notice (nibras-qa P1-7) instead of a book vanishing
   * with no explanation. Computed from `state` (this hook's own
   * closure, not a stale snapshot) BEFORE calling setState, then that
   * exact already-pruned map is handed to setState as a plain value —
   * safe here because this function is only ever called once per
   * discrete user action (paste/file-open), never in a loop or
   * concurrently with another mutation of this same state. */
  function openOrUpdateDocument(input: {
    sections: DocumentSection[]
    sourceType: SourceType
    lang: 'en' | 'ar'
    title?: string
  }): { id: string; prunedTitle: string | null } {
    const id = hashSections(input.sections)
    const existing = state.documents[id]
    const doc: ReaderDocument = existing
      ? { ...existing, ...input, updatedAt: Date.now() }
      : {
          id,
          title: input.title,
          sourceType: input.sourceType,
          lang: input.lang,
          sections: input.sections,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          position: { sectionIndex: 0, fraction: 0 },
          bookmarks: [],
          notes: [],
        }
    const { documents, dropped } = pruneDocuments({ ...state.documents, [id]: doc })
    // Task #143 — also track this as the per-language auto-reopen
    // candidate (see DocumentsState.lastDocumentIdByLang's own doc
    // comment), alongside the existing global pointer.
    setState((s) => ({
      ...s,
      lastDocumentId: id,
      lastDocumentIdByLang: { ...s.lastDocumentIdByLang, [doc.lang]: id },
      documents,
    }))
    return { id, prunedTitle: dropped.length > 0 ? dropped[0].title?.trim() || '' : null }
  }

  function updatePosition(id: string, position: Position) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      return { ...s, documents: { ...s.documents, [id]: { ...doc, position } } }
    })
  }

  function addBookmark(id: string, position: Position) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      const bookmark: Bookmark = { id: newId('bm'), position, createdAt: Date.now() }
      const bookmarks = [...doc.bookmarks, bookmark].sort(comparePositions)
      return { ...s, documents: { ...s.documents, [id]: { ...doc, bookmarks } } }
    })
  }

  function removeBookmark(id: string, bookmarkId: string) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      return {
        ...s,
        documents: {
          ...s.documents,
          [id]: { ...doc, bookmarks: doc.bookmarks.filter((b) => b.id !== bookmarkId) },
        },
      }
    })
  }

  function addNote(id: string, position: Position, text: string) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      const note: DocNote = { id: newId('note'), position, text, createdAt: Date.now() }
      const notes = [...doc.notes, note].sort(comparePositions)
      return { ...s, documents: { ...s.documents, [id]: { ...doc, notes } } }
    })
  }

  function removeNote(id: string, noteId: string) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      return {
        ...s,
        documents: { ...s.documents, [id]: { ...doc, notes: doc.notes.filter((n) => n.id !== noteId) } },
      }
    })
  }

  /** Stops offering to resume, without deleting the saved document —
   * opening the same book/text again later still finds its bookmarks
   * and notes. Optional `lang` (task #143, "Start Fresh" on a
   * language-switch-triggered reopen) also clears THAT language's own
   * auto-reopen candidate, so dismissing really means "don't bring
   * this back" — without it, switching away and back to `lang` would
   * silently re-resume the exact document Start Fresh just cleared. */
  function dismissResume(lang?: 'en' | 'ar') {
    setState((s) => ({
      ...s,
      lastDocumentId: null,
      lastDocumentIdByLang: lang ? { ...s.lastDocumentIdByLang, [lang]: null } : s.lastDocumentIdByLang,
    }))
  }

  /** Permanently deletes a saved document — its bookmarks/notes go
   * with it, since both are stored embedded on the document itself
   * (see ReaderDocument.bookmarks/notes). Also clears it as the resume
   * target if it was one (both the global pointer AND, task #143, its
   * own per-language one), so the Reader never tries to resume
   * something that no longer exists. The Library page gets an explicit
   * confirmation from the reader before calling this — there's no
   * undo. */
  function removeDocument(id: string) {
    setState((s) => {
      if (!(id in s.documents)) return s
      const documents = { ...s.documents }
      delete documents[id]
      const lastDocumentIdByLang = { ...s.lastDocumentIdByLang }
      for (const lang of ['en', 'ar'] as const) {
        if (lastDocumentIdByLang[lang] === id) lastDocumentIdByLang[lang] = null
      }
      return {
        ...s,
        documents,
        lastDocumentId: s.lastDocumentId === id ? null : s.lastDocumentId,
        lastDocumentIdByLang,
      }
    })
  }

  /** Assigns (or, with `null`, clears) which Library folder a saved
   * document belongs to. Deliberately does NOT touch `updatedAt` —
   * filing a book is an organizational action, not "you just read
   * this" (see the field's own comment on ReaderDocument). No-ops if
   * the document no longer exists. */
  function setDocumentFolder(id: string, folderId: string | null) {
    setState((s) => {
      const doc = s.documents[id]
      if (!doc) return s
      const { folderId: _current, ...rest } = doc
      const updated: ReaderDocument = folderId ? { ...rest, folderId } : rest
      return { ...s, documents: { ...s.documents, [id]: updated } }
    })
  }

  /** Marks an already-saved document as the resume target WITHOUT
   * touching its content/position — unlike openOrUpdateDocument, which
   * is for freshly-parsed text/files. Lets a caller outside the Reader
   * (the Profile page's library list) pick which saved document the
   * Reader should resume on its next mount, since the Reader seeds its
   * initial state from `lastDocumentId` at mount time. No-ops if the id
   * no longer exists (e.g. it was pruned). */
  function resumeDocument(id: string) {
    setState((s) => (s.documents[id] ? { ...s, lastDocumentId: id } : s))
  }

  /** Permanently hides the Reader's "try an example" prompt on this
   * device — called both by an explicit dismiss action and (in the
   * Reader) once a guest actually opens an example, so it doesn't
   * linger as a concept once it's served its purpose. */
  function dismissExamples() {
    setState((s) => ({ ...s, examplesDismissed: true }))
  }

  return {
    documents: state.documents,
    lastDocumentId: state.lastDocumentId,
    lastDocumentIdByLang: state.lastDocumentIdByLang,
    examplesDismissed: state.examplesDismissed,
    openOrUpdateDocument,
    updatePosition,
    addBookmark,
    removeBookmark,
    addNote,
    removeNote,
    dismissResume,
    removeDocument,
    setDocumentFolder,
    resumeDocument,
    dismissExamples,
  }
}

function comparePositions(a: { position: Position }, b: { position: Position }) {
  if (a.position.sectionIndex !== b.position.sectionIndex) {
    return a.position.sectionIndex - b.position.sectionIndex
  }
  return a.position.fraction - b.position.fraction
}
