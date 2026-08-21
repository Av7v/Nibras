import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { useHeaderSlotContent } from './HeaderSlot'
import { MenuIcon } from './icons'
import { VoiceSettingsControl } from './VoiceSettingsControl'
import { focusRingInset } from '../lib/focus'

function pageLabelKey(pathname: string): string {
  if (pathname === '/dashboard') return 'dashboard.title'
  if (pathname.startsWith('/reader')) return 'reader.kicker'
  if (pathname.startsWith('/techniques')) return 'landing.techniques'
  if (pathname.startsWith('/mind-maps')) return 'dashboard.navMindMaps'
  // #150 self-caught (2026-08-14) — a real screenshot of the new page
  // showed the breadcrumb silently falling through to "Dashboard"
  // (this function's own default) because /reading-buddy was missing
  // here. Same bug already existed for /letter-sounds, pre-dating
  // #150 — fixed alongside it while already in this file with full
  // context, rather than leaving a known second instance of the exact
  // same gap.
  if (pathname.startsWith('/reading-buddy')) return 'dashboard.navReadingBuddy'
  if (pathname.startsWith('/letter-sounds')) return 'letterSounds.title'
  if (pathname.startsWith('/guide')) return 'guide.title'
  if (pathname.startsWith('/library')) return 'library.title'
  if (pathname.startsWith('/profile')) return 'profile.kicker'
  if (pathname.startsWith('/privacy')) return 'privacy.title'
  if (pathname.startsWith('/signin')) return 'signin.title'
  return 'dashboard.title'
}

/**
 * The app-shell's sticky top header: a route-aware breadcrumb (brand +
 * current page name) + the EN/ع language toggle + whatever the current
 * page injects into the shared HeaderSlot (e.g. the Reader's "Reading
 * settings" toggle — same mechanism the older Layout/Header used, see
 * HeaderSlot.tsx, preserved here so that control keeps working under
 * this shell too). Promoted 2026-08-12 alongside AppShellSidebar.
 *
 * Responsive (nibras-qa P0-2, 2026-08-13): below `md:`, a menu button
 * opens AppShellSidebar as an overlay drawer (AppShell.tsx owns the
 * shared open state + this button's ref, so focus can return to it
 * when the drawer closes). Every control (menu button, breadcrumb,
 * language toggle, each slot button) is a DIRECT `flex-wrap` child of
 * the header itself — deliberately flat, not grouped into nested
 * flex-wrap sub-containers. A first attempt nested the trailing
 * controls in their own `flex flex-wrap` div and found it doesn't
 * self-constrain: a flex item that ends up alone on its own wrapped
 * line sizes to its OWN un-wrapped content's natural width (there's no
 * width limit for ITS children to wrap against unless something forces
 * that div to a bounded width), so the nested wrapping never actually
 * kicked in and the group silently overflowed anyway — confirmed via
 * `getBoundingClientRect()` on every element at 390px width, not
 * assumed from a screenshot alone (a screenshot alone under-reported
 * it: the ~39px overflow fell mostly within a button's own trailing
 * padding, so the *text* still looked complete). The flat structure
 * sidesteps the problem entirely: the breadcrumb carries `flex-1`
 * (grows to fill each line's remaining space, same visual effect
 * `justify-between` gave when there were only 2 groups) and every
 * other control is free to individually drop to whichever line has
 * room, with the breadcrumb's own `truncate` shrinking first.
 */
export function AppShellHeader({
  onOpenMenu,
  menuButtonRef,
}: {
  onOpenMenu: () => void
  menuButtonRef: Ref<HTMLButtonElement>
}) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const slotContent = useHeaderSlotContent()

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-cream/85 px-6 py-3 backdrop-blur-sm sm:px-8">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        aria-label={t('dashboard.openMenuLabel')}
        className={`flex size-9 flex-none items-center justify-center rounded-control text-ink-muted hover:bg-accent-tint hover:text-accent md:hidden ${focusRingInset}`}
      >
        <MenuIcon className="size-5" />
      </button>
      <p className="m-0 min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-muted">
        {t('dashboard.breadcrumbTemplate', { brand: t('brand'), page: t(pageLabelKey(pathname)) })}
      </p>

      <div
        role="group"
        aria-label={t('header.languageLabel')}
        className="inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
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

      <VoiceSettingsControl />

      {slotContent}
    </header>
  )
}
