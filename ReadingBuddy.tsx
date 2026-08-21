import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EXAMPLE_TEXTS } from '../content/exampleTexts'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { useReadingCoachSession } from '../hooks/useReadingCoachSession'
import { isAiBackendConfigured, SpendCapError, synthesizeVoice, VoiceUnavailableError } from '../lib/aiService'
import { grantArabicSttConsent, hasArabicSttConsent } from '../lib/arabicSttConsent'
import { speak, stopSpeaking, type SpeechLang } from '../lib/textToSpeech'
import { MicrophoneIcon, SpeakerIcon, StopIcon, TrashIcon } from '../components/icons'
import { focusRing, focusRingInset } from '../lib/focus'
import { ArabicSttConsent } from '../components/reader/ArabicSttConsent'

/**
 * Reading Buddy / رفيق القراءة (#150) — a TWO-WAY companion, dedicated
 * home at /reading-buddy. Reuses the SAME two seams the rest of the app
 * already ships on rather than inventing a parallel system:
 *   - Reads TO you: lib/aiService.synthesizeVoice + lib/textToSpeech,
 *     the exact mechanism ReadingBuddyPlayer.tsx (the in-Reader quick
 *     player, left untouched) already uses.
 *   - Listens TO you + analyzes: hooks/useReadingCoachSession.ts (task
 *     #217, 2026-08-19 extraction — see that file's own header) —
 *     English via lib/speechRecognition.ts (native browser
 *     SpeechRecognition, on-device, LIVE), Arabic via server STT once
 *     the AI-on backend lands (Amal's confirmed Path A, xAI, 30-day/
 *     no-train — see this file's own ARABIC section below for the
 *     current honest "coming" state).
 *
 * Practice text (task #217): TWO sources now, both driving the SAME
 * hook — the original fixed passage (content/exampleTexts.ts, kept as
 * a no-setup quick-start) OR a reader's own pasted text, entered here
 * directly (Amal's own confirmed shape — self-contained, no link to or
 * handoff from the Reader; the Reader stays completely untouched and
 * out of scope for this task). Switching between them, or pasting a new
 * text, resets the session (see the hook's own reasoning).
 *
 * Metrics are real and zero-based, never fabricated (Amal's explicit
 * instruction, #150 spec): words-matched is a real word-by-word
 * alignment against whichever text is active; pace is recognized-words
 * ÷ elapsed-minutes; streak + Today's wins are real, localStorage-
 * backed, absent on a fresh browser, and SHARED across both text
 * sources (task #217, Amal's confirmed call — it's honestly the same
 * reading activity either way). No "82% accuracy" / "Confidence" tile
 * exists anywhere here — those aren't measurable in-browser and were
 * dropped per spec.
 *
 * ARABIC LISTENING — the on-device Whisper path this file's history
 * once described is SUPERSEDED (task #217, 2026-08-19): Amal approved
 * server-side STT (xAI, Path A) once the AI-on backend lands instead,
 * which sidesteps the ~317MB on-device download entirely.
 * `ARABIC_LISTENING_ENABLED`/whisperRecognition.ts stay in the hook,
 * untouched, as a dormant fallback — not the active plan. Until AI-on
 * lands, Arabic gets the SAME honest "how it works today / what's
 * coming" card pair it already had — no mic, no session-pulse/streak UI
 * (nothing to honestly measure without a listening session).
 *
 * ENGLISH IS GATED (nibras-web-reviewer, 2026-08-14) — not simply
 * "always on". `englishOnDeviceSupported` must be genuinely confirmed
 * before the mic UI renders at all — a browser that can't PROVE an
 * on-device session gets the same honest mic-free read-aloud + tap-word
 * experience Arabic already has, never a mic button that would silently
 * risk sending audio off-device. See speechRecognition.ts's own header.
 */

/** One "Session pulse"/"Today's wins" metric row (task #195, 2026-08-15;
 * bar made OPTIONAL in task #203, 2026-08-15) — a label + its current
 * value, with an OPTIONAL thin fill bar. `pending` renders the value in
 * muted ink (an honest "not yet" look, not a real result styled the
 * same as a genuine one).
 *
 * `showBar` (task #203, quality-review P1-1): the bar used to render
 * UNCONDITIONALLY with `fillPercent={0}` passed for 5 of 6 rows —
 * meaning a real, growing VALUE ("6/52", a real wpm, "Day 3") sat
 * permanently above a grey bar that could never move, reading like a
 * broken/stuck loading skeleton. A fill bar only makes honest sense
 * where a genuine bounded 0-100% proportion exists — this app has
 * exactly ONE such row today (Words-this-session, a real matched/total
 * ratio). Every other row (Pace, Time read, Words/Passages today,
 * Reading streak) has no natural denominator to show a proportion
 * AGAINST — inventing one (e.g. "cap wpm at 200 for the bar") would be
 * exactly the kind of fabricated-looking metric this app's spec
 * forbids, so those rows render as a clean label+value line, no bar. */
