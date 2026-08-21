import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BrandMarkIcon, ChevronIcon } from '../components/icons'
import { focusRing, focusRingInset } from '../lib/focus'

/**
 * Landing — the app's true first screen, rebuilt 2026-08-13 (Amal, via
 * team-lead) as a real "before you enter the app" welcome, distinct
 * from the Dashboard (now the signed-in-feeling home once you've
 * actually started, moved to `/dashboard`). Deliberately sits OUTSIDE
 * both shells (AppShell's sidebar, and the older Layout's utility
 * header) — its own minimal chrome, since neither an app-nav sidebar
 * nor a "Profile" icon make sense before someone has even started.
 *
 * Content, top to bottom: the brand lockup (mark + name + tagline —
 * "what Nibras is," per the brief), a one-line calm value proposition,
 * the primary "Start"/"ابدأ" CTA (enters the app at /dashboard), and a
 * quiet secondary-links row. Scope call on "quiet links to key
 * features": Techniques + Privacy + the usage guide — genuinely
 * standalone, pre-entry-sensible destinations (a curious visitor can
 * see "how does this work" or read the policy before ever starting).
 * The IN-app features (Reader, Mind Maps, Library, Reading Buddy, AI
 * Assistant, Calm Space (now «سُكون»/"Calmness")) still deliberately stay off this page — they
 * need the app-shell context to make sense and are already
 * comprehensively presented the moment you land on the Dashboard;
 * duplicating them here as a second card grid would fight the
 * "quiet"/calm instruction rather than serve it. Guide added
 * 2026-08-13 alongside the Dashboard's own "surface Library + Calm
 * Space + the guide" pass — the guide fits this row's own "standalone,
 * makes sense before you've started" bar the same way Techniques and
 * Privacy already do; Library/Calm Space (now «سُكون»/"Calmness") don't (see the reasoning
 * above), so they were surfaced on the Dashboard instead, not here.
 *
 * #004aad + cream throughout, matching the app-shell exactly. Bilingual
 * + RTL via the same CSS-logical-property/flex patterns as everywhere
 * else in this app — no manual mirroring needed anywhere on this page.
 */
export function Landing() {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col bg-cream">
      {/* Skip link — finishes an i18n key (landing.skipToCta) that
          existed before this page had any header content to skip past;
          points straight at the CTA's own id, which (being a real
          link) is natively focusable, so no extra tabIndex plumbing is
          needed the way AppShell's skip target required. */}
      <a
        href="#landing-cta"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
      >
        {t('landing.skipToCta')}
      </a>

      <header className="flex justify-end px-6 py-5 sm:px-10">
        <div
          role="group"
          aria-label={t('header.languageLabel')}
          className="inline-flex overflow-hidden rounded-full border-[1.5px] border-line-strong"
        >
          <button
            type="button"
            aria-pressed={i18n.language === 'en'}
            onClick={() => i18n.changeLanguage('en')}
            className={`px-3.5 py-1.5 text-sm font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            EN
          </button>
          <button
            type="button"
            lang="ar"
            aria-pressed={i18n.language === 'ar'}
            onClick={() => i18n.changeLanguage('ar')}
            className={`px-3.5 py-1.5 text-sm font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            ع
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-9 px-6 pb-16 text-center sm:px-10">
        <div className="flex flex-col items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-14 flex-none items-center justify-center rounded-card bg-accent text-accent-ink"
          >
            <BrandMarkIcon className="size-7" />
          </span>
          <div>
            <p className="m-0 text-[1.625rem] font-bold text-ink">{t('brand')}</p>
            <p className="m-0 mt-1 text-[0.9375rem] text-ink-muted">{t('dashboard.brandTagline')}</p>
          </div>
        </div>

        <h1 className="max-w-[34rem] text-[2rem] leading-[1.35] font-bold text-ink rtl:text-[2.25rem] rtl:leading-[1.55]">
          {t('landing.headline')}
        </h1>

        <Link
          id="landing-cta"
          to="/dashboard"
          className={`inline-flex items-center gap-2 rounded-lg bg-accent px-9 py-4 text-[1.0625rem] font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active ${focusRing}`}
        >
          {t('landing.startApp')}
          <ChevronIcon className="size-[18px] rtl:-scale-x-100" />
        </Link>

        <nav aria-label={t('landing.secondaryLinks')}>
          <ul className="flex items-center gap-2.5 text-[0.9375rem]">
            <li>
              <Link
                to="/techniques"
                className={`border-b border-transparent pb-0.5 text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
              >
                {t('landing.techniques')}
              </Link>
            </li>
            <li aria-hidden="true" className="text-line-strong">
              &middot;
            </li>
            <li>
              <Link
                to="/privacy"
                className={`border-b border-transparent pb-0.5 text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
              >
                {t('landing.privacy')}
              </Link>
            </li>
            <li aria-hidden="true" className="text-line-strong">
              &middot;
            </li>
            <li>
              <Link
                to="/guide"
                className={`border-b border-transparent pb-0.5 text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
              >
                {t('guide.sidebarLink')}
              </Link>
            </li>
          </ul>
        </nav>
      </main>
    </div>
  )
}
