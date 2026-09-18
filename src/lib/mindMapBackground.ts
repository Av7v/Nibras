/**
 * On-device per-map BACKGROUND colour for the mind-map canvas (task
 * #364, 2026-09-13 — Amal, after previewing #350: a colour wheel for the
 * map background, independent of the global page colour and of node
 * colours). Same lib/+hook split and localStorage pattern as
 * mindMapColors.ts, and for the same reason: the canvas background is a
 * per-map PRESENTATION attribute, not structural content, so it stays a
 * separate keyed lookup rather than being merged into the tree.
 *
 * Keyed by mapId -> hex, so each map keeps its own background (mirrors
 * the node-colours store's own mapId scoping). Absence of a key = no
 * override = the canvas keeps its default look. Stored INDEPENDENTLY of
 * the reader's reading-panel background and of the global page
 * background (`pageBackground`), per Amal's Flag #2 (the reading panel is
 * the only surface with its own colour tied to the global page colour;
 * everything else here is its own choice).
 */

import { isValidHex } from './color'

/** mapId -> background hex. */
export type MindMapBackgrounds = Record<string, string>

const STORAGE_KEY = 'nibras-mindmap-bg'

export function loadMindMapBackgrounds(): MindMapBackgrounds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    // Same "don't trust what comes back out of storage" guard as
    // mindMapColors.ts: an entry that isn't a real hex (hand-edited
    // devtools value, a future format change) is DROPPED rather than
    // replaced, which is exactly the safe "no override for this map"
    // state a reader who never coloured it would be in.
    const result: MindMapBackgrounds = {}
    for (const [mapId, hex] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof hex === 'string' && isValidHex(hex)) result[mapId] = hex
    }
    return result
  } catch {
    return {}
  }
}

/** Best-effort save — never throws (quota errors / private browsing). */
export function saveMindMapBackgrounds(backgrounds: MindMapBackgrounds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backgrounds))
  } catch {
    // ignore
  }
}
