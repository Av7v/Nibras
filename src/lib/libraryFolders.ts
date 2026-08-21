import type { RulerColor } from './readingSettings'

/**
 * Library folders/collections (Amal, 2026-08-13): "the Library needs a
 * way to put books into folders so they're organized, plus a colour
 * choice per folder" («المكتبة ضيف فيها خاصية وضع الكتب بملفات بحيث
 * انها تكون مرتبة، مع خاصية اختيار لون الملف») + "and it should also
 * be possible to name the folder" («ويصير برضه فيه إمكانية تسمية
 * المجلد»). On-device only, same privacy model as everywhere else —
 * a separate localStorage key from the documents store itself
 * (documents.ts), so a folder is its own small, independently-
 * persisted record; each `ReaderDocument` carries an OPTIONAL
 * `folderId` (see documents.ts) pointing back at one of these by id.
 *
 * Color reuses `RulerColor`/`RULER_COLORS` from readingSettings.ts
 * (the Reading Ruler's own palette) rather than inventing a second
 * one — same reasoning the Reading Ruler itself used for choosing that
 * palette (moderately-saturated, comfortable, already contrast-
 * checked), and it means the Library's own color picker can reuse
 * `RulerColorField` from components/reader/SettingsFields.tsx
 * directly, with zero new picker component needed.
 */

export interface LibraryFolder {
  id: string
  name: string
  color: RulerColor
  createdAt: number
}

export interface LibraryFoldersState {
  folders: Record<string, LibraryFolder>
}

const STORAGE_KEY = 'nibras-library-folders'

function emptyState(): LibraryFoldersState {
  return { folders: {} }
}

export function loadLibraryFoldersState(): LibraryFoldersState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<LibraryFoldersState>
    return { folders: parsed.folders ?? {} }
  } catch {
    return emptyState()
  }
}

export function saveLibraryFoldersState(state: LibraryFoldersState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // best-effort — never let a save failure (e.g. quota) crash the page
  }
}
