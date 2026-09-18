import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { askPageIdFor, guideMascotEntryFor } from '../content/guideMascotScripts'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { ask, transcribe, AccessTokenError, SpendCapError, isAiBackendConfigured } from '../lib/aiService'
import { hasArabicSttConsent, grantArabicSttConsent } from '../lib/arabicSttConsent'
import { startArabicRecording, isMediaRecordingSupported, type ArabicRecordingHandle } from '../lib/speechRecording'
import { closeMascotChat, useMascotChatOpen } from '../lib/mascotChat'
import { focusRing } from '../lib/focus'
import { CloseIcon, MicrophoneIcon, SpeakerIcon, StopIcon } from './icons'
import { NibrasGuideFace } from './mascot/NibrasGuideFace'
import { MascotMouthDriver, type MouthShape } from './mascot/mascotMouthDriver'

// One id for useSpeakingController — the popup owns its OWN controller
// instance and only one thing (script OR answer) ever speaks at a time, so
// sharing the id keeps the talking-avatar logic simple.
const MASCOT_SPEAKING_ID = 'nibras-guide-mascot'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * «مرشد نبراس» — the chat POPUP for the Nibras guide (task #369, refined
 * spec 2026-09-14, Amal via team-lead). Opened by MascotLauncher.tsx
 * (docked in AppShellSidebar on app pages, floating on Landing) via the
 * lib/mascotChat store; this component renders the floating panel itself
 * at a NON-transformed root (AppShell + Landing both mount it) so it never
 * inherits the sidebar's transform. `variant` only nudges the desktop
 * horizontal anchor so the panel clears the app sidebar.
 *
 * It is BOTH the scripted per-page guide (#366 — always shown as the first
 * message, spoken through the same neural/browser voice path with the
 * talking-mouth avatar) AND the interactive grounded Q&A (#369): the reader
 * types OR speaks a question about THIS page and the guide answers, in text
 * and optionally aloud.
 *
 * HONESTY: the ask + mic need the AI backend ON. In demo mode the panel
 * shows an honest "works in the live version" note and never fabricates an
 * answer (aiService.ask/transcribe have no demo path). The grounding +
 * out-of-scope scoped decline live SERVER-SIDE (server/api/ask.ts); the
 * client sends only {pageId, question, lang}. The mic reuses the app's
 * existing consent-gated, no-retention STT (lib/arabicSttConsent +
 * /stt) — the reader's voice goes to xAI only after they agree, is never
 * used to train, and is deleted within 30 days (privacy policy #125).
 * Reuses the access-gate token + per-volunteer spend cap + rate limiter.
 */
export function NibrasGuideMascot({ variant = 'app' }: { variant?: 'app' | 'landing' }) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
  const open = useMascotChatOpen()
  const { speakingId, preparingId, errorId, toggle, stop } = useSpeakingController()
  const { hasVoiceFor } = useSpeechVoices()
  const { gender, rate } = useVoicePreference()

  const [mouth, setMouth] = useState<MouthShape>('mouth-rest')
  const [warm, setWarm] = useState(false)
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function pulseWarm() {
    setWarm(true)
    if (warmTimerRef.current) clearTimeout(warmTimerRef.current)
    warmTimerRef.current = setTimeout(() => setWarm(false), 1800)
  }

  // Ask (#369) state.
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askErrorKind, setAskErrorKind] = useState<'generic' | 'limit' | 'limitGlobal' | 'mic' | null>(null)
  // Mic (speak-your-question) state — reuses the approved STT consent + path.
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [needConsent, setNeedConsent] = useState(false)
  const recordingHandleRef = useRef<ArabicRecordingHandle | null>(null)

  function resetChat() {
    setQuestion('')
    setAnswer(null)
    setAsking(false)
    setAskErrorKind(null)
    setNeedConsent(false)
    setTranscribing(false)
    setRecording(false)
    recordingHandleRef.current = null
  }

  // One mouth driver for the component's lifetime.
  const driverRef = useRef<MascotMouthDriver | null>(null)
  if (!driverRef.current) driverRef.current = new MascotMouthDriver(setMouth)

  const isSpeaking = speakingId === MASCOT_SPEAKING_ID
  const isPreparing = preparingId === MASCOT_SPEAKING_ID

  // Settle the mouth closed when speech ends (natural end / stop / error).
  const wasSpeakingRef = useRef(false)
  useEffect(() => {
    if (isSpeaking) {
      wasSpeakingRef.current = true
      return
    }
    if (!isPreparing) {
      driverRef.current?.stop()
      if (wasSpeakingRef.current) {
        wasSpeakingRef.current = false
        pulseWarm()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking, isPreparing])

  // Release the AudioContext + timers if this ever truly unmounts.
  useEffect(() => {
    const driver = driverRef.current
    return () => {
      driver?.dispose()
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current)
    }
  }, [])

  // On navigation: stop any speech, close the popup, and clear the previous
  // page's Q&A so nothing bleeds into the next page.
  useEffect(() => {
    return () => {
      stop()
      closeMascotChat()
      resetChat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Esc closes the popup (only while open).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        stop()
        closeMascotChat()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Focus management for the non-modal chat popup (qcheck P1, 2026-09-14):
  // on open, move keyboard focus INTO the dialog — its launcher sits late in
  // the sidebar DOM while the popup mounts early, so a keyboard user would
  // otherwise land nowhere near the ask box; on close, return focus to
  // whatever opened it (the docked/floating launcher). Non-modal: no focus
  // trap (z-20, below the drawer/gate), and Esc still closes (effect above).
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      openerRef.current = (document.activeElement as HTMLElement) ?? null
      dialogRef.current?.focus()
    } else {
      openerRef.current?.focus?.()
      openerRef.current = null
    }
  }, [open])

  const entry = guideMascotEntryFor(pathname)
  // P1 fix (2026-09-15, rev-web's review): the scripted-guide allowlist
  // above and the /ask grounding allowlist are NOT the same set — see
  // askPageIdFor's own comment. null here means this page has no vetted
  // facts to answer from at all (currently /privacy, /signin), so the
  // whole Ask section is hidden below rather than 400ing on submit.
  const canonicalAskId = askPageIdFor(pathname)
  const voiceAvailable = hasVoiceFor(lang)
  const aiOn = isAiBackendConfigured()
  const hasError = errorId === MASCOT_SPEAKING_ID
  const micSupported = isMediaRecordingSupported()

  // The panel renders only when opened AND the current page has a guide
  // entry. A page with no entry offers no launcher, so this is a backstop.
  if (!entry || !open) return null

  const scriptText = t(entry.scriptKey)
  const expression = isSpeaking ? 'expr-talking' : warm ? 'expr-warm' : 'expr-idle'
  const faceState = `${expression} ${mouth}`
  const busy = asking || transcribing || recording

  // Shared "make the mascot say this text" through the same neural/browser
  // voice + talking-mouth path (no parallel TTS).
  function speakThroughMascot(text: string) {
    if (isSpeaking || isPreparing) {
      stop()
      return
    }
    if (!voiceAvailable) return
    pulseWarm()
    if (!prefersReducedMotion()) driverRef.current?.start(aiOn ? 'neural' : 'browser')
    toggle(MASCOT_SPEAKING_ID, text, lang, {
      gender,
      rate,
      onBoundary: () => driverRef.current?.pushBoundary(),
      onAudio: (audio) => driverRef.current?.attachAudio(audio),
    })
  }

  async function runAsk(qRaw: string) {
    const q = qRaw.trim()
    // Defensive as much as functional: the ask form itself only renders
    // when canonicalAskId is set (see the JSX below), but guarding here
    // too means this can never fire the request that used to 400 on
    // /techniques/:id, /techniques/category/:category, /privacy, or
    // /signin (2026-09-15 P1 fix) even from a stray call.
    if (!q || asking || !canonicalAskId) return
    stop()
    setAsking(true)
    setAnswer(null)
    setAskErrorKind(null)
    try {
      // pageId = the CANONICAL id (e.g. '/techniques', never the raw
      // '/techniques/r1'), matching the server's own _askContext
      // allowlist exactly. No page facts are sent from here — grounding
      // lives server-side.
      const res = await ask(canonicalAskId, q, lang)
      setAnswer(res.answer)
    } catch (err) {
      if (err instanceof AccessTokenError) {
        /* global <AccessGate> already reopened; the reader enters a code and retries */
      } else if (err instanceof SpendCapError) {
        setAskErrorKind(err.reason === 'global_cap_reached' ? 'limitGlobal' : 'limit')
      } else {
        setAskErrorKind('generic')
      }
    } finally {
      setAsking(false)
    }
  }

  function handleAskSubmit(e: FormEvent) {
    e.preventDefault()
    void runAsk(question)
  }

  function handleListenAnswer() {
    if (answer) speakThroughMascot(answer)
  }

  // Mic: speak your question. Reuses the approved consent + /stt path; the
  // transcript lands in the input for the reader to review before sending
  // (STT can mishear, so we never auto-send what we "heard").
  async function startRecording() {
    setAskErrorKind(null)
    stop()
    const handle = await startArabicRecording({
      onError: () => {
        setRecording(false)
        setAskErrorKind('mic')
      },
    })
    if (!handle) {
      setAskErrorKind('mic')
      return
    }
    recordingHandleRef.current = handle
    setRecording(true)
  }

  async function handleMic() {
    if (transcribing) return
    if (recording) {
      const handle = recordingHandleRef.current
      recordingHandleRef.current = null
      setRecording(false)
      if (!handle) return
      setTranscribing(true)
      try {
        const blob = await handle.stop()
        const { text } = await transcribe(blob, lang)
        setQuestion((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
      } catch (err) {
        if (err instanceof AccessTokenError) {
          /* gate reopened */
        } else if (err instanceof SpendCapError) {
          setAskErrorKind(err.reason === 'global_cap_reached' ? 'limitGlobal' : 'limit')
        } else {
          setAskErrorKind('mic')
        }
      } finally {
        setTranscribing(false)
      }
      return
    }
    // Not recording yet: gate on the one-time consent before the mic ever opens.
    if (!hasArabicSttConsent()) {
      setNeedConsent(true)
      return
    }
    void startRecording()
  }

  function handleConsentAllow() {
    grantArabicSttConsent()
    setNeedConsent(false)
    void startRecording()
  }

  function handleClose() {
    stop()
    closeMascotChat()
  }

  // Desktop anchor, ROUND 3 (task #540, Amal via team-lead, 2026-09-15):
  // round 2 (below) correctly confined the popup to the sidebar's own
  // column, but STILL paired `md:top-[542px]` with the base `bottom-4`
  // — on desktop that's the exact same "both top AND bottom pinned"
  // mechanism round 1 used, which forces the box to fill that whole
  // span regardless of content (CSS: an absolutely/fixed-positioned
  // block with `height:auto` and BOTH `top`/`bottom` set has its height
  // computed FROM those two anchors, not from its content). Amal caught
  // it directly: the popup opened but visibly stretched all the way to
  // the sidebar's own bottom («نافذته ممطوطة لآخر شي») even when its
  // real content (the scripted guide line or two) barely needed a third
  // of that height. Round 3 fix, desktop-only: `md:bottom-auto` cancels
  // the inherited bottom pin so the box is CONTENT-height again,
  // growing downward from `top-[542px]` only as far as it needs —
  // paired with `md:max-h-[calc(100vh-542px-1rem)]` so a short window
  // still caps the box before it would run off-screen, handing overflow
  // to the pre-existing `overflow-y-auto` (scroll) instead of letting a
  // long answer clip past the bottom edge. Horizontal sizing/position
  // (`md:start-3 md:w-[calc(255px-1.5rem)]`) and every non-md: variant
  // (mobile app, Landing) are UNTOUCHED — this only changes the
  // vertical SIZING mechanism at md: for variant='app'.
  //
  // Round 2's own measurement, still the source of every constant here:
  // real browser, viewport 1280x800, both langs, both a short page
  // (Dashboard) and a very tall one (Reader) — the launcher's own
  // rendered box is x:12-243 w:231 (EN) / x:1037-1268 w:231 (AR, mirrors
  // correctly) with its bottom edge at y=533 in EVERY case checked —
  // its position is set by the fixed count of nav rows above it, not by
  // page content height, so it's a stable anchor. `md:top-[542px]` =
  // that measured bottom (533) plus an 8px gap; `md:w-[calc(255px-
  // 1.5rem)]` reproduces the launcher's own 231px width (255px sidebar
  // minus the nav list's 12px inset each side) so the popup's start/end
  // edges land flush with the launcher's, reading as "growing out of"
  // it rather than floating independently.
  const anchor =
    variant === 'app'
      ? 'bottom-4 start-4 top-[60vh] w-[min(22rem,calc(100vw-2rem))] md:start-3 md:top-[542px] md:bottom-auto md:max-h-[calc(100vh-542px-1rem)] md:w-[calc(255px-1.5rem)]'
      : 'bottom-4 start-4 top-[60vh] w-[min(22rem,calc(100vw-2rem))]'

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-label={t('mascot.name')}
      // `bottom-4` (unchanged since round 1) still governs MOBILE +
      // Landing: viewport-relative rather than a fixed max-height, so
      // the popup's own bottom edge stays inside whatever window it's
      // on there (a fixed height could run past a short window's bottom
      // and get silently clipped, since `fixed` never extends the
      // page). Paired with `top-[60vh]` this gives THOSE variants a
      // hard ceiling regardless of content length, growing the SCROLL
      // (overflow-y-auto, already here) instead of the box — the
      // scripted guide text + the whole Ask section + a real answer can
      // reach 400-450px, well past what's comfortable on a phone.
      //
      // DESKTOP (md: + variant='app') no longer pairs bottom-4 with the
      // top anchor — round 3's own comment above explains why (that
      // pairing forces a STRETCHED box regardless of content, which is
      // exactly what Amal flagged: «نافذته ممطوطة لآخر شي»). It's
      // content-height there now, capped by `md:max-h-[...]`, with the
      // SAME overflow-y-auto absorbing anything past that cap.
      //
      // HONEST LIMIT, measured, not assumed: 0px overlap with `main`
      // (the actual requirement) holds on every viewport height
      // regardless of this box's own height, since its horizontal
      // column (round 2) is what guarantees that, not its vertical
      // size. What CAN still happen on desktop: if the popup's content
      // is long enough to hit `md:max-h-[...]` on an unusually TALL
      // browser window (roughly 1000px+), the sidebar's OWN OTHER
      // footer links (Guide/Privacy/Profile, pinned to the sidebar's
      // bottom via justify-between) can end up under the popup's lower
      // edge — never `main`, only those secondary links, only on tall
      // windows, and only once content is genuinely that long (the
      // common case — a line or two of scripted guide text — now sizes
      // far short of that). Flagged, not silently hidden.
      className={`fixed z-20 flex flex-col overflow-y-auto rounded-card border-[1.5px] border-line-strong bg-card p-4 text-start shadow-lg ${anchor}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <NibrasGuideFace stateClass={faceState} size={80} />
          <span className="text-[0.8125rem] font-bold text-accent">{t('mascot.name')}</span>
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('mascot.closeCaption')}
          className={`flex size-6 flex-none items-center justify-center rounded-control text-ink-muted hover:text-ink ${focusRing}`}
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>

      {/* The always-available SCRIPTED guide (#366) — the first message, with
          its own listen control. Its own live region so a screen reader
          hears the guidance when the popup opens. */}
      <div role="status" className="rounded-control bg-page-bg p-3">
        <p className="m-0 text-[0.9375rem] leading-relaxed text-ink">{scriptText}</p>
        <div className="mt-2 flex items-center gap-2">
          {voiceAvailable && (
            <button
              type="button"
              onClick={() => speakThroughMascot(scriptText)}
              disabled={isPreparing}
              aria-label={isPreparing ? t('techniques.preparing') : isSpeaking ? t('techniques.stopListening') : t('mascot.play')}
              className={`flex size-8 flex-none items-center justify-center rounded-control text-accent hover:bg-card disabled:cursor-progress ${focusRing}`}
            >
              {isPreparing ? (
                <span aria-hidden="true" className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
              ) : isSpeaking ? (
                <StopIcon className="size-4" />
              ) : (
                <SpeakerIcon className="size-4" />
              )}
            </button>
          )}
          {!voiceAvailable && <span className="text-[0.75rem] text-ink-muted">{t('techniques.noVoice')}</span>}
          {hasError && (
            <span role="alert" className="text-[0.75rem] text-ink-muted">
              {t('techniques.voiceUnavailable')}
            </span>
          )}
          {voiceAvailable && !aiOn && (
            <span className="inline-flex rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
              {t('readingBuddy.demoVoiceBadge')}
            </span>
          )}
        </div>
      </div>

      {/* «اسألني عن الصفحة» (#369) — the grounded Q&A. Live mode = a real ask
          box (type or speak). Demo mode = an honest coming-soon note, never a
          fabricated answer. Whole section hidden (2026-09-15 P1 fix) when
          canonicalAskId is null — /privacy and /signin have a scripted
          guide above but no vetted page facts to ground an answer in, in
          EITHER mode, so there is nothing honest to offer here at all
          (not even the demo-mode "coming soon" note, which would imply
          this will eventually work here too). */}
      {canonicalAskId && (
      <div className="mt-3 border-t border-line-strong pt-3">
        <p className="m-0 mb-2 text-[0.8125rem] font-bold text-ink">{t('mascot.ask.heading')}</p>
        {aiOn ? (
          <>
            {answer && (
              <div role="status" className="mb-2 rounded-control bg-accent-tint p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[0.6875rem] font-semibold text-accent">{t('mascot.ask.answerLabel')}</span>
                  {voiceAvailable && (
                    <button
                      type="button"
                      onClick={handleListenAnswer}
                      disabled={isPreparing}
                      aria-label={isPreparing ? t('techniques.preparing') : isSpeaking ? t('techniques.stopListening') : t('mascot.ask.listen')}
                      className={`flex size-8 flex-none items-center justify-center rounded-control text-accent hover:bg-card disabled:cursor-progress ${focusRing}`}
                    >
                      {isPreparing ? (
                        <span aria-hidden="true" className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
                      ) : isSpeaking ? (
                        <StopIcon className="size-4" />
                      ) : (
                        <SpeakerIcon className="size-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="m-0 text-[0.9375rem] leading-relaxed text-ink">{answer}</p>
              </div>
            )}

            {asking && <p role="status" className="m-0 mb-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.thinking')}</p>}
            {transcribing && <p role="status" className="m-0 mb-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.transcribing')}</p>}
            {recording && <p role="status" className="m-0 mb-2 text-[0.8125rem] font-semibold text-accent">{t('mascot.ask.recording')}</p>}

            {needConsent ? (
              <div className="rounded-control border-[1.5px] border-line-strong p-3">
                <p className="m-0 text-[0.8125rem] leading-relaxed text-ink">{t('mascot.ask.consentBody')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleConsentAllow}
                    className={`rounded-control bg-accent px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-ink transition hover:brightness-110 ${focusRing}`}
                  >
                    {t('mascot.ask.consentAllow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedConsent(false)}
                    className={`rounded-control px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink ${focusRing}`}
                  >
                    {t('mascot.ask.consentDeny')}
                  </button>
                </div>
              </div>
            ) : (
              // md:flex-wrap (variant='app' only, task #540 round 2): at
              // the new sidebar-confined desktop width (~231px, see the
              // anchor comment above) mic+input+send never fit on one
              // row — the submit button's own md:w-full below forces it
              // onto its own second line instead of clipping/squeezing
              // the input down to near-nothing. Mobile (this same
              // variant, wide 22rem popup) and Landing (never confined)
              // both keep today's single row.
              <form onSubmit={handleAskSubmit} className={`flex items-stretch gap-2 ${variant === 'app' ? 'md:flex-wrap' : ''}`}>
                {micSupported && (
                  <button
                    type="button"
                    onClick={handleMic}
                    disabled={asking || transcribing}
                    aria-pressed={recording}
                    aria-label={recording ? t('mascot.ask.micStop') : t('mascot.ask.mic')}
                    className={`flex size-10 flex-none items-center justify-center rounded-control border-[1.5px] transition disabled:opacity-50 ${
                      recording ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-accent hover:bg-accent-tint'
                    } ${focusRing}`}
                  >
                    {recording ? <StopIcon className="size-4" /> : <MicrophoneIcon className="size-4" />}
                  </button>
                )}
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={500}
                  disabled={asking}
                  placeholder={t('mascot.ask.placeholder')}
                  aria-label={t('mascot.ask.placeholder')}
                  className={`min-w-0 flex-1 rounded-control border-[1.5px] border-line-strong bg-page-bg px-3 py-2 text-[0.875rem] text-ink placeholder:text-ink-muted disabled:opacity-60 ${focusRing}`}
                />
                <button
                  type="submit"
                  disabled={busy || question.trim() === ''}
                  // md:w-full (variant='app' only) forces this onto its
                  // OWN row when the form above is md:flex-wrap — a
                  // flex-none item with an explicit 100% width still
                  // takes the whole line, it just doesn't grow/shrink
                  // beyond it. flex-none alone (no md: split) at every
                  // other width/variant, unchanged from before.
                  className={`flex-none rounded-control bg-accent px-3 py-2 text-[0.8125rem] font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50 ${variant === 'app' ? 'md:w-full' : ''} ${focusRing}`}
                >
                  {t('mascot.ask.send')}
                </button>
              </form>
            )}

            {!needConsent && <p className="m-0 mt-1.5 text-[0.6875rem] text-ink-muted">{t('mascot.ask.scopedNote')}</p>}

            {askErrorKind === 'generic' && <p role="alert" className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.error')}</p>}
            {askErrorKind === 'mic' && <p role="alert" className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.micError')}</p>}
            {askErrorKind === 'limit' && <p role="alert" className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.limitReached')}</p>}
            {askErrorKind === 'limitGlobal' && <p role="alert" className="m-0 mt-2 text-[0.8125rem] text-ink-muted">{t('mascot.ask.limitGlobal')}</p>}
          </>
        ) : (
          <p className="m-0 text-[0.8125rem] leading-relaxed text-ink-muted">{t('mascot.ask.comingSoon')}</p>
        )}
      </div>
      )}
    </div>
  )
}
