import { useEffect, useMemo, useRef, useState } from 'react'
import {
  isNativeRecognitionConstructorPresent,
  supportsOnDeviceAvailabilityCheck,
  checkEnglishAvailability,
  startEnglishListening,
  type EnglishRecognitionHandle,
} from '../lib/speechRecognition'
import { startArabicRecording, type ArabicRecordingHandle } from '../lib/speechRecording'
import { AccessTokenError, isAiBackendConfigured, SpendCapError, transcribe } from '../lib/aiService'
import { getAccessToken, reportInvalidToken } from '../lib/accessToken'
import type { SpeechLang } from '../lib/textToSpeech'

/**
 * Reading Buddy's listening/analysis SESSION mechanism (task #150),
 * extracted from ReadingBuddy.tsx (task #217, 2026-08-19) so it works on
 * ANY text passed in — the fixed practice passage OR a reader's own
 * pasted text — rather than being hard-wired to content/exampleTexts.ts.
 * Deliberately scoped to LISTENING only: playback ("read TO you" via
 * synthesizeVoice/speak) stays in the page, since it's a separate,
 * already-simple concern that doesn't benefit from sharing this hook.
 *
 * Metrics are real and zero-based, never fabricated (Amal's explicit
 * instruction, #150 spec) — see the individual functions below for the
 * exact honesty rules each one follows (never counting an interim/
 * unconfirmed result, never crediting the streak for an abandoned
 * session, etc.). Ported verbatim from ReadingBuddy.tsx's own original
 * implementation — no behavior change, just relocated so a second
 * consumer (or the SAME page switching between an example and a pasted
 * text) can reuse it instead of duplicating ~250 lines.
 */

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    // Arabic combining diacritics (tashkeel) — a reader's spoken word
    // recognized by Whisper has none of these anyway, but the SOURCE
    // passage text might carry some; strip both sides the same way so
    // "the same word" always compares equal regardless of vocalization.
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[.,!?؟،؛:"'"'«»()\-—]/g, '')
    .trim()
}

const STREAK_STORAGE_KEY = 'nibras.readingCoach.streak.v1'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
function yesterdayIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
}

/** Real, zero-based, localStorage-backed — absent/0 on a fresh browser,
 * exactly like this project's other real-metric surfaces (Library,
 * Calm Space). Reading a session's streak never invents a number. */
function readStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { count: number; lastDate: string }
    if (parsed.lastDate === todayIso() || parsed.lastDate === yesterdayIso()) return parsed.count
    return 0 // the streak lapsed — today isn't a continuation of it
  } catch {
    return 0
  }
}

/** Only called on a genuinely COMPLETED session (the whole passage was
 * read, not a mid-way stop or an explicit "start over") — a manual stop
 * never touches the streak; claiming a "win" for an abandoned attempt
 * would be exactly the kind of dishonest metric the spec forbids. */
function recordSessionCompletion(): number {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { count: number; lastDate: string }) : null
    const today = todayIso()
    let nextCount = 1
    if (parsed) {
      if (parsed.lastDate === today) nextCount = parsed.count
      else if (parsed.lastDate === yesterdayIso()) nextCount = parsed.count + 1
    }
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ count: nextCount, lastDate: today }))
    return nextCount
  } catch {
    return 0
  }
}

// "Today's wins" day-cumulative stats (task #201) — real, on-device,
// zero on a fresh device AND at the start of each new day. Distinct
// from Session Pulse's per-session "Words read": these accumulate
// across every reading session TODAY, mirroring the streak's own
// date-keyed localStorage pattern. Task #217: this is the SAME store
// regardless of which text (example or pasted) a session ran on —
// Amal's own call, confirmed via team-lead — it's honestly the same
// reading activity either way, one shared count.
const DAILY_STORAGE_KEY = 'nibras.readingCoach.daily.v1'

export interface DailyStats {
  wordsRead: number
  passagesRead: number
}

/** Real, zero-based, localStorage-backed — 0 on a fresh device and reset
 * to 0 at the start of each new day ("today" means today, never carried
 * over like the streak is). Never throws. */
