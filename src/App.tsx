import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { usePageBackgroundPreference } from './hooks/usePageBackgroundPreference'
import { ACCENT_THEME_VARS, deriveAccentTheme, type AccentTheme } from './lib/accentTheme'
import { mixWithWhite } from './lib/color'
import { TINTS } from './lib/readingSettings'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { Reader } from './pages/Reader'
import { Techniques } from './pages/Techniques'
import { TechniqueCategoryView } from './pages/TechniqueCategoryView'
import { TechniqueDetail } from './pages/TechniqueDetail'
import { MindMaps } from './pages/MindMaps'
import { LetterSounds } from './pages/LetterSounds'
import { ReadingBuddy } from './pages/ReadingBuddy'
import { Guide } from './pages/Guide'
import { Library } from './pages/Library'
import { Privacy } from './pages/Privacy'
import { Profile } from './pages/Profile'
import { SignIn } from './pages/SignIn'

const router = createBrowserRouter([
  // Landing — the true first screen, rebuilt 2026-08-13 (Amal, via
  // team-lead) as a real "before you enter the app" welcome, standalone
  // at "/" with its own minimal chrome (see Landing.tsx's own comment
  // for why it uses neither the AppShell sidebar nor a per-route
  // header). The "Start" CTA enters the app at /dashboard, which is
  // where "/" used to point before this change.
  { path: '/', element: <Landing /> },
  {
    // Primary app-shell (persistent brand-navy #002147 sidebar +
    // header, Amal's primary as of 2026-09-15 — see index.css's own
    // accent comment for the history) — promoted 2026-08-12 from a
    // contained /preview/dashboard
    // mockup once Amal approved the direction («ابي داشبورد»). Wraps
    // Dashboard (home), Reader, Techniques(+detail), Mind Maps, Library,
    // Profile, Privacy, Sign-in. See components/AppShell.tsx.
    //
    // Privacy + Sign-in moved in here 2026-08-13 (nibras-qa P1-11,
    // bundled with the P0-2 mobile-layout fix): they used to keep the
    // older top-nav `Layout`/`Header` shell, which QA flagged as
    // reading "like a different app" mid-session — no other functional
    // reason for the split existed. `Layout.tsx`/`Header.tsx` now have
    // zero consumers app-wide (confirmed via grep) — left in place
    // rather than deleted (file deletion is outside this agent's
    // Class 0-1 ceiling; flagged to team-lead as a proposed follow-up
    // cleanup, not done here). Vite never bundles an unimported file,
    // so this has no effect on the shipped app either way.
    element: <AppShell />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/reader', element: <Reader /> },
      { path: '/techniques', element: <Techniques /> },
      // Category page (task #128) BEFORE the :id detail route below —
      // react-router ranks by segment count/specificity regardless of
      // declaration order (a literal "category" segment never collides
      // with a real technique id, which is always short like 'r1'), but
      // keeping this next to its sibling reads clearest.
      { path: '/techniques/category/:category', element: <TechniqueCategoryView /> },
      { path: '/techniques/:id', element: <TechniqueDetail /> },
      { path: '/mind-maps', element: <MindMaps /> },
      // Reading Buddy / رفيق القراءة (#150, 2026-08-14) — the two-way
      // companion's dedicated home (reads to you AND listens to you).
      // The in-Reader quick read-aloud player (ReadingBuddyPlayer.tsx)
      // stays where it is, unchanged — this is a separate destination,
      // not a replacement (see ReadingBuddy.tsx's own header).
      { path: '/reading-buddy', element: <ReadingBuddy /> },
      // Letter Sounds / «أصوات الحروف» (task #110, 2026-08-13) — first
      // visual slice, a few demo letters only (see LetterSounds.tsx's
      // own header).
      { path: '/letter-sounds', element: <LetterSounds /> },
      { path: '/guide', element: <Guide /> },
      { path: '/library', element: <Library /> },
      { path: '/profile', element: <Profile /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/signin', element: <SignIn /> },
    ],
  },
])

