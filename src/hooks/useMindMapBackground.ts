import { useEffect, useState } from 'react'
import { loadMindMapBackgrounds, saveMindMapBackgrounds } from '../lib/mindMapBackground'
import { normalizeHex } from '../lib/color'

/** Per-map canvas background colour (`mapId`), persisted to localStorage
 * on every change — same shape as useMindMapColors/useMindMapNotes.
 * `setBackground(null)` (or an invalid hex) clears the override, so the
 * canvas reverts to its default look — mirrors useMindMapColors'
 * null-clears-the-entry convention.
 *
 * Every background write goes through this single funnel before it lands
 * in an inline style AND localStorage, so it's the right place to
 * validate/normalize (task #364): ColorWheelField's hex-text path already
 * only calls onChange with a normalizeHex-passed value, and its
 * wheel-drag path always emits a well-formed hslToHex(), so in practice
 * this never rejects a real UI interaction — it's defence-in-depth for
 * any other caller, the same "validate before it lands" shape
 * mindMapColors.ts uses. An invalid hex is treated exactly like `null`. */
export function useMindMapBackground(mapId: string) {
  const [all, setAll] = useState(() => loadMindMapBackgrounds())

  useEffect(() => {
    saveMindMapBackgrounds(all)
  }, [all])

  const background = all[mapId] ?? null

  function setBackground(hex: string | null) {
    const normalized = hex ? normalizeHex(hex) : null
    setAll((prev) => {
      const next = { ...prev }
      if (!normalized) {
        delete next[mapId]
      } else {
        next[mapId] = normalized
      }
      return next
    })
  }

  return { background, setBackground }
}
