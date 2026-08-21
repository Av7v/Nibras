import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAiBackendConfigured, synthesizeVoice, type SynthesizeVoiceResult } from '../../lib/aiService'
import { speak, stopSpeaking, type VoiceGender } from '../../lib/textToSpeech'
import { useSpeechVoices } from '../../hooks/useSpeechVoices'
import { useVoicePreference } from '../../hooks/useVoicePreference'
import { VOICE_RATES } from '../../lib/readingSettings'
import { CloseIcon } from '../icons'
import { ToggleField } from './SettingsFields'
import { SpeedField } from '../VoiceControls'
import { focusRing, focusRingInset } from '../../lib/focus'

type Phase = 'inhale' | 'exhale'

// Inhale 4s -> exhale 6s, no holds (~6 breaths/min) — the slow-breathing
// range the spec's evidence review supports; see
// ~/Desktop/AI/research/nibras/design/calm-space-spec.md §4b/§9.
const PHASE_SECONDS: Record<Phase, number> = { inhale: 4, exhale: 6 }

// Calm, unhurried pacing for the OPTIONAL spoken voice (2026-08-13,
// synthesized build brief from both voice specialists) — deliberately
// slower/lower than this app's other read-aloud features (Techniques/
// Reading Buddy/Guide all use the neutral rate 1 / pitch 1). Voice 1
// (male-mapped) gets a slightly higher pitch than Voice 2 (female-
// mapped, the default) so it doesn't read as gloomy at this slow a
// rate+pitch combination — a deliberate asymmetry from the spec, not
// an oversight.
const INTRO_RATE = 0.85
const CUE_RATE = 0.8
const PITCH_BY_GENDER: Record<VoiceGender, number> = { female: 0.9, male: 0.95 }

/**
 * «سُكون» / "Calmness" — an optional, non-clinical comfort overlay: a
 * settle line + a user-initiated slow-breathing pacer. Built to the
 * approved spec at
 * ~/Desktop/AI/research/nibras/design/calm-space-spec.md (named "Calm
 * Space" there; renamed to «سُكون»/"Stillness" 2026-08-13 after Amal
 * saw it live, then the ENGLISH half renamed again the same day to
 * "Calmness" — «سُكون» itself never changed, only its English name,
 * twice — values-only both times, the spec's own mechanism/structure
 * is unchanged, and the internal filename/component export
 * deliberately kept as CalmSpace so neither rename ripples into every
 * import site for a naming change). No data, no storage — purely
 * local component state, closes with everything forgotten (matches
 * the spec's §7: "None required").
 *
 * ONE timer drives `phase` and `secondsLeft` TOGETHER, as a single
 * combined state update per tick (spec's own requirement) — so the
 * screen-reader-announced phase word and the reduced-motion numeric
 * countdown can never drift apart, not even for one intermediate
 * render. The motion-safe circle's scale is a pure CSS transition
 * keyed off `phase` (not a second, independently-timed animation
 * loop) — same reason, and it makes Pause trivial: stopping the timer
 * is the whole mechanism, there's no separate animation clock to also
 * stop or resync.
 *
 * Reduced-motion (§4b/§5): the circle never changes size (no
 * `motion-safe:` class ever applies its scale/transition, so a
 * reduced-motion user's circle just sits at its authored full size);
 * guidance becomes the aria-live phase word plus an aria-hidden
 * (deliberately NOT separately announced every second — would be
 * chatty) numeric countdown, shown only under `motion-reduce:`.
 *
 * OPTIONAL VOICE LAYER (2026-08-13, task #93, synthesized brief from
 * both voice specialists): an entirely separate, additive channel —
 * default OFF (same "no unprompted change" posture as the Reading
 * Ruler), reusing the EXACT SAME read-aloud path as Techniques/Reading
 * Buddy/the Guide (lib/textToSpeech.ts's speak(), lib/aiService.ts's
 * synthesizeVoice seam, hooks/useSpeechVoices.ts's REACTIVE voice
 * list) rather than any parallel mechanism. Voice 1/Voice 2 reuse
 * Reading Buddy's own gender-mapped voice picker verbatim (same keys,
 * same `findVoice(lang, gender)` path, same default Voice 2). Kept
 * independent of `prefers-reduced-motion` on purpose — voice is the
 * EYES-FREE channel, so it must keep working (or not) purely based on
 * whether a voice exists for the language, never based on a motion
 * preference that has nothing to do with hearing.
 *
 * Sequencing on a fresh Begin (voice on): the settle intro
 * (`calm.settleSpoken` — a variant of the on-screen `calm.settle` that
 * says "breathe together" instead of "follow the circle", since with
 * eyes closed there's no circle to follow) speaks ONCE, then ~1s
 * later the pacer actually starts. Per-phase cues speak once at the
 * START of each phase, then silence for the rest of it — the silence
 * IS the breathing, this never counts seconds aloud (unless "count
 * with me", task #136, is on — see that toggle's own comment below).
 * Spoken cues use their own fully-diacritized `calm.inhaleHintSpoken`/
 * `exhaleHintSpoken` keys (task #136) — SAME WORDS as the on-screen
 * `calm.inhaleHint`/`exhaleHint`, only تشكيل weight differs; see
 * teamlead/calm-cue-wording-136.md for the full linguistic rationale.
 * The cue fires from a useEffect keyed on `pace.phase` (+ running +
 * voiceEnabled) — deliberately NOT from inside the setPace functional
 * updater above, because React 18 Strict Mode double-invokes updater
 * functions (harmless for a pure state calculation, but would speak
 * every cue twice) — the SAME external trigger that already updates
 * the on-screen شهيق/زفير phase word, so voice/circle/label can never
 * drift apart.
 */
