/**
 * On-device colour overrides for individual mind-map nodes/"ideas"
 * (task #211, 2026-08-19 — Amal's "colour the boxes" request, actioning
 * the node-colour part of #126). Same lib/+hook split and localStorage
 * persistence pattern as mindMapNotes.ts, and for the same reason: a
 * colour choice is a per-node PRESENTATION attribute, not a structural
 * content edit, so it stays a separate keyed lookup rather than being
 * merged into the tree the way mindMapEdits.ts's label/branch edits are
 * (applyMindMapEdits rebuilds the tree itself; this never needs to).
 * Keyed by mapId -> nodeId -> hex, so colours for different maps never
 * collide (mirrors notes' own mapId scoping).
 */

import { isValidHex } from './color'

export type MindMapColors = Record<string, Record<string, string>>

const STORAGE_KEY = 'nibras-mindmap-colors'

export function loadMindMapColors(): MindMapColors {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    // tech-final review (2026-08-19): useMindMapColors' own setColor
    // already normalizes/rejects a bad hex before it's ever WRITTEN
    // here, but this file reads raw localStorage independently of that
    // hook — the same "don't trust what comes back out of storage"
    // guard readingSettings.ts already applies to its own persisted
    // text-colour fields (a hand-edited value in devtools, a future
    // format change, or a value written by some other code path could
    // all still land here as something that isn't real hex). Unlike
    // readingSettings.ts's fixed fields (which have one obvious default
    // to fall back to per field), an arbitrary node id has no sensible
    // default colour of its own — so an invalid entry is DROPPED
    // entirely rather than replaced, which is exactly equivalent to
    // "no override for this node," the same safe state a reader who
    // never coloured it would already be in.
    const result: MindMapColors = {}
    for (const [mapId, forMap] of Object.entries(parsed as Record<string, unknown>)) {
      if (!forMap || typeof forMap !== 'object') continue
      const cleaned: Record<string, string> = {}
      for (const [nodeId, hex] of Object.entries(forMap as Record<string, unknown>)) {
        if (typeof hex === 'string' && isValidHex(hex)) cleaned[nodeId] = hex
      }
      if (Object.keys(cleaned).length > 0) result[mapId] = cleaned
    }
    return result
  } catch {
    return {}
  }
}

/** Best-effort save — never throws (quota errors / private browsing). */
export function saveMindMapColors(colors: MindMapColors) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch {
    // ignore
  }
}