function SessionPulseRow({
  label,
  value,
  fillPercent,
  pending = false,
  showBar = false,
}: {
  label: string
  value: string
  fillPercent?: number
  pending?: boolean
  showBar?: boolean
}) {
  return (
    <div>
      <div className={showBar ? 'mb-1 flex items-center justify-between gap-2 text-[0.8125rem]' : 'flex items-center justify-between gap-2 text-[0.8125rem]'}>
        <span className="text-ink-muted">{label}</span>
        <span className={`font-semibold ${pending ? 'text-ink-muted' : 'text-ink'}`}>{value}</span>
      </div>
      {showBar && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, fillPercent ?? 0))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function ReadingBuddy() {
  const { t, i18n } = useTranslation()
  const lang: SpeechLang = i18n.language === 'ar' ? 'ar' : 'en'
  const isRtl = lang === 'ar'

  const passage = useMemo(() => EXAMPLE_TEXTS.find((example) => example.lang === lang) ?? EXAMPLE_TEXTS[0], [lang])

  // Task #217 — a reader's own pasted text, self-contained (Amal's own
  // confirmed shape: no link to or handoff from the Reader, which stays
  // completely untouched). null means no custom text is active, so the
  // fixed example above is what's shown. Cleared on a language switch
  // (below): a pasted text is written in whatever language the reader
  // was using at the time, with no detection step the way the Reader
  // itself has, so keeping a stale paste displayed while the UI (and
  // the recognizer) switch language would silently mismatch. Session-
  // only, not persisted — matches this page's own established
  // reset-on-language-switch precedent, not a saved document the way
  // the Reader's library is.
  const [customText, setCustomText] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteDraft, setPasteDraft] = useState('')

  useEffect(() => {
    setCustomText(null)
    setPasteOpen(false)
    setPasteDraft('')
  }, [lang])

  const activeTitle = customText !== null ? t('readingCoach.yourTextTitle') : passage.title
  const activeText = customText ?? passage.text

  function useOwnText() {
    const trimmed = pasteDraft.trim()
    if (!trimmed) return
    setCustomText(trimmed)
    setPasteOpen(false)
  }

  function backToExample() {
    setCustomText(null)
    setPasteDraft('')
  }

  // The whole listening/analysis SESSION mechanism (task #217 extraction
  // — see hooks/useReadingCoachSession.ts's own header) — reactively
  // re-keyed on activeText, so switching example<->pasted (or pasting a
  // fresh text) cleanly resets progress rather than measuring it against
  // stale expectations.
  const {
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
  } = useReadingCoachSession(activeText, lang)

  // Arabic listening needs an explicit, opt-in consent gate before the
  // FIRST recording ever starts — the honest tradeoff English's
  // on-device path never has (this audio genuinely leaves the device,
  // sent to xAI's /stt; see ArabicSttConsent.tsx's own header). Gated
  // ONLY on the "about to START a new session" click — mirrors
  // useReadingCoachSession's own handleMicButtonClick branching
  // exactly: a stop-listening or ignored-transcribing click always
  // passes straight through untouched; only a fresh start, in Arabic,
  // without consent recorded yet, intercepts here instead.
  const [consentOpen, setConsentOpen] = useState(false)

  function handleMicButtonClickGated() {
    const aboutToStart = sessionState === 'idle' || sessionState === 'finished'
    if (lang === 'ar' && aboutToStart && !hasArabicSttConsent()) {
      setConsentOpen(true)
      return
    }
    handleMicButtonClick()
  }

  function agreeToArabicStt() {
    grantArabicSttConsent()
    setConsentOpen(false)
    handleMicButtonClick()
  }

  const { gender, rate } = useVoicePreference()
  const { hasVoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)

  const [readAloudStatus, setReadAloudStatus] = useState<'idle' | 'preparing' | 'playing'>('idle')
  // Task #219's honest error handling for "Hear the passage" — see
  // ReadingBuddyPlayer.tsx's own identical state for the full reasoning
  // (this page duplicates that player's play logic rather than sharing
  // it — see playPassage's own header comment on the rate² fix for why
  // that duplication already existed before this task). 'tokenCap'/
  // 'globalCap' split (AI-on honesty pass, 2026-08-19) mirrors
  // ReadingBuddyPlayer.tsx's own identical reasoning.
  const [voiceError, setVoiceError] = useState<'accessCode' | 'tokenCap' | 'globalCap' | 'unavailable' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // A SEPARATE, reused <audio> for tap-a-word sound-help — one element,
  // paused before each replay (mirrors playPassage), so rapid taps don't
  // stack overlapping clips (P2, 2026-08-19). Kept distinct from audioRef
  // so a word tap never fights the passage player.
  const wordAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      stopSpeaking()
      audioRef.current?.pause()
    }
  }, [])

  /** "0:00"/"1:05"/"12:03" — real elapsed time, never a fabricated
   * duration. Used by the "Time read" Session Pulse tile. */
  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function playPassage() {
    setVoiceError(null)
    // Neural render takes a few seconds — show an honest "preparing…"
    // state (button disabled + busy) instead of a dead-looking button.
    if (isAiBackendConfigured()) setReadAloudStatus('preparing')
    // tech-final P1 (2026-08-19), bundled with #211: same rate² bug
    // ReadingBuddyPlayer.tsx already fixed for #147 P1-a — the 'audio'
    // (real backend) path was applying `rate` TWICE, once server-side
    // (xAI genuinely renders the MP3 at the requested speed,
    // server/api/_xaiTts.ts:92-93) and again below via
    // audio.playbackRate, compounding to roughly rate² (1.5× requested
    // sounded ~2.25×). Always request a NEUTRAL (1×) render — playback
    // rate below is then the ONLY place speed is ever applied. The
    // 'browser' (Web Speech) path is unaffected either way — it only
    // ever applies `rate` once, to the utterance itself, via `speak()`.
    // Task #217: reads whichever text is ACTIVE (activeText) — the
    // fixed example or the reader's own paste — not always the example.
    let result: Awaited<ReturnType<typeof synthesizeVoice>>
    try {
      result = await synthesizeVoice({ text: activeText, lang, gender, rate: 1 })
    } catch (err) {
      // Task #219: synthesizeVoice now RE-THROWS an access-code/spend-
      // cap problem instead of silently degrading to browser voice —
      // show the honest reason instead of leaving the button looking
      // like it just silently did nothing.
      setVoiceError(
        err instanceof SpendCapError
          ? err.reason === 'global_cap_reached'
            ? 'globalCap'
            : 'tokenCap'
          : err instanceof VoiceUnavailableError
            ? 'unavailable'
            : 'accessCode',
      )
      setReadAloudStatus('idle')
      return
    }
    if (result.mode === 'browser') {
      const started = speak(activeText, lang, {
        gender,
        rate,
        onStart: () => setReadAloudStatus('playing'),
        onEnd: () => setReadAloudStatus('idle'),
        onError: () => setReadAloudStatus('idle'),
      })
      if (!started) setReadAloudStatus('idle')
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = result.url
    audio.playbackRate = rate
    audio.onended = () => setReadAloudStatus('idle')
    audio.onerror = () => setReadAloudStatus('idle')
    try {
      await audio.play()
      setReadAloudStatus('playing')
    } catch {
      setReadAloudStatus('idle')
    }
  }

  function stopPlayback() {
    stopSpeaking()
    audioRef.current?.pause()
    setReadAloudStatus('idle')
  }

  // Sound-help (spec: "tap a word -> hear how it breaks into sounds").
  // Scope call for this first build (flagged to team-lead, not silent):
  // this plays the WORD's own clear pronunciation via the same
  // established voice seam, not a true letter-by-letter phonetic
  // breakdown — content/letterSounds.ts's entries are isolated,
  // specifically-vocalized letter forms, and correctly mapping an
  // arbitrary passage word to the right diacritized letter sequence
  // (Arabic especially) is real linguistic work nibras-ar hasn't
  // reviewed yet. Hearing the word again, clearly, is still real,
  // honest, working sound-based guidance — never red ink either way.
  function speakWord(word: string) {
    void synthesizeVoice({ text: word, lang, gender, rate: 1 })
      .then((result) => {
        if (result.mode === 'browser') {
          speak(word, lang, { gender, rate: 1 })
          return
        }
        if (!wordAudioRef.current) wordAudioRef.current = new Audio()
        const wordAudio = wordAudioRef.current
        wordAudio.pause() // stop any still-playing tap before starting the next
        wordAudio.src = result.url
        void wordAudio.play()
      })
      .catch(() => {
        // Task #219: synthesizeVoice now re-throws an access-code/
        // spend-cap problem rather than silently falling back — the
        // main "Hear the passage" button (playPassage above) already
        // surfaces that honestly, and an invalid code ALSO already
        // reopens the globally-mounted <AccessGate> regardless of what
        // this specific tap does. Adding a SECOND, per-word error
        // message for this minor, high-frequency tap-a-word
        // interaction would be disproportionate noise; a single word
        // quietly not sounding out is an acceptable degradation here,
        // same reasoning already applied to CalmSpace's cues.
      })
  }

  const statusText = (() => {
    if (sessionState === 'idle') return t('readingCoach.tapToStart')
    // Shared brief-async-wait text — English's own on-device setup wait
    // and Arabic's own mic-permission-request wait (before recording
    // starts) are both genuinely "getting the listening coach ready",
    // and the copy itself never claims a specific mechanism, so one key
    // honestly covers both rather than needing two near-identical ones.
    if (sessionState === 'loading-model') return t('readingCoach.preparingVoice')
    if (sessionState === 'listening') return t('readingCoach.listening')
    // Arabic-only: the ONE recorded clip has been sent to /stt and the
    // reader is waiting on the real transcript — a genuine async wait
    // with nothing live to show, distinct from 'listening' (recording
    // in progress) and from the generic 'preparingVoice' text above
    // (this isn't "getting ready", the passage is already being
    // checked).
    if (sessionState === 'transcribing') return t('readingCoach.transcribing')
    return t('readingCoach.sessionDone')
  })()

  return (
    <main className="mx-auto grid w-full max-w-[1180px] flex-1 gap-7 px-6 py-8 sm:px-10 sm:py-10 xl:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
      <section aria-labelledby="reading-coach-heading">
        {/* "Module 3" pill removed (Amal's decision, 2026-08-14 pre-pilot
            batch — "شيل الوحدة ٣"): it was fidelity to the reference
            nibrasapp.com/reading-buddy page (#150's own "recreate it
            exactly" brief), not a real course-module structure Nibras
            actually has, so it read as a promise the app doesn't keep. */}
        {/* Title block + mode badge share one row, badge on the END side
            (task #195, 2026-08-15 — matches the reference
            nibrasapp.com/reading-buddy's own layout, where its badge
            sits beside the title, not stacked below the subtitle).
            `justify-between` mirrors correctly for RTL on its own (no
            `rtl:` class needed) since flexbox already follows `dir`.
            `sm:flex-nowrap` (task #203, quality-review P2-3): the
            reported bug was wrap kicking in and dropping the badge to
            its own row below the title block at normal/tablet widths,
            where there's clearly enough room for both — `sm:flex-nowrap`
            (640px+) fixes exactly that. Below `sm:`, wrap is
            DELIBERATELY still allowed: measured directly (task #203
            mobile-AR gap check, 2026-08-15) that forcing nowrap at true
            phone widths (390px) instead squeezes the badge (flex-none,
            longer in Arabic) against the h1, leaving so little room that
            `min-w-0` shrinks the title column to ~71px and the 3-word
            heading wraps one-word-per-line — worse than letting the
            badge drop to its own full-width row below the title, which
            is what the base (no `sm:`) wrap now does instead. `min-w-0`
            on the title block below still matters at `sm:`+ widths where
            nowrap is active, letting ITS OWN text shrink without forcing
            the row to overflow. */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
          <div className="min-w-0">
            <h1 id="reading-coach-heading" className="mb-2 text-[1.75rem] font-bold text-ink">
              {t('readingCoach.title')}
            </h1>
            <p className="max-w-[46rem] text-[0.9375rem] text-ink-muted">{t('readingCoach.subtitle')}</p>
          </div>
          {/* Mode badge — WORDING stays honest and state-specific
              (unchanged): `modeArabicReadOnly`'s own EN/AR text is
              intentionally generic ("Reads to you. Tap any word to hear
              it.") — despite its name, it's shared by BOTH "Arabic
              deferred" AND "English on this browser can't prove
              on-device" (2026-08-14 privacy-gate fix), never claims
              listening either way; do NOT collapse these 3 real states
              into one static "Phonological mode" label, that would lose
              the exact honesty distinction task #150's privacy gate
              exists to make. STYLING (not wording) explicitly matches
              Amal's own reference screenshot (task #195, 2026-08-15,
              «رفيق القراءة» design ref) — a green pill, a deliberate
              ONE-OFF exception to this app's normal blue-only palette
              (see task #8's own green->blue migration), applied here
              because Amal specifically pointed at this exact color in
              the reference. Not extended to any other badge in the app. */}
          <div className="inline-flex flex-none items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-[0.75rem] font-semibold text-green-800">
            {!listeningAvailable
              ? t('readingCoach.modeArabicReadOnly')
              : isRtl
                ? t('readingCoach.modeArabicBatch')
                : t('readingCoach.modeEnglishLive')}
          </div>
        </div>

        <div className="rounded-control border-[1.5px] border-line-strong bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">{activeTitle}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Task #217 (2026-08-19) — Amal's confirmed final shape:
                  accept the reader's OWN text right here, self-contained
                  (no link to or handoff from the Reader, which stays
                  untouched). Kept the fixed example too, as a no-setup
                  quick-start — this toggle just offers a second source,
                  it doesn't replace the first. */}
              {customText === null ? (
                <button
                  type="button"
                  onClick={() => setPasteOpen((v) => !v)}
                  aria-expanded={pasteOpen}
                  className={`rounded-control border-[1.5px] px-3 py-1.5 text-[0.75rem] font-semibold transition-colors aria-expanded:border-accent aria-expanded:bg-accent-tint aria-expanded:text-accent ${pasteOpen ? '' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'} ${focusRing}`}
                >
                  {t('readingCoach.pasteOwnTextButton')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={backToExample}
                  className={`rounded-control border-[1.5px] border-line-strong px-3 py-1.5 text-[0.75rem] font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
                >
                  {t('readingCoach.backToExampleButton')}
                </button>
              )}
              {voiceAvailable && (
                <button
                  type="button"
                  onClick={readAloudStatus === 'playing' ? stopPlayback : playPassage}
                  disabled={readAloudStatus === 'preparing'}
                  aria-busy={readAloudStatus === 'preparing'}
                  className={`flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[0.75rem] font-semibold text-ink-muted hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                >
                  {readAloudStatus === 'preparing' ? (
                    <SpeakerIcon className="size-3.5 motion-safe:animate-pulse" />
                  ) : readAloudStatus === 'playing' ? (
                    <StopIcon className="size-3.5" />
                  ) : (
                    <SpeakerIcon className="size-3.5" />
                  )}
                  {readAloudStatus === 'preparing'
                    ? t('techniques.preparing')
                    : readAloudStatus === 'playing'
                      ? t('readingCoach.stopReading')
                      : t('readingCoach.hearPassage')}
                </button>
              )}
            </div>
          </div>
          {voiceError && (
            <p role="alert" className="mb-4 text-[0.8125rem] text-ink-muted">
              {voiceError === 'tokenCap'
                ? t('readingCoach.limitReachedTokenCap')
                : voiceError === 'globalCap'
                  ? t('readingCoach.limitReachedGlobalCap')
                  : voiceError === 'unavailable'
                    ? t('readingCoach.voiceUnavailable')
                    : t('readingCoach.accessCodeMessage')}
            </p>
          )}

          {pasteOpen && customText === null && (
            <div className="mb-4 rounded-control border border-line bg-cream p-3">
              <label htmlFor="rb-paste-input" className="sr-only">
                {t('readingCoach.pasteOwnTextButton')}
              </label>
              <textarea
                id="rb-paste-input"
                rows={3}
                value={pasteDraft}
                onChange={(e) => setPasteDraft(e.target.value)}
                placeholder={t('readingCoach.pasteOwnTextPlaceholder')}
                dir={isRtl ? 'rtl' : 'ltr'}
                className={`w-full resize-y rounded-control bg-transparent p-2 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-[0.75rem] text-ink-muted">{t('readingCoach.pasteLanguageHint')}</p>
                <button
                  type="button"
                  onClick={useOwnText}
                  disabled={!pasteDraft.trim()}
                  className={`rounded-control bg-accent px-3.5 py-1.5 text-[0.75rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  {t('readingCoach.useThisTextButton')}
                </button>
              </div>
            </div>
          )}

          {/* Passage gets its own visually-separated box (task #195,
              2026-08-15 — matches the reference page's own distinctly-
              tinted passage area). Deliberately `bg-cream` (the app's
              own PAGE background token), not `bg-accent-tint` — the
              word-highlight system below already uses `bg-accent-tint/40`
              for the "tentative" state, so wrapping it in a box of that
              SAME color would make that highlight nearly invisible
              against its own-colored parent; `bg-cream` gives the same
              "distinct box" separation from the surrounding white card
              without colliding with the highlight colors. */}
          <div className="mb-5 rounded-control bg-cream p-4">
            <p dir={isRtl ? 'rtl' : 'ltr'} className="text-[1.0625rem] leading-relaxed text-ink">
              {expectedWords.map((word, i) => {
                // Confirmed (a FINAL result committed it) gets the solid
                // fill; tentative (English-only, a still-changing interim
                // result reached this far but hasn't been finalized yet)
                // gets a lighter tint — live-feeling without reporting an
                // unconfirmed guess as real progress (matchedCount, the
                // actual metric, only ever advances on a final result).
                //
                // P0 contrast fix (nibras-qa, 2026-08-14): confirmed used
                // to be `bg-accent-tint text-accent-ink` — white text
                // (--color-accent-ink) on a near-white tint
                // (--color-accent-tint, #f3f3f4), ~1.1:1, effectively
                // invisible. `text-accent-ink` is correct and unchanged
                // (it's the SAME white the mic button below already pairs
                // with `bg-accent`, by design) — only the confirmed
                // BACKGROUND moves to the solid `bg-accent` (#004aad),
                // giving white-on-blue at 8.1:1 (verified via the WCAG
                // relative-luminance formula against this project's own
                // index.css tokens, not assumed). Do not swap this back to
                // `bg-accent-tint` — that near-white tint was never meant
                // to carry white text; it only works with a DARK
                // foreground (see `text-accent` usage elsewhere, e.g. the
                // mode badge above) — and, since task #195, is doubly
                // wrong now: the surrounding passage BOX is `bg-cream`,
                // not `bg-accent-tint`, but a future accent-tint reader
                // would still contrast poorly against ink text either way.
                const confirmed = i < matchedCount
                const tentative = !confirmed && i < liveIndex
                return (
                  <span key={i}>
                    <button
                      type="button"
                      onClick={() => speakWord(word)}
                      aria-label={t('readingCoach.hearWordLabel', { word })}
                      className={`rounded px-0.5 ${focusRingInset} ${
                        confirmed
                          ? 'bg-accent text-accent-ink'
                          : tentative
                            ? 'bg-accent-tint/40'
                            : 'hover:bg-ink/5'
                      }`}
                    >
                      {word}
                    </button>{' '}
                  </span>
                )
              })}
            </p>
          </div>

          {/* Sound-help discoverability hint — the word-tap-to-hear
              affordance above is the PRIMARY interaction whenever
              listening is unavailable (Arabic deferred, OR English on a
              browser that can't prove on-device — same generic string
              either way), so it gets an explicit visible hint here; the
              full listening state below doesn't need one, tapping a
              word during an active session is already a secondary/
              optional action. */}
          {!listeningAvailable && (
            <p className="mb-1 text-[0.8125rem] text-ink-muted">{t('readingCoach.tapWordHint')}</p>
          )}

          {listeningAvailable && (
            <div className="flex flex-col items-center gap-3 border-t border-line pt-5">
              <button
                type="button"
                onClick={handleMicButtonClickGated}
                aria-pressed={sessionState === 'listening'}
                // Arabic's own 'transcribing' phase (the ONE recorded
                // clip is uploading, nothing left to stop) disables the
                // button rather than silently no-op'ing it on click
                // (handleMicButtonClick already ignores a click in this
                // state — this keeps the disabled control honestly
                // reflected in the UI/for assistive tech too, not just
                // enforced in the click handler).
                disabled={sessionState === 'transcribing'}
                aria-label={
                  sessionState === 'listening' || sessionState === 'loading-model'
                    ? t('readingCoach.stopListening')
                    : sessionState === 'transcribing'
                      ? t('readingCoach.transcribing')
                      : t('readingCoach.startListening')
                }
                className={`flex size-16 items-center justify-center rounded-full text-accent-ink transition-colors ${focusRing} ${
                  sessionState === 'listening'
                    ? 'bg-accent-active'
                    : sessionState === 'transcribing'
                      ? 'cursor-not-allowed bg-accent/60'
                      : 'bg-accent hover:bg-accent-hover active:bg-accent-active'
                }`}
              >
                <MicrophoneIcon className="size-7" />
              </button>
              <p role="status" aria-live="polite" className="text-[0.8125rem] font-medium text-ink-muted">
                {statusText}
              </p>
              {/* Progress dots (spec's described affordance) — mirror the
                  Mind Maps generator's established motion-safe pattern. */}
              {sessionState === 'listening' && (
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 rounded-full bg-accent motion-safe:animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              )}
              {/* readingCoach.micUnavailable's own copy claims "on-device"
                  specifically (accurate for English's SpeechRecognition
                  path) — wrong/misleading for Arabic's own MediaRecorder
                  path, which was never on-device, so Arabic gets its own
                  honest wording for the same (very rare — MediaRecorder
                  is a long-stable API, unlike English's still-
                  experimental on-device check) unsupported-browser case. */}
              {micUnavailable && (
                <p className="text-[0.8125rem] text-ink-muted">
                  {t(lang === 'ar' ? 'readingCoach.micUnavailableArabic' : 'readingCoach.micUnavailable')}
                </p>
              )}
              {hasMicError && <p className="text-[0.8125rem] text-ink-muted">{t('readingCoach.micError')}</p>}
              {arabicSttError === 'tokenCap' && (
                <p className="text-[0.8125rem] text-ink-muted">{t('readingCoach.limitReachedTokenCap')}</p>
              )}
              {arabicSttError === 'globalCap' && (
                <p className="text-[0.8125rem] text-ink-muted">{t('readingCoach.limitReachedGlobalCap')}</p>
              )}
              {arabicSttError === 'failed' && <p className="text-[0.8125rem] text-ink-muted">{t('readingCoach.transcribeFailed')}</p>}

              {/* "Delete & start over" (task #217, Amal's exact bilingual
                  copy) — shown once there's actually something to clear
                  (an active/finished session, OR leftover progress still
                  on screen after a manual stop — stopSession() itself
                  never clears matchedCount, only this does). min-h-11
                  (44px) is a deliberately LARGER target than this app's
                  usual 24px WCAG 2.5.8 AA floor, per team-lead's own
                  explicit ask for this specific control. Honest scope:
                  clears the on-device session only (matched/live/wpm/
                  elapsed, back to idle) — never touches streak/Today's
                  wins (real history, same as a plain stop already
                  doesn't), never claims to reach the AI service (that
                  provider's own 30-day auto-delete is covered by the
                  separate consent copy, not this button). */}
              {(sessionState !== 'idle' || matchedCount > 0) && (
                <button
                  type="button"
                  onClick={startOver}
                  className={`flex min-h-11 items-center gap-1.5 rounded-control border-[1.5px] border-line-strong px-3.5 text-[0.8125rem] font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
                >
                  <TrashIcon className="size-4" />
                  {t('readingCoach.deleteStartOverButton')}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* `self-start xl:self-auto` (2026-08-18, team-lead follow-up on
          #203's AR-parity void note): below `xl:` the grid is a SINGLE
          column, `<section>`/`<aside>` each get their own implicit row,
          and `<main>`'s own `flex-1` (from its flex ancestor) can leave
          the grid container taller than `section`+`aside`'s combined
          natural height — CSS Grid's `align-items:normal` resolves to
          `stretch` (unlike Flexbox, where it's `flex-start`), so with NO
          explicit `align-self` here the aside's row absorbed 100% of
          that leftover space, same mechanism documented at #203's first
          landing. `self-start` overrides that: this grid item sizes to
          its own content and top-aligns within its row, so on mobile/
          tablet the cards sit directly against the passage with no
          trailing void, regardless of viewport height (verified at
          390x700, 390x844, 390x1400 — no gap in any direction at any of
          them, task #203 follow-up, 2026-08-18). `xl:self-auto` restores
          the ORIGINAL (unset) behavior at `xl:`+ specifically, where
          `section`/`aside` share a single 2-column ROW and the
          stretch-to-match-height look is the intended, established
          desktop pattern (matches the aside's own bordered cards
          reaching the same visual bottom edge as the passage column) —
          do not remove the `xl:` override, that would flatten the
          desktop column-matching too. */}
      <aside className="flex flex-col gap-4 self-start xl:self-auto">
        {listeningAvailable ? (
          <>
            {/* Distinct accent-tinted background (task #195, 2026-08-15
                — matches the reference page's own visually-featured
                first card in this column, via the SAME `bg-accent-tint
                border-accent` "featured" combo already used elsewhere
                in Nibras, e.g. MindMaps.tsx's active-state cards —
                rather than the reference's own off-palette peach/orange). */}
            <div className="rounded-control border-[1.5px] border-accent bg-accent-tint p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">{t('readingCoach.liveGuidanceTitle')}</h2>
              <p className="m-0 text-[0.8125rem] text-ink-muted">{t('readingCoach.liveGuidanceHint')}</p>
            </div>

            {/* Restructured (task #195, 2026-08-15) to match the reference
                page's own row-per-metric-with-bar layout — Words matched
                (our own pre-existing real metric, kept alongside the
                reference's own choices) + Pace, both real. Team-lead's
                own follow-up refinement (same day, after the audio
                team's Phase 1 pass): the reference's "Phonology
                accuracy %" / "Confidence" are NOT just held-empty, they
                are being DROPPED/replaced outright once Amal's real
                metric spec lands — so no tile is bound to either concept
                at all here (removed, not left as an empty placeholder;
                a placeholder would still imply these two specific
                concepts are the plan). Add whatever the confirmed
                replacement metrics turn out to be once that spec
                arrives — don't guess at them now. */}
            {/* Amal's CONFIRMED metric spec (2026-08-15, relayed by
                team-lead after the audio team's Phase 1 pass) — Words
                read, Pace, Time read, all real, all start at 0/empty and
                fill only from this actual reading session. */}
            <div className="rounded-control border-[1.5px] border-line-strong bg-card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">{t('readingCoach.sessionPulseTitle')}</h2>
              <div className="flex flex-col gap-3">
                <SessionPulseRow
                  label={t('readingCoach.wordsMatchedLabel')}
                  value={`${matchedCount}/${expectedWords.length}`}
                  fillPercent={expectedWords.length > 0 ? (matchedCount / expectedWords.length) * 100 : 0}
                  showBar
                />
                <SessionPulseRow
                  label={t('readingCoach.paceLabel')}
                  value={wpm !== null ? String(wpm) : t('readingCoach.metricPending')}
                  pending={wpm === null}
                />
                <SessionPulseRow
                  label={t('readingCoach.timeReadLabel')}
                  value={elapsedSeconds !== null ? formatElapsed(elapsedSeconds) : t('readingCoach.metricPending')}
                  pending={elapsedSeconds === null}
                />
              </div>
            </div>

            {/* Today's wins — day-cumulative REAL metrics (task #201,
                2026-08-15, Amal's confirmed Option A). All three are real
                and on-device, zero on a fresh device, and fill only from
                actual reading sessions today:
                  - "Words read today": day-bucketed sum of matched words
                    across today's sessions — distinct from Session Pulse's
                    per-session "Words read" (the "today" label carries the
                    distinction).
                  - "Passages read today": count of completed passages
                    today. Replaces the old "Lines read today", which had
                    no honest definition on a single flowing paragraph
                    (recognition tracks words, not lines) — Amal's call.
                  - "Reading streak": unchanged real localStorage logic;
                    "Day 1" on a fresh device. */}
            <div className="rounded-control border-[1.5px] border-line-strong bg-card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">{t('readingCoach.todaysWinsTitle')}</h2>
              <div className="flex flex-col gap-3">
                <SessionPulseRow label={t('readingCoach.wordsReadTodayLabel')} value={String(daily.wordsRead)} />
                <SessionPulseRow label={t('readingCoach.passagesReadTodayLabel')} value={String(daily.passagesRead)} />
                <SessionPulseRow
                  label={t('readingCoach.streakLabel')}
                  value={t('readingCoach.streakCount', { count: streak })}
                />
              </div>
            </div>

            {/* "Begin session" — task #195: the reference page has this
                as a SEPARATE primary CTA below the aside cards, in
                addition to its own circular mic icon. Rather than
                inventing a second, different mechanism, this wires to
                the EXACT SAME real start/stop action as the mic button
                (handleMicButtonClick) — a second honest entry point to
                one real action, not a decorative duplicate. */}
            <button
              type="button"
              onClick={handleMicButtonClickGated}
              disabled={sessionState === 'transcribing'}
              className={`flex items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-semibold text-accent-ink transition-colors ${focusRing} ${
                sessionState === 'listening'
                  ? 'bg-accent-active'
                  : sessionState === 'transcribing'
                    ? 'cursor-not-allowed bg-accent/60'
                    : 'bg-accent hover:bg-accent-hover active:bg-accent-active'
              }`}
            >
              <MicrophoneIcon className="size-4" />
              {sessionState === 'listening' || sessionState === 'loading-model'
                ? t('readingCoach.stopListening')
                : sessionState === 'transcribing'
                  ? t('readingCoach.transcribing')
                  : t('readingCoach.beginSession')}
            </button>
          </>
        ) : lang === 'en' && englishOnDeviceSupported === 'checking' ? (
          // Genuinely don't know yet (nibras-qa P2, 2026-08-14) —
          // confirmed via a real timeline-logging Playwright run that
          // rendering the "unsupported" card here unconditionally made
          // it VISIBLE for ~360ms on every load in fully-supported
          // Chrome, before flipping to the real mic UI once the async
          // check resolved. Render nothing rather than a claim that
          // might be wrong a moment later — a brief empty aside is a
          // much smaller cost than a false "not available" flash.
          null
        ) : lang === 'en' ? (
          // English, and NOW definitively confirmed unsupported (not
          // just "still checking") — this browser can't prove an
          // on-device session (no `.available()`, or a live check came
          // back anything other than usable). A genuinely different
          // reason than Arabic's own deferred-by-choice state below, so
          // it gets its own honest copy rather than reusing (and
          // misnaming) the Arabic-specific "coming soon" text. EN-only
          // key — this branch can only render while the UI itself is in
          // English (`lang` mirrors `i18n.language` 1:1), so no AR
          // translation is needed.
          <div className="rounded-control border-[1.5px] border-line-strong bg-card p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">{t('readingCoach.listeningUnsupportedTitle')}</h2>
            <p className="m-0 text-[0.8125rem] text-ink-muted">{t('readingCoach.listeningUnsupportedBody')}</p>
          </div>
        ) : (
          // Arabic, listening deferred — none of the 3 English metric
          // cards above apply (nothing real to measure without a
          // listening session), so two honest cards replace them instead
          // of an always-empty streak/session-pulse that would imply a
          // mechanism that doesn't exist yet (task #203 P1-2, AR parity
          // fill, 2026-08-15, copy blessed by nibras-ar): card 1 explains
          // what the AR experience DOES today (read-aloud + tap-word —
          // this is also where the pill's own former long instruction
          // text moved, once P2-3 shortened the pill to a bare label);
          // card 2 (unchanged position, TRIMMED body) says what's coming.
          // nibras-ar specifically caught that the pre-#203 card 2 body
          // duplicated card 1's own "reads aloud + tap word" description
          // — the two cards are now complementary (how it works now /
          // what's coming), not overlapping. Card 1 gets the SAME
          // accent-featured treatment as the English branch's own first
          // card (`liveGuidanceTitle`, above) — same role (the primary
          // "how this works" orientation card), same visual language.
          <>
            <div className="rounded-control border-[1.5px] border-accent bg-accent-tint p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">{t('readingCoach.arabicGuidanceTitle')}</h2>
              <p className="m-0 text-[0.8125rem] text-ink-muted">{t('readingCoach.arabicGuidanceLine1')}</p>
              <p className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('readingCoach.arabicGuidanceLine2')}</p>
            </div>
            <div className="rounded-control border-[1.5px] border-line-strong bg-card p-4">
              <h2 className="mb-2 text-sm font-bold text-ink">{t('readingCoach.arabicListeningComingTitle')}</h2>
              <p className="m-0 text-[0.8125rem] text-ink-muted">{t('readingCoach.arabicListeningComingBody')}</p>
            </div>
          </>
        )}

        {/* "the listening coach itself is fully real and on-device" is
            only TRUE when this session actually has one (English, or
            Arabic if the deferred flag is ever flipped back on) — while
            Arabic is deferred there is no listening coach at all here,
            just the same plain "Demo voice" badge every other read-aloud
            surface already uses (techniques.demoVoiceBadge etc.), so
            this never overclaims for the language that doesn't have it. */}
        {!isAiBackendConfigured() && (
          <p className="text-[0.75rem] text-ink-muted">
            {t(listeningAvailable ? 'readingCoach.demoVoiceBadge' : 'readingCoach.demoVoiceBadgePlain')}
          </p>
        )}

        {/* AI-on, Arabic-only honest disclosure (team-lead's "lang-aware
            demoVoiceBadge fix", the same task as the consent gate above) —
            a genuinely DIFFERENT axis from the "Demo voice" badge above,
            which is silent for English precisely because there's nothing
            to disclose (on-device, always, regardless of backend state).
            Once the backend is live and Arabic listening actually turns
            on, that symmetry breaks: Arabic's mic audio now genuinely
            leaves the device (server /stt, see ArabicSttConsent.tsx's own
            header). The one-time consent dialog covers the FIRST
            recording; this ambient line keeps the same fact visible on
            every later visit too, not just the one moment consent was
            granted — same "don't let a true disclosure fade into a single
            forgotten dialog" reasoning the access-code gate (#219) already
            applies elsewhere. English needs no equivalent line at any
            backend state, so this never touches its branch above. */}
        {isAiBackendConfigured() && lang === 'ar' && listeningAvailable && (
          <p className="text-[0.75rem] text-ink-muted">{t('readingCoach.arabicSttDisclosure')}</p>
        )}
      </aside>

      {consentOpen && <ArabicSttConsent onAgree={agreeToArabicStt} onDecline={() => setConsentOpen(false)} />}
    </main>
  )
}
