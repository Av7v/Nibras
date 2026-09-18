import type { MindMapTreeNode } from '../content/demoMindMaps'

/**
 * On-device structural edits to a mind map — renaming an existing
 * node's text, adding a brand-new node/branch, or deleting a node
 * (#441, Amal's exact ask: «مسح المستطيلات والاسم»). Separate from
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
  /** Ids the user deleted — an overlay MARKER, same idea as the two
   * fields above: the base tree in demoMindMaps.ts is never mutated,
   * applyMindMapEdits below just excludes these ids (and everything
   * nested under them) while it rebuilds the effective tree fresh every
   * render. One flat list works for BOTH a pre-authored node's id and
   * an id from addedNodes above — deleteNode (useMindMapEdits.ts)
   * doesn't need to know, or care, which kind of node it's given. */
  removedNodeIds: string[]
}

export type AllMindMapEdits = Record<string, MindMapEdits>

const STORAGE_KEY = 'nibras-mindmap-edits'

function emptyEdits(): MindMapEdits {
  return { labelOverrides: {}, addedNodes: [], removedNodeIds: [] }
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
 * handling needed.
 *
 * Deletion (#441) filters BEFORE recursing, in both helpers below, not
 * after — so a removed node's whole subtree is simply never visited,
 * which is what makes "delete a node" also drop its descendants with
 * no separate cascade step. `root` itself is passed straight into
 * `rebuild()` below, never through an array this function filters —
 * there is no code path here that could ever drop the root, even if
 * its id somehow ended up in `removedNodeIds`; the actual guard (the
 * root's Delete button stays disabled) lives in MindMapView, this is
 * just a structural backstop underneath it. */
export function applyMindMapEdits(root: MindMapTreeNode, edits: MindMapEdits | undefined): MindMapTreeNode {
  const e = edits ?? emptyEdits()
  const removed = new Set(e.removedNodeIds ?? [])

  // Builds one node that came from `addedNodes` (never part of the base
  // tree). Unlike the old version of this function, this is recursive:
  // addNode's own doc comment already promises an added node can itself
  // parent a FURTHER added node, so this has to look for its own
  // children the same way `rebuild` does for a base-tree node, not just
  // return a flat leaf. Returns null for a removed node so the two
  // `.filter()` calls below drop it (and, since a null result is never
  // recursed into, its own added descendants too).
  function buildAdded(added: { id: string; label: string }): MindMapTreeNode | null {
    if (removed.has(added.id)) return null
    const label = e.labelOverrides[added.id] ?? added.label
    const children = e.addedNodes
      .filter((child) => child.parentId === added.id)
      .map(buildAdded)
      .filter((child): child is MindMapTreeNode => child !== null)
    return children.length > 0 ? { id: added.id, label, children } : { id: added.id, label }
  }

  function rebuild(node: MindMapTreeNode): MindMapTreeNode {
    const label = e.labelOverrides[node.id] ?? node.label
    const ownChildren = (node.children ?? []).filter((child) => !removed.has(child.id)).map(rebuild)
    const newChildren = e.addedNodes
      .filter((added) => added.parentId === node.id)
      .map(buildAdded)
      .filter((child): child is MindMapTreeNode => child !== null)
    const children = [...ownChildren, ...newChildren]
    return children.length > 0 ? { id: node.id, label, children } : { id: node.id, label }
  }

  return rebuild(root)
}
