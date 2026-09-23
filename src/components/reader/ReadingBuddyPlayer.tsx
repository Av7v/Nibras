import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAiBackendConfigured, SpendCapError, synthesizeVoice, VoiceUnavailableError } from '../../lib/aiService'
import {
  pauseSpeaking,
  resumeSpeaking,
  speak,
  stopSpeaking,
  type SpeechLang,
  type VoiceGender,
} from '../../lib/textToSpeech'
import { useSpeechVoices } from '../../hooks/useSpeechVoices'
import { useVoicePreference } from '../../hooks/useVoicePreference'
// Task #361 — publish this player's REAL playback progress so the
// word-by-word reading ruler can highlight the word being spoken. The
// player is the single voice transport; the ruler is a pure subscriber
// (see lib/narrationProgress.ts) — no second, competing play button.
import {
  pauseNarration,
  reportNarrationBoundary,
  reportNarrationFraction,
  resumeNarration,
  startNarration,
  stopNarration,
} from '../../lib/narrationProgress'
import { VOICE_RATES } from '../../lib/readingSettings'
import { DownloadIcon, PauseIcon, PlayIcon, SpeakerIcon, SpinnerIcon } from '../icons'
import { focusRing, focusRingInset } from '../../lib/focus'
import { ComingSoonAction } from './ComingSoonAction'

// Task #145 — was this file's own local copy (Reading Buddy's markup
// pioneered the pattern #127 later extracted into VoiceControls.tsx,
// predating the shared lib/readingSettings.ts constant); consolidated
// onto the ONE shared source of truth rather than two hardcoded
// copies of the same 4 values risking drift.
const RATES = VOICE_RATES

/**
 * Reading Buddy — a player over the current reading text: play/pause,
 * speed, and a male/female voice choice (Amal's explicit ask). First
 * AI-feature slice built through the aiService seam (lib/aiService.ts)
 * — today this always resolves to the DEMO path (the browser's own
 * Web Speech voice, via lib/textToSpeech.ts), since no AI backend is
 * configured yet; once one is, the exact same UI drives a real neural
 * voice instead, with zero changes needed here — see synthesizeVoice's
 * mode branch below.
 *
 * Scope note: this is the play/pause/speed/voice player specifically
 * requested — synced word-highlighting and Arabic auto-diacritized
 * synthesis (the fuller "Reading Buddy" mechanism named in the
 * project's build order) are a later increment, not this one.
 *
 * Works on whatever text is currently shown (including the placeholder
 * sample text before anything's been opened) — Web Speech needs no
 * backend/key at all, so there's no reason to restrict it to the
 * example texts the way the AI Assistant/Mind Maps demos will be.
 */
