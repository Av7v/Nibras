import { useEffect, useState } from 'react'
import { loadMindMapEdits, saveMindMapEdits, type MindMapEdits } from '../lib/mindMapEdits'

function emptyEdits(): MindMapEdits {
  return { labelOverrides: {}, addedNodes: [], removedNodeIds: [] }
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

  /** Marks `nodeId` (and, once applyMindMapEdits rebuilds the tree, its
   * whole subtree) as removed — #441, Amal's exact ask: «مسح
   * المستطيلات والاسم». Works identically for a pre-authored node or
   * one from addedNodes above; this function doesn't need to tell them
   * apart. Does NOT decide whether `nodeId` is allowed to be deleted at
   * all (the caller, MindMapView, must never pass the root's id here
   * in the first place — its Delete button stays disabled for the
   * root) — this just records the marker. `?? []` guards a map whose
   * edits were persisted before this field existed. */
  function deleteNode(nodeId: string) {
    setAll((prev) => {
      const forMap = prev[mapId] ?? emptyEdits()
      const already = forMap.removedNodeIds ?? []
      if (already.includes(nodeId)) return prev
      return { ...prev, [mapId]: { ...forMap, removedNodeIds: [...already, nodeId] } }
    })
  }

  return { edits, setLabel, addNode, deleteNode }
}