function App() {
  // Task #350: the ONE place that actually PAINTS the chosen page colour.
  // Whole-screen (Amal, 2026-09-13): the tint covers the ENTIRE light screen,
  // not just the body canvas, by setting THREE light-surface variables on
  // the root:
  //   - `--color-page-bg` (index.css's body canvas),
  //   - `--color-cream` (the header + every `bg-cream` chrome surface), and
  //   - `--color-card` (every `bg-card` panel: the dashboard/tool cards, the
  //     stat cards, popovers) — a LIGHTER shade of the tint, not the same
  //     hex as the two above (task #398 review, FIX 3, 2026-09-14): setting
  //     all three to one identical hex made cards visually collapse into the
  //     page/header and lose their elevation. `mixWithWhite` (lib/color.ts)
  //     blends the tint 55% toward white, which reproduces this app's own
  //     already-approved default page-bg-vs-card relationship almost
  //     exactly (see that function's own doc comment for the sanity check).
  //     ink-on-card contrast only ever IMPROVES from this (lighter
  //     background, same dark ink), so no new AA risk — re-verified live,
  //     both preset tints, see task #398/#407 report.
  //
  // Task #367 (2026-09-13, Amal via team-lead, same day): extends this to
  // the ACCENT family too — `--color-accent`/`-hover`/`-active`/`-darker`/
  // `-tint` — so the chosen colour drives the WHOLE theme, not just
  // backgrounds: every button, the play button, active pills, the sidebar
  // rail, and the Reading Buddy/Reader voice bar all read `bg-accent`/
  // `text-accent`/etc. Tailwind classes that resolve to these SAME CSS
  // variables (confirmed via grep — none of those ~40 usages hardcode a
  // literal hex), so overriding the variables here recolors all of them
  // with ZERO changes to any of those component files. See
  // lib/accentTheme.ts for the derivation itself (hold the chosen colour's
  // hue, force full saturation, search for a lightness that keeps white
  // button-text >= WCAG AA against even the lightest family member).
  // `--color-ink`, borders, and shadows are still left untouched either
  // way, so cards stay legible as subtly bordered panels and dark ink
  // keeps its own already-verified contrast on all five (light) tints.
  //
  // Mounted here (App's own root), not inside AppShell, because Landing
  // (`/`, below) sits OUTSIDE AppShell and must still pick up the colour.
  // Runs on every value change (initial load included), so a reload or a
  // cross-tab change repaints immediately, regardless of the active route.
  const { value } = usePageBackgroundPreference()
  useEffect(() => {
    const root = document.documentElement.style
    const SURFACE_VARS = ['--color-page-bg', '--color-cream', '--color-card']
    const ACCENT_VARS = Object.values(ACCENT_THEME_VARS)
    // 'none' (Amal, 2026-09-13): NO override — remove every var so the app
    // falls back to index.css's native defaults (its original look,
    // navy accent included).
    if (value === 'none') {
      for (const v of SURFACE_VARS) root.removeProperty(v)
      for (const v of ACCENT_VARS) root.removeProperty(v)
      return
    }
    const tint = TINTS[value]
    // page-bg + cream stay the RAW tint (the "whole screen" look task #350
    // asked for); card alone gets a lighter mix so it stays visually
    // distinct from both — see this effect's own header comment (FIX 3).
    root.setProperty('--color-page-bg', tint)
    root.setProperty('--color-cream', tint)
    root.setProperty('--color-card', mixWithWhite(tint, 0.55))

    // Task #367: 'white' is the one preset with no real hue to derive
    // from (hexToHsl documents a fully desaturated input as HUE-LESS —
    // it returns h=0/red by convention, since hue is meaningless at
    // s=0) — deriving "red buttons" from a reader picking a plain WHITE
    // background would be an arbitrary artifact of that convention, not
    // a reflection of anything they actually chose. The page background
    // still goes white either way; only the accent stays at its
    // ORIGINAL navy, same as 'none'.
    if (value === 'white') {
      for (const v of ACCENT_VARS) root.removeProperty(v)
      return
    }
    const theme = deriveAccentTheme(tint)
    for (const key of Object.keys(ACCENT_THEME_VARS) as (keyof AccentTheme)[]) {
      root.setProperty(ACCENT_THEME_VARS[key], theme[key])
    }
  }, [value])

  return <RouterProvider router={router} />
}

export default App
