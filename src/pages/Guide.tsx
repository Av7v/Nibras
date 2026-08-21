import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GUIDE_CHAPTERS, type GuideChapterId } from '../content/guideSteps'
import { GUIDE_CHAPTER_ICON } from '../components/guide/guideIcons'
import { GuideIllustration } from '../components/guide/GuideIllustration'
import { SpeakerButton } from '../components/techniques/SpeakerButton'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { isAiBackendConfigured } from '../lib/aiService'
import { ChevronIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

const SPEAKING_ID = 'guide-step'

/**
 * "How to use Nibras" — a creative, step-by-step interactive
 * walkthrough (Amal, 2026-08-13, via team-lead: explicitly NOT a
 * video — Nibras doesn't produce video). 6 chapters, one per main
 * feature (Reader, Reading settings, Techniques, Reading Buddy, Mind
 * Maps, AI Assistant — content in content/guideSteps.ts), 2 short
 * steps each, each with a small entrance-animated illustration
 * (GuideIllustration.tsx). "Next"/"Previous" walk linearly through the
 * WHOLE guide (crossing chapter boundaries), so someone can just keep
 * pressing Next from the very first step and see everything in order —
 * or jump straight to one feature via the picker row above.
 *
 * Calm, not just "creative": every animation is gated behind
 * `motion-safe:` (see index.css), illustrations are simple
 * icon+geometry, not busy scenes, and re-triggering an animation only
 * ever happens on a deliberate step change (keyed remount), never on
 * an interval/autoplay.
 */
export function Guide() {
  const { t, i18n } = useTranslation()
  const rtl = i18n.language === 'ar'
  // Explicit annotation (not left to inference) — a bare ternary here
  // has bitten this exact pattern before in this codebase (see
  // patterns_react_architecture.md's useProfileData note): without it,
  // TS can widen this to plain `string` once it travels anywhere, which
  // `SpeakerButton`'s `lang: SpeechLang` prop would then reject.
  const lang: 'en' | 'ar' = rtl ? 'ar' : 'en'
  const [chapterId, setChapterId] = useState(GUIDE_CHAPTERS[0].id)
  const [stepIndex, setStepIndex] = useState(0)
  const { speakingId, preparingId, errorId, toggle, stop } = useSpeakingController()

  const chapterIndex = GUIDE_CHAPTERS.findIndex((c) => c.id === chapterId)
  const chapter = GUIDE_CHAPTERS[chapterIndex]
  const step = chapter.steps[stepIndex]
  const Icon = GUIDE_CHAPTER_ICON[chapter.id]

  const isFirstOverall = chapterIndex === 0 && stepIndex === 0
  const isLastOverall = chapterIndex === GUIDE_CHAPTERS.length - 1 && stepIndex === chapter.steps.length - 1

  // The period between title/body gives the browser's TTS engine a
  // natural pause between them — there's no SSML/pause markup available
  // through the plain Web Speech API this app uses (see
  // lib/textToSpeech.ts), so real punctuation is the only lever.
  const speakableText = `${t(step.titleKey)}. ${t(step.bodyKey)}`

  function selectChapter(id: GuideChapterId) {
    stop()
    setChapterId(id)
    setStepIndex(0)
  }

  function goNext() {
    stop()
    if (stepIndex < chapter.steps.length - 1) {
      setStepIndex((i) => i + 1)
      return
    }
    if (chapterIndex < GUIDE_CHAPTERS.length - 1) {
      setChapterId(GUIDE_CHAPTERS[chapterIndex + 1].id)
      setStepIndex(0)
    }
  }

  function goPrev() {
    stop()
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1)
      return
    }
    if (chapterIndex > 0) {
      const prevChapter = GUIDE_CHAPTERS[chapterIndex - 1]
      setChapterId(prevChapter.id)
      setStepIndex(prevChapter.steps.length - 1)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[46rem] flex-1 px-6 py-10 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('guide.title')}</h1>
      <p className="mb-8 text-[0.9375rem] text-ink-muted">{t('guide.subtitle')}</p>

      <div role="group" aria-label={t('guide.title')} className="mb-6 flex flex-wrap gap-2">
        {GUIDE_CHAPTERS.map((c) => {
          const ChapterIcon = GUIDE_CHAPTER_ICON[c.id]
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChapter(c.id)}
              aria-pressed={c.id === chapterId}
              className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${focusRing}`}
            >
              <ChapterIcon className="size-4" />
              {t(c.titleKey)}
            </button>
          )
        })}
      </div>

      <div className="rounded-card border border-line bg-card p-6 sm:p-8">
        <GuideIllustration key={`${chapterId}-${stepIndex}`} icon={Icon} flourish={step.flourish} rtl={rtl} />

        <p className="mt-6 mb-1.5 text-[0.8125rem] font-bold tracking-[0.08em] text-accent uppercase">
          {t('guide.stepLabel', { current: stepIndex + 1, total: chapter.steps.length })}
        </p>

        {/* Optional read-aloud (Amal, 2026-08-13: «نحط صوت يقرأ لهم اذا
            حبوا») — reuses the exact same SpeakerButton + useSpeakingController
            + useSpeechVoices path as Techniques/TechniqueDetail, not a
            parallel system: voice availability is the SAME reactive check
            that fixed the P0-1 cold-load bug, so this can't regress it,
            and a language with no installed voice just shows the button's
            own built-in disabled state (SpeakerButton already handles
            that, nothing extra needed here). Demo-voice badge reused
            verbatim from Reading Buddy — same underlying fact (browser
            voice today, a real one once an AI backend is configured). */}
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <h2 className="m-0 flex-1 text-[1.375rem] font-bold text-ink">{t(step.titleKey)}</h2>
          <div className="flex items-center gap-2">
            <SpeakerButton
              lang={lang}
              isActive={speakingId === SPEAKING_ID}
              isPreparing={preparingId === SPEAKING_ID}
              onToggle={() => toggle(SPEAKING_ID, speakableText, lang)}
              size="sm"
            />
            {!isAiBackendConfigured() && (
              <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
                {t('readingBuddy.demoVoiceBadge')}
              </span>
            )}
          </div>
        </div>
        {errorId === SPEAKING_ID && (
          <p role="alert" className="mb-2 text-[0.8125rem] text-ink-muted">{t('techniques.voiceUnavailable')}</p>
        )}
        <p className="m-0 text-[0.9375rem] leading-relaxed text-ink-muted">{t(step.bodyKey)}</p>

        <div className="mt-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirstOverall}
            className={`inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-line-strong px-4 py-2 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
            {t('guide.previous')}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={isLastOverall}
            className={`inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            {t('guide.next')}
            <ChevronIcon className="size-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </main>
  )
}
