import { useEffect, useState } from 'react'
import { loadLibraryFoldersState, saveLibraryFoldersState, type LibraryFolder } from '../lib/libraryFolders'
import { DEFAULT_RULER_COLOR, type RulerColor } from '../lib/readingSettings'

function newFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Persists Library folders to localStorage on every change — same
 * one-hook-per-localStorage-key pattern as useDocuments/
 * useReadingSettings. Deliberately does NOT touch useDocuments itself
 * (assigning/clearing a document's folderId is useDocuments'
 * `setDocumentFolder`) — Library.tsx coordinates the two together
 * (e.g. un-filing every book in a folder right before deleting it),
 * the same way useProfileData already coordinates useDocuments +
 * useReadingSettings into one combined read surface, rather than one
 * hook reaching into another's localStorage key directly. */
export function useLibraryFolders() {
  const [state, setState] = useState(() => loadLibraryFoldersState())

  useEffect(() => {
    saveLibraryFoldersState(state)
  }, [state])

  function createFolder(name: string, color: RulerColor = DEFAULT_RULER_COLOR): string {
    const id = newFolderId()
    const folder: LibraryFolder = { id, name, color, createdAt: Date.now() }
    setState((s) => ({ folders: { ...s.folders, [id]: folder } }))
    return id
  }

  function renameFolder(id: string, name: string) {
    setState((s) => {
      const folder = s.folders[id]
      if (!folder) return s
      return { folders: { ...s.folders, [id]: { ...folder, name } } }
    })
  }

  function recolorFolder(id: string, color: RulerColor) {
    setState((s) => {
      const folder = s.folders[id]
      if (!folder) return s
      return { folders: { ...s.folders, [id]: { ...folder, color } } }
    })
  }

  /** Deletes the folder record itself only — does NOT touch any
   * document's `folderId` (that would be reaching into useDocuments'
   * own localStorage key from here). Callers un-file every affected
   * document via useDocuments.setDocumentFolder(id, null) FIRST — see
   * Library.tsx's handleDeleteFolder. */
  function deleteFolder(id: string) {
    setState((s) => {
      if (!(id in s.folders)) return s
      const folders = { ...s.folders }
      delete folders[id]
      return { folders }
    })
  }

  return { folders: state.folders, createFolder, renameFolder, recolorFolder, deleteFolder }
}
