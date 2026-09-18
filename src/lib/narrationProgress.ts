/**
 * Task #361 (2026-09-13) — a tiny shared store for the LIVE progress of
 * the current read-aloud, so the word-by-word reading ruler
 * (components/reader/WordHighlightRuler.tsx) can highlight exactly the
 * word the Reading Buddy voice is speaking.
 *
 * Why a shared store (same `useSyncExternalStore` pattern as
 * lib/voicePreference.ts, deliberately — the house style for
 * "one live value several components must react to"): the voice is
 * driven by ONE player (ReadingBuddyPlayer, above the reading text),
 * and the highlight is rendered by a DIFFERENT component (the ruler,
 * inside the reading text). Rather than a second, competing play button
 * on the ruler (which would fight ReadingBuddyPlayer for the single
 * speechSynthesis/audio channel), the player PUBLISHES its real playback
 * progress here and the ruler SUBSCRIBES — so "press play on Reading
 * Buddy → the words highlight along" is one honest transport, exactly
 * what Amal asked for («تظليل الكلام متزامن مع سرعة الصوت»).
 *
 * Ephemeral by design — this is transient playback state, NOT a saved
 * preference, so (unlike voicePreference) it is never persisted to
 * localStorage and starts idle on every load.
 *
 * The two voice paths report DIFFERENT real signals, and this store
 * keeps them distinct rather than pretending they're the same precision:
 *  - 'browser' (Web Speech): `charIndex` — the engine's own native
 *    per-word boundary offset (see lib/textToSpeech.ts's onBoundary).
 *    This is TRUE word-level timing.
 *  - 'neural'  (xAI /voice, an <audio> element): `fraction` —
 *    playback position ÷ the audio's real duration. The provider does
 *    NOT expose per-word timestamps (server/api/_xaiTts.ts returns MP3
 *    bytes only), so this is an honest APPROXIMATE pace derived from the
 *    real audio, never faked per-word timing. The ruler labels it as
 *    approximate when this source is active.
 */

export type NarrationSource = 'browser' | 'neural'
export type NarrationStatus = 'idle' | 'playing' | 'paused'

export interface NarrationProgress {
  status: NarrationStatus
  /** Which voice path is driving playback, or null when idle. Tells the
   * ruler whether it has TRUE per-word timing ('browser') or an honest
   * approximate pace ('neural'). */
  source: NarrationSource | null
  /** 'browser' path only: start char offset of the word currently being
   * spoken, in the same text the ruler renders. null until the first
   * boundary event (or on an engine that reports none). */
  charIndex: number | null
  /** 'neural' path only: playback position as a fraction [0,1] of the
   * audio's real duration. null until the audio's duration is known. */
  fraction: number | null
}

const IDLE: NarrationProgress = { status: 'idle', source: null, charIndex: null, fraction: null }

// Module-level single instance (there is only ever one Reading Buddy
// player mounted at a time). Reassigned, never mutated in place, so
// useSyncExternalStore's reference check distinguishes changed vs not.
let snapshot: NarrationProgress = IDLE
const listeners = new Set<() => void>()

function set(next: NarrationProgress) {
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribeNarration(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function getNarrationSnapshot(): NarrationProgress {
  return snapshot
}

/** Playback just began (or restarted, e.g. on a rate/voice change that
 * re-speaks) — clears any stale position from a previous run. */
export function startNarration(source: NarrationSource) {
  set({ status: 'playing', source, charIndex: null, fraction: null })
}

/** 'browser' path: the engine reached a new word at `charIndex`. */
export function reportNarrationBoundary(charIndex: number) {
  // #398 review P2 (2026-09-14) — was `=== 'idle'`, which let a LATE
  // event through while `status` was 'paused': the neural <audio>
  // element (and, less predictably, a speech engine) can still fire one
  // more boundary/timeupdate tick right at/after pauseNarration() has
  // already recorded 'paused', which silently flipped the shared store
  // back to 'playing' even though playback is genuinely paused — a
  // real state-desync bug (this store's whole contract is "status
  // accurately reflects live playback"), even though it happened to be
  // invisible today since the only consumer, WordHighlightRuler, only
  // branches on idle-vs-not, not paused-vs-playing. `!== 'playing'`
  // drops a late/stray event whenever we're not ACTIVELY playing —
  // idle OR paused — instead of just idle.
  if (snapshot.status !== 'playing') return
  set({ status: 'playing', source: 'browser', charIndex, fraction: null })
}

/** 'neural' path: the <audio> element advanced to `fraction` of its
 * real duration (clamped to [0,1]). */
export function reportNarrationFraction(fraction: number) {
  // See reportNarrationBoundary's comment just above — same fix.
  if (snapshot.status !== 'playing') return
  const clamped = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
  set({ status: 'playing', source: 'neural', charIndex: null, fraction: clamped })
}

/** Paused in place — keeps the last position so the highlight freezes
 * on the current word rather than resetting. */
export function pauseNarration() {
  if (snapshot.status !== 'playing') return
  set({ ...snapshot, status: 'paused' })
}

export function resumeNarration() {
  if (snapshot.status !== 'paused') return
  set({ ...snapshot, status: 'playing' })
}

/** Playback ended, was cancelled, errored, or the text/player went
 * away — clear everything so no stale word stays highlighted. */
export function stopNarration() {
  if (snapshot.status === 'idle' && snapshot.source === null) return
  set(IDLE)
}
