import type { MindMapTreeNode } from '../content/demoMindMaps'

/**
 * On-device structural edits to a mind map — renaming an existing
 * node's text, or adding a brand-new node/branch. Separate from
 * mindMapNotes.ts (notes are commentary ABOUT a node; this changes the
 * node/tree itself) even though both use the same lib+hook localStorage
 * split as readingSettings.ts/documents.ts.
 */

export interface MindMapEdits {
  /** nodeId -> the user's replacement text for an EXISTING node. */
  labelOverrides: Record<string, string>
  /** Nodes the user added, each attached under an existing (or
   * another added) node via parentId. */
  addedNodes: { id: string; parentId: string; label: string }[]
}

export type AllMindMapEdits = Record<string, MindMapEdits>

const STORAGE_KEY = 'nibras-mindmap-edits'

function emptyEdits(): MindMapEdits {
  return { labelOverrides: {}, addedNodes: [] }
}

export function loadMindMapEdits(): AllMindMapEdits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as AllMindMapEdits
    return {}
  } catch {
    return {}
  }
}

/** Best-effort save — never throws (quota errors / private browsing). */
export function saveMindMapEdits(edits: AllMindMapEdits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits))
  } catch {
    // ignore
  }
}

/** Merges persisted edits onto a base tree, returning a NEW tree — the
 * demo content in content/demoMindMaps.ts is never mutated. Applied
 * once per render in MindMapView, so both the on-screen diagram and
 * the PNG export (which serializes whatever's currently on screen)
 * automatically reflect the user's edits with no separate export-time
 * handling needed. */
export function applyMindMapEdits(root: MindMapTreeNode, edits: MindMapEdits | undefined): MindMapTreeNode {
  const e = edits ?? emptyEdits()

  function rebuild(node: MindMapTreeNode): MindMapTreeNode {
    const label = e.labelOverrides[node.id] ?? node.label
    const ownChildren = (node.children ?? []).map(rebuild)
    const newChildren = e.addedNodes
      .filter((added) => added.parentId === node.id)
      .map((added): MindMapTreeNode => ({ id: added.id, label: e.labelOverrides[added.id] ?? added.label }))
    const children = [...ownChildren, ...newChildren]
    return children.length > 0 ? { id: node.id, label, children } : { id: node.id, label }
  }

  return rebuild(root)
}
