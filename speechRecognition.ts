/**
 * On-device speech-to-text for Reading Buddy's "listens to you" coach
 * (task #150, 2026-08-14). Mirrors `lib/textToSpeech.ts`'s own shape
 * (thin, client-only wrappers around native browser APIs, honest
 * disclosed limitations) — but unlike that file, English and Arabic
 * here are NOT the same mechanism with a language parameter. They are
 * two genuinely different engines, kept honestly separate rather than
 * forced into one fake-unified "streaming" shape (team-lead's own
 * approved #150 build plan):
 *
 * - English: this file, the browser's native on-device
 *   `SpeechRecognition` (Web Speech API) — event-driven, genuinely
 *   live/incremental (`interimResults`), zero extra download once the
 *   on-device language pack itself is installed.
 * - Arabic: `lib/whisperRecognition.ts` (separate file) — a
 *   self-hosted Whisper model run in a Web Worker, promise-based/
 *   batch (one sentence/pause-segment at a time), NOT incremental —
 *   see that file's own header for why forcing it into a fake-live
 *   shape would cost real accuracy for no real benefit.
 *
 * PRIVACY: entirely on-device. `processLocally: true` is passed
 * explicitly on every availability/install/recognition call — this is
 * not merely the default, it is the actual guarantee this feature
 * promises (no audio ever leaves the device, matching #150's own
 * non-negotiable). If on-device English is ever `'unavailable'` here,
 * the caller must degrade to a mic-free experience — NEVER silently
 * fall back to a cloud recognizer, which `processLocally: false` would
 * allow the browser to do.
 *
 * GATED on `ctor.available` existing (2026-08-14, nibras-web-reviewer):
 * `processLocally: true` is best-effort per MDN — a browser without the
 * `.available()` static has no way to PROVE it honored it, so
 * `startEnglishListening` refuses outright (returns `null`) rather than
 * start a session on an unproven browser. `ReadingBuddy.tsx` mirrors
 * this at the UI layer via `supportsOnDeviceAvailabilityCheck()`, so an
 * unsupported browser sees the mic-free experience up front, never a
 * mic button that silently risks sending audio off-device.
 *
 * BROWSER SUPPORT: `SpeechRecognition.available()`/`.install()` are
 * real, MDN-documented, but currently EXPERIMENTAL (Chrome-only as of
 * this writing) — confirmed genuinely working on this project's own
 * dev machine via a direct Playwright test (see
 * `src/types/speech-recognition-availability.d.ts`'s own header for
 * the exact confirmed result), but there is an open Chromium bug
 * (issues.chromium.org/issues/444393111) reporting this can behave
 * unreliably on some macOS configurations — so every call here is
 * wrapped defensively; a caller must treat "isNativeEnglishSupported()
 * is false" or "checkAvailability() resolves 'unavailable'" as a
 * completely normal, expected outcome, not an error.
 */

const ENGLISH_LANG = 'en-US'

function getConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

/** Coarse feature-detect only — does NOT mean on-device English is
 * actually available yet (the language pack may still need
 * installing, or `available()`/`processLocally` may not be supported
 * at all even though the base constructor exists). Use
 * `checkEnglishAvailability()` for the real answer. */
export function isNativeRecognitionConstructorPresent(): boolean {
  return getConstructor() !== undefined
}

/** True only if this exact browser build supports the on-device
 * availability check itself (`SpeechRecognition.available` as a
 * function) — a real, separate signal from "the constructor exists,"
 * since a browser can have `SpeechRecognition` without this newer,
 * still-experimental static method. */
export function supportsOnDeviceAvailabilityCheck(): boolean {
  const ctor = getConstructor()
  return typeof ctor?.available === 'function'
}

/** Real, live check — never cached/assumed. Resolves 'unavailable' on
 * ANY failure (missing API, a thrown error, an unsupported browser)
 * so every caller has exactly one "can't do this" branch to handle,
 * rather than needing to separately catch exceptions AND check a
 * status string. */
export async function checkEnglishAvailability(): Promise<SpeechRecognitionAvailabilityStatus> {
  const ctor = getConstructor()
  if (!ctor || typeof ctor.available !== 'function') return 'unavailable'
  try {
    return await ctor.available({ langs: [ENGLISH_LANG], processLocally: true })
  } catch {
    return 'unavailable'
  }
}

/** Triggers the real, one-time on-device English language-pack
 * download (only meaningful when `checkEnglishAvailability()` returned
 * `'downloadable'`). Returns false on any failure — never throws, so a
 * caller can treat this as "did it work?" without a try/catch. */
export async function installEnglishRecognition(): Promise<boolean> {
  const ctor = getConstructor()
  if (!ctor || typeof ctor.install !== 'function') return false
  try {
    return await ctor.install({ langs: [ENGLISH_LANG], processLocally: true })
  } catch {
    return false
  }
}

export interface EnglishRecognitionResult {
  text: string
  /** True once this exact utterance is settled (won't change on a
   * later event) — false for a live, still-updating interim result. */
  isFinal: boolean
}

export interface EnglishRecognitionHandle {
  stop: () => void
}

