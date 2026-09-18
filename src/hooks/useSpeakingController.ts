import { useEffect, useRef, useState } from 'react'
import { speak, stopSpeaking, type SpeechLang, type VoiceGender } from '../lib/textToSpeech'
import { isAiBackendConfigured, synthesizeVoice, VoiceUnavailableError } from '../lib/aiService'
import { getVoicePreferenceSnapshot } from '../lib/voicePreference'

/** Coordinates "only one card speaks at a time" and guarantees speech
 * never keeps playing after the page that started it unmounts (e.g.
 * navigating from the grid to a card's detail) — shared by the
 * Techniques grid/detail, Letter Sounds, Mind Maps "listen", the Guide,
 * and the Privacy page rather than duplicated in each.
 *
 * Neural voice (task #127's real intent, wired here 2026-08-19): when a
 * real AI backend is configured, read-aloud on ALL these surfaces now
 * goes through aiService.synthesizeVoice (the same xAI neural voice
 * Reading Buddy uses), NOT the robotic browser Web Speech voice — the
 * gap Amal hit on تقنيات القراءة (it played the browser voice even with
 * AI on). Mirrors ReadingBuddyPlayer.startPlayback exactly: request a
 * NEUTRAL 1x render (xAI already renders at speed server-side, so speed
 * is applied ONCE here via audio.playbackRate — never the rate² double
 * of #147). AI-ON NEVER falls back to a browser voice: a neural failure
 * surfaces an honest "voice needs internet" state (`errorId`), never the
 * free voice (Amal's option ب, 2026-08-19). Browser voice is used ONLY
 * when no backend is configured (the demo / AI-off build).
 *
 * `preparingId` (2026-08-19): the neural render takes a few seconds, so
 * the hook exposes which id is currently GENERATING (vs `speakingId`,
 * which is actually PLAYING). Callers show an honest "preparing…" state
 * and disable the control while it's set, so a read-aloud button never
 * looks dead during the wait and an impatient double-click can't fire a
 * second (paid) render. The browser path has no wait, so it goes
 * straight to `speakingId`. */
