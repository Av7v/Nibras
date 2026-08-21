import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
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
    // Primary app-shell (persistent brand-blue #004aad sidebar +
    // header) — promoted 2026-08-12 from a contained /preview/dashboard
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
  return <RouterProvider router={router} />
}

export default App
