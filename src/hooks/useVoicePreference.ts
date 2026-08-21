import { useSyncExternalStore } from 'react'
import {
  getVoicePreferenceSnapshot,
  setVoiceGender,
  setVoiceRate,
  subscribeVoicePreference,
} from '../lib/voicePreference'

/** Task #145 (2026-08-14) — the ONE global, persisted, LIVE-reactive
 * voice preference (gender + rate). Every read-aloud surface
 * (Reading Buddy, سُكون, Letter Sounds, Mind Maps, Techniques) calls
 * this instead of owning local gender state or reading the old
 * per-instance useReadingSettings().voiceRate — see
 * lib/voicePreference.ts's own header comment for the full "why."
 * Changing gender/rate through this hook on ANY mounted surface is
 * instantly reflected on every OTHER mounted surface in the same
 * session (useSyncExternalStore's whole point), not just after a
 * remount/reload. */
export function useVoicePreference() {
  const { gender, rate } = useSyncExternalStore(subscribeVoicePreference, getVoicePreferenceSnapshot)
  return { gender, rate, setGender: setVoiceGender, setRate: setVoiceRate }
}
