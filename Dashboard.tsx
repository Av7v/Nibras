import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  BookmarkIcon,
  BreathIcon,
  ChatIcon,
  ClockIcon,
  DocumentIcon,
  EarIcon,
  LibraryIcon,
  LightbulbIcon,
  MicrophoneIcon,
  MindMapIcon,
  NoteIcon,
} from '../components/icons'
import { SOURCE_LABEL_KEY, useProfileData } from '../hooks/useProfileData'
import { focusRing } from '../lib/focus'
import { formatRelativeTime } from '../lib/relativeTime'

/** How many recently-opened documents to show here — the full list
 * lives on /profile; this is a "recent" cut, not a duplicate of it. */
const RECENT_LIBRARY_LIMIT = 4

/**
 * The app's home screen. Promoted 2026-08-12 from a contained
 * `/preview/dashboard` mockup after Amal approved the direction
 * («ابي داشبورد»). The brand + tagline already live in the sidebar
 * (see AppShellSidebar.tsx), so this page deliberately skips a repeat
 * kicker/brand block and opens straight on a light welcome, per
 * team-lead's "keep the dashboard body clean" instruction.
 *
 * Every number here comes from useProfileData() — the same hook
 * /profile uses — so the two pages can never silently disagree about
 * what's actually saved on this device.
 */
