import { useEffect, useState } from 'react'
import { loadMindMapColors, saveMindMapColors } from '../lib/mindMapColors'
import { normalizeHex } from '../lib/color'

/** Colour overrides for one map (`mapId`), persisted to localStorage on
 * every change — same shape as useMindMapNotes. `setColor(id, null)`
 * (or an invalid hex) clears the override, reverting that node to its
 * automatic colour (branch colour if colorByBranch is on, the default
 * accent/cream otherwise) — mirrors useMindMapNotes' own
 * empty-string-deletes-the-entry convention.
 *
 * tech-final review (2026-08-19): this is the single funnel every
 * colour write goes through before it lands in an inline SVG `fill`
 * AND localStorage, so it's the right place to validate/normalize —
 * ColorWheelField's own hex-text-input path already only ever calls
 * onChange with a value that passed normalizeHex (SettingsFields.tsx's
 * commitHexDraft), and its wheel-drag path always emits a well-formed
 * hslToHex() result, so in practice this never rejects a real UI
 * interaction. It exists as defence-in-depth for any OTHER caller of
 * this hook (present or future) that doesn't go through the wheel —
 * same "validate before it lands, don't trust the caller" shape
 * readingSettings.ts already uses for its own persisted text-colour
 * fields (isValidHex there; normalizeHex here since it also has to
 * accept a bare-without-`#`/mixed-case draft the way the wheel's own
 * hex input does). An invalid hex is treated exactly like `null` —
 * silently ignored, never stored — matching what the doc comment
 * above already promised. */
export function useMindMapColors(mapId: string) {
  const [all, setAll] = useState(() => loadMindMapColors())

  useEffect(() => {
    saveMindMapColors(all)
  }, [all])

  const colors = all[mapId] ?? {}

  function setColor(nodeId: string, hex: string | null) {
    const normalized = hex ? normalizeHex(hex) : null
    setAll((prev) => {
      const forMap = { ...(prev[mapId] ?? {}) }
      if (!normalized) {
        delete forMap[nodeId]
      } else {
        forMap[nodeId] = normalized
      }
      return { ...prev, [mapId]: forMap }
    })
  }

  return { colors, setColor }
}
