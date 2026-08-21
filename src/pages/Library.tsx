import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfileData, SOURCE_LABEL_KEY } from '../hooks/useProfileData'
import { useLibraryFolders } from '../hooks/useLibraryFolders'
import { FileOpenButton } from '../components/reader/FileOpenButton'
import { RulerColorField } from '../components/reader/SettingsFields'
import { formatRelativeTime } from '../lib/relativeTime'
import { chunkPlainText } from '../lib/textChunking'
import { detectLanguage, tagSectionLanguages } from '../lib/detectLanguage'
import { DEFAULT_RULER_COLOR, RULER_COLORS, RULER_COLOR_LABEL_KEY, type RulerColor } from '../lib/readingSettings'
import { AddIcon, EditIcon, TrashIcon } from '../components/icons'
import { focusRing, focusRingInset } from '../lib/focus'
import type { ParsedFile } from '../lib/fileParsers'
import type { ReaderDocument } from '../lib/documents'
import type { LibraryFolder } from '../lib/libraryFolders'

/**
 * The dedicated Library (Amal, 2026-08-13, via team-lead): "a library
 * where the reader puts their books/files, saves them, and comes back
 * to them whenever they like" («مكتبة يحط فيها القارئ كتبه/ملفاته اللي
 * يبغى يقرأها، يحفظها، ويرجع لها متى ما حب»). This is the full home
 * for the on-device documents store (useDocuments, via useProfileData)
 * — every saved book/file, newest first, with Add (file picker or
 * pasted text) and Remove (with confirm). Profile keeps a short
 * summary + a link here instead of duplicating the full list (its own
 * call, see Profile.tsx); Dashboard's own "recently opened" mini-list
 * is unchanged and links here too.
 *
 * Folders (added same day, a follow-up: "the Library needs a way to
 * put books into folders so they're organized, plus a colour choice
 * per folder, and it should be possible to name the folder"): a
 * separate on-device store (useLibraryFolders/lib/libraryFolders.ts),
 * each document optionally tagged with a `folderId`. The book list is
 * grouped by folder, each folder shown by NAME first — colour is a
 * small supplementary dot next to it, never the only way to tell two
 * folders apart (a colour-blind reader must be able to use this page
 * exactly as well as anyone else). Deleting a folder un-files its
 * books back to "Uncategorized" rather than deleting them — confirmed
 * first, same confirm-bar pattern already used for removing a book.
 *
 * Fully on-device, same privacy model as everywhere else in Nibras —
 * nothing here is ever uploaded.
 */

// RULER_COLORS[0] IS DEFAULT_RULER_COLOR — the same brand-accent blue
// as the nav highlight and every accent heading on this page. Seeding
// every new folder with it (the naive "just use the default" choice)
// made the first folder's colour dot read as a plain bullet, not a
// colour choice (nibras-qa + PM, P1-12, 2026-08-13) — Amal's own ask
// («لون الملف») was specifically to SEE a colour. Fix is the SEEDING
// here, not DEFAULT_RULER_COLOR itself — that constant is shared with
// the Reading Ruler's own load-time fallback (readingSettings.ts), so
// changing IT would silently change the ruler's default too (a real
// trap, flagged independently by both QA and PM — the ruler's blue
// default is a deliberate "no unprompted colour change" decision from
// an earlier task).
const NON_ACCENT_FOLDER_COLORS = RULER_COLORS.slice(1)

/** Next colour a NEW folder should default to — the first non-accent
 * hue not already used by an EXISTING folder, cycling back through
 * the same 5 once all are taken (folder #6 reuses folder #1's colour,
 * etc. — fine, per team-lead: the folder's NAME is the identifier,
 * colour is always supplementary). The accent blue is deliberately
 * never auto-suggested — still fully choosable manually in the picker,
 * just never the unprompted default. Existing folders keep whatever
 * colour they already have; this only affects what a NEW folder starts
 * pre-selected to. */
function nextUnusedFolderColor(existingFolders: LibraryFolder[]): RulerColor {
  const used = new Set(existingFolders.map((f) => f.color))
  const unused = NON_ACCENT_FOLDER_COLORS.find((color) => !used.has(color))
  if (unused) return unused
  return NON_ACCENT_FOLDER_COLORS[existingFolders.length % NON_ACCENT_FOLDER_COLORS.length]
}