export function useSpeakingController() {
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [preparingId, setPreparingId] = useState<string | null>(null)
  // The id whose neural render just FAILED with a transient
  // VoiceUnavailableError (offline / network / 5xx / 429) — consumers show
  // an honest "voice needs internet, try again" line next to THAT control
  // instead of ever dropping to a free browser voice (Amal's approved
  // option ب, 2026-08-19). Cleared the instant a new toggle or stop begins.
  const [errorId, setErrorId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Bumped on every stop / new toggle / unmount so a neural render that
  // is still in flight (synthesizeVoice can take a few seconds) knows it
  // was superseded and must NOT start playing over whatever took its
  // place — the async equivalent of speak()'s own cancel-then-restart.
  const genRef = useRef(0)

  useEffect(() => {
    return () => {
      genRef.current++
      stopSpeaking()
      audioRef.current?.pause()
    }
  }, [])

  function clearCurrent(id: string) {
    setSpeakingId((current) => (current === id ? null : current))
    setPreparingId((current) => (current === id ? null : current))
  }

  /** `opts.gender`/`opts.rate` (task #127) — optional. Callers with a
   * voice/speed picker (Letter Sounds, Mind Maps, Techniques) pass the
   * shared persisted preference; callers that pass nothing (Guide,
   * Privacy) fall back to the SAME global preference for the neural
   * path (so the whole app speaks in one consistent voice) and to
   * speak()'s own defaults for the browser path.
   *
   * `opts.onBoundary`/`opts.onAudio` (task #366) — optional voice-signal
   * taps for «مرشد نبراس»'s talking mouth, and INERT for every other
   * caller (they pass neither): `onBoundary` is forwarded to speak()'s
   * per-word boundary on the browser path; `onAudio` hands the neural
   * <audio> element to the caller right before it plays, so it can wire
   * an AnalyserNode for amplitude. Neither changes playback in any way. */
  async function toggle(
    id: string,
    text: string,
    lang: SpeechLang,
    opts?: {
      gender?: VoiceGender
      rate?: number
      onBoundary?: (charIndex: number, charLength?: number) => void
      onAudio?: (audio: HTMLAudioElement) => void
    },
  ) {
    if (speakingId === id || preparingId === id) {
      stop()
      return
    }
    // Take over from whatever is currently speaking (browser or audio).
    stopSpeaking()
    audioRef.current?.pause()
    setErrorId(null)
    const myGen = ++genRef.current

    if (isAiBackendConfigured()) {
      // Mark THIS id as PREPARING so the button shows an honest
      // "preparing…" state (and disables) during the neural generation
      // wait rather than looking dead — and so a second click on it
      // stops/cancels instead of firing a second paid render.
      setPreparingId(id)
      setSpeakingId(null)
      const gender = opts?.gender ?? getVoicePreferenceSnapshot().gender
      let result: Awaited<ReturnType<typeof synthesizeVoice>>
      try {
        result = await synthesizeVoice({ text, lang, gender, rate: 1 })
      } catch (err) {
        if (myGen !== genRef.current) return // superseded/stopped during await
        // AI-ON: NEVER drop to the free browser voice on a failure — Amal's
        // "only my two neural voices" requirement (2026-08-19). A transient
        // VoiceUnavailableError (offline / network / 5xx / 429) surfaces the
        // honest "voice needs internet, try again" line on the control that
        // failed; AccessTokenError already reopened the global <AccessGate>
        // and SpendCapError has its own copy elsewhere, so those just reset.
        // In every case: no browser voice, ever.
        clearCurrent(id)
        if (err instanceof VoiceUnavailableError) setErrorId(id)
        return
      }
      if (myGen !== genRef.current) return // stopped/superseded during await
      if (result.mode === 'audio') {
        if (!audioRef.current) audioRef.current = new Audio()
        const audio = audioRef.current
        audio.src = result.url
        audio.playbackRate = opts?.rate ?? 1 // speed applied ONCE (server rendered at 1x)
        audio.onended = () => clearCurrent(id)
        audio.onerror = () => clearCurrent(id)
        // #366: hand the element to the mascot BEFORE play() so its
        // AnalyserNode is wired before the first samples flow. The data:
        // URL is same-origin, so the analyser reads real amplitude (not
        // CORS-tainted zeros). No-op for every other caller. Guarded so a
        // throw in the tap can never stop the voice from playing.
        try {
          opts?.onAudio?.(audio)
        } catch {
          /* mouth is cosmetic — never let it break playback */
        }
        try {
          await audio.play()
          if (myGen !== genRef.current) return
          setPreparingId((c) => (c === id ? null : c))
          setSpeakingId(id)
        } catch {
          clearCurrent(id)
        }
        return
      }
      // AI-on always resolves to a neural 'audio' render now (synthesizeVoice
      // throws on every failure instead of ever returning 'browser'), so this
      // is unreachable when the backend is on — reset defensively, never speak.
      clearCurrent(id)
      return
    }

    // Browser Web Speech path — DEMO / AI-OFF ONLY (no neural backend).
    const started = speak(text, lang, {
      gender: opts?.gender,
      rate: opts?.rate,
      onEnd: () => clearCurrent(id),
      onError: () => clearCurrent(id),
      onBoundary: opts?.onBoundary, // #366 mascot mouth-sync; undefined for every other caller
    })
    if (myGen === genRef.current) setSpeakingId(started ? id : null)
  }

  /** #284: play a FIXED pre-rendered audio FILE (a `soundClip` URL), not
   * live TTS. Used by Letter Sounds for the 9 sounds a live voice can't say
   * right on its own: the clip is served from public/ and plays AS-IS at its
   * baked rate (NEVER the user's global speed, which is why s/h needed a fixed
   * clip), works AI-on or AI-off, and needs no browser voice. Shares the
   * one-at-a-time + generation guard with `toggle` via the same audioRef. */
  async function toggleClip(id: string, url: string) {
    if (speakingId === id || preparingId === id) {
      stop()
      return
    }
    stopSpeaking()
    audioRef.current?.pause()
    setErrorId(null)
    const myGen = ++genRef.current
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = url
    audio.playbackRate = 1 // clip is pre-rendered at the approved rate
    audio.onended = () => clearCurrent(id)
    audio.onerror = () => clearCurrent(id)
    try {
      await audio.play()
      if (myGen !== genRef.current) return
      setPreparingId((c) => (c === id ? null : c))
      setSpeakingId(id)
    } catch {
      clearCurrent(id)
    }
  }

  /** Explicit stop, independent of a toggle click — needed anywhere the
   * app itself changes what's on screen while speech might still be
   * playing (e.g. the Guide navigating to a different step). Bumps the
   * generation guard so an in-flight neural render is abandoned too. */
  function stop() {
    genRef.current++
    stopSpeaking()
    audioRef.current?.pause()
    setSpeakingId(null)
    setPreparingId(null)
    setErrorId(null)
  }

  return { speakingId, preparingId, errorId, toggle, toggleClip, stop }
}
