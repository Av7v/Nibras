import { useSyncExternalStore } from 'react'
import {
  getPageBackgroundSnapshot,
  setPageBackground,
  subscribePageBackground,
} from '../lib/pageBackgroundPreference'

/** Task #350 — the ONE global, persisted, LIVE-reactive page-canvas
 * background colour. Both places that can change it (the header's
 * BackgroundSettingsControl, mounted once in AppShellHeader.tsx and
 * again in Landing.tsx's own separate header) and the one place that
 * actually paints it (the App-root effect in App.tsx) all read through
 * this hook, so a change from EITHER control is instantly reflected
 * everywhere else in the same session — see
 * lib/pageBackgroundPreference.ts's own header comment for the full
 * "why" (same useSyncExternalStore shape as hooks/useVoicePreference.ts). */
export function usePageBackgroundPreference() {
  const value = useSyncExternalStore(subscribePageBackground, getPageBackgroundSnapshot)
  return { value, setValue: setPageBackground }
}
