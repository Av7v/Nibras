import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GUIDE_CHAPTERS, type GuideChapterId } from '../content/guideSteps'
import { GUIDE_CHAPTER_ICON } from '../components/guide/guideIcons'
import { focusRing } from '../lib/focus'

/**
 * "How to use Nibras" — rebuilt 2026-09-15 (Amal, via team-lead) from a
 * text step-by-step walkthrough into a video-first guide, now that real
 * narrated clips exist. The feature list is no longer a text stepper —
 * each icon is an "explainer launcher" («كل أيقونة نضغطها يجي فيديو
 * يشرحها»): tap one and its own short explainer opens right below the
 * grid — a video for most features, a plain-text card for the two
 * features that have no video of their own (Library, AI Assistant).
 *
 * A same-day follow-up (Amal, «الفيديو الأول شيله») removed the
 * full-width overview video that originally sat above this grid — she
 * wants ONLY the per-feature explainers, icon-click-to-video, nothing
 * to watch before choosing a feature. `guide.videoHeading` is now
 * unused (left in i18n — harmless); `guide.videoCaptionsLabel` is still
 * used, by every per-feature clip's own `<track>` below.
 *
 * The OLD chapter/step content (title+body pairs, 2 steps per chapter,
 * Next/Previous navigation, the entrance-animated GuideIllustration) is
 * gone from this page. guideSteps.ts / guideIcons.tsx are kept as-is —
 * this page now only reads their `id` + `titleKey` + icon lookup, which
 * doubles as the feature list's source of truth (same reuse principle
 * guideSteps.ts's own header comment describes: one shared id union,
 * checked by `tsc -b`, so a feature can't go missing an icon silently).
 */

/** How a given chapter's explainer is shown: either its own short
 * video clip, or (for the 2 features with no clip) a plain text card.
 * There's no standalone "Reading settings" chapter (removed 2026-09-17,
 * Amal via team-lead): the `reader` clip already shows the same font/
 * size/spacing/background controls live, so it covers both. */
type GuideExplainer = { kind: 'video'; clipKey: string } | { kind: 'text'; bodyKey: string }

const GUIDE_EXPLAINER: Record<GuideChapterId, GuideExplainer> = {
  colours: { kind: 'video', clipKey: 'colours' },
  techniques: { kind: 'video', clipKey: 'techniques' },
  reader: { kind: 'video', clipKey: 'reader' },
  readingBuddy: { kind: 'video', clipKey: 'readingBuddy' },
  mindMaps: { kind: 'video', clipKey: 'mindMaps' },
  letterSounds: { kind: 'video', clipKey: 'letterSounds' },
  // Library works fully on-device today. AI Assistant now has its own guide
  // video that demonstrates the feature working; the AI Assistant page itself
  // still shows «قريبًا / coming soon» in demo mode, which is consistent —
  // the video shows how it will work, the live page is honest that it is not
  // switched on yet. Both are video tiles.
  aiAssistant: { kind: 'video', clipKey: 'aiAssistant' },
  library: { kind: 'video', clipKey: 'library' },
  calmSpace: { kind: 'video', clipKey: 'calmness' },
  guideMascot: { kind: 'video', clipKey: 'mascot' },
}

