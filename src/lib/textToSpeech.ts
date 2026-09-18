/**
 * Thin wrapper around the browser's Web Speech API (SpeechSynthesis) —
 * entirely client-side, no server, no accounts, nothing recorded or
 * uploaded. Originally built for the Techniques read-aloud (whole-card,
 * no highlighting); extended 2026-08-13 for the Reading Buddy player
 * (play/pause, speed, male/female voice) — this is the DEMO voice path
 * (aiService.synthesizeVoice's `mode: 'browser'` branch); a real neural
 * voice becomes available once an AI backend is configured, see
 * lib/aiService.ts. Reading Buddy's synced word-highlighting and
 * Arabic auto-diacritization are a later increment, not this one.
 *
 * Known, disclosed limitation (per the content doc, audit F16): Arabic
 * text here is undiacritized (adult default), and undiacritized Arabic
 * TTS pronunciation is imperfect on most engines.
 *
 * Known, disclosed limitation (gender selection): `SpeechSynthesisVoice`
 * has no official gender field. `classifyVoiceGender` below is a
 * best-effort heuristic over common voice names across macOS/Chrome/
 * Windows — reliable when a voice's own name says "female"/"male"
 * (several Chrome network voices do), a reasonable guess otherwise, and
 * gracefully falls back to "just offer a second, distinct voice" rather
 * than silently ignoring the choice when no voice can be confidently
 * classified. Never presented as more precise than it is.
 *
 * Known, disclosed limitation (mid-utterance rate change): Web Speech
 * has no API to change an already-playing utterance's rate — `rate` is
 * fixed on the SpeechSynthesisUtterance object before `speak()` starts
 * it. Changing speed while reading therefore restarts the utterance
 * from the beginning at the new rate (see ReadingBuddyPlayer), not a
 * silent no-op or a broken control.
 */

export type SpeechLang = 'en' | 'ar'
export type VoiceGender = 'male' | 'female'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function getVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return []
  return window.speechSynthesis.getVoices()
}

function findVoicesForLang(lang: SpeechLang): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang))
}

// Common voice-name fragments across macOS/Safari (AVSpeechSynthesis),
// Windows (SAPI), and Chrome's network voices (several of which
// literally include "Female"/"Male" in their own name — checked first,
// most reliable signal when present).
const FEMALE_NAME_HINTS = [
  'female',
  'samantha',
  'ava',
  'allison',
  'susan',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'zoe',
  'nicky',
  'zira',
  'hazel',
  'eva',
  'salma',
  'laila',
  'amira',
  'amal',
]
const MALE_NAME_HINTS = [
  'male',
  'alex',
  'daniel',
  'fred',
  'tom',
  'aaron',
  'nathan',
  'oliver',
  'arthur',
  'gordon',
  'david',
  'mark',
  'george',
  'ryan',
  'maged',
  'majed',
  'tarik',
  'hamed',
]

function classifyVoiceGender(voice: SpeechSynthesisVoice): VoiceGender | null {
  const name = voice.name.toLowerCase()
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) return 'female'
  if (MALE_NAME_HINTS.some((hint) => name.includes(hint))) return 'male'
  return null
}

function findVoice(lang: SpeechLang, gender?: VoiceGender): SpeechSynthesisVoice | undefined {
  const candidates = findVoicesForLang(lang)
  if (!gender) return candidates[0]
  const classified = candidates.find((v) => classifyVoiceGender(v) === gender)
  if (classified) return classified
  // No voice confidently classified as the requested gender — still
  // honor the choice as "a distinct alternative voice" rather than
  // silently falling back to whatever `gender` wasn't asked for.
  return candidates[gender === 'female' ? 1 : 0] ?? candidates[0]
}

/** Speaks `text` in `lang`, cancelling any speech already in progress
 * first (only one utterance plays at a time, app-wide). Returns false
 * without speaking if the API isn't supported or no matching voice
 * exists — callers should already have disabled the triggering control
 * in that case (see useSpeechVoices), this is a defensive double-check. */
export function speak(
  text: string,
  lang: SpeechLang,
  opts?: {
    onStart?: () => void
    onEnd?: () => void
    onError?: () => void
    gender?: VoiceGender
    /** Playback rate, 0.5–2 (SpeechSynthesisUtterance's own supported
     * range is wider, but that's a sane, still-intelligible bound for a
     * reading aid). Defaults to 1 (normal speed). */
    rate?: number
    /** Voice pitch, 0–2 (SpeechSynthesisUtterance's own native range;
     * 1 = the voice's normal pitch). Added 2026-08-13 for «سُكون»'s
     * calm voice — the first caller that needs a pitch OTHER than the
     * default, so this stayed unbuilt until then. */
    pitch?: number
    /** Task #361 (2026-09-13) — fires as the engine reaches each spoken
     * WORD, carrying `charIndex` (the start offset of that word in
     * `text`) and, where the engine reports it, `charLength`. This is
     * the REAL, native word-timing signal the word-by-word reading
     * ruler follows to highlight exactly the word being spoken (see
     * components/reader/WordHighlightRuler.tsx) — not an assumed pace.
     * Chrome/Edge/Safari and iOS WKWebView fire word boundary events;
     * a few engines (notably Firefox historically) do not, in which
     * case this simply never fires and the highlight honestly stays
     * put rather than guessing — the caller never fabricates positions.
     * Optional and inert for every existing caller that doesn't pass
     * it (the utterance's onboundary is only wired when it's given). */
    onBoundary?: (charIndex: number, charLength?: number) => void
  },
): boolean {
  if (!isSpeechSupported()) return false
  const voice = findVoice(lang, opts?.gender)
  if (!voice) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = opts?.rate ?? 1
  utterance.pitch = opts?.pitch ?? 1
  if (opts?.onStart) utterance.onstart = opts.onStart
  if (opts?.onEnd) utterance.onend = opts.onEnd
  if (opts?.onError) utterance.onerror = opts.onError
  if (opts?.onBoundary) {
    const onBoundary = opts.onBoundary
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      // Forward every boundary the engine reports (word boundaries on
      // the engines Nibras targets; a coarser sentence boundary still
      // points at a real word start, so the caller's char→word mapping
      // stays correct either way — never wrong, just coarser on an
      // engine that only reports sentences).
      onBoundary(event.charIndex, event.charLength)
    }
  }
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

/** Pauses in place — resumable via `resumeSpeaking()`. Browser support
 * for pause/resume (vs. cancel-and-restart) varies but is broadly
 * available in current Chrome/Safari/Edge; degrades safely (a no-op)
 * where unsupported since it's a thin call onto the native API. */
export function pauseSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.pause()
}

export function resumeSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.resume()
}
