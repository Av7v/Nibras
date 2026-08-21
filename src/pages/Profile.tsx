import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProfileData } from '../hooks/useProfileData'
import { formatRelativeTime } from '../lib/relativeTime'
import { BookmarkIcon, LibraryIcon, NoteIcon, PersonIcon, SlidersIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

/** The member area — design/UI only this pass (no real accounts yet,
 * per Amal). Everything shown is genuine on-device data (reading
 * settings, saved documents, bookmarks, notes) via useProfileData() —
 * the same hook the Dashboard home uses, so the two pages can never
 * silently disagree about what's actually saved on this device (was
 * duplicated inline logic before the Dashboard was promoted from a
 * preview to the real app 2026-08-12; extracted then). No reading
 * streak: the on-device data model only has createdAt/updatedAt per
 * document, not a real per-day activity log, so a "streak" would be an
 * inference dressed up as a fact — skipped rather than faked, matching
 * the project's "no fake numbers" rule generally. */
export function Profile() {
  const { t } = useTranslation()
  const {
    docList,
    bookmarkCount,
    noteCount,
    lastReadAt,
    lang,
    openInReader,
    settingsSummary,
    rollup: fullRollup,
  } = useProfileData()

  const rollup = fullRollup.slice(0, 8)

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 sm:px-10">
      {/* Was a <span>, with the "Guest" name below it as the real h1 —
          QA (P1-9/2026-08-13) found the page's heading text was
          literally "Guest", not "Profile". Same fix shape as Reader.tsx:
          the page's own kicker becomes its h1 (tag-only change, same
          styling), the more specific name/title below it steps down to
          h2 — same valid outline shape this page's OTHER sections
          already use (multiple h2s under one h1). */}
      <h1 className="mb-2 block text-[0.8125rem] font-bold tracking-[0.08em] text-accent uppercase">
        {t('profile.kicker')}
      </h1>

      <div className="mb-8 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 flex-none items-center justify-center rounded-full bg-accent-tint text-accent"
        >
          <PersonIcon className="size-8" />
        </span>
        <div>
          <h2 className="m-0 text-[1.75rem] font-bold text-ink">{t('profile.guestName')}</h2>
          <p className="m-0 text-[0.875rem] text-ink-muted">{t('profile.notSignedIn')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-labelledby="settings-heading" className="rounded-card border border-line bg-card p-5">
          <h2
            id="settings-heading"
            className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase"
          >
            {t('profile.settingsTitle')}
          </h2>
          <p className="mb-3 text-[0.9375rem] text-ink">{settingsSummary}</p>
          <Link
            to="/reader"
            className={`inline-flex items-center gap-2 rounded-control text-sm font-semibold text-accent hover:underline ${focusRing}`}
          >
            <SlidersIcon className="size-4" />
            {t('profile.openSettingsLink')}
          </Link>
        </section>

        <section aria-labelledby="progress-heading" className="rounded-card border border-line bg-card p-5">
          <h2
            id="progress-heading"
            className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase"
          >
            {t('profile.progressTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('profile.statDocuments')} value={String(docList.length)} />
            <Stat label={t('profile.statBookmarks')} value={String(bookmarkCount)} />
            <Stat label={t('profile.statNotes')} value={String(noteCount)} />
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-muted">
            {t('profile.statLastRead')}:{' '}
            {lastReadAt ? formatRelativeTime(lastReadAt, lang) : t('profile.statLastReadNever')}
          </p>
        </section>
      </div>

      {/* Non-duplicative on purpose (2026-08-13, the dedicated Library
          page): a short summary + link, not the full per-item list —
          the full list now lives at /library (same underlying store,
          via useProfileData/useDocuments), so there's exactly one
          place to add/open/remove a book instead of two competing
          ones. */}
      <section aria-labelledby="library-heading" className="mt-5 rounded-card border border-line bg-card p-5">
        <h2 id="library-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('profile.libraryTitle')}
        </h2>
        <p className="mb-3 text-[0.9375rem] text-ink-muted">
          {docList.length === 0 ? t('profile.libraryEmpty') : t('profile.libraryCount', { count: docList.length })}
        </p>
        <Link
          to="/library"
          className={`inline-flex items-center gap-2 rounded-control text-sm font-semibold text-accent hover:underline ${focusRing}`}
        >
          <LibraryIcon className="size-4" />
          {t('profile.goToLibrary')}
        </Link>
      </section>

      <section aria-labelledby="rollup-heading" className="mt-5 rounded-card border border-line bg-card p-5">
        <h2 id="rollup-heading" className="mb-4 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('profile.bookmarksNotesTitle')}
        </h2>
        {rollup.length === 0 ? (
          <p className="text-[0.9375rem] text-ink-muted">{t('profile.bookmarksNotesEmpty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {rollup.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openInReader(item.docId)}
                  className={`flex w-full items-start gap-2.5 rounded-control px-2 py-1.5 text-start hover:bg-accent-tint ${focusRing}`}
                >
                  {item.kind === 'bookmark' ? (
                    <BookmarkIcon className="mt-0.5 size-4 flex-none text-accent" />
                  ) : (
                    <NoteIcon className="mt-0.5 size-4 flex-none text-accent" />
                  )}
                  <span className="min-w-0 flex-1 text-[0.875rem] text-ink">
                    {item.kind === 'bookmark'
                      ? t('profile.bookmarkInDocument', { title: item.docTitle })
                      : t('profile.noteInDocument', { title: item.docTitle })}
                    {item.kind === 'note' && item.text && (
                      <span className="block truncate text-ink-muted italic">&ldquo;{item.text}&rdquo;</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="account-heading" className="mt-5 rounded-card border border-line bg-card p-5">
        <h2 id="account-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('profile.accountTitle')}
        </h2>
        <p className="mb-4 max-w-[42rem] text-[0.875rem] leading-relaxed text-ink-muted">
          {t('profile.accountPrivacyNote')}
        </p>
        <Link
          to="/signin"
          className={`inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active ${focusRing}`}
        >
          {t('profile.signInButton')}
        </Link>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-accent-tint px-3 py-2.5 text-center">
      <p className="m-0 text-[1.375rem] font-bold text-accent tabular-nums">{value}</p>
      <p className="m-0 text-[0.75rem] text-ink-muted">{label}</p>
    </div>
  )
}
