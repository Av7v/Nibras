/**
 * Task #350 (2026-09-08, Amal via team-lead): ONE global, persisted,
 * LIVE-reactive PAGE-CANVAS background colour, shared by every routed
 * page — not just the Reader's own reading surface. Same architecture
 * as lib/voicePreference.ts (task #145), reused verbatim because it's
 * the exact same shape of problem: React's own `useSyncExternalStore`
 * (see hooks/usePageBackgroundPreference.ts), since this value has TWO
 * independent mount points that must react to each other synchronously
 * — the header control in components/AppShellHeader.tsx (every route
 * under AppShell) and the second instance in pages/Landing.tsx's own
 * separate header (Landing lives outside AppShell entirely, see
 * AppShell.tsx's own header comment for why).
 *
 * Deliberately a DIFFERENT concept from `latin.tint`/`arabic.tint`
 * (lib/readingSettings.ts): those two colour only the Reader's own
 * `<article>` reading surface and are picked per-script; this colours
 * the page CANVAS behind every route (index.css's `--color-page-bg`
 * variable + `body` rule, applied by the effect in App.tsx) — one
 * shared value regardless of language/script, and left completely
 * independent of the Reader's own tint so its already-shipped,
 * already-tested tint+textColor contrast pairing is untouched.
 *
 * Reuses the SAME closed `Tint`/`TINTS` palette as the Reader's own
 * tint picker (5 pre-vetted, contrast-safe pastels) and the SAME
 * `TintField` control component — deliberately NOT a free hex/colour
 * wheel: unlike the text-colour wheel (ColorWheelField), there is no
 * live contrast safeguard for background, and most non-Reader pages
 * render page titles directly on the bare canvas with fixed text
 * colours that were only ever contrast-verified against the fixed
 * cream/card tokens (see index.css's own header comment) — so this
 * stays a closed, pre-vetted palette until/unless that safeguard is
 * built.
 *
 * Persistence: the SAME `nibras-reading-settings` localStorage key
 * readingSettings.ts already owns — reads/writes through its own
 * load/save functions, so a concurrent typography or voice-preference
 * write from another surface is merged onto, never clobbered (the
 * same "read fresh, merge, write" shape voicePreference.ts's own
 * persist() already documents).
 */
import {
  loadReadingSettings,
  saveReadingSettings,
  STORAGE_KEY,
  type ReadingSettingsState,
  type PageBackground,
} from './readingSettings'

function readFromStorage(): PageBackground {
  return loadReadingSettings().pageBackground
}

// Module-level — genuinely one shared instance per tab, same "one
// global preference" shape voicePreference.ts's own snapshot already
// is. Reassigned (never mutated in place) on every real change, so
// useSyncExternalStore's reference-equality check correctly
// distinguishes "nothing changed" from "changed."
let snapshot: PageBackground = readFromStorage()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function persist(next: PageBackground) {
  // Read the FULL current state FRESH — not from any cached copy — so
  // a concurrently-open OTHER surface's own typography/voice change
  // (or another browser tab's write) is never clobbered by this
  // write; only pageBackground is ever touched here.
  const current = loadReadingSettings()
  const merged: ReadingSettingsState = { ...current, pageBackground: next }
  saveReadingSettings(merged)
  snapshot = next
  notify()
}

export function subscribePageBackground(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function getPageBackgroundSnapshot(): PageBackground {
  return snapshot
}

export function setPageBackground(next: PageBackground) {
  if (next === snapshot) return
  persist(next)
}

// Cross-tab sync — the same free bonus voicePreference.ts's own
// identical pattern already gets: another tab writing the same key
// (e.g. its own setPageBackground call) fires a 'storage' event in
// THIS tab too, so this tab's own subscribers update instead of
// silently drifting until a manual reload.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return
    const next = readFromStorage()
    if (next === snapshot) return
    snapshot = next
    notify()
  })
}