export function ReadingBuddyPlayer({ text, lang }: { text: string; lang: SpeechLang }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'preparing' | 'playing' | 'paused'>('idle')
  // Task #145 (2026-08-14) — gender+rate now come from the ONE global,
  // persisted, live-reactive voice preference (was fully local state
  // here, per #127's own deliberate "Reading Buddy is zero-risk,
  // already-shipped — leave it alone" call at the time; #145 folds it
  // in per team-lead's explicit approval, since it shares files with
  // this same consolidation pass anyway).
  const { gender, setGender, rate, setRate } = useVoicePreference()
  const modeRef = useRef<'browser' | 'audio' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // #398 review P2 (2026-09-14) — guards the neural "preparing…" race:
  // synthesizeVoice() awaits a real network round-trip that can take a
  // few seconds, and nothing disables the rate/voice pills during that
  // window (only the big play button gets disabled), so a reader can
  // trigger a SECOND overlapping startPlayback() (a quick rate or voice
  // change) before the first one's await has resolved. Both calls would
  // otherwise write to the SAME audioRef element (src, ontimeupdate,
  // onended, onerror) and both would eventually call setStatus('playing')
  // — whichever one's await settles last "wins" regardless of which one
  // the reader actually meant, and the older element handlers can end up
  // clobbered mid-flight. See startPlayback's own comments for where
  // this is checked.
  const playbackAbortRef = useRef<AbortController | null>(null)
  // Task #219's honest error handling — 'accessCode' is only ever
  // transient (the globally-mounted <AccessGate> is the actual
  // "re-enter your code" UI; this local message just explains WHY
  // playback didn't start, since that dialog appearing elsewhere on
  // screen doesn't by itself say "and that's why the button did
  // nothing"). Neither spend-cap state has a separate global UI — this
  // IS the message for those cases, split by SpendCapError's own
  // `reason` (AI-on honesty pass, 2026-08-19, spec in
  // teamlead/ai-on-honesty-copy-spec.md): 'tokenCap' = this volunteer's
  // own per-code budget is spent, PERMANENT for the pilot (never says
  // "try again later" — that would be dishonest); 'globalCap' = the
  // shared service-wide backstop, genuinely TEMPORARY.
  const [voiceError, setVoiceError] = useState<'accessCode' | 'tokenCap' | 'globalCap' | 'unavailable' | null>(null)

  // Reactive (found broken 2026-08-13, nibras-qa P0-1): the browser's
  // voice list loads asynchronously, so a plain one-shot getVoices()
  // read at first render sees [] before `voiceschanged` has ever fired
  // — a cold /reader load showed no player + a false "not available in
  // this language" message, self-correcting only once something else
  // happened to trigger a later re-render. useSpeechVoices() subscribes
  // to voiceschanged and re-renders this component once the real list
  // arrives — same hook SpeakerButton.tsx already used correctly.
  const { hasVoiceFor, hasGenderChoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  const genderChoiceAvailable = hasGenderChoiceFor(lang)

  // Stop playback on unmount, and whenever the text being shown changes
  // (a new section/document) — never leave stale audio playing behind.
  useEffect(() => {
    return () => {
      stopSpeaking()
      audioRef.current?.pause()
      // Clear the word-highlight ruler's follow-along too — never leave
      // a word highlighted for text that's no longer being read (#361).
      stopNarration()
      // #398 review P2 — cancel any in-flight synthesizeVoice() too, so
      // a response that arrives after unmount/text-change never touches
      // this (now stale) closure's refs/state.
      playbackAbortRef.current?.abort()
    }
  }, [text])

  async function startPlayback(atRate: number, withGender: VoiceGender) {
    // #398 review P2 — a NEWER startPlayback() call (a rate/voice pill
    // tapped during the "preparing…" window, or a second Play press)
    // must win outright: cancel whatever the PREVIOUS call was waiting
    // on before starting this one, so its eventual settle (success or
    // error) is recognized as stale below and never overwrites state
    // this call now owns.
    playbackAbortRef.current?.abort()
    const controller = new AbortController()
    playbackAbortRef.current = controller
    setVoiceError(null)
    // Neural render takes a few seconds — show an honest "preparing…"
    // state (button disabled + busy) instead of a dead-looking button.
    if (isAiBackendConfigured()) setStatus('preparing')
    // #107 P1-a self-caught-in-review fix (2026-08-14): the 'audio'
    // (real backend) path was applying `atRate` TWICE — once server-
    // side (xAI genuinely renders the MP3 at the requested speed,
    // server/api/_xaiTts.ts:84-91) and again here via
    // audio.playbackRate, compounding to roughly atRate² (1.5×
    // requested sounded ~2.25×). Always request a NEUTRAL (1×) render
    // — audio.playbackRate below is then the ONLY place speed is ever
    // applied, matching what handleRateChange's own live-adjustment
    // branch already assumed was true. The 'browser' (Web Speech) path
    // is unaffected either way — it only ever applied `rate` once, to
    // the utterance itself, never doubled.
    let result: Awaited<ReturnType<typeof synthesizeVoice>>
    try {
      result = await synthesizeVoice({ text, lang, gender: withGender, rate: 1 }, controller.signal)
    } catch (err) {
      // A newer call already aborted this one — it's already driving
      // its own status/UI, so this stale continuation must stay silent
      // (no error flash, no status change) rather than fight it.
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Task #219: synthesizeVoice now RE-THROWS an access-code/spend-
      // cap problem instead of silently degrading to browser voice —
      // show the honest reason instead of leaving the play button
      // looking like it just silently did nothing.
      setVoiceError(
        err instanceof SpendCapError
          ? err.reason === 'global_cap_reached'
            ? 'globalCap'
            : 'tokenCap'
          : err instanceof VoiceUnavailableError
            ? 'unavailable'
            : 'accessCode',
      )
      setStatus('idle')
      return
    }
    // Resolved successfully, but a NEWER call may have superseded this
    // one in the meantime (it already aborted `controller` above) —
    // same "stay silent, the newer call owns playback now" rule.
    if (controller.signal.aborted) return
    modeRef.current = result.mode
    if (result.mode === 'browser') {
      const started = speak(text, lang, {
        gender: withGender,
        rate: atRate,
        onStart: () => {
          if (controller.signal.aborted) return
          setStatus('playing')
          // Word-by-word ruler: begin a fresh browser-voice follow-along.
          startNarration('browser')
        },
        // #361 — the engine's REAL per-word boundary drives the highlight
        // (true word-level timing on the engines Nibras targets), never a
        // guessed pace. `text` here is the SAME string the ruler renders,
        // so charIndex maps straight onto its words.
        onBoundary: (charIndex) => reportNarrationBoundary(charIndex),
        onEnd: () => {
          setStatus('idle')
          stopNarration()
        },
        onError: () => {
          setStatus('idle')
          stopNarration()
        },
      })
      if (!started) {
        setStatus('idle')
        stopNarration()
      }
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = result.url
    audio.playbackRate = atRate
    // #361 — the neural provider returns MP3 bytes with NO per-word
    // timestamps (server/api/_xaiTts.ts), so the word-by-word ruler can't
    // sync to true word boundaries here. Instead publish an HONEST
    // approximate pace derived from the REAL audio: playback position ÷
    // the audio's own duration. The ruler labels this as approximate for
    // the enhanced voice — never presented as exact per-word timing.
    audio.ontimeupdate = () => {
      if (audio.duration > 0 && Number.isFinite(audio.duration)) {
        reportNarrationFraction(audio.currentTime / audio.duration)
      }
    }
    audio.onended = () => {
      setStatus('idle')
      stopNarration()
    }
    audio.onerror = () => {
      setStatus('idle')
      stopNarration()
    }
    // Mark playing BEFORE play() so the first timeupdate isn't dropped by
    // the store's idle-guard; the catch clears it if playback is blocked.
    startNarration('neural')
    try {
      await audio.play()
      // #398 review P2 — the race this whole controller exists for: a
      // NEWER startPlayback() can abort us and take over audioRef's src/
      // handlers while THIS await was pending. Without this check, the
      // stale call would still stamp 'playing' over whatever state the
      // newer call has already reached.
      if (controller.signal.aborted) return
      setStatus('playing')
    } catch {
      if (controller.signal.aborted) return
      setStatus('idle')
      stopNarration()
    }
  }

  function handlePlayPause() {
    if (status === 'playing') {
      if (modeRef.current === 'browser') pauseSpeaking()
      else audioRef.current?.pause()
      setStatus('paused')
      // Freeze the ruler highlight on the current word (#361).
      pauseNarration()
      return
    }
    if (status === 'paused') {
      if (modeRef.current === 'browser') resumeSpeaking()
      else audioRef.current?.play()
      setStatus('playing')
      resumeNarration()
      return
    }
    startPlayback(rate, gender)
  }

  function handleRateChange(newRate: number) {
    setRate(newRate)
    if (status === 'idle') return
    if (modeRef.current === 'audio' && audioRef.current) {
      // Real audio-element playback rate can change live — no restart.
      audioRef.current.playbackRate = newRate
      return
    }
    // Web Speech has no live-rate API (see textToSpeech.ts's own
    // documented limitation) — restart at the new rate instead of a
    // silent no-op.
    startPlayback(newRate, gender)
  }

  function handleGenderChange(newGender: VoiceGender) {
    setGender(newGender)
    if (status === 'idle') return
    // A different voice fundamentally means a new utterance/audio
    // render either way — restart.
    startPlayback(rate, newGender)
  }

  // A small named heading (task #114, 2026-08-14 — Amal asked why
  // Reading Buddy wasn't inside the Reader and where it went, after
  // the sidebar/Dashboard entries that used to point here were
  // removed): before this, the player was just a row of icon buttons
  // with no label at all — easy to not recognize as a real, named
  // feature. h2 (task #371, 2026-09-13: moved OUT of the tinted
  // reading-view <article> to sit directly above it, on the page's own
  // background, so it follows the page/accent theme like Amal asked —
  // was h3 while nested inside the article, subordinate to that
  // article's own h2#reading-heading; now a sibling top-level section
  // of its own, same shape as AiAssistantPanel's own h2, so it needs
  // the same heading level that component already uses).
  const heading = (
    <h2 id="reading-buddy-heading" className="mb-1.5 flex items-center gap-2 text-sm font-bold text-ink">
      <SpeakerIcon className="size-[18px] text-accent" />
      {t('dashboard.navReadingBuddy')}
    </h2>
  )

  if (!voiceAvailable) {
    return (
      <section aria-labelledby="reading-buddy-heading" className="mb-4">
        {heading}
        <p className="m-0 text-[0.8125rem] text-ink-muted">{t('techniques.noVoice')}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="reading-buddy-heading" className="mb-4">
      {heading}
      <p className="mb-2 text-[0.8125rem] text-ink-muted">{t('readingBuddy.discoverabilityHint')}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-card px-3.5 py-2.5">
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={status === 'preparing'}
        aria-pressed={status === 'playing'}
        aria-busy={status === 'preparing'}
        aria-label={status === 'preparing' ? t('techniques.preparing') : status === 'playing' ? t('readingBuddy.pause') : t('readingBuddy.play')}
        className={`flex size-9 flex-none items-center justify-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active ${status === 'preparing' ? 'cursor-progress' : ''} ${focusRing}`}
      >
        {status === 'preparing' ? (
          // Distinct broken-ring spinner (not the play triangle it used
          // to dim) so the state reads as "working", never "nothing
          // happened" — reduce-motion sees a static broken ring. The
          // visible label beside it makes it unmistakable (#252 fix).
          <SpinnerIcon className="size-4 motion-safe:animate-spin" />
        ) : status === 'playing' ? (
          <PauseIcon className="size-4" />
        ) : (
          <PlayIcon className="size-4" />
        )}
      </button>

      {/* Visible "Preparing…" text (not just the button's aria-label) —
          the whole-clip neural render takes a few seconds; this states it
          in words right beside the spinner. Only reachable AI-on (status
          only becomes 'preparing' when isAiBackendConfigured), which is
          also why it can share the far-end demo-badge slot's row without
          ever colliding: the demo badge only renders AI-off. */}
      {status === 'preparing' && (
        <span className="text-[0.8125rem] font-semibold text-ink">{t('techniques.preparing')}</span>
      )}

      <div
        role="group"
        aria-label={t('readingBuddy.speedLabel')}
        className="inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
      >
        {RATES.map((r) => (
          // dir="ltr" — see VoiceControls.tsx's SpeedField (this player's
          // own independent copy of the same pill) for the full bidi
          // reasoning; task #398 review, 2026-09-14.
          <button
            key={r}
            type="button"
            dir="ltr"
            aria-pressed={rate === r}
            onClick={() => handleRateChange(r)}
            className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            {r}×
          </button>
        ))}
      </div>

      {genderChoiceAvailable && (
        // Labeled "Narrator" / Voice 1 / Voice 2 (Amal, 2026-08-13) —
        // deliberately no Male/Female wording anywhere in the UI. The
        // underlying selection mechanism (VoiceGender, textToSpeech.ts)
        // is untouched — Voice 1 maps to the same voice that was
        // previously labeled "male", Voice 2 to "female", per team-
        // lead's explicit mapping. This also resolves the honesty
        // concern with the gender heuristic itself: labeling by
        // "first/second voice" makes no unverifiable gender claim.
        <div
          role="group"
          aria-label={t('readingBuddy.voiceLabel')}
          className="inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
        >
          <button
            type="button"
            aria-pressed={gender === 'male'}
            onClick={() => handleGenderChange('male')}
            className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            {t('readingBuddy.voice1')}
          </button>
          <button
            type="button"
            aria-pressed={gender === 'female'}
            onClick={() => handleGenderChange('female')}
            className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            {t('readingBuddy.voice2')}
          </button>
        </div>
      )}

      {/* Honest labeling (team-lead's explicit instruction): the
          FEATURE genuinely works right now — this badge is specifically
          about the VOICE, not a "this doesn't really work yet" notice. */}
      {!isAiBackendConfigured() && (
        <span className="ms-auto rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
          {t('readingBuddy.demoVoiceBadge')}
        </span>
      )}
      </div>
      {/* Task #465 (2026-09-14, Amal via team-lead) — "download as
          MP3" is on the roadmap, not built yet. Placed OUTSIDE the
          real control bar above (not another pill jammed in next to
          Play/speed/voice) so it never competes with genuinely working
          controls for attention — a smaller, separately-bordered chip
          read as "also coming, near this feature" rather than "a 5th
          working button here." */}
      <ComingSoonAction icon={DownloadIcon} label={t('reader.downloadMp3')} className="mt-2" />
      {voiceError && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-ink-muted">
          {voiceError === 'tokenCap'
            ? t('readingBuddy.limitReachedTokenCap')
            : voiceError === 'globalCap'
              ? t('readingBuddy.limitReachedGlobalCap')
              : voiceError === 'unavailable'
                ? t('readingBuddy.voiceUnavailable')
                : t('readingBuddy.accessCodeMessage')}
        </p>
      )}
    </section>
  )
}
