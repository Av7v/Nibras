/**
 * On-device notes/annotations attached to individual mind-map nodes.
 * Same lib/+hook split and localStorage persistence pattern as
 * readingSettings.ts / documents.ts. Keyed by mapId (the example's id
 * today; a saved document's id once real generation exists) → nodeId →
 * note text, so notes for different maps never collide.
 */

export type MindMapNotes = Record<string, Record<string, string>>

const STORAGE_KEY = 'nibras-mindmap-notes'

export function loadMindMapNotes(): MindMapNotes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as MindMapNotes
    return {}
  } catch {
    return {}
  }
}

/** Best-effort save — never throws (quota errors / private browsing). */
export function saveMindMapNotes(notes: MindMapNotes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // ignore
  }
}
