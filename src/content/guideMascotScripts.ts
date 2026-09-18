/**
 * Per-page script registry for «مرشد نبراس» / the Nibras voice-guide
 * mascot (task #366, 2026-09-13, Amal via team-lead): the lantern gives
 * SCRIPTED (not open AI Q&A) guidance about whatever page it's on,
 * spoken through the app's normal read-aloud path AND shown as an
 * on-screen caption (so it's honest, cheap, reliable, and usable by a
 * deaf/HoH reader too).
 *
 * Keyed by route PATHNAME -> an i18n key that resolves to the
 * bilingual script text (mascot.json's own translation-key
 * convention: content that must follow the UI language lives in the
 * i18n catalogs, not a literal { en, ar } object here — same reasoning
 * content/guideSteps.ts already documents for the OTHER guide feature
 * ("How to use Nibras"), which this mirrors deliberately: both are
 * scripted UI narration ABOUT the app, not content tied to one
 * specific document's own language the way content/exampleTexts.ts's
 * reading passages are).
 *
 * A page with NO entry here simply never shows the mascot (see
 * NibrasGuideMascot.tsx's own early-return) — never a button with
 * nothing to say. Now covers every route under AppShell (see App.tsx),
 * including /privacy and /signin (2026-09-15 P0 fix, below) — those two
 * get a scripted guide entry but deliberately NO `/ask` grounding (see
 * `askPageIdFor` further down), since there's nothing page-specific and
 * vetted to answer questions from on either.
 */
export interface GuideMascotEntry {
  /** i18n key resolving to this page's guide text (spoken + shown as
   * the caption), under the `mascot.*` namespace. */
  scriptKey: string
}

export const GUIDE_MASCOT_SCRIPTS: Record<string, GuideMascotEntry> = {
  '/': { scriptKey: 'mascot.landingScript' },
  '/dashboard': { scriptKey: 'mascot.dashboardScript' },
  '/reader': { scriptKey: 'mascot.readerScript' },
  '/techniques': { scriptKey: 'mascot.techniquesScript' },
  '/reading-buddy': { scriptKey: 'mascot.readingBuddyScript' },
  '/mind-maps': { scriptKey: 'mascot.mindMapsScript' },
  '/letter-sounds': { scriptKey: 'mascot.letterSoundsScript' },
  '/library': { scriptKey: 'mascot.libraryScript' },
  '/profile': { scriptKey: 'mascot.profileScript' },
  '/guide': { scriptKey: 'mascot.guideScript' },
  '/privacy': { scriptKey: 'mascot.privacyScript' },
  '/signin': { scriptKey: 'mascot.signinScript' },
}

// P0 fix (2026-09-15, team-lead — confirmed live): the sidebar launcher
// (MascotLauncher.tsx) renders on every AppShell page regardless of this
// registry, so an exact-match-only lookup left it opening NOTHING on
// App.tsx's two DYNAMIC Techniques routes (`/techniques/:id`,
// `/techniques/category/:category`) — `useLocation().pathname` there is
// the real URL (e.g. `/techniques/r1`), which never equals the literal
// string `/techniques`. Both fall back to the SAME '/techniques' entry:
// the category page and a single technique's detail page are still,
// honestly, "the Techniques feature," not a distinct destination that
// needs its own script. This restores the registry's own invariant
// (its header comment above): a page with no entry shows no launcher at
// all, so a route genuinely outside this map (there is none left now
// among AppShell's children — see App.tsx) still never renders a dead
// button with nothing to say.
export function guideMascotEntryFor(pathname: string): GuideMascotEntry | undefined {
  if (GUIDE_MASCOT_SCRIPTS[pathname]) return GUIDE_MASCOT_SCRIPTS[pathname]
  if (pathname.startsWith('/techniques/')) return GUIDE_MASCOT_SCRIPTS['/techniques']
  return undefined
}

/** The server's own POST /ask allowlist (server/api/_askContext.ts's
 * `AskPageId`) — mirrored here as a plain string-literal type, not
 * imported, since the client bundle and the server process are two
 * separate deployables that don't share a types module. Keep the two
 * lists in sync by hand: a page added to one without the other either
 * 400s (added here, not there) or silently has no grounding (there,
 * not here). Deliberately a SEPARATE, NARROWER list than
 * GUIDE_MASCOT_SCRIPTS above — /privacy and /signin have a scripted
 * guide entry but no real page-specific facts to ground an answer in,
 * so they're intentionally absent here. */
export type AskPageId =
  | '/'
  | '/dashboard'
  | '/reader'
  | '/techniques'
  | '/mind-maps'
  | '/reading-buddy'
  | '/letter-sounds'
  | '/library'
  | '/profile'
  | '/guide'

const ASK_PAGE_IDS: readonly AskPageId[] = [
  '/',
  '/dashboard',
  '/reader',
  '/techniques',
  '/mind-maps',
  '/reading-buddy',
  '/letter-sounds',
  '/library',
  '/profile',
  '/guide',
]

// P1 fix (2026-09-15, rev-web's review + team-lead): NibrasGuideMascot.tsx
// used to send the raw `useLocation().pathname` straight through as the
// /ask pageId. That 400'd on every route this allowlist doesn't cover —
// the two dynamic Techniques routes (pathname is e.g. `/techniques/r1`,
// which never equals the literal `/techniques`) AND /privacy + /signin
// (never in the allowlist at all, on purpose — see the type's own
// comment above). This is the single source of truth both problems
// route through: the caller uses a `null` result to hide the Ask box
// entirely (honest — no fabricated grounding), and normalizes the
// Techniques sub-routes to the one real allowlist entry, same
// normalization guideMascotEntryFor does for the scripted guide.
export function askPageIdFor(pathname: string): AskPageId | null {
  if ((ASK_PAGE_IDS as readonly string[]).includes(pathname)) return pathname as AskPageId
  if (pathname.startsWith('/techniques/')) return '/techniques'
  return null
}
