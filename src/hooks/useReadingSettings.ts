import { useEffect, useState } from 'react'
import {
  DEFAULT_ARABIC_SETTINGS,
  DEFAULT_LATIN_SETTINGS,
  loadReadingSettings,
  saveReadingSettings,
  type ArabicSettings,
  type LatinSettings,
  type RulerColor,
} from '../lib/readingSettings'

/** Single source of truth for both script profiles (typography),
 * persisted to localStorage on every change. Each instance owns its
 * OWN copy of the state, so two of these mounted SIMULTANEOUSLY (e.g.
 * سُكون open as a modal over the Reader, which stays mounted
 * underneath) won't live-sync a typography change made in one to the
 * other until the next mount/reload — an accepted, low-stakes
 * tradeoff for typography specifically (nobody asked for a font-size
 * change to apply mid-session across two open surfaces at once).
 *
 * Voice gender/rate (task #127, then #145) used to live here too —
 * MOVED to lib/voicePreference.ts + hooks/useVoicePreference.ts
 * (2026-08-14), which gives voice preference the genuine live
 * cross-instance reactivity Amal asked for ("changing it anywhere
 * changes it everywhere") via useSyncExternalStore, something this
 * hook's own per-instance pattern was never built for. The 2 fields
 * still live in the SAME persisted `nibras-reading-settings` object
 * (an existing user's saved voiceRate must survive untouched) — this
 * hook's own save effect below re-reads them FRESH immediately
 * before every write specifically so a typography-only change here
 * can never accidentally revert a voice-preference change some OTHER
 * concurrently-open surface just made via useVoicePreference — the
 * symmetric half of the same race-safety voicePreference.ts's own
 * persist() already documents. */
export function useReadingSettings() {
  const [state, setState] = useState(() => loadReadingSettings())

  useEffect(() => {
    // Re-read voiceRate/voiceGender fresh rather than trusting this
    // instance's own (possibly stale — see the hook's own header
    // comment) copy of those 2 fields.
    const current = loadReadingSettings()
    saveReadingSettings({ ...state, voiceRate: current.voiceRate, voiceGender: current.voiceGender })
  }, [state])

  function updateLatin(patch: Partial<LatinSettings>) {
    setState((s) => ({ ...s, latin: { ...s.latin, ...patch } }))
  }
  function updateArabic(patch: Partial<ArabicSettings>) {
    setState((s) => ({ ...s, arabic: { ...s.arabic, ...patch } }))
  }
  function resetLatin() {
    setState((s) => ({ ...s, latin: { ...DEFAULT_LATIN_SETTINGS } }))
  }
  function resetArabic() {
    setState((s) => ({ ...s, arabic: { ...DEFAULT_ARABIC_SETTINGS } }))
  }
  // Deliberately NOT touched by resetLatin/resetArabic — the ruler is a
  // script-independent mechanism preference, not part of either
  // typography profile, so resetting one script's fonts/spacing
  // shouldn't silently flip it.
  function setReadingRuler(readingRuler: boolean) {
    setState((s) => ({ ...s, readingRuler }))
  }
  function setReadingRulerColor(readingRulerColor: RulerColor) {
    setState((s) => ({ ...s, readingRulerColor }))
  }
  // voiceRate/voiceGender are deliberately NOT exposed here anymore
  // (task #145) — use hooks/useVoicePreference.ts instead, which is
  // live-reactive across every mounted surface; this hook's own state
  // still carries both fields internally (see the save-effect comment
  // above) purely so it can merge-not-clobber them on every save.

  return {
    latin: state.latin,
    arabic: state.arabic,
    readingRuler: state.readingRuler,
    readingRulerColor: state.readingRulerColor,
    updateLatin,
    updateArabic,
    resetLatin,
    resetArabic,
    setReadingRuler,
    setReadingRulerColor,
  }
}
