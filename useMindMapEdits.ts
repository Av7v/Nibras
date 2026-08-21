import { useEffect, useState } from 'react'
import { loadMindMapEdits, saveMindMapEdits, type MindMapEdits } from '../lib/mindMapEdits'

function emptyEdits(): MindMapEdits {
  return { labelOverrides: {}, addedNodes: [] }
}

function newNodeId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Structural edits for one map (`mapId`), persisted to localStorage on
 * every change — same shape as useMindMapNotes. */
export function useMindMapEdits(mapId: string) {
  const [all, setAll] = useState(() => loadMindMapEdits())

  useEffect(() => {
    saveMindMapEdits(all)
  }, [all])

  const edits = all[mapId] ?? emptyEdits()

  function setLabel(nodeId: string, label: string) {
    setAll((prev) => {
      const forMap = prev[mapId] ?? emptyEdits()
      return { ...prev, [mapId]: { ...forMap, labelOverrides: { ...forMap.labelOverrides, [nodeId]: label } } }
    })
  }

  /** Adds a new child node under `parentId`, returns its new id so the
   * caller can immediately select it for editing. */
  function addNode(parentId: string, label: string): string {
    const id = newNodeId()
    setAll((prev) => {
      const forMap = prev[mapId] ?? emptyEdits()
      return { ...prev, [mapId]: { ...forMap, addedNodes: [...forMap.addedNodes, { id, parentId, label }] } }
    })
    return id
  }

  return { edits, setLabel, addNode }
}
