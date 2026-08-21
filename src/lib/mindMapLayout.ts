import type { MindMapTreeNode } from '../content/demoMindMaps'

/**
 * A small, hand-built tree-layout algorithm — deliberately not a
 * graph-visualization library dependency, since the trees here are
 * shallow (depth ≤ 3, a handful of branches) and a from-scratch layout
 * keeps the bundle lean and the behavior fully understood/debuggable.
 *
 * RTL handling: SVG has no concept of logical start/end, so unlike the
 * rest of this app (which gets RTL mirroring for free from CSS logical
 * properties), this needs EXPLICIT mirrored math — computed directly
 * here, not via a CSS transform on the rendered SVG (a transform-based
 * flip would also mirror every text label backwards, needing a second
 * counter-transform per label; explicit coordinate math avoids that
 * whole class of bug).
 */

export interface PositionedNode {
  id: string
  label: string
  x: number
  y: number
  depth: number
  /** Has real children in the underlying tree, whether or not they're
   * currently being shown (see `collapsed`). A leaf never has this. */
  hasChildren: boolean
  /** True when this node has children AND they're currently hidden
   * (its id is in the caller's `collapsedIds`) — MindMapView renders
   * an expand/collapse toggle only for nodes where `hasChildren` is
   * true, using this to decide which direction it points. */
  collapsed: boolean
}

export interface PositionedEdge {
  fromId: string
  toId: string
}

export interface MindMapLayout {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  width: number
  height: number
}

// Node box dimensions — the single source of truth for both this
// layout math AND MindMapView.tsx's own rendering (which imports these
// rather than keeping a separate local copy). Found the hard way
// (nibras-qa interim review, 2026-08-13): the two files USED to each
// hardcode their own numbers with nothing tying them together, and the
// margin below was sized only against ROW_SPACING/vertical clearance,
// never actually checked against NODE_W — so the horizontally-outermost
// node's rect quietly clipped past the SVG canvas edge (confirmed via
// direct rect-attribute measurement: the root node's box sat at
// x=-8..148 in a 0..890 canvas). Keeping the dimensions here and
// deriving the margin FROM them, rather than two independently-tuned
// magic numbers, makes that specific bug class structurally impossible
// to reintroduce.
export const NODE_W = 156
export const NODE_H = 60

const DEPTH_SPACING = 200
const ROW_SPACING = 84
// Vertical margin — unchanged from before this fix (NODE_H/2=30 always
// fit comfortably inside the old flat 70px margin, so there was never
// a vertical clipping issue to fix, only a horizontal one).
const MARGIN_Y = 70
// Horizontal margin — must clear the outermost node's own half-width
// (NODE_W/2) plus real breathing room, on BOTH sides symmetrically
// (unlike the old formula, which reserved 70px on the near side but a
// different, larger ~220px on the far side — an asymmetry that's what
// let the near side clip in the first place while the far side stayed
// fine, which is exactly why this bug hit the ROOT node, not a "deep
// column" one — verified empirically, not assumed, before fixing).
const CLIP_PADDING = 12
const MARGIN_X = NODE_W / 2 + CLIP_PADDING

/**
 * `collapsedIds` — node ids whose children should be excluded from
 * this layout pass entirely (not just visually hidden): a collapsed
 * node is measured/row-assigned as if it were a leaf, so the tree
 * stays compact instead of budgeting space for content that isn't
 * shown. Added 2026-08-13 (Amal, after seeing the 4-level example:
 * "ابغى العائلات الثلاثة داخل الخريطة" — wants to see all 3 families
 * together at once, not scroll past one to find the next) so the
 * default view can show just the root + 3 families without needing
 * the ~50-node full tree's height.
 */
export function layoutMindMap(root: MindMapTreeNode, rtl: boolean, collapsedIds: ReadonlySet<string> = new Set()): MindMapLayout {
  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []
  let leafCounter = 0

  // Depth-first: leaves (real leaves, OR a collapsed node treated as
  // one) get the next slot in reading order, an internal node's row is
  // the average of its VISIBLE children's rows — a simple,
  // non-overlapping vertical layout for shallow trees.
  function visit(node: MindMapTreeNode, depth: number): number {
    let row: number
    const hasChildren = Boolean(node.children && node.children.length > 0)
    const collapsed = hasChildren && collapsedIds.has(node.id)
    const visibleChildren = collapsed ? [] : (node.children ?? [])
    if (visibleChildren.length === 0) {
      row = leafCounter
      leafCounter += 1
    } else {
      const childRows = visibleChildren.map((child) => {
        edges.push({ fromId: node.id, toId: child.id })
        return visit(child, depth + 1)
      })
      row = childRows.reduce((a, b) => a + b, 0) / childRows.length
    }
    nodes.push({
      id: node.id,
      label: node.label,
      x: MARGIN_X + depth * DEPTH_SPACING,
      y: MARGIN_Y + row * ROW_SPACING,
      depth,
      hasChildren,
      collapsed,
    })
    return row
  }

  visit(root, 0)

  const maxDepth = Math.max(...nodes.map((n) => n.depth))
  // Symmetric: MARGIN_X already clears the near node's own half-width
  // (see its own comment above), so doubling it gives the SAME
  // clearance on the far side too — the deepest column's center sits at
  // MARGIN_X + maxDepth*DEPTH_SPACING, and its right edge lands exactly
  // MARGIN_X - NODE_W/2 (= CLIP_PADDING) short of this width, mirroring
  // the near side precisely. RTL's mirror (width - n.x, below) inherits
  // the same symmetric clearance for free — no separate RTL-specific
  // margin math needed, unlike DEPTH_SPACING's mirroring elsewhere in
  // this app.
  const width = MARGIN_X * 2 + maxDepth * DEPTH_SPACING
  const height = MARGIN_Y * 2 + Math.max(0, leafCounter - 1) * ROW_SPACING

  const finalNodes = rtl ? nodes.map((n) => ({ ...n, x: width - n.x })) : nodes

  return { nodes: finalNodes, edges, width, height }
}

/**
 * Maps every node id to which of the root's DIRECT children ("branch")
 * it descends from — 0 for the root's first child's whole subtree, 1
 * for the second, and so on; the root itself gets no entry (it isn't
 * part of any branch, it's what the branches come FROM). A purely
 * presentational grouping, computed independently of the geometry
 * above — used only by MindMapView's `colorByBranch` styling (task
 * #204, 2026-08-18, the AI generator's own "look," scoped there per
 * team-lead: existing maps like the Reading Techniques example keep
 * their established single-accent styling, unchanged).
 */
export function assignBranchIndices(root: MindMapTreeNode): Map<string, number> {
  const result = new Map<string, number>()
  function markSubtree(node: MindMapTreeNode, branchIndex: number) {
    result.set(node.id, branchIndex)
    for (const child of node.children ?? []) markSubtree(child, branchIndex)
  }
  ;(root.children ?? []).forEach((branch, i) => markSubtree(branch, i))
  return result
}
