import type { ComponentType, SVGProps } from 'react'
import type { GuideChapterId } from '../../content/guideSteps'
import { BreathIcon, ChatIcon, DocumentIcon, EarIcon, LanternIcon, LibraryIcon, LightbulbIcon, MindMapIcon, PaletteIcon, SpeakerIcon } from '../icons'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

/** One icon per guide chapter — reuses the exact same icon each
 * feature already uses elsewhere (sidebar/Dashboard/Techniques), so
 * the guide feels like part of one consistent visual system rather
 * than introducing a second icon for something already iconified.
 *
 * A missing entry here isn't a silent no-op — GuideIllustration looks
 * up a chapter's icon by id and renders it directly as a component;
 * an id with no entry resolves to `undefined`, which React throws on
 * (minified error #130, "element type is invalid"). Found the hard
 * way 2026-08-13 adding the library/calmSpace chapters (P1-4) — this
 * file's own header comment even names guideSteps.ts as owning
 * per-chapter data, which made it easy to add a new CHAPTER there
 * without remembering this SEPARATE file also needs an entry for it.
 * Keyed by `GuideChapterId` (not plain `string`) specifically so this
 * can't happen silently again — `tsc -b` now refuses to build if a
 * chapter id from guideSteps.ts has no matching entry here. */
export const GUIDE_CHAPTER_ICON: Record<GuideChapterId, IconType> = {
  colours: PaletteIcon,
  reader: DocumentIcon,
  techniques: LightbulbIcon,
  readingBuddy: SpeakerIcon,
  mindMaps: MindMapIcon,
  letterSounds: EarIcon,
  aiAssistant: ChatIcon,
  library: LibraryIcon,
  calmSpace: BreathIcon,
  // The one purpose-built glyph in this map: «مرشد نبراس» has no icon
  // elsewhere to reuse, so LanternIcon is drawn to match this set (task
  // #518) — a line-glyph نبراس lantern, replacing the colour animated
  // NibrasGuideFace that used to render here and stuck out beside its 10
  // flat siblings. NibrasGuideFace still drives the animated mascot in the
  // sidebar/launcher/chat; only this static guide-grid tile switched.
  guideMascot: LanternIcon,
}