export function Guide() {
  const { t, i18n } = useTranslation()
  // Explicit annotation (not left to inference) — see
  // patterns_react_architecture.md's useProfileData note: without it,
  // TS can widen this to plain `string` once it travels anywhere.
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'

  const [openId, setOpenId] = useState<GuideChapterId>(GUIDE_CHAPTERS[0].id)
  // Whether the CURRENTLY selected clip, in the CURRENT language,
  // failed to load — e.g. its file hasn't been produced/deployed yet.
  // Reset below whenever the clip or the language changes, so a clip
  // that lands later (or a language switch to one that already has its
  // clip) is retried instead of staying stuck on the fallback forever.
  const [videoFailed, setVideoFailed] = useState(false)

  const openChapter = GUIDE_CHAPTERS.find((c) => c.id === openId) ?? GUIDE_CHAPTERS[0]
  const OpenIcon = GUIDE_CHAPTER_ICON[openChapter.id]
  const explainer = GUIDE_EXPLAINER[openChapter.id]

  useEffect(() => {
    setVideoFailed(false)
  }, [lang, openId])

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('guide.title')}</h1>
      <p className="mb-6 text-[0.9375rem] text-ink-muted">{t('guide.subtitle')}</p>

      <section aria-labelledby="guide-explore-heading">
        <h2 id="guide-explore-heading" className="mb-1 text-[1.0625rem] font-bold text-ink">
          {t('guide.exploreHeading')}
        </h2>
        <p className="mb-4 text-[0.875rem] text-ink-muted">{t('guide.exploreSubtitle')}</p>

        {/* The feature list, kept (icons + labels) but repurposed as
            explainer launchers (Amal, 2026-09-15) — same aria-pressed
            toggle-button-group pattern the old chapter picker used
            (proven accessible/RTL-safe already), just pointed at the
            explainer panel below instead of the old step content. */}
        <div
          id="guide-feature-grid"
          role="group"
          aria-label={t('guide.exploreHeading')}
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {GUIDE_CHAPTERS.map((c) => {
            const ChapterIcon = GUIDE_CHAPTER_ICON[c.id]
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                aria-pressed={c.id === openId}
                aria-controls="guide-explainer-panel"
                className={`flex flex-col items-center gap-2 rounded-card border-[1.5px] border-line-strong bg-card px-3 py-4 text-center text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${focusRing}`}
              >
                <ChapterIcon className="size-7" />
                {t(c.titleKey)}
              </button>
            )
          })}
        </div>

        {/* aria-live="polite" so assistive-tech users hear the new
            explainer announced without needing to tab down to it —
            there's no separate ARIA tabs/tabpanel wiring here (this
            page uses the simpler pressed-button-group pattern above),
            so this is the one thing standing in for that announcement. */}
        <div id="guide-explainer-panel" aria-live="polite" className="rounded-card border border-line bg-card p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-control bg-accent-tint text-accent"
            >
              <OpenIcon className="size-6" />
            </span>
            <h3 className="m-0 text-[1.25rem] font-bold text-ink">{t(openChapter.titleKey)}</h3>
          </div>

          {explainer.kind === 'text' ? (
            <p className="m-0 text-[0.9375rem] leading-relaxed text-ink-muted">{t(explainer.bodyKey)}</p>
          ) : videoFailed ? (
            // Honest fallback instead of a broken/blank video box — hit
            // while this clip's file isn't deployed at this path yet
            // (see the segments/<lang>/<key>.mp4 convention below).
            <p className="m-0 text-[0.9375rem] text-ink-muted">{t('guide.videoUnavailable')}</p>
          ) : (
            <video
              key={`${lang}-${explainer.clipKey}`}
              controls
              playsInline
              poster={`/guide-videos/segments/${lang}/${explainer.clipKey}.jpg`}
              aria-label={t(openChapter.titleKey)}
              onError={() => setVideoFailed(true)}
              className="aspect-video w-full rounded-control border border-line bg-cream"
            >
              {/* qa-review P1 (2026-09-15): a media `error` event doesn't
                  bubble, and per the HTML resource-selection algorithm a
                  <source> that 404s isn't guaranteed to also raise an
                  `error` on its parent <video> once no candidate is left —
                  a real, long-documented cross-browser gotcha, even though
                  a direct repro against this build's Chromium DID still
                  fire the <video> handler correctly. With 8 clips still
                  mid-production, some WILL 404 in the wild on SOME engine,
                  and the failure mode if this doesn't fire anywhere is a
                  blank/broken box instead of the honest fallback text
                  above — so listen on the <source> too as a zero-cost
                  belt-and-suspenders: whichever element's error actually
                  fires, the same handler still runs once. */}
              <source
                src={`/guide-videos/segments/${lang}/${explainer.clipKey}.mp4`}
                type="video/mp4"
                onError={() => setVideoFailed(true)}
              />
              <track
                kind="captions"
                src={`/guide-videos/segments/${lang}/${explainer.clipKey}.vtt`}
                srcLang={lang}
                label={t('guide.videoCaptionsLabel')}
              />
            </video>
          )}
        </div>
      </section>
    </main>
  )
}