export function Library() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  const { docList, lang, docTitle, openInReader, openOrUpdateDocument, removeDocument, setDocumentFolder } =
    useProfileData()
  const { folders, createFolder, renameFolder, recolorFolder, deleteFolder } = useLibraryFolders()

  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  // Split in two (nibras-qa P1-12, 2026-08-13) — was one shared
  // `statusMessage` that rendered ONLY inside the "Add to your
  // library" card, so a delete/move/folder action's confirmation
  // showed up far from where it actually happened, down in the list
  // section. `addStatusMessage` stays next to Add (file/paste);
  // `listStatusMessage` renders next to the list itself (remove a
  // book, create/delete a folder, move a book between folders).
  const [addStatusMessage, setAddStatusMessage] = useState('')
  const [listStatusMessage, setListStatusMessage] = useState('')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState<RulerColor>(DEFAULT_RULER_COLOR)

  // A fresh Add can push the library over its 10-book cap and silently
  // drop the least-recently-opened OTHER book (nibras-qa P1-7) — appends
  // the same honest notice Reader.tsx shows, onto the SAME status line
  // as the "Added" confirmation (one role="status" paragraph, so a
  // screen reader announces both facts together, not just the good
  // news half).
  function addedStatusMessage(title: string, prunedTitle: string | null) {
    const added = t('library.addedStatus', { title })
    if (prunedTitle === null) return added
    return `${added} ${t('library.limitPrunedNotice', { title: prunedTitle || t('profile.untitledDocument') })}`
  }

  function handleFileParsed(result: ParsedFile) {
    const { prunedTitle } = openOrUpdateDocument(result)
    setAddStatusMessage(addedStatusMessage(result.title?.trim() || t('profile.untitledDocument'), prunedTitle))
  }

  function handleSavePastedText() {
    const text = pasteText.trim()
    if (!text) return
    const docLang = detectLanguage(text, isArabic ? 'ar' : 'en')
    const { prunedTitle } = openOrUpdateDocument({
      sections: tagSectionLanguages(chunkPlainText(text).map((chunk) => ({ text: chunk })), docLang),
      sourceType: 'pasted',
      lang: docLang,
    })
    setAddStatusMessage(addedStatusMessage(t('profile.untitledDocument'), prunedTitle))
    setPasteText('')
    setPasteOpen(false)
  }

  function handleRemove(doc: ReaderDocument) {
    removeDocument(doc.id)
    setListStatusMessage(t('library.removedStatus', { title: docTitle(doc) }))
  }

  // Moving a book between folders had NO confirmation message at all
  // before (nibras-qa P1-12 polish, 2026-08-13) — setDocumentFolder was
  // wired directly to the select's onChange with nothing else. Looks
  // up the target folder's NAME (not just id) for the message, since
  // name is always the identifier a reader actually recognizes.
  function handleMoveDoc(docId: string, folderId: string | null) {
    const doc = docList.find((d) => d.id === docId)
    setDocumentFolder(docId, folderId)
    if (!doc) return
    const targetName = folderId ? folders[folderId]?.name : null
    setListStatusMessage(
      targetName
        ? t('library.movedToFolderStatus', { title: docTitle(doc), folder: targetName })
        : t('library.movedToUncategorizedStatus', { title: docTitle(doc) }),
    )
  }

  // Opens the "+ New folder" disclosure, pre-selecting the next
  // not-yet-used non-accent colour (see nextUnusedFolderColor above) —
  // computed fresh here, not once at mount, since which colours are
  // "used" changes as folders are created/deleted.
  function handleOpenNewFolder() {
    setNewFolderColor(nextUnusedFolderColor(folderList))
    setNewFolderOpen(true)
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    createFolder(name, newFolderColor)
    setListStatusMessage(t('library.folderCreatedStatus', { name }))
    setNewFolderName('')
    setNewFolderColor(DEFAULT_RULER_COLOR)
    setNewFolderOpen(false)
  }

  // Un-files every book in the folder FIRST (a separate store from the
  // folder record itself — see useLibraryFolders' own comment on why
  // that coordination happens here, not inside either hook), then
  // deletes the folder record. Order matters: if this crashed midway,
  // "some books orphaned, folder still exists" is recoverable (just
  // re-file them); "folder gone, books still tagged with a dead id"
  // is a worse state to be in.
  function handleDeleteFolder(folder: LibraryFolder) {
    for (const doc of docList) {
      if (doc.folderId === folder.id) setDocumentFolder(doc.id, null)
    }
    deleteFolder(folder.id)
    setListStatusMessage(t('library.folderDeletedStatus', { name: folder.name }))
  }

  const folderList = Object.values(folders).sort((a, b) => a.createdAt - b.createdAt)
  // Guards against a document whose folderId points at nothing (should
  // never happen given handleDeleteFolder above always un-files first,
  // but a document filed under a folder that's since vanished should
  // still show up SOMEWHERE, not silently disappear from the page).
  const uncategorized = docList.filter((doc) => !doc.folderId || !folders[doc.folderId])

  const colorLabels: Record<RulerColor, string> = Object.fromEntries(
    RULER_COLORS.map((color) => [color, t(RULER_COLOR_LABEL_KEY[color])]),
  ) as Record<RulerColor, string>

  const isEmpty = docList.length === 0 && folderList.length === 0

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('library.title')}</h1>
      <p className="mb-8 max-w-[46rem] text-[0.9375rem] text-ink-muted">{t('library.subtitle')}</p>

      <section aria-labelledby="library-add-heading" className="mb-8 rounded-card border border-line bg-card p-5">
        <h2 id="library-add-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('library.addTitle')}
        </h2>
        <FileOpenButton onParsed={handleFileParsed} uiLanguageFallback={isArabic ? 'ar' : 'en'} />

        {pasteOpen ? (
          <div className="rounded-control border-[1.5px] border-line-strong bg-cream p-3">
            <label htmlFor="library-paste" className="sr-only">
              {t('library.pastePlaceholder')}
            </label>
            <textarea
              id="library-paste"
              rows={3}
              autoFocus
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('library.pastePlaceholder')}
              className={`w-full resize-y rounded-control bg-transparent p-2 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasteOpen(false)
                  setPasteText('')
                }}
                className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
              >
                {t('library.pasteCancel')}
              </button>
              <button
                type="button"
                onClick={handleSavePastedText}
                disabled={!pasteText.trim()}
                className={`rounded-control bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
              >
                {t('library.pasteSave')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className={`mt-1 inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[0.8125rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
          >
            <AddIcon className="size-4" />
            {t('library.addPasteToggle')}
          </button>
        )}

        {addStatusMessage && (
          <p role="status" className="mt-3 text-[0.8125rem] font-medium text-accent">
            {addStatusMessage}
          </p>
        )}
      </section>

      <section aria-labelledby="library-list-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="library-list-heading" className="text-sm font-bold tracking-[0.08em] text-accent uppercase">
            {t('library.listTitle')}
          </h2>
          {!newFolderOpen && (
            <button
              type="button"
              onClick={handleOpenNewFolder}
              className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[0.8125rem] font-semibold text-accent hover:bg-accent-tint ${focusRingInset}`}
            >
              <AddIcon className="size-4" />
              {t('library.foldersNewButton')}
            </button>
          )}
        </div>

        {/* Delete/create-folder/remove-book/move-book confirmations
            render HERE, next to the list they actually affected — not
            up in the Add card, far away (nibras-qa P1-12 polish,
            2026-08-13). */}
        {listStatusMessage && (
          <p role="status" className="mb-4 text-[0.8125rem] font-medium text-accent">
            {listStatusMessage}
          </p>
        )}

        {newFolderOpen && (
          <div className="mb-5 rounded-control border-[1.5px] border-line-strong bg-card p-3.5">
            <label htmlFor="new-folder-name" className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
              {t('library.folderNameLabel')}
            </label>
            <input
              id="new-folder-name"
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('library.folderNamePlaceholder')}
              maxLength={40}
              dir={isArabic ? 'rtl' : 'ltr'}
              className={`mb-3 w-full rounded-control border-[1.5px] border-line-strong bg-cream p-2 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
            />
            <RulerColorField
              legend={t('library.folderColorLabel')}
              name="new-folder-color"
              value={newFolderColor}
              onChange={setNewFolderColor}
              colorLabels={colorLabels}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewFolderOpen(false)
                  setNewFolderName('')
                  setNewFolderColor(DEFAULT_RULER_COLOR)
                }}
                className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
              >
                {t('library.folderCancelButton')}
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className={`rounded-control bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
              >
                {t('library.createFolderButton')}
              </button>
            </div>
          </div>
        )}

        {isEmpty ? (
          <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
            <p className="m-0 text-[0.9375rem] text-ink-muted">{t('library.empty')}</p>
          </div>
        ) : (
          <div id="library-groups" className="flex flex-col gap-7">
            {folderList.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                docs={docList.filter((doc) => doc.folderId === folder.id)}
                lang={lang}
                docTitle={docTitle}
                folderOptions={folderList}
                colorLabels={colorLabels}
                onOpen={(id) => openInReader(id)}
                onRemoveDoc={handleRemove}
                onMoveDoc={handleMoveDoc}
                onRename={(name) => renameFolder(folder.id, name)}
                onRecolor={(color) => recolorFolder(folder.id, color)}
                onDelete={() => handleDeleteFolder(folder)}
              />
            ))}
            {(folderList.length === 0 || uncategorized.length > 0) && (
              <FolderGroup
                folder={null}
                docs={uncategorized}
                lang={lang}
                docTitle={docTitle}
                folderOptions={folderList}
                colorLabels={colorLabels}
                onOpen={(id) => openInReader(id)}
                onRemoveDoc={handleRemove}
                onMoveDoc={handleMoveDoc}
              />
            )}
          </div>
        )}
      </section>
    </main>
  )
}