function readDailyStats(): DailyStats {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY)
    if (!raw) return { wordsRead: 0, passagesRead: 0 }
    const parsed = JSON.parse(raw) as DailyStats & { date: string }
    if (parsed.date !== todayIso()) return { wordsRead: 0, passagesRead: 0 }
    return { wordsRead: parsed.wordsRead ?? 0, passagesRead: parsed.passagesRead ?? 0 }
  } catch {
    return { wordsRead: 0, passagesRead: 0 }
  }
}

/** Adds a just-ended session's REAL progress to today's bucket (resetting
 * first if the stored date isn't today). `wordsToAdd` is the session's
 * real matched-word count; `passageCompleted` bumps the passages count
 * only when the whole passage was read to the end. Never throws. */
function recordDailyProgress(wordsToAdd: number, passageCompleted: boolean): DailyStats {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as DailyStats & { date: string }) : null
    const today = todayIso()
    const base = parsed && parsed.date === today ? parsed : { wordsRead: 0, passagesRead: 0 }
    const next = {
      date: today,
      wordsRead: base.wordsRead + Math.max(0, wordsToAdd),
      passagesRead: base.passagesRead + (passageCompleted ? 1 : 0),
    }
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(next))
    return { wordsRead: next.wordsRead, passagesRead: next.passagesRead }
  } catch {
    return readDailyStats()
  }
}

// 'transcribing' (new, Arabic-only): the ONE recorded clip has been
// stopped and is being uploaded + transcribed by the real /stt call —
// a genuine async wait with no live signal, distinct from 'loading-model'
// (English's own brief on-device-setup wait, or Arabic's own
// mic-permission-request wait, BEFORE recording starts).
export type ReadingCoachSessionState = 'idle' | 'loading-model' | 'listening' | 'transcribing' | 'finished'

