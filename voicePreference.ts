/**
 * Task #145 (2026-08-14, Amal): ONE global, persisted, LIVE-reactive
 * voice preference (gender + rate), shared by every read-aloud
 * surface in the app. Team-lead-approved architecture: React's own
 * `useSyncExternalStore` (see hooks/useVoicePreference.ts) — no new
 * dependency, and it's specifically built for exactly this shape of
 * problem (an external, mutable value multiple components must react
 * to synchronously).
 *
 * Why this exists, not just another field on useReadingSettings:
 * useReadingSettings.ts's own doc comment already documents that its
 * per-instance localStorage load is NOT live-cross-synced — two
 * mounted instances (e.g. سُكون open as a modal over the Reader) each
 * own their OWN copy, so a change in one isn't visible in the other
 * until a remount/reload. That was an accepted tradeoff for a
 * typography preference; #145 explicitly asks for "changing it
 * anywhere changes it everywhere," which needs a genuine shared,
 * subscribed store, not just a shared storage KEY.
 *
 * Persistence: still the exact SAME `nibras-reading-settings`
 * localStorage key useReadingSettings.ts already owns (musts-hold
 * from Skywalker's review — an existing user's saved `voiceRate` must
 * survive this migration untouched) — this module reads/writes
 * through readingSettings.ts's own load/save functions rather than
 * touching localStorage directly, so it always merges its 2 fields
 * onto the LATEST typography fields rather than risking a stale
 * overwrite of them (see persist() below). useReadingSettings.ts's
 * own save effect does the symmetric thing in the other direction —
 * re-reading these 2 fields fresh before ITS OWN writes — so neither
 * side can ever accidentally revert the other's most recent change.
 */
import {
  loadReadingSettings,
  saveReadingSettings,
  STORAGE_KEY,
  type ReadingSettingsState,
} from './readingSettings'
import type { VoiceGender } from './textToSpeech'

export interface VoicePreference {
  gender: VoiceGender
  rate: number
}

function readFromStorage(): VoicePreference {
  const s = loadReadingSettings()
  return { gender: s.voiceGender, rate: s.voiceRate }
}

// Module-level — genuinely one shared instance per tab, matching the
// "one global preference" brief. Reassigned (never mutated in place)
// on every real change, so useSyncExternalStore's reference-equality
// check correctly distinguishes "nothing changed" from "changed."
let snapshot: VoicePreference = readFromStorage()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function persist(next: VoicePreference) {
  // Read the FULL current state FRESH — not from any cached copy —
  // so a concurrently-open OTHER surface's own typography change (or
  // another browser tab's write) is never clobbered by this write;
  // only the 2 voice fields are ever touched here.
  const current = loadReadingSettings()
  const merged: ReadingSettingsState = { ...current, voiceGender: next.gender, voiceRate: next.rate }
  saveReadingSettings(merged)
  snapshot = next
  notify()
}

export function subscribeVoicePreference(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function getVoicePreferenceSnapshot(): VoicePreference {
  return snapshot
}

export function setVoiceGender(gender: VoiceGender) {
  if (gender === snapshot.gender) return
  persist({ ...snapshot, gender })
}

export function setVoiceRate(rate: number) {
  if (rate === snapshot.rate) return
  persist({ ...snapshot, rate })
}

// Cross-tab sync — a bonus this design gets essentially for free:
// another tab writing the same key (e.g. its own setVoiceRate call)
// fires a 'storage' event in THIS tab, so this tab's own subscribers
// update too, instead of silently drifting until a manual reload.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return
    const next = readFromStorage()
    if (next.gender === snapshot.gender && next.rate === snapshot.rate) return
    snapshot = next
    notify()
  })
}
