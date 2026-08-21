import { useEffect, useState } from 'react'
import { isSpeechSupported, type SpeechLang } from '../lib/textToSpeech'
import { isAiBackendConfigured } from '../lib/aiService'

/** Tracks the browser's voice list, which loads asynchronously — a
 * component checking voice availability on first render (before
 * `voiceschanged` has ever fired) would otherwise see an empty list
 * even on a device that does have the voice, and disable read-aloud
 * incorrectly. */
export function useSpeechVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    isSpeechSupported() ? window.speechSynthesis.getVoices() : [],
  )

  useEffect(() => {
    if (!isSpeechSupported()) return
    function update() {
      setVoices(window.speechSynthesis.getVoices())
    }
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  function voicesForLang(lang: SpeechLang) {
    return voices.filter((v) => v.lang.toLowerCase().startsWith(lang))
  }

  /** A usable voice exists for `lang` — from the browser's own list OR,
   * when a real AI backend is configured, from the neural provider. xAI
   * TTS renders BOTH English and Arabic (server/api/_xaiTts.ts, verified
   * live + Amal-confirmed on ar-SA), so once AI-on, read-aloud and the
   * voice controls correctly appear even for a language the browser ships
   * few/no voices for (the Arabic case Amal hit). In DEMO (no backend)
   * this stays honest — only the real browser voices count. */
  function hasVoiceFor(lang: SpeechLang) {
    return isAiBackendConfigured() || voicesForLang(lang).length > 0
  }

  /** Whether a meaningful 2-voice choice (Voice 1/Voice 2) exists for
   * `lang`. Browser path: needs >= 2 real voices for the language (the
   * same >= 2 threshold lib/textToSpeech.ts used before its non-reactive
   * version was removed for a cold-load bug — a plain getVoices() at
   * first render sees [] before `voiceschanged` fires; reading this
   * hook's reactive `voices` state fixes that). Neural path (AI-on): the
   * provider always offers two distinct voices (rex = Voice 1, eve =
   * Voice 2) for BOTH languages, so the choice is genuinely available —
   * this fixes the bug where Arabic's Voice 1/Voice 2 choice wrongly hid
   * under AI-on because only browser voices were counted (Amal, 2026-08-18).
   * DEMO stays honest: no faked 2-voice choice when the browser has one. */
  function hasGenderChoiceFor(lang: SpeechLang) {
    return isAiBackendConfigured() || voicesForLang(lang).length >= 2
  }

  return { voices, hasVoiceFor, hasGenderChoiceFor }
}
