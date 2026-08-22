import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LibraryIcon } from '../icons'
import { focusRing, focusRingInset } from '../../lib/focus'
import { SOURCE_LABEL_KEY } from '../../hooks/useProfileData'
import type { ReaderDocument } from '../../lib/documents'

/** "Open from Library" (#260) — a sibling to FileOpenButton. Lets a reader
 * pick a book they already saved (useDocuments) and load it into the Reader
 * through the SAME openDocument path an uploaded file uses. Client-only, no
 * network. A small popover of saved books, most-recent first; each book keeps
 * its OWN language/direction so a mixed library lists correctly. Closes on
 * pick, outside-click, or Escape. */
export function OpenFromLibraryButton({
  documents,
  onPick,
}: {
  documents: Record<string, ReaderDocument>
  onPick: (doc: ReaderDocument) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const docs = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt)

  useEffect(() => {
    if (!open) return
    // a11y (P2-G): move focus INTO the popover on open (the labelled dialog
    // container), so a keyboard/screen-reader user lands inside it rather
    // than being left on the trigger while a popup silently appears.
    const raf = requestAnimationFrame(() => popoverRef.current?.focus())
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus() // return focus to the trigger on Escape
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink ${focusRingInset}`}
      >
        <LibraryIcon className="size-[18px]" aria-hidden="true" />
        {t('reader.openFromLibrary')}
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('reader.openFromLibrary')}
          tabIndex={-1}
          className="absolute z-20 mt-1.5 max-h-[19rem] w-[min(22rem,calc(100vw-3rem))] overflow-auto rounded-control border-[1.5px] border-line-strong bg-card p-1.5 shadow-lg focus:outline-none"
        >
          {docs.length === 0 ? (
            <p className="m-0 px-3 py-4 text-center text-[0.8125rem] text-ink-muted">{t('reader.libraryEmpty')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(doc)
                      setOpen(false)
                    }}
                    lang={doc.lang}
                    dir={doc.lang === 'ar' ? 'rtl' : 'ltr'}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-control px-3 py-2 text-start hover:bg-accent-tint ${focusRing}`}
                  >
                    <span className="block w-full truncate text-[0.9375rem] font-semibold text-ink">
                      {doc.title || t('profile.untitledDocument')}
                    </span>
                    <span className="block text-[0.75rem] text-ink-muted">{t(SOURCE_LABEL_KEY[doc.sourceType])}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
