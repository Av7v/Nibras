import type { GuideFlourish } from '../components/guide/GuideIllustration'

/**
 * The "How to use Nibras" interactive guide's content structure — 8
 * chapters (one per main feature; started at 6, Library + «سُكون»
 * added 2026-08-13 once those features shipped), 2 short steps each.
 * Pure data (no React/JSX dependency, same reasoning as
 * content/techniques.ts) — icon components live in
 * components/guide/guideIcons.tsx instead.
 *
 * Chapter titles deliberately REUSE existing i18n keys (the same
 * feature name shown everywhere else in the app — reader.kicker,
 * settings.title, etc.) rather than new guide-specific ones, so the
 * guide never risks drifting out of sync with what a feature is
 * actually called elsewhere. Step copy is new (guide.* namespace),
 * written short and concrete — describes exactly what's actually
 * built, nothing aspirational (e.g. Reading Buddy's steps don't claim
 * synced word-highlighting, which isn't built yet — and Mind Maps'
 * own step 1 had to be RE-fixed 2026-08-13 after nibras-qa caught an
 * aspirational rewrite: describing what a feature *could* do, even in
 * passing, is the same class of honesty gap as describing what it
 * never will).
 */

export interface GuideStep {
  titleKey: string
  bodyKey: string
  flourish: GuideFlourish
}

// A literal union, not plain `string` (added 2026-08-13, prevention
// after a real bug): guideIcons.tsx keeps a SEPARATE per-chapter icon
// lookup keyed by this same id. With `id: string`, adding a new
// chapter here typechecks and builds cleanly even if that OTHER file
// never gets an entry for it — the lookup just silently returns
// `undefined` at runtime, and rendering `undefined` as a component
// crashes the whole page (React error #130). Typing both `id` here AND
// guideIcons.tsx's lookup Record against this SAME union turns that
// into a compile-time error instead — tsc -b refuses to build once a
// new id is added here until guideIcons.tsx is also updated, so this
// specific bug class can't happen again silently.
export type GuideChapterId = 'reader' | 'settings' | 'techniques' | 'readingBuddy' | 'mindMaps' | 'aiAssistant' | 'library' | 'calmSpace'

export interface GuideChapter {
  id: GuideChapterId
  titleKey: string
  steps: GuideStep[]
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'reader',
    titleKey: 'reader.kicker',
    steps: [
      { titleKey: 'guide.readerStep1Title', bodyKey: 'guide.readerStep1Body', flourish: 'reveal' },
      { titleKey: 'guide.readerStep2Title', bodyKey: 'guide.readerStep2Body', flourish: 'sweep' },
    ],
  },
  {
    id: 'settings',
    titleKey: 'settings.title',
    steps: [
      { titleKey: 'guide.settingsStep1Title', bodyKey: 'guide.settingsStep1Body', flourish: 'sweep' },
      { titleKey: 'guide.settingsStep2Title', bodyKey: 'guide.settingsStep2Body', flourish: 'pulse' },
    ],
  },
  {
    id: 'techniques',
    titleKey: 'landing.techniques',
    steps: [
      { titleKey: 'guide.techniquesStep1Title', bodyKey: 'guide.techniquesStep1Body', flourish: 'reveal' },
      { titleKey: 'guide.techniquesStep2Title', bodyKey: 'guide.techniquesStep2Body', flourish: 'pulse' },
    ],
  },
  {
    id: 'readingBuddy',
    titleKey: 'dashboard.navReadingBuddy',
    steps: [
      { titleKey: 'guide.readingBuddyStep1Title', bodyKey: 'guide.readingBuddyStep1Body', flourish: 'pulse' },
      { titleKey: 'guide.readingBuddyStep2Title', bodyKey: 'guide.readingBuddyStep2Body', flourish: 'sweep' },
    ],
  },
  {
    id: 'mindMaps',
    titleKey: 'mindMaps.title',
    steps: [
      { titleKey: 'guide.mindMapsStep1Title', bodyKey: 'guide.mindMapsStep1Body', flourish: 'sweep' },
      { titleKey: 'guide.mindMapsStep2Title', bodyKey: 'guide.mindMapsStep2Body', flourish: 'reveal' },
    ],
  },
  {
    id: 'aiAssistant',
    titleKey: 'aiAssistant.title',
    steps: [
      { titleKey: 'guide.aiAssistantStep1Title', bodyKey: 'guide.aiAssistantStep1Body', flourish: 'reveal' },
      { titleKey: 'guide.aiAssistantStep2Title', bodyKey: 'guide.aiAssistantStep2Body', flourish: 'pulse' },
    ],
  },
  // Added 2026-08-13 (nibras-qa P1-4) — Library and «سُكون»/Calmness
  // both shipped after this guide's original 6 chapters were written.
  // Same honesty discipline as every other chapter here, re-flagged by
  // team-lead specifically for these two: Library's copy describes the
  // ACTION (open/organize), never a permanence guarantee — P1-7 (the
  // 10-document cap silently pruning the oldest book) is still open,
  // so "everything you save stays here" would be a NEW false claim
  // layered on an already-known one. «سُكون»'s copy makes no benefit/
  // treatment claim and explicitly says nothing is saved (it really
  // isn't — see CalmSpace.tsx's own comment), matching calm.subtitle's
  // own "before or during reading" register rather than inventing new
  // framing.
  {
    id: 'library',
    titleKey: 'library.title',
    steps: [
      { titleKey: 'guide.libraryStep1Title', bodyKey: 'guide.libraryStep1Body', flourish: 'reveal' },
      { titleKey: 'guide.libraryStep2Title', bodyKey: 'guide.libraryStep2Body', flourish: 'sweep' },
    ],
  },
  {
    id: 'calmSpace',
    titleKey: 'calm.title',
    steps: [
      { titleKey: 'guide.calmSpaceStep1Title', bodyKey: 'guide.calmSpaceStep1Body', flourish: 'pulse' },
      { titleKey: 'guide.calmSpaceStep2Title', bodyKey: 'guide.calmSpaceStep2Body', flourish: 'reveal' },
    ],
  },
]