/**
 * Starts real, on-device, LIVE English recognition — `continuous` (a
 * whole passage, not one phrase) + `interimResults` (word-by-word
 * feedback while still speaking, matching the reference page's own
 * "current word is highlighted" promise). Returns a handle whose
 * `stop()` ends the session; also self-stops on a terminal browser
 * error so a caller never has to guess whether it's still running.
 *
 * ASYNC (not the earlier sync version) — self-caught, 2026-08-14, via
 * a real fake-mic Playwright test through the ACTUAL /reading-buddy
 * page (not just this lib directly): a fresh browser/device that has
 * never used on-device English before throws `'language-not-supported'`
 * from a bare `.start()` — the on-device language pack genuinely needs
 * `install()`ing first. The earlier lib-level availability-lifecycle
 * test had already called `install()` as part of its OWN setup, which
 * masked this gap until a real end-to-end page-level run caught it.
 * `opts.onInstalling` fires only in that one-time case so a caller can
 * show an honest "setting up on-device English (one time)" state
 * instead of a confusing generic mic error.
 *
 * `processLocally: true` here too (the recognition SESSION itself,
 * not just the availability check) — belt-and-suspenders: even if a
 * future browser build changed its own default, this call can never
 * silently start a cloud-backed session.
 */
export async function startEnglishListening(opts: {
  onResult: (result: EnglishRecognitionResult) => void
  onError?: (errorCode: string) => void
  onEnd?: () => void
  onInstalling?: () => void
}): Promise<EnglishRecognitionHandle | null> {
  const ctor = getConstructor()
  if (!ctor) return null

  // PRIVACY GATE (nibras-web-reviewer, 2026-08-14): `ctor.available` is
  // the ONLY signal this file has for "the browser can prove this
  // session stays on-device." Without it, `processLocally: true` below
  // is best-effort only (per MDN, a browser MAY silently ignore it) —
  // so a browser that HAS `webkitSpeechRecognition` but NOT the newer
  // `.available()` static (older Chromium, Safari, WKWebView) could
  // silently start a CLOUD-backed session the instant `.start()` is
  // called, directly contradicting privacyPolicy.ts's "entirely on
  // your device… never falls back to sending your voice to an outside
  // service" promise. Refuse outright rather than gamble on an
  // unproven browser — the caller (ReadingBuddy.tsx) already gates the
  // mic UI itself on `supportsOnDeviceAvailabilityCheck()` so this
  // should be unreachable via the app's own UI; this is the last-line
  // defense for any OTHER caller (present or future) that skips that
  // gate.
  if (typeof ctor.available !== 'function') return null

  let availability: SpeechRecognitionAvailabilityStatus
  try {
    availability = await ctor.available({ langs: [ENGLISH_LANG], processLocally: true })
  } catch {
    availability = 'unavailable'
  }
  if (availability === 'unavailable') return null
  if (availability !== 'available') {
    opts.onInstalling?.()
    if (typeof ctor.install !== 'function') return null
    try {
      const installed = await ctor.install({ langs: [ENGLISH_LANG], processLocally: true })
      if (!installed) return null
    } catch {
      return null
    }
  }

  const recognition = new ctor()
  recognition.lang = ENGLISH_LANG
  recognition.continuous = true
  recognition.interimResults = true
  // Not part of the ambient type above (optional, non-universal) —
  // set defensively via a loose cast rather than widening the shared
  // type for one non-essential property every other caller would then
  // also see.
  ;(recognition as unknown as { processLocally?: boolean }).processLocally = true

  let stoppedByCaller = false

  // Tight-loop guard (nibras-web-reviewer, 2026-08-14): if the browser
  // ends a session almost immediately after each `.start()` — a real,
  // observed possibility on some builds per the Chromium bug cited in
  // this file's own header — the auto-restart below would otherwise
  // call `.start()` in an unbounded, synchronous-ish loop. A session
  // that runs for a normal amount of time (even a few seconds) resets
  // the counter, so this never fires during genuine use; only 3
  // consecutive sub-300ms sessions in a row trip it.
  const MIN_SESSION_MS = 300
  const MAX_CONSECUTIVE_FAST_ENDS = 3
  let lastStartTime = Date.now()
  let consecutiveFastEnds = 0

  recognition.onresult = (event) => {
    const latest = event.results[event.results.length - 1]
    if (!latest || latest.length === 0) return
    opts.onResult({ text: latest[0].transcript, isFinal: latest.isFinal })
  }
  recognition.onerror = (event) => {
    opts.onError?.(event.error)
  }
  recognition.onend = () => {
    // The browser can end a 'continuous' session on its own (e.g. a
    // long silence) — restart automatically unless the CALLER asked
    // to stop, so "continuous" genuinely means continuous from the
    // reader's point of view, not "until the browser feels like
    // stopping."
    if (!stoppedByCaller) {
      const ranFor = Date.now() - lastStartTime
      if (ranFor < MIN_SESSION_MS) {
        consecutiveFastEnds++
        if (consecutiveFastEnds >= MAX_CONSECUTIVE_FAST_ENDS) {
          opts.onError?.('restart-loop-detected')
          opts.onEnd?.()
          return
        }
      } else {
        consecutiveFastEnds = 0
      }
      try {
        lastStartTime = Date.now()
        recognition.start()
      } catch {
        opts.onEnd?.()
      }
      return
    }
    opts.onEnd?.()
  }

  try {
    lastStartTime = Date.now()
    recognition.start()
  } catch {
    return null
  }

  return {
    stop: () => {
      stoppedByCaller = true
      recognition.stop()
    },
  }
}
