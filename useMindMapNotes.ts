import { useEffect, useState } from 'react'
import { loadMindMapNotes, saveMindMapNotes } from '../lib/mindMapNotes'

/** Notes for one map (`mapId`), persisted to localStorage on every
 * change. An empty/whitespace-only note deletes the entry rather than
 * storing an empty string, so the "has a note" badge in MindMapView
 * stays accurate. */
export function useMindMapNotes(mapId: string) {
  const [all, setAll] = useState(() => loadMindMapNotes())

  useEffect(() => {
    saveMindMapNotes(all)
  }, [all])

  const notes = all[mapId] ?? {}

  function setNote(nodeId: string, text: string) {
    setAll((prev) => {
      const forMap = { ...(prev[mapId] ?? {}) }
      if (text.trim() === '') {
        delete forMap[nodeId]
      } else {
        forMap[nodeId] = text
      }
      return { ...prev, [mapId]: forMap }
    })
  }

  return { notes, setNote }
}
