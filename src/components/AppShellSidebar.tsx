import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import {
  BrandMarkIcon,
  CloseIcon,
  DocumentIcon,
  EarIcon,
  HelpIcon,
  HomeIcon,
  LibraryIcon,
  LightbulbIcon,
  LockIcon,
  MicrophoneIcon,
  MindMapIcon,
  PersonIcon,
} from './icons'
import { focusRing, focusRingInset } from '../lib/focus'
import { usePageBackgroundPreference } from '../hooks/usePageBackgroundPreference'
import { MascotLauncher } from './MascotLauncher'

/**
 * The app's primary navigation — a persistent brand-navy (`#002147`,
 * Oxford navy, Amal's primary as of 2026-09-15 — supersedes the
 * deck-sampled `#004aad` used 2026-08-12–2026-09-15; see index.css's own
 * accent comment for the full derivation + contrast history) sidebar
 * wrapping every route
 * under AppShell (Dashboard, Reading Techniques, Reader, Reading
 * Buddy, Mind Maps, Letter Sounds, Library, Profile, Privacy,
 * Sign-in — see App.tsx for the current, authoritative list; this
 * sidebar's own nav items further below are the live source of what's
 * actually linked). Promoted 2026-08-12 from a contained one-screen
 * preview at `/preview/dashboard` after Amal approved the direction
 * («ابي داشبورد» — "I want a dashboard").
 *
 * Reader/Techniques/Profile/Dashboard/Mind Maps all link to real,
 * shipped destinations now (Mind Maps promoted from "Soon" 2026-08-13
 * — demo maps on the example texts; real generation on any text still
 * needs an AI backend, see pages/MindMaps.tsx). Reading Buddy's own nav
 * item was REMOVED 2026-08-14 (task #114, Amal noticed it looked like
 * its own separate section when the ONLY thing that existed then was
 * the in-Reader quick player, ReadingBuddyPlayer.tsx) and RE-ADDED the
 * same day (task #150) once Reading Buddy became a real two-way
 * companion with its own dedicated destination (/reading-buddy,
 * pages/ReadingBuddy.tsx) — this is a genuinely different situation
 * from the one #114 fixed, not a silent revert of that decision; the
 * in-Reader player is untouched and still there as a convenience. AI
 * Assistant's own honest "coming soon" row no longer lives in THIS
 * sidebar at all (see this file's own closing comment below for when/why
 * it left) — it's Dashboard.tsx's ComingSoonToolCard now, the same
 * "no fake success" rule SignIn also follows. Techniques was renamed «التقنيات»->«تقنيات القراءة» /
 * "Techniques"->"Reading Techniques" (task #190) and moved to position 2,
 * right after Dashboard (task #192, same day) — both confirmed by Amal via
 * team-lead, 2026-08-15; see the NavItem's own comment below for the
 * order history.
 *
 * Active-item highlighting is route-driven (`useLocation`), not
 * hardcoded — this now wraps multiple real routes, unlike the
 * single-screen preview it started as.
 *
 * Responsive (nibras-qa P0-2, 2026-08-13 — no mobile layout existed at
 * all below 780px; every page overflowed under 500px): ONE `<nav>`
 * tree, no duplicated markup between a "desktop" and "mobile" copy —
 * only its CSS position/visibility changes. At `md:` (768px, confirmed
 * against this project's own compiled Tailwind v4 output rather than
 * assumed) and up it's `md:static` and always visible, exactly as
 * before. Below `md:` it's `fixed` + off-canvas by default (translated
 * fully past the reading-direction START edge — genuinely directional,
 * so the off state is mirrored explicitly via `rtl:`, same pattern
 * already used for ChevronIcon elsewhere in this app), and slides in as
 * an overlay drawer when `isOpen` (opened via AppShellHeader's menu
 * button, AppShell.tsx owns the shared state). While open: a backdrop,
 * a focus trap + Esc-to-close (mirrors CalmSpace.tsx's established
 * dialog pattern), and body-scroll-lock — AppShell.tsx's `onClose`
 * callback also returns focus to the menu button that opened it.
 */