function FolderGroup({
  folder,
  docs,
  lang,
  docTitle,
  folderOptions,
  colorLabels,
  onOpen,
  onRemoveDoc,
  onMoveDoc,
  onRename,
  onRecolor,
  onDelete,
}: {
  /** null = the "Uncategorized" pseudo-folder — no rename/recolor/
   * delete controls, since it isn't a real record. */
  folder: LibraryFolder | null
  docs: ReaderDocument[]
  lang: 'en' | 'ar'
  docTitle: (doc: ReaderDocument) => string
  folderOptions: LibraryFolder[]
  colorLabels: Record<RulerColor, string>
  onOpen: (id: string) => void
  onRemoveDoc: (doc: ReaderDocument) => void
  onMoveDoc: (docId: string, folderId: string | null) => void
  onRename?: (name: string) => void
  onRecolor?: (color: RulerColor) => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draftName, setDraftName] = useState(folder?.name ?? '')
  const [draftColor, setDraftColor] = useState<RulerColor>(folder?.color ?? DEFAULT_RULER_COLOR)

  const headingId = folder ? `folder-${folder.id}-heading` : 'folder-uncategorized-heading'
  const displayName = folder ? folder.name : t('library.uncategorized')

  function startEditing() {
    setDraftName(folder?.name ?? '')
    setDraftColor(folder?.color ?? DEFAULT_RULER_COLOR)
    setEditing(true)
  }

  function saveEditing() {
    const name = draftName.trim()
    if (!name || !onRename || !onRecolor) return
    onRename(name)
    onRecolor(draftColor)
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Decorative only — the folder's NAME (just below) is
              always the real, primary way to identify it; this dot is
              a supplementary hint, never load-bearing on its own. */}
          {folder && (
            <span aria-hidden="true" className="size-3 flex-none rounded-full" style={{ background: folder.color }} />
          )}
          <h3 id={headingId} className="m-0 truncate text-[0.9375rem] font-bold text-ink">
            {displayName}
          </h3>
          <span className="flex-none text-[0.8125rem] text-ink-muted">
            {t('library.folderBookCount', { count: docs.length })}
          </span>
        </div>
        {folder && !editing && !confirmingDelete && (
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              aria-label={t('library.renameFolderLabel', { name: folder.name })}
              onClick={startEditing}
              className={`rounded-control p-1.5 text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              <EditIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t('library.deleteFolderLabel', { name: folder.name })}
              onClick={() => setConfirmingDelete(true)}
              className={`rounded-control p-1.5 text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {folder && editing && (
        <div className="mb-4 rounded-control border-[1.5px] border-line-strong bg-card p-3.5">
          <label htmlFor={`rename-${folder.id}`} className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
            {t('library.folderNameLabel')}
          </label>
          <input
            id={`rename-${folder.id}`}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            className={`mb-3 w-full rounded-control border-[1.5px] border-line-strong bg-cream p-2 text-[0.9375rem] text-ink ${focusRing}`}
          />
          <RulerColorField
            legend={t('library.folderColorLabel')}
            name={`recolor-${folder.id}`}
            value={draftColor}
            onChange={setDraftColor}
            colorLabels={colorLabels}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              {t('library.folderCancelButton')}
            </button>
            <button
              type="button"
              onClick={saveEditing}
              disabled={!draftName.trim()}
              className={`rounded-control bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
            >
              {t('library.saveFolderButton')}
            </button>
          </div>
        </div>
      )}

      {folder && confirmingDelete && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control border-[1.5px] border-line-strong bg-card p-3.5">
          <span className="text-[0.8125rem] text-ink">{t('library.deleteFolderConfirmText', { name: folder.name })}</span>
          <span className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              {t('library.folderCancelButton')}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className={`rounded-control border-[1.5px] border-line-strong bg-cream px-3 py-1.5 text-[0.8125rem] font-semibold text-ink hover:border-ink ${focusRing}`}
            >
              {t('library.deleteFolderConfirmButton')}
            </button>
          </span>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="m-0 text-[0.8125rem] italic text-ink-muted">{t('library.folderEmptyHint')}</p>
      ) : (
        <ul aria-labelledby={headingId} className="m-0 flex list-none flex-col gap-2 p-0">
          {docs.map((doc) => (
            <LibraryRow
              key={doc.id}
              doc={doc}
              lang={lang}
              title={docTitle(doc)}
              folderOptions={folderOptions}
              currentFolderId={folder?.id ?? ''}
              onOpen={() => onOpen(doc.id)}
              onRemove={() => onRemoveDoc(doc)}
              onMove={(folderId) => onMoveDoc(doc.id, folderId || null)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function LibraryRow({
  doc,
  lang,
  title,
  folderOptions,
  currentFolderId,
  onOpen,
  onRemove,
  onMove,
}: {
  doc: ReaderDocument
  lang: 'en' | 'ar'
  title: string
  folderOptions: LibraryFolder[]
  currentFolderId: string
  onOpen: () => void
  onRemove: () => void
  onMove: (folderId: string) => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="rounded-control border border-line bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-[0.9375rem] font-semibold text-ink">{title}</p>
          <p className="m-0 text-[0.8125rem] text-ink-muted">
            {t(SOURCE_LABEL_KEY[doc.sourceType])} ·{' '}
            {t('profile.updatedRelative', { time: formatRelativeTime(doc.updatedAt, lang) })}
          </p>
        </div>
        {!confirming && (
          <div className="flex flex-none flex-wrap items-center gap-1.5">
            {/* Hidden entirely when no folder exists yet (nibras-qa
                P1-12 polish, 2026-08-13) — offering a "move to folder"
                control with nowhere real to move a book TO is clutter,
                not a genuine choice. folderOptions.length === 0 only
                happens when this row is already in Uncategorized (a
                book filed under a real folder implies that folder is
                itself in folderOptions), so this never hides a control
                a reader would actually need. */}
            {folderOptions.length > 0 && (
              <>
                <label htmlFor={`move-${doc.id}`} className="sr-only">
                  {t('library.moveToFolderLabel', { title })}
                </label>
                <select
                  id={`move-${doc.id}`}
                  value={currentFolderId}
                  onChange={(e) => onMove(e.target.value)}
                  className={`rounded-control border-[1.5px] border-line-strong bg-card px-2 py-1.5 text-[0.8125rem] text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
                >
                  <option value="">{t('library.uncategorized')}</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              type="button"
              onClick={onOpen}
              className={`rounded-control border-[1.5px] border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
            >
              {t('profile.openDocument')}
            </button>
            <button
              type="button"
              aria-label={t('library.removeButtonLabel', { title })}
              onClick={() => setConfirming(true)}
              className={`rounded-control p-1.5 text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[0.8125rem] text-ink">{t('library.removeConfirmText', { title })}</span>
          <span className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
            >
              {t('library.removeCancelButton')}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`rounded-control border-[1.5px] border-line-strong bg-cream px-3 py-1.5 text-[0.8125rem] font-semibold text-ink hover:border-ink ${focusRing}`}
            >
              {t('library.removeConfirmButton')}
            </button>
          </span>
        </div>
      )}
    </li>
  )
}
