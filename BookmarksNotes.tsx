import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Position, ReaderDocument } from '../../lib/documents'
import { describePosition } from '../../lib/positionLabels'
import { BookmarkIcon, ChevronIcon, CloseIcon, NoteIcon } from '../icons'
import { focusRing, focusRingInset } from '../../lib/focus'

/** Bookmarks + Notes for the currently-open document. Both are
 * "position markers" on the same scale — a bookmark is an unlabeled
 * marker, a note is a marker with text attached — so they share one
 * visual language here. Only rendered once a real document is open
 * (not for the sample placeholder). */
export function BookmarksNotes({
  document,
  getPosition,
  onJump,
  onAddBookmark,
  onRemoveBookmark,
  onAddNote,
  onRemoveNote,
}: {
  document: ReaderDocument
  getPosition: () => Position
  onJump: (position: Position) => void
  onAddBookmark: (position: Position) => void
  onRemoveBookmark: (bookmarkId: string) => void
  onAddNote: (position: Position, text: string) => void
  onRemoveNote: (noteId: string) => void
}) {
  const { t } = useTranslation()
  const [draftNotePosition, setDraftNotePosition] = useState<Position | null>(null)
  const [draftNoteText, setDraftNoteText] = useState('')

  function startNote() {
    setDraftNotePosition(getPosition())
    setDraftNoteText('')
  }

  function saveNote() {
    if (draftNotePosition === null || !draftNoteText.trim()) return
    onAddNote(draftNotePosition, draftNoteText.trim())
    setDraftNotePosition(null)
    setDraftNoteText('')
  }

  return (
    <div className="mt-7 grid gap-6 sm:grid-cols-2">
      <section aria-labelledby="bookmarks-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="bookmarks-heading" className="text-sm font-bold text-ink">
            {t('reader.bookmarksTitle')}
          </h2>
          <button
            type="button"
            onClick={() => onAddBookmark(getPosition())}
            className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[0.8125rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
          >
            <BookmarkIcon className="size-4" />
            {t('reader.addBookmark')}
          </button>
        </div>

        {document.bookmarks.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-muted">{t('reader.noBookmarks')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {document.bookmarks.map((bookmark) => (
              <li
                key={bookmark.id}
                className="flex items-center justify-between gap-2 rounded-control border border-line bg-card px-3 py-2"
              >
                <span className="text-[0.8125rem] text-ink">
                  {describePosition(document, bookmark.position, t)}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onJump(bookmark.position)}
                    className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-[0.8125rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
                  >
                    {t('reader.jump')}
                    <ChevronIcon className="size-3.5 rtl:-scale-x-100" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('reader.remove')}
                    onClick={() => onRemoveBookmark(bookmark.id)}
                    className={`rounded-control p-1.5 text-ink-muted hover:text-ink ${focusRingInset}`}
                  >
                    <CloseIcon className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notes-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="notes-heading" className="text-sm font-bold text-ink">
            {t('reader.notesTitle')}
          </h2>
          <button
            type="button"
            onClick={startNote}
            className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[0.8125rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
          >
            <NoteIcon className="size-4" />
            {t('reader.addNote')}
          </button>
        </div>

        {draftNotePosition !== null && (
          <div className="mb-2.5 rounded-control border-[1.5px] border-line-strong bg-card p-2.5">
            <label htmlFor="new-note" className="sr-only">
              {t('reader.notePlaceholder')}
            </label>
            <textarea
              id="new-note"
              rows={2}
              autoFocus
              value={draftNoteText}
              onChange={(e) => setDraftNoteText(e.target.value)}
              placeholder={t('reader.notePlaceholder')}
              className={`w-full resize-y rounded-control bg-transparent p-1.5 text-[0.8125rem] text-ink placeholder:text-ink-muted ${focusRing}`}
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraftNotePosition(null)}
                className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
              >
                {t('reader.cancelNote')}
              </button>
              <button
                type="button"
                onClick={saveNote}
                disabled={!draftNoteText.trim()}
                className={`rounded-control bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
              >
                {t('reader.saveNote')}
              </button>
            </div>
          </div>
        )}

        {document.notes.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-muted">{t('reader.noNotes')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {document.notes.map((note) => (
              <li key={note.id} className="rounded-control border border-line bg-card px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[0.75rem] font-semibold text-ink-muted">
                    {describePosition(document, note.position, t)}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onJump(note.position)}
                      className={`inline-flex items-center gap-1 rounded-control px-2 py-1 text-[0.75rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
                    >
                      {t('reader.jump')}
                      <ChevronIcon className="size-3 rtl:-scale-x-100" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('reader.remove')}
                      onClick={() => onRemoveNote(note.id)}
                      className={`rounded-control p-1.5 text-ink-muted hover:text-ink ${focusRingInset}`}
                    >
                      <CloseIcon className="size-3.5" />
                    </button>
                  </span>
                </div>
                <p className="m-0 text-[0.875rem] text-ink">{note.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