export function AppShellSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  // Task #350 whole-screen (Amal, 2026-09-13): when a page colour is chosen the
  // sidebar joins the uniform tint. Its background becomes the tint (via
  // `--color-page-bg`, set by the App-root effect) and its foreground FLIPS to
  // dark ink by scope-overriding `--color-accent-ink` -> `--color-ink` on THIS
  // element only. The whole sidebar already keys off accent-ink (text-accent-ink
  // + the accent-ink/NN active/hover/chip/muted mixes), so they all flip
  // together: labels/wordmark/tagline/footer/guest go dark; the active item
  // becomes ink@15% (a deeper shade of the tint); hover ink@10%. `--color-accent`
  // is deliberately NOT overridden, so the keyboard focus ring stays brand-navy
  // (clearly visible on the light tint). 'No colour' -> no override, so the
  // original navy background + white text scheme is restored unchanged.
  const { value } = usePageBackgroundPreference()
  const tinted = value !== 'none'
  const navStyle: CSSProperties | undefined = tinted
    ? ({ backgroundColor: 'var(--color-page-bg)', '--color-accent-ink': 'var(--color-ink)' } as CSSProperties)
    : undefined

  // Focus the drawer's own close button on open — only meaningful below
  // md (the only way `isOpen` becomes true), matches CalmSpace.tsx's
  // "focus the dialog's primary dismiss/action control on open".
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus()
  }, [isOpen])

  // Esc closes; Tab/Shift+Tab traps focus inside the drawer while open.
  // Inert whenever isOpen is false (desktop, or the drawer simply
  // hasn't been opened) — same shape as CalmSpace.tsx's own effect.
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab' && navRef.current) {
        const focusables = navRef.current.querySelectorAll<HTMLElement>(
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
  }, [isOpen, onClose])

  // The drawer overlays page content while open — lock background
  // scroll, same as CalmSpace.tsx. A no-op at md: and up (isOpen can't
  // meaningfully be true there — the button that sets it is md:hidden).
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop — mobile-drawer-only (md:hidden keeps it from ever
          rendering visible at desktop widths even if isOpen is stale
          true from a mid-session resize). Clicking it closes the
          drawer, same as CalmSpace.tsx's own backdrop. */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink/45 md:hidden"
        />
      )}
      <nav
        ref={navRef}
        aria-label={t('dashboard.sidebarNavLabel')}
        style={navStyle}
        // `invisible` (not just the off-screen transform) below md when
        // closed: a `transform`-translated element is still fully
        // Tab-reachable and screen-reader-navigable even while visually
        // off-canvas — a keyboard/AT user on a narrow viewport would
        // otherwise tab into invisible nav links before ever reaching
        // the page's own visible content. `visibility` (unlike
        // `display:none`) removes it from the tab order/AT tree while
        // still allowing the transform's slide-in transition to work
        // once it flips back to visible. `md:visible` unconditionally
        // restores normal, always-interactive behavior at md: and up,
        // regardless of the mobile-only `isOpen` state.
        //
        // `md:rtl:translate-x-0` (not just plain `md:translate-x-0`) —
        // found via a real regression run, 2026-08-13: at a DESKTOP
        // width in Arabic, the closed-state's `rtl:translate-x-full`
        // and the plain `md:translate-x-0` are BOTH simultaneously
        // "valid" (width>=768 AND dir=rtl are both true at once), and
        // Tailwind gives them equal specificity — so it comes down to
        // which rule the compiler happened to emit later in the
        // stylesheet, which (confirmed by literally checking the built
        // CSS's byte offsets, not assumed) was `rtl:translate-x-full`,
        // silently leaving the sidebar translated off-screen on desktop
        // Arabic even though `md:static`/`md:visible` correctly won
        // their own, non-conflicting overrides. A compound variant that
        // names BOTH conditions together resolves the ambiguity
        // explicitly rather than gambling on variant emission order.
        className={`fixed inset-y-0 start-0 z-40 flex w-[255px] flex-none flex-col justify-between bg-accent py-6 transition-transform duration-200 motion-reduce:transition-none md:static md:z-auto md:visible md:translate-x-0 md:rtl:translate-x-0 ${tinted ? 'border-e border-ink/15 ' : ''}${
          isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full rtl:translate-x-full'
        }`}
      >
        <div>
          <div className="mx-5 mb-8">
            <div className="flex items-center justify-between gap-2">
              {/* Task #144 (2026-08-14, Amal): the brand wordmark + book
                  icon should return to the LANDING page («ابدأ»/Start,
                  route "/"), not the Dashboard — the two are separate
                  pages (see App.tsx: Landing is "/", Dashboard is
                  "/dashboard", split 2026-08-13). Already a real
                  react-router Link (keyboard-focusable, accessible) —
                  this task only needed the target route corrected. */}
              <Link
                to="/"
                className={`flex items-center gap-2.5 text-lg font-bold text-accent-ink ${focusRing}`}
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-control bg-accent-ink/15">
                  <BrandMarkIcon className="size-[18px]" />
                </span>
                {t('brand')}
              </Link>
              {/* Drawer-only close button — the persistent desktop
                  sidebar has nothing to dismiss, so this only needs to
                  exist/show below md:. */}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t('dashboard.closeMenuLabel')}
                className={`flex size-8 flex-none items-center justify-center rounded-control text-accent-ink/82 hover:bg-accent-ink/10 hover:text-accent-ink md:hidden ${focusRingInset}`}
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
            {/* Brand tagline — the product's core positioning: an
                AI-powered cognitive translator. A quiet supporting line
                under the name, not part of the link's own accessible
                name (it's brand messaging, not part of "where this
                goes"), but still real text a screen reader announces. */}
            {/* Opacity recalibrated 2026-08-12 for the brand-blue swap
                (#004aad is notably brighter than the old #002147, so the
                same opacity gives less contrast against it — /65 dropped
                to 4.36:1, below AA; /75 restores 5.27:1, script-verified,
                see index.css's accent comment for the full re-check).
                2026-09-15: accent reverted to #002147 (this time as the
                permanent primary, see index.css) — going DARKER only
                raises this ratio further (/75 is now 9.47:1), so /75
                stays correct with room to spare; no change needed. */}
            <p className="mt-1.5 text-[0.6875rem] leading-snug text-accent-ink/75">{t('dashboard.brandTagline')}</p>
          </div>

          <ul className="m-0 flex list-none flex-col gap-1 px-3">
          <NavItem
            to="/dashboard"
            icon={<HomeIcon className="size-[18px]" />}
            label={t('dashboard.title')}
            current={pathname === '/dashboard'}
          />
          {/* Reading Techniques / «تقنيات القراءة» — moved to position 2
              (Amal, 2026-08-15, confirmed via team-lead, same pre-share
              final build as the #190 title rename): sits right after
              Dashboard and before the Reader now. Was directly after
              Reading Buddy before this move. */}
          <NavItem
            to="/techniques"
            icon={<LightbulbIcon className="size-[18px]" />}
            label={t('landing.techniques')}
            current={pathname.startsWith('/techniques')}
          />
          <NavItem
            to="/reader"
            icon={<DocumentIcon className="size-[18px]" />}
            label={t('reader.kicker')}
            current={pathname.startsWith('/reader')}
          />
          {/* Reading Buddy / رفيق القراءة (task #150, 2026-08-14) — the
              two-way companion's own destination (reads to you AND
              listens to you), see this file's own header for how this
              relates to the in-Reader quick player. Positioned directly
              under the Reader (Amal, 2026-08-14, pre-share final build —
              "تنقلها وتحطها تحت القارئ"); was after Mind Maps before. */}
          <NavItem
            to="/reading-buddy"
            icon={<MicrophoneIcon className="size-[18px]" />}
            label={t('dashboard.navReadingBuddy')}
            current={pathname.startsWith('/reading-buddy')}
          />
          <NavItem
            to="/mind-maps"
            icon={<MindMapIcon className="size-[18px]" />}
            label={t('dashboard.navMindMaps')}
            current={pathname.startsWith('/mind-maps')}
          />
          {/* Letter Sounds / «أصوات الحروف» (task #110, 2026-08-13) —
              first visual slice, a few demo letters. */}
          <NavItem
            to="/letter-sounds"
            icon={<EarIcon className="size-[18px]" />}
            label={t('letterSounds.title')}
            current={pathname.startsWith('/letter-sounds')}
          />
          <NavItem
            to="/library"
            icon={<LibraryIcon className="size-[18px]" />}
            label={t('library.title')}
            current={pathname.startsWith('/library')}
          />
          <NavItem
            to="/profile"
            icon={<PersonIcon className="size-[18px]" />}
            label={t('profile.kicker')}
            current={pathname.startsWith('/profile')}
          />
          {/* «مرشد نبراس» docked launcher — moved UP to sit directly under
              Profile as the last main-nav item, bigger, so it reads as a
              prominent helper and is not buried at the very bottom (Amal
              2026-09-14: «ترفعه بعد الملف الشخصي مهو آخر شي وكبّره»). Clicking
              opens the chat popup, which floats free of this sidebar's
              transform (mounted once in AppShell via lib/mascotChat). */}
          <li>
            <MascotLauncher variant="sidebar" onActivate={onClose} />
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-1 px-3">
        {/* Two quiet links, not two more main NavItems — the nav list
            above has been settled twice already (team-lead), and
            "how do I use this"/"what data do you keep" are a different
            kind of destination than the 6 feature items above them.
            Sit right above the Profile card so they're always
            reachable, wherever you are in the app. Privacy added
            2026-08-13 (nibras-qa P1-5) — it was previously reachable
            ONLY from Landing.tsx, never from inside the app itself. */}
        <Link
          to="/guide"
          className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[0.8125rem] font-medium text-accent-ink/72 hover:bg-accent-ink/10 hover:text-accent-ink ${focusRing}`}
        >
          <HelpIcon className="size-4" />
          {t('guide.sidebarLink')}
        </Link>

        <Link
          to="/privacy"
          className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[0.8125rem] font-medium text-accent-ink/72 hover:bg-accent-ink/10 hover:text-accent-ink ${focusRing}`}
        >
          <LockIcon className="size-4" />
          {t('landing.privacy')}
        </Link>

        <Link
          to="/profile"
          className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 hover:bg-accent-ink/10 ${focusRing}`}
        >
          <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-ink/15 text-accent-ink">
            <PersonIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.8125rem] font-semibold text-accent-ink">
              {t('profile.guestName')}
            </span>
            {/* /70 -> /78: same brand-blue recalibration as the tagline above. */}
            <span className="block truncate text-[0.75rem] text-accent-ink/78">{t('profile.notSignedIn')}</span>
          </span>
        </Link>

        {/* «مرشد نبراس» launcher moved UP into the nav list, directly under
            the Profile item (Amal 2026-09-14) — see the <li> after the
            Profile NavItem above. */}
      </div>
    </nav>
    </>
  )
}

function NavItem({
  to,
  icon,
  label,
  current,
}: {
  to: string
  icon: ReactNode
  label: string
  current?: boolean
}) {
  return (
    <li>
      <Link
        to={to}
        aria-current={current ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${focusRing} ${
          current
            ? 'bg-accent-ink/15 text-accent-ink'
            : 'text-accent-ink/82 hover:bg-accent-ink/10 hover:text-accent-ink'
        }`}
      >
        {icon}
        {label}
      </Link>
    </li>
  )
}

// ComingSoonNavItem (the "/55" -> "/72" brand-blue-recalibrated honest
// "Soon" row) was removed 2026-08-13 — Mind Maps was its last user,
// promoted to a real NavItem above. Dashboard.tsx's ComingSoonToolCard
// (a different component) still carries the AI Assistant card's honest
// "Soon" state — nothing built ever loses that pattern, this row
// specifically no longer needed it. Re-add the same shape here if a
// future sidebar item needs it again.