export function useReadingCoachSession(text: string, lang: SpeechLang) {
  const expectedWords = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const normalizedExpected = useMemo(() => expectedWords.map(normalizeWord), [expectedWords])

  // PRIVACY GATE (nibras-web-reviewer, 2026-08-14): English's mic UI
  // must not even render unless THIS browser can genuinely prove an
  // on-device session (see speechRecognition.ts's own header for why —
  // `processLocally: true` is best-effort without `.available()`).
  // THREE states, not a boolean (nibras-qa P2, 2026-08-14) — `'checking'`
  // is the honest "don't know yet" state, re-checked on every switch to
  // English (never cached/assumed).
  const [englishOnDeviceSupported, setEnglishOnDeviceSupported] = useState<'checking' | 'supported' | 'unsupported'>(
    'checking',
  )
  useEffect(() => {
    if (lang !== 'en') {
      setEnglishOnDeviceSupported('checking')
      return
    }
    if (!supportsOnDeviceAvailabilityCheck()) {
      setEnglishOnDeviceSupported('unsupported')
      return
    }
    setEnglishOnDeviceSupported('checking')
    let cancelled = false
    void checkEnglishAvailability().then((status) => {
      if (!cancelled) setEnglishOnDeviceSupported(status === 'unavailable' ? 'unsupported' : 'supported')
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  // Arabic: available the instant a real AI backend is configured — via
  // the real server-side /stt path (xAI), NOT the old
  // ARABIC_LISTENING_ENABLED/on-device-Whisper flag (that mechanism is
  // fully retired from this hook's active path; lib/whisperRecognition.ts
  // itself stays on disk, shelved, per this project's established
  // "don't delete, just stop wiring" convention — see
  // config/features.ts's own header for why it was deferred in the
  // first place). Demo-inert by construction, same pattern every other
  // AI feature in this app already uses: no backend configured -> false
  // -> the honest "coming" cards render instead (unchanged).
  const listeningAvailable = lang === 'en' ? englishOnDeviceSupported === 'supported' : isAiBackendConfigured()

  const [sessionState, setSessionState] = useState<ReadingCoachSessionState>('idle')
  const [matchedCount, setMatchedCount] = useState(0)
  // Live/tentative highlight index, English-only (interim results) —
  // always >= matchedCount, superseded by it once a final result lands.
  const [liveIndex, setLiveIndex] = useState(0)
  const [wpm, setWpm] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null)
  const [micUnavailable, setMicUnavailable] = useState(false)
  const [hasMicError, setHasMicError] = useState(false)
  // Arabic-only: distinguishes "your code was fine, you're just out of
  // budget" from "something else genuinely failed" (network, a bad
  // provider response, etc.) — a rejected/missing access code is
  // handled separately, globally, by <AccessGate> reopening itself
  // (aiService.ts's postJson already does this before throwing
  // AccessTokenError), so this never needs an 'accessCode' variant the
  // way #219's own voice-playback error states do. 'tokenCap'/
  // 'globalCap' split (AI-on honesty pass, 2026-08-19, spec in
  // teamlead/ai-on-honesty-copy-spec.md) mirrors ReadingBuddyPlayer.tsx/
  // ReadingBuddy.tsx's own identical reasoning for the TTS side —
  // 'tokenCap' (this volunteer's own budget, PERMANENT) never says "try
  // again later"; 'globalCap' (shared backstop, TEMPORARY) does.
  const [arabicSttError, setArabicSttError] = useState<'tokenCap' | 'globalCap' | 'failed' | null>(null)
  const [streak, setStreak] = useState(0)
  const [daily, setDaily] = useState<DailyStats>({ wordsRead: 0, passagesRead: 0 })

  const handleRef = useRef<EnglishRecognitionHandle | ArabicRecordingHandle | null>(null)
  const pointerRef = useRef(0)
  const recognizedWordsRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    setStreak(readStreak())
    setDaily(readDailyStats())
  }, [])

  function stopSession() {
    handleRef.current?.stop()
    handleRef.current = null
    setSessionState('idle')
  }

  function resetMetrics() {
    setMatchedCount(0)
    setLiveIndex(0)
    setWpm(null)
    setElapsedSeconds(null)
  }

  // A half-finished session is bound to BOTH the current language
  // (English vs Arabic route through entirely different listening
  // pipelines) AND the current TEXT (task #217 — a session's whole
  // point is measuring progress against a specific passage; switching
  // to a different one, example<->pasted or a fresh paste, makes the
  // old progress meaningless). No continuation exists across either
  // change, so end cleanly rather than leave a dangling mic/worker
  // session running against stale text or the wrong pipeline.
  useEffect(() => {
    stopSession()
    resetMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, text])

  useEffect(() => {
    return () => {
      handleRef.current?.stop()
    }
  }, [])

  function finishSession() {
    handleRef.current?.stop()
    handleRef.current = null
    setSessionState('finished')
    setStreak(recordSessionCompletion())
    // A completed read: add its real matched words + 1 passage to today's
    // wins (task #201). pointerRef.current is the committed matched count.
    setDaily(recordDailyProgress(pointerRef.current, true))
  }

  /** Forgiving sequential alignment: look a few words ahead of `from`,
   * not just the immediate next word — a skipped or self-corrected
   * word never blocks the rest of the passage from lighting up once
   * the reader moves past it. Pure (returns the new index, never
   * mutates) so the same logic can drive both a COMMITTED position
   * (final results only) and a TENTATIVE one (interim results, for
   * live highlighting only — see handleInterimText below). */
  function alignFrom(words: string[], from: number): number {
    let pointer = from
    for (const word of words) {
      const normalized = normalizeWord(word)
      if (!normalized) continue
      const windowEnd = Math.min(pointer + 6, normalizedExpected.length)
      for (let i = pointer; i < windowEnd; i++) {
        if (normalizedExpected[i] === normalized) {
          pointer = i + 1
          break
        }
      }
    }
    return pointer
  }

  function updateWpm(wordCount: number) {
    recognizedWordsRef.current += wordCount
    if (startTimeRef.current === null) return
    const elapsedMs = Date.now() - startTimeRef.current
    setElapsedSeconds(Math.round(elapsedMs / 1000))
    const elapsedMin = elapsedMs / 60_000
    if (elapsedMin > 0.05) setWpm(Math.round(recognizedWordsRef.current / elapsedMin))
  }

  /** A live, still-changing interim result (English only — Arabic has
   * no interim concept). Advances the TENTATIVE live-highlight index
   * only, from the last COMMITTED position — never touches matchedCount
   * (the real, reported metric) or the streak/wpm word count, since
   * interim text can still change before it's finalized. */
  function handleInterimText(text: string) {
    const words = text.split(/\s+/).filter(Boolean)
    setLiveIndex(alignFrom(words, pointerRef.current))
  }

  function handleRecognizedText(text: string) {
    const words = text.split(/\s+/).filter(Boolean)
    pointerRef.current = alignFrom(words, pointerRef.current)
    setMatchedCount(pointerRef.current)
    setLiveIndex(pointerRef.current) // an interim overshoot is superseded by its own final result
    updateWpm(words.length)
    if (pointerRef.current >= normalizedExpected.length) finishSession()
  }

  async function startSession() {
    // Defensive — the mic button that calls this never renders when
    // listening isn't available for the current language, so this
    // should be unreachable in practice.
    if (!listeningAvailable) return
    setHasMicError(false)
    setMicUnavailable(false)
    setArabicSttError(null)
    pointerRef.current = 0
    recognizedWordsRef.current = 0
    setMatchedCount(0)
    setLiveIndex(0)
    setWpm(null)
    setElapsedSeconds(null)
    startTimeRef.current = Date.now()

    if (lang === 'en') {
      if (!isNativeRecognitionConstructorPresent()) {
        setMicUnavailable(true)
        return
      }
      setSessionState('loading-model')
      const handle = await startEnglishListening({
        onResult: (result) => {
          if (result.isFinal) handleRecognizedText(result.text)
          else handleInterimText(result.text)
        },
        onError: () => setHasMicError(true),
        // speechRecognition.ts's own tight-loop guard (FIX 5) calls
        // `onEnd` when it trips — with no handler here, the session
        // state stayed stuck on 'listening' forever. A NORMAL
        // user-initiated stop already resets state synchronously inside
        // stopSession() below, before the browser's own `onend` event
        // even fires, so this is a harmless no-op redundancy for that
        // path — it only matters for the guard-tripped/restart-failed
        // paths. Deliberately does NOT call handleRef.current?.stop()
        // again — the recognition has already ended itself.
        onEnd: () => {
          handleRef.current = null
          setSessionState('idle')
        },
      })
      if (!handle) {
        setMicUnavailable(true)
        setSessionState('idle')
        return
      }
      handleRef.current = handle
      setSessionState('listening')
      return
    }

    // Arabic — server-side STT (xAI /stt), replacing the deferred
    // on-device-Whisper path (lib/whisperRecognition.ts stays on disk,
    // shelved, unused by this active flow). ONE recording per attempt:
    // tap mic -> request the microphone + start capturing -> read ->
    // tap mic again -> the WHOLE clip uploads once and comes back as
    // ONE transcript, aligned all at once via the SAME handleRecognizedText
    // English's own FINAL results already use. Deliberately does not
    // auto-resume/chain multiple recordings into one session (the /stt
    // endpoint has no live/interim concept to chain against) — a
    // second tap after a partial result starts a genuinely FRESH
    // attempt (see the top of this function), the same as tapping it
    // for the very first time. Flagged as a first-build simplification,
    // not a silent limitation — see stopArabicRecordingAndTranscribe's
    // own header for the honest "what happens to partial progress" rule.
    //
    // P2 (tech-final's #237 re-check, 2026-08-19): check the access
    // code BEFORE requesting the mic/recording, not after the upload
    // 401s. Without this, a volunteer who already granted voice consent
    // records the WHOLE passage, uploads it, gets rejected, and has to
    // redo the recording — a real wasted effort unique to this surface
    // (unlike Summarize/Mind Maps/TTS, nothing costly happens before
    // their own reactive 401 today). Reuses the SAME global reactive
    // gate every other AI surface already relies on rather than adding
    // a second mechanism — reportInvalidToken() reads the current
    // (already known-absent) token itself, so it correctly reports
    // `hadToken: false` here (see accessToken.ts), showing "you need a
    // code" rather than the wrong "that code isn't valid" copy.
    if (!getAccessToken()) {
      reportInvalidToken()
      return
    }
    setSessionState('loading-model') // brief: awaiting the mic-permission prompt
    const handle = await startArabicRecording({ onError: () => setHasMicError(true) })
    if (!handle) {
      setMicUnavailable(true)
      setSessionState('idle')
      return
    }
    handleRef.current = handle
    setSessionState('listening')
  }

  /** Stops the ONE active Arabic recording, uploads it, and aligns the
   * single returned transcript against the passage — the Arabic
   * counterpart to English's `stopSession()`, but genuinely async (a
   * real network round-trip, not an instant local stop) so it can't
   * reuse that function's synchronous shape.
   *
   * Honesty rule, mirroring English's own manual-stop behavor (task
   * #201): a transcript that DOESN'T reach the end of the passage still
   * credits its real matched words to today's stats (a genuine partial
   * attempt), but never marks a passage complete or touches the streak
   * — only finishSession() (fired automatically inside
   * handleRecognizedText once the WHOLE passage is matched) does that. */
  async function stopArabicRecordingAndTranscribe() {
    const handle = handleRef.current as ArabicRecordingHandle | null
    handleRef.current = null
    if (!handle) {
      setSessionState('idle')
      return
    }
    setSessionState('transcribing')
    try {
      const blob = await handle.stop()
      const result = await transcribe(blob, 'ar')
      handleRecognizedText(result.text)
      if (pointerRef.current < normalizedExpected.length) {
        setDaily(recordDailyProgress(pointerRef.current, false))
        setSessionState('idle')
      }
      // else: handleRecognizedText already called finishSession() (full
      // credit + streak) — don't overwrite its 'finished' state or
      // double-count today's progress.
    } catch (err) {
      if (err instanceof AccessTokenError) {
        // Handled globally — the <AccessGate> mounted in AppShell.tsx
        // has already reopened itself (aiService.ts's postJson calls
        // reportInvalidToken() before throwing). No local message here
        // would be redundant with that, matching #219's own established
        // pattern for every other AI call site in this app.
      } else if (err instanceof SpendCapError) {
        setArabicSttError(err.reason === 'global_cap_reached' ? 'globalCap' : 'tokenCap')
      } else {
        setArabicSttError('failed')
      }
      setSessionState('idle')
    }
  }

  function handleMicButtonClick() {
    if (sessionState === 'transcribing') return // busy — ignore an extra tap
    if (sessionState === 'listening' || sessionState === 'loading-model') {
      if (lang === 'ar') {
        void stopArabicRecordingAndTranscribe()
        return
      }
      // A user-initiated stop mid-read still counts the words actually
      // read toward "today" (but NOT a completed passage) — only while
      // genuinely listening with real progress. A completed read is
      // handled by finishSession instead. (task #201)
      if (sessionState === 'listening' && pointerRef.current > 0) {
        setDaily(recordDailyProgress(pointerRef.current, false))
      }
      stopSession()
      return
    }
    void startSession()
  }

  /** "Delete & start over" (task #217) — an explicit, reader-initiated
   * reset of the CURRENT session's own working state: stops any active
   * mic/model session and returns every session-scoped metric to its
   * fresh/idle value, ready for a new attempt on the SAME active text.
   * Never touches streak/daily — those are historical facts about
   * completed sessions, exactly like a manual stopSession() already
   * doesn't touch them. Honestly scoped to on-device session state
   * only — never claims to reach into the AI service (its own separate
   * 30-day auto-delete is covered by the consent copy, untouched here). */
  function startOver() {
    stopSession()
    resetMetrics()
    pointerRef.current = 0
    recognizedWordsRef.current = 0
    startTimeRef.current = null
    setMicUnavailable(false)
    setHasMicError(false)
    setArabicSttError(null)
  }

  return {
    expectedWords,
    englishOnDeviceSupported,
    listeningAvailable,
    sessionState,
    matchedCount,
    liveIndex,
    wpm,
    elapsedSeconds,
    micUnavailable,
    hasMicError,
    arabicSttError,
    streak,
    daily,
    handleMicButtonClick,
    startOver,
  }
}
