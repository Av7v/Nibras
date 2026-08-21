import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { AccessGate } from './AccessGate'
import { AppShellHeader } from './AppShellHeader'
import { AppShellSidebar } from './AppShellSidebar'
import { HeaderSlotProvider } from './HeaderSlot'

/**
 * Primary app-shell for Dashboard/Reader/Techniques/Profile/Privacy/
 * Sign-in: a persistent Oxford-blue sidebar + a sticky header, wrapping
 * routed page content. Promoted 2026-08-12 from the `/preview/dashboard`
 * mockup once Amal approved the direction. Carries its own
 * HeaderSlotProvider (same mechanism the older Layout.tsx used) so the
 * Reader's "Reading settings" header button keeps working here too.
 *
 * `#app-main` is the skip-link target (WCAG 2.4.1) — new for this
 * shell specifically, since it's the only shape in the app with a
 * persistent multi-item sidebar to skip past. It wraps the routed
 * page's own `<main>`, not the header, so activating it lands right at
 * the page content without needing every wrapped page to know about
 * this shell's internals.
 *
 * Owns the mobile nav drawer's shared open state (nibras-qa P0-2,
 * 2026-08-13) — AppShellHeader's menu button opens it, AppShellSidebar
 * renders + closes it (Esc/backdrop/its own close button), and this
 * component also closes it automatically on every route change (a
 * plain `setMobileNavOpen(false)`, not `closeMobileNav` — navigating
 * away is the user's own intent, not a "cancel", so focus should land
 * on the new page rather than being pulled back to the menu button).
 * `closeMobileNav` (used by every OTHER close path — Esc, backdrop,
 * the drawer's own close button) also returns focus to the menu button
 * that opened it, since those paths dismiss the drawer without the
 * user going anywhere.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  function closeMobileNav() {
    setMobileNavOpen(false)
    menuButtonRef.current?.focus()
  }

  return (
    <HeaderSlotProvider>
      <div className="flex min-h-svh">
        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
        >
          {t('dashboard.skipToContent')}
        </a>

        {/* Task #219's client counterpart — mounted once here (not
            per-page) so it's available above every AI-touching route
            (Reader, Reading Buddy, Mind Maps all live under this
            shell). Renders nothing at all unless a real AI call
            actually needs a code and doesn't have a valid one — see
            AccessGate.tsx's own header for why this is reactive, not
            a proactive block on the whole app. */}
        <AccessGate />

        <AppShellSidebar isOpen={mobileNavOpen} onClose={closeMobileNav} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppShellHeader onOpenMenu={() => setMobileNavOpen(true)} menuButtonRef={menuButtonRef} />
          <div id="app-main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            <Outlet />
          </div>
        </div>
      </div>
    </HeaderSlotProvider>
  )
}