export function Dashboard() {
  const { t } = useTranslation()
  const { docList, bookmarkCount, noteCount, lastReadAt, mostRecent, lang, docTitle, openInReader } =
    useProfileData()

  return (
    <main id="dashboard-main" className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-6 text-[1.75rem] font-bold text-ink">{t('dashboard.welcome')}</h1>

      <section aria-labelledby="dashboard-tools-heading" className="mb-5">
        <h2 id="dashboard-tools-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('dashboard.toolsTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Order + the Reading Buddy card below: Amal, 2026-08-14
              pre-share final build — «التقنيات، القارئ، رفيق القراءة»
              first, «والي تحتها نفس الترتيب يظل» (Mind Maps/Library/
              AI Assistant/Calm/Letter Sounds keep their existing
              relative order, just shifted down). */}
          <ToolCard
            to="/techniques"
            icon={<LightbulbIcon className="size-6" />}
            title={t('landing.techniques')}
            description={t('dashboard.toolTechniquesDesc')}
          />
          <ToolCard
            to="/reader"
            icon={<DocumentIcon className="size-6" />}
            title={t('reader.kicker')}
            description={t('dashboard.toolReaderDesc')}
          />
          {/* Reading Buddy card — RE-ADDED 2026-08-14 (Amal's pre-share
              request; nibras-qa had independently flagged this exact
              omission as P2-c: the sidebar links to /reading-buddy but
              the dashboard grid never did). MicrophoneIcon matches the
              sidebar's own icon for this destination. Description
              reuses the EXISTING, already-shipped dashboard.
              toolReadingBuddyDesc key (purpose-built for this exact
              card slot, unused since task #114 removed the earlier,
              then-redundant version of this card) rather than new
              copy — deliberately NOT readingCoach.subtitle (the page's
              own longer "companion...guidance" framing leans toward
              describing the English-only listening-COACH behavior,
              which would overclaim for Arabic, where Reading Buddy
              only reads TO you, per #150's listening-deferred honesty
              work). "Listen along at your own pace" describes the
              user listening to Nibras, the one direction genuinely
              true in BOTH languages today — flagged to team-lead for
              a language-specialist honesty re-check in this new
              context, not assumed sufficient just because it already
              shipped once before. */}
          <ToolCard
            to="/reading-buddy"
            icon={<MicrophoneIcon className="size-6" />}
            title={t('dashboard.navReadingBuddy')}
            description={t('dashboard.toolReadingBuddyDesc')}
          />
          {/* Promoted from "Soon" 2026-08-13 — demo maps on the example
              texts, real generation still needs an AI backend (see
              pages/MindMaps.tsx). */}
          <ToolCard
            to="/mind-maps"
            icon={<MindMapIcon className="size-6" />}
            title={t('dashboard.navMindMaps')}
            description={t('dashboard.toolMindMapsDesc')}
          />
          {/* Added 2026-08-13 alongside the dedicated Library page —
              same store as the "Recently opened" section below, just
              the tool-grid's own entry point into it. */}
          <ToolCard
            to="/library"
            icon={<LibraryIcon className="size-6" />}
            title={t('library.title')}
            description={t('dashboard.toolLibraryDesc')}
          />
          <ToolCard
            to="/reader"
            icon={<ChatIcon className="size-6" />}
            title={t('dashboard.navAiAssistant')}
            description={t('dashboard.toolAiAssistantDesc')}
          />
          {/* Added 2026-08-13 alongside Calm Space (now «سُكون»/
              "Calmness") itself — same /reader-embedded-feature pattern
              as AI Assistant above (no standalone route of its own;
              opens from the Reader's header). */}
          <ToolCard
            to="/reader"
            icon={<BreathIcon className="size-6" />}
            title={t('calm.title')}
            description={t('dashboard.toolCalmSpaceDesc')}
          />
          {/* Letter Sounds / «أصوات الحروف» (task #110, 2026-08-13,
              first visual slice, a few demo letters). No longer `wide`
              (2026-08-14, Reading Buddy re-added above): the grid is
              back to 8 cards — even — so the odd-one-out full-width
              treatment (see ToolCard's own `wide` doc comment) isn't
              needed here anymore. */}
          <ToolCard
            to="/letter-sounds"
            icon={<EarIcon className="size-6" />}
            title={t('letterSounds.title')}
            description={t('dashboard.toolLetterSoundsDesc')}
          />
        </div>
      </section>

      {/* Stat tiles — real on-device numbers, zero fabricated. No
          visible heading text to attach to (the tool cards above and
          the callout below already frame this section), so a
          role="group" + aria-label stands in for one. */}
      <div role="group" aria-label={t('profile.progressTitle')} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon={<DocumentIcon className="size-5" />}
          value={String(docList.length)}
          label={t('profile.statDocuments')}
        />
        <StatTile
          icon={<BookmarkIcon className="size-5" />}
          value={String(bookmarkCount)}
          label={t('profile.statBookmarks')}
        />
        <StatTile icon={<NoteIcon className="size-5" />} value={String(noteCount)} label={t('profile.statNotes')} />
        <StatTile
          icon={<ClockIcon className="size-5" />}
          value={lastReadAt ? formatRelativeTime(lastReadAt, lang) : t('profile.statLastReadNever')}
          label={t('profile.statLastRead')}
          small
        />
      </div>

      {/* Continue-reading callout — the one restrained warm-accent
          moment in this shell (original's own warm orange #f7a062,
          used nowhere else). Honest empty state when nothing has been
          read yet, not a fake example. */}
      <section
        className="mt-5 rounded-card border border-line bg-card p-5"
        style={{ borderInlineStartWidth: '4px', borderInlineStartColor: '#f7a062' }}
      >
        {mostRecent ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="mb-1 flex items-center gap-2 text-sm font-bold tracking-[0.08em] text-accent uppercase">
                <span aria-hidden="true" className="size-2 flex-none rounded-full bg-[#f7a062]" />
                {t('dashboard.continueReadingKicker')}
              </span>
              <p className="m-0 truncate text-[1.0625rem] font-semibold text-ink">{docTitle(mostRecent)}</p>
              <p className="m-0 text-[0.8125rem] text-ink-muted">
                {t('profile.updatedRelative', { time: formatRelativeTime(mostRecent.updatedAt, lang) })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openInReader(mostRecent.id)}
              className={`flex-none rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active ${focusRing}`}
            >
              {t('profile.openDocument')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="m-0 text-[1.0625rem] font-semibold text-ink">{t('dashboard.continueReadingEmptyTitle')}</p>
              <p className="m-0 text-[0.875rem] text-ink-muted">{t('dashboard.continueReadingEmptyBody')}</p>
            </div>
            <Link
              to="/reader"
              className={`flex-none rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active ${focusRing}`}
            >
              {t('landing.startReading')}
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="dashboard-library-heading" className="mt-5 rounded-card border border-line bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="dashboard-library-heading"
            className="text-sm font-bold tracking-[0.08em] text-accent uppercase"
          >
            {t('dashboard.recentLibraryTitle')}
          </h2>
          {docList.length > 0 && (
            <Link to="/library" className={`text-sm font-semibold text-accent hover:underline ${focusRing}`}>
              {t('dashboard.viewAllInLibrary')}
            </Link>
          )}
        </div>
        {docList.length === 0 ? (
          <p className="text-[0.9375rem] text-ink-muted">{t('profile.libraryEmpty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {docList.slice(0, RECENT_LIBRARY_LIMIT).map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-control border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-[0.9375rem] font-semibold text-ink">{docTitle(doc)}</p>
                  <p className="m-0 text-[0.8125rem] text-ink-muted">
                    {t(SOURCE_LABEL_KEY[doc.sourceType])} ·{' '}
                    {t('profile.updatedRelative', { time: formatRelativeTime(doc.updatedAt, lang) })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openInReader(doc.id)}
                  className={`flex-none rounded-control border-[1.5px] border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
                >
                  {t('profile.openDocument')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function ToolCard({
  to,
  icon,
  title,
  description,
  wide,
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
  /** Spans both grid columns — for a trailing odd-one-out card so it
   * doesn't look orphaned in the 2-column layout. */
  wide?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex items-start gap-4 rounded-card border border-line bg-card p-5 transition-colors hover:border-accent ${wide ? 'sm:col-span-2' : ''} ${focusRing}`}
    >
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-control bg-accent-tint text-accent"
      >
        {icon}
      </span>
      <span>
        <span className="block text-[1.0625rem] font-bold text-ink">{title}</span>
        <span className="block text-[0.8125rem] text-ink-muted">{description}</span>
      </span>
    </Link>
  )
}

// ComingSoonToolCard (a plain non-interactive card shell for a
// not-yet-built feature) was removed 2026-08-13 — AI Assistant was its
// last user, promoted to a real ToolCard above; all 7 Dashboard tool
// cards (Library + Calm Space (now «سُكون»/"Calmness") added later the same day) are real links
// now. Shape was: same card layout as ToolCard
// but a non-interactive <div>, muted (not accent) icon badge + title,
// plus a "Soon" text badge next to the title. Re-add that shape if a
// future card needs it again.

function StatTile({
  icon,
  value,
  label,
  small,
}: {
  icon: ReactNode
  value: string
  label: string
  small?: boolean
}) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <span
        aria-hidden="true"
        className="mb-3 flex size-9 items-center justify-center rounded-full bg-accent-tint text-accent"
      >
        {icon}
      </span>
      <p className={`m-0 font-bold text-ink tabular-nums ${small ? 'text-[1.125rem]' : 'text-[1.5rem]'}`}>{value}</p>
      <p className="m-0 text-[0.75rem] text-ink-muted">{label}</p>
    </div>
  )
}