export function CalmSpace({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
  const [hasStarted, setHasStarted] = useState(false)
  const [running, setRunning] = useState(false)
  const [pace, setPace] = useState<{ phase: Phase; secondsLeft: number }>({
    phase: 'inhale',
    secondsLeft: PHASE_SECONDS.inhale,
  })
  const [breathCount, setBreathCount] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  // Task #136 — optional, OFF-by-default "count with me": the per-
  // phase cue speaks a paced count instead of the plain hint. Session-
  // only, deliberately NOT persisted (unlike voiceRate) — matches
  // `voiceEnabled` itself, the most directly-analogous existing
  // setting on this same surface (both are opt-in toggles gating an
  // optional audio behavior, both reset on a fresh open; only the
  // RATE preference persists, per #127's own explicit ask).
  const [countEnabled, setCountEnabled] = useState(false)
  // Task #127 — a speed MULTIPLIER on top of the calm baseline rates
  // (INTRO_RATE/CUE_RATE below), not a replacement — the default
  // multiplier (1×, VOICE_RATES' own middle value) reproduces today's
  // EXACT calm pacing unchanged; a reader who wants it faster/slower
  // still gets the same intro-vs-cue relative difference the spec's
  // own pacing was tuned for, just scaled. Shares the ONE persisted
  // rate preference every other #127 surface uses. Task #145 — gender
  // now shares that SAME global preference too (was local state here,
  // matching how every other surface started out).
  const { gender, setGender, rate: voiceRate, setRate: setVoiceRate } = useVoicePreference()
  // True only during the one-time settle intro on a fresh Begin — the
  // primary button reads "Begin" (disabled, so it can't be double-
  // clicked) rather than jumping straight to "Resume" before the pacer
  // has genuinely started.
  const [introPlaying, setIntroPlaying] = useState(false)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const beginButtonRef = useRef<HTMLButtonElement | null>(null)

  // Reactive (see hooks/useSpeechVoices.ts's own doc comment — this is
  // the exact mechanism that fixed the P0-1 cold-load bug elsewhere;
  // reused here, not reimplemented, so this can't regress it).
  const { hasVoiceFor, hasGenderChoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  const genderChoiceAvailable = voiceEnabled && hasGenderChoiceFor(lang)

  // Focus into the dialog on open (WAI-ARIA APG: the Begin button, the
  // dialog's primary action) — the parent (Reader.tsx) owns returning
  // focus to the trigger on close, since it owns that button.
  useEffect(() => {
    beginButtonRef.current?.focus()
  }, [])

  function handleClose() {
    // Pause / Done / close / unmount must all stop any in-progress
    // speech (spec requirement) — routing every close path through
    // this one function, rather than calling the raw onClose prop
    // directly from each handler, is what guarantees that.
    stopSpeaking()
    onClose()
  }

  // Esc closes; Tab/Shift+Tab traps focus inside the dialog while open.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A true modal shouldn't leave the page scrollable behind it.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // Defensive unmount cleanup, independent of handleClose — covers any
  // path that unmounts this component without going through it (there
  // shouldn't be one today, but this costs nothing and matches the
  // same idiom already used in hooks/useSpeakingController.ts).
  useEffect(() => stopSpeaking, [])

  // The one state-machine timer (spec §4b) — ticks once/sec, advancing
  // secondsLeft and flipping phase (with its own new duration) the
  // instant the current phase's time is up, both in ONE state update
  // so they're never inconsistent even for a single render. Only runs
  // while `running`; pausing just stops this effect, and `pace` holds
  // exactly where it was for Resume to continue from.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setPace((prev) => {
        if (prev.secondsLeft > 1) {
          return { phase: prev.phase, secondsLeft: prev.secondsLeft - 1 }
        }
        const nextPhase: Phase = prev.phase === 'inhale' ? 'exhale' : 'inhale'
        return { phase: nextPhase, secondsLeft: PHASE_SECONDS[nextPhase] }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  // Breath counter — a completed breath = a full inhale, then exhale.
  // Fires from the SAME external-trigger pattern as the spoken cue
  // effect just below (keyed on pace.phase, not called from inside
  // setPace's own functional updater above) for the identical reason:
  // React 18 Strict Mode double-invokes a functional updater passed to
  // setState (harmless for a pure calculation, but calling a SECOND
  // setState — setBreathCount — from inside one is a side effect that
  // would double-count every breath in dev). prevPhaseRef distinguishes
  // a genuine exhale->inhale TRANSITION from merely re-running because
  // `running` changed (e.g. Resume, where `phase` is unchanged from
  // before the pause) — without it, resuming mid-inhale would
  // over-count.
  const prevPhaseRef = useRef<Phase>(pace.phase)
  useEffect(() => {
    if (running && pace.phase === 'inhale' && prevPhaseRef.current === 'exhale') {
      setBreathCount((c) => c + 1)
    }
    prevPhaseRef.current = pace.phase
  }, [pace.phase, running])

  // The per-phase spoken cue — fires from the SAME external trigger
  // that already drives the on-screen phase word (pace.phase), not
  // from inside setPace's own functional updater above (React 18
  // Strict Mode double-invokes a functional updater, which is
  // harmless for a pure calculation but would speak every cue twice —
  // this effect runs exactly once per real phase change instead).
  // Speaks ONCE per phase, then goes silent for the rest of it — the
  // silence IS the breathing, never counts seconds aloud.
  useEffect(() => {
    if (!running || !voiceEnabled || !voiceAvailable) return
    // Task #136 — the SPOKEN cue now uses its own fully-diacritized
    // `…Spoken` key (never the light `…Hint` key the screen shows —
    // words match, only تشكيل weight differs; see nibras-ar's own
    // spec at teamlead/calm-cue-wording-136.md). When "count with me"
    // is on, the count variant replaces it entirely rather than
    // layering on top — the numbers themselves supply the pacing the
    // plain cue's «ببطء وهدوء» would otherwise provide, so saying both
    // would be redundant. The on-screen `phaseHint` below is
    // deliberately UNCHANGED by `countEnabled` either way — counting
    // is an audio-only enhancement, not a different visual state, so
    // the calm guidance on screen stays identical whether or not
    // voice/count are on (matters for anyone reading with voice off).
    const cueText = countEnabled
      ? pace.phase === 'inhale'
        ? t('calm.inhaleCount')
        : t('calm.exhaleCount')
      : pace.phase === 'inhale'
        ? t('calm.inhaleHintSpoken')
        : t('calm.exhaleHintSpoken')
    void speakCalm(cueText, CUE_RATE * voiceRate)
    // `voiceRate` deliberately NOT in the deps array (task #127) — the
    // effect still reads its latest value every time it DOES run (a
    // fresh closure every render), so a speed change smoothly takes
    // effect from the NEXT phase transition onward; it just doesn't
    // immediately re-speak the CURRENT phase's cue the instant the
    // speed pill is clicked. Deliberately different from Reading
    // Buddy's own "changing rate restarts immediately" convention —
    // an abrupt mid-breath restart is the wrong feel for this
    // specifically calm, unhurried surface. `countEnabled` (task #136)
    // gets the exact same deliberate exclusion, for the exact same
    // reason — toggling mid-breath switches from the NEXT cue, not an
    // abrupt restart of the one currently playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace.phase, running, voiceEnabled])

  // Shared speak path for both the intro and the per-phase cues — goes
  // through the SAME aiService seam Reading Buddy uses (browser voice
  // today via lib/textToSpeech.ts's speak(); a real neural voice later
  // once an AI backend is configured, with zero changes needed here).
  async function speakCalm(text: string, rate: number, opts?: { onEnd?: () => void; onError?: () => void }) {
    let result: SynthesizeVoiceResult
    try {
      result = await synthesizeVoice({ text, lang, gender, rate, pitch: PITCH_BY_GENDER[gender] })
    } catch {
      // Task #219: synthesizeVoice now RE-THROWS an access-code/spend-
      // cap problem instead of silently degrading to browser voice (the
      // whole point of the fix — those are meaningful states, not a
      // flaky-backend moment). سُكون's own voice is already a fully
      // optional layer over a silent, fully-functional breathing pacer
      // (see `voiceEnabled`) — a missing/invalid code is already
      // surfaced by the globally-mounted <AccessGate>, and a spent
      // session budget just means this ONE cue stays silent, same
      // graceful degradation `opts?.onError?.()` already provides for a
      // flaky real-backend call below. Adding a SECOND, dedicated error
      // message to this deliberately minimal, calming surface would be
      // disproportionate for what the reader can already tell (the
      // voice cue simply didn't play) — unlike Reading Buddy's own
      // PRIMARY play controls, which do show one (ReadingBuddyPlayer.tsx/
      // ReadingBuddy.tsx).
      opts?.onError?.()
      return
    }
    if (result.mode === 'browser') {
      const started = speak(text, lang, { gender, rate, pitch: PITCH_BY_GENDER[gender], onEnd: opts?.onEnd, onError: opts?.onError })
      if (!started) opts?.onError?.()
      return
    }
    // 'audio' mode (a real backend configured) has no rate/pitch to
    // apply client-side — a pre-rendered file's tone is already fixed
    // server-side. Not reachable today (no backend exists yet); the
    // onEnd/onError callbacks still matter once it is, so the intro ->
    // pacer sequencing keeps working the same way either path resolves.
    const audio = new Audio(result.url)
    audio.onended = () => opts?.onEnd?.()
    audio.onerror = () => opts?.onError?.()
    audio.play().catch(() => opts?.onError?.())
  }

  function toggleRunning() {
    if (running) {
      stopSpeaking()
      setRunning(false)
      return
    }
    if (!hasStarted) {
      // First-ever Begin. With voice on (and actually available): speak
      // the settle intro once, THEN start the pacer ~1s after it ends
      // — never overlapping the intro with the first phase's own cue.
      // Voice off (or unavailable): unchanged original behavior, starts
      // immediately.
      setHasStarted(true)
      if (voiceEnabled && voiceAvailable) {
        setIntroPlaying(true)
        void speakCalm(t('calm.settleSpoken'), INTRO_RATE * voiceRate, {
          onEnd: () => window.setTimeout(() => {
            setIntroPlaying(false)
            setRunning(true)
          }, 1000),
          // Don't strand the reader on a silent, permanently-disabled
          // Begin button if speech itself fails for any reason — start
          // the (silent) pacer anyway rather than getting stuck.
          onError: () => {
            setIntroPlaying(false)
            setRunning(true)
          },
        })
        return
      }
      setRunning(true)
      return
    }
    // Resume from a pause — no intro replay (spec: "Read the intro
    // ONCE"), the per-phase cue effect above picks back up on its own.
    setRunning(true)
  }

  // Only while actively running does the circle target its "full"
  // breath size during inhale; every other moment (exhale, or not
  // running at all — never started yet, or paused) it settles back to
  // its small resting size. A short 400ms settle for pause/idle vs.
  // the real 4s/6s breathing durations while running.
  const isFullSize = running && pace.phase === 'inhale'
  const durationClass = !running
    ? 'motion-safe:duration-[400ms]'
    : pace.phase === 'inhale'
      ? 'motion-safe:duration-[4000ms]'
      : 'motion-safe:duration-[6000ms]'

  const phaseLabel = pace.phase === 'inhale' ? t('calm.inhale') : t('calm.exhale')
  const phaseHint = pace.phase === 'inhale' ? t('calm.inhaleHint') : t('calm.exhaleHint')
  const primaryLabel = introPlaying ? t('calm.begin') : running ? t('calm.pause') : hasStarted ? t('calm.resume') : t('calm.begin')

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/45 p-4" onClick={handleClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calm-space-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[26rem] rounded-card border border-line bg-card p-6 text-center shadow-lg"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="size-8 flex-none" aria-hidden="true" />
          <h2 id="calm-space-title" className="m-0 flex-1 text-[1.25rem] font-bold text-ink">
            {t('calm.title')}
          </h2>
          <button
            type="button"
            aria-label={t('calm.close')}
            onClick={handleClose}
            className={`flex size-8 flex-none items-center justify-center rounded-control text-ink-muted hover:text-ink ${focusRingInset}`}
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {/* Added 2026-08-13 alongside the «سُكون»/"Stillness" rename —
            a short tagline under the title, plain reading-order text
            (no special aria wiring needed: a screen-reader user
            navigating into the dialog encounters it right after the
            title naturally, same as the settle line just below it). */}
        <p className="mb-4 text-[0.8125rem] text-ink-muted">{t('calm.subtitle')}</p>

        <p className="mb-4 text-[0.9375rem] leading-relaxed text-ink-muted">{t('calm.settle')}</p>

        {/* Optional voice layer (task #93) — default OFF, same posture
            as the Reading Ruler toggle it deliberately mirrors. Text-
            aligned start (not centered like the rest of this dialog)
            since it reads as a real settings control, not narrative
            copy. */}
        <div className="mb-2 text-start">
          <ToggleField
            id="calm-voice-toggle"
            label={t('calm.voiceToggle')}
            description={voiceAvailable ? t('calm.voiceToggleDescription') : t('techniques.noVoice')}
            ariaLabel={t('calm.voiceToggleAria')}
            checked={voiceEnabled && voiceAvailable}
            disabled={!voiceAvailable}
            onChange={setVoiceEnabled}
          />
          {genderChoiceAvailable && (
            <div
              role="group"
              aria-label={t('calm.voiceLabel')}
              className="mb-5 -mt-3 inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
            >
              <button
                type="button"
                aria-pressed={gender === 'male'}
                onClick={() => setGender('male')}
                className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
              >
                {t('readingBuddy.voice1')}
              </button>
              <button
                type="button"
                aria-pressed={gender === 'female'}
                onClick={() => setGender('female')}
                className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
              >
                {t('readingBuddy.voice2')}
              </button>
            </div>
          )}
          {/* Speed (task #127) — shown whenever voice is on+available,
              independent of genderChoiceAvailable (adjusting the speed
              of a single available voice is still meaningful with only
              one voice to choose from). Keeps CalmSpace's own calm
              default (multiplier 1x reproduces today's exact pacing)
              — see the INTRO_RATE/CUE_RATE multiplication above. */}
          {voiceEnabled && voiceAvailable && (
            <div className="mb-5 -mt-3 inline-block">
              <SpeedField legend={t('calm.speedLabel')} value={voiceRate} options={VOICE_RATES} onChange={setVoiceRate} />
            </div>
          )}
          {/* "Count with me" (task #136) — OFF by default, only offered
              once voice is already on+available (same gating as Speed
              above; counting is meaningless without a voice to count
              with). A second, independent ToggleField rather than a
              pill picker — this is a genuine binary on/off, matching
              the voice toggle's own control shape exactly, not a
              multi-option choice like Speed/Voice1-2. */}
          {voiceEnabled && voiceAvailable && (
            <div className="mb-2 -mt-3 text-start">
              <ToggleField
                id="calm-count-toggle"
                label={t('calm.countToggle')}
                description={t('calm.countToggleDescription')}
                ariaLabel={t('calm.countToggleAria')}
                checked={countEnabled}
                onChange={setCountEnabled}
              />
            </div>
          )}
          {voiceEnabled && voiceAvailable && !isAiBackendConfigured() && (
            <span className="mb-5 -mt-3 inline-flex rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
              {t('readingBuddy.demoVoiceBadge')}
            </span>
          )}
        </div>

        <div className="mb-6 flex flex-col items-center justify-center gap-3 py-2">
          <div className="relative flex size-32 items-center justify-center">
            {/* The scale itself — not just its transition — must be
                gated behind motion-safe: (a plain inline style would
                apply the size change to EVERY user regardless of
                their OS motion preference, just abruptly instead of
                smoothly, which is not what "does not scale — fixed
                size" means). With neither motion-safe:scale-* class
                active, a reduced-motion user's circle has no scale
                transform at all — sitting at its authored full size,
                constant, matching ReadingRuler.tsx's own
                base-state-is-the-correct-resting-state pattern. */}
            <div
              aria-hidden="true"
              className={`size-32 rounded-full bg-accent/15 motion-safe:transition-transform motion-safe:ease-in-out ${durationClass} ${isFullSize ? 'motion-safe:scale-100' : 'motion-safe:scale-[60%]'}`}
            />
          </div>
          <p aria-live="polite" className="m-0 text-[1.375rem] font-bold text-ink">
            {phaseLabel}
          </p>
          <p className="m-0 text-[0.8125rem] text-ink-muted">{phaseHint}</p>
          {/* Reduced-motion-only text guide (§4b/§5) — aria-hidden
              deliberately: announcing a number every second would be
              chatty; the phase word above is the one thing screen
              readers hear at each change. */}
          <p aria-hidden="true" className="m-0 hidden text-[1.5rem] font-bold text-ink tabular-nums motion-reduce:block">
            {pace.secondsLeft}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            ref={beginButtonRef}
            type="button"
            onClick={toggleRunning}
            disabled={introPlaying}
            className={`min-w-[7rem] rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            aria-label={t('calm.backToReading')}
            onClick={handleClose}
            className={`min-w-[7rem] rounded-control border-[1.5px] border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
          >
            {t('calm.done')}
          </button>
        </div>

        {breathCount > 0 && (
          <p className="mt-4 text-[0.8125rem] text-ink-muted tabular-nums">
            {t('calm.breathsCounter', { count: breathCount })}
          </p>
        )}
      </div>
    </div>
  )
}
