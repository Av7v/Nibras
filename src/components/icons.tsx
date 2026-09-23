import type { SVGProps } from 'react'

/** Nibras brand mark — a simple open-book glyph, ported from the
 * approved static mockup. Decorative by default (aria-hidden); the
 * visible brand *name* carries the accessible meaning, not this icon. */
export function BrandMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 5.5C6 4.3 9 4 12 5c3-1 6-.7 8 .5v13c-2-1.2-5-1.5-8-.5-3-1-6-.7-8 .5v-13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M12 5v13" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/** Directional "proceed" chevron — points toward reading-flow direction.
 * Genuinely directional (unlike most icons), so callers must mirror it
 * for RTL explicitly, e.g. className="... rtl:-scale-x-100". Not baked
 * in here because not every use of this glyph is directional. */
export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <polyline
        points="9 5 16 12 9 19"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Reading-settings toggle glyph. Symmetric — no RTL mirroring needed. */
export function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="6" r="2.2" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7" cy="12" r="2.2" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="18" r="2.2" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

/** Symmetric — no RTL mirroring needed. */
export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Not directional (a clipboard has no inherent left/right meaning) —
 * intentionally NOT mirrored for RTL, unlike ChevronIcon. */
export function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** A bookmark ribbon has no inherent left/right meaning — not
 * mirrored for RTL. */
export function BookmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A pencil's diagonal is decorative, not meaningfully "directional" —
 * not mirrored for RTL (matches how a pencil icon reads in both
 * directions in real platform icon sets). */
export function NoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** A speaker with sound waves has no inherent left/right reading-flow
 * meaning — not mirrored for RTL (matches real platform icon sets,
 * where a "volume/speaker" glyph stays the same in both directions). */
export function SpeakerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 9.5v5h3.5L13 18V6L7.5 9.5H4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A filled square is the conventional "stop" glyph — symmetric, no
 * RTL mirroring needed. */
export function StopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  )
}

/** A filled triangle — the universal media "play" glyph. Deliberately
 * NOT mirrored for RTL: real media players (YouTube, Spotify, the OS
 * volume/media controls) keep this pointing the same way regardless of
 * interface direction — it signals "playback," not reading order. */
export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M7 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  )
}

/** Two filled bars — the universal media "pause" glyph. Symmetric, no
 * RTL mirroring needed. */
export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

/** Head-and-shoulders "account" glyph — symmetric, no RTL mirroring
 * needed (matches how a person icon reads in every real platform icon
 * set, LTR or RTL). Used for the Header's link to /profile. */
export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M4.5 20c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Simplified, generic marks for the "Continue with Apple/Google"
 * buttons — a design-only preview (no real OAuth wired up yet), so
 * these are tasteful, unmistakable-enough glyphs rather than an
 * attempt at pixel-exact reproductions of either company's official
 * lockup (which have their own separate brand guidelines meant for a
 * real, working sign-in integration). */
export function AppleGlyphIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M16.5 3.2c.1 1-.3 2-.9 2.7-.6.7-1.6 1.3-2.6 1.2-.1-1 .4-2 1-2.7.6-.7 1.7-1.2 2.5-1.2Z"
        fill="currentColor"
      />
      <path
        d="M20 17.3c-.5 1.1-.7 1.6-1.4 2.6-.9 1.3-2.2 3-3.8 3-1.4 0-1.8-.9-3.7-.9-1.9 0-2.3.9-3.7.9-1.6 0-2.8-1.5-3.7-2.8C1.3 17.1.7 13 2.2 10.6c1-1.6 2.6-2.6 4.1-2.6 1.5 0 2.5 1 3.7 1 1.2 0 1.9-1 3.7-1 1.3 0 2.7.7 3.7 2-3.3 1.8-2.7 6.5.6 7.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Simple neutral "G" mark — see AppleGlyphIcon's note above; not
 * Google's exact multi-colour logo, which is reserved for a real,
 * working Google Sign-In integration. */
export function GoogleGlyphIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M12.2 11v2.2h4.1c-.2 1.1-1.6 3.3-4.1 3.3-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5c1.4 0 2.4.6 2.9 1.1l2-1.9C15.9 5.5 14.2 4.7 12.2 4.7c-4 0-7.3 3.3-7.3 7.3s3.3 7.3 7.3 7.3c4.2 0 7-3 7-7.1 0-.5 0-.9-.1-1.2h-6.9Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Symmetric — no RTL mirroring needed. */
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  )
}

/* --- Added for the /preview/dashboard app-shell preview (nav +
   stat-tile icons). Same hand-rolled style as the icons above — kept
   here rather than a separate file since they're generically useful
   nav/stat glyphs, not preview-specific markup. */

/** A page with text lines — "Reader" nav item and the Documents stat
 * tile. Symmetric — no RTL mirroring needed. */
export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="15.5" x2="16" y2="15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="19" x2="12.5" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** A lightbulb — "Techniques" nav item (tips/ideas). Symmetric — no
 * RTL mirroring needed. */
export function LightbulbIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M9 18h6M10 21h4M8.5 15.5C6.9 14.3 6 12.6 6 10.7 6 7 8.7 4.2 12 4.2s6 2.8 6 6.5c0 1.9-.9 3.6-2.5 4.8-.7.5-1.1 1.3-1.1 2.1v.1H9.6v-.1c0-.8-.4-1.6-1.1-2.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Connected nodes/branches — "Mind Maps" nav item. A branching-node
 * diagram has no inherent reading direction — not mirrored for RTL. */
export function MindMapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="5.5" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="17.5" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="17.5" cy="18.5" r="2.3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M7.6 10.8 15.4 6.7M7.6 13.2l7.8 4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** A clock face — the "Last read" stat tile (time-based, not a nav
 * item). Symmetric — no RTL mirroring needed. */
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M12 7.5V12l3.2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A speech bubble with a "typing" dot row — the "AI Assistant" tool
 * card (a conversational summarize/explain helper). Not mirrored for
 * RTL — like BookmarkIcon/NoteIcon/SpeakerIcon, a chat-bubble tail
 * reads as "attached to a location," not as a reading-direction cue
 * (matches how real chat UIs render the same bubble shape in RTL
 * locales). */
export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.5 4V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="11" r="1" fill="currentColor" />
      <circle cx="12.5" cy="11" r="1" fill="currentColor" />
      <circle cx="16.5" cy="11" r="1" fill="currentColor" />
    </svg>
  )
}

/** A pencil inside a bordered square — "Edit" (Mind Maps' edit-mode
 * toggle). Deliberately distinct from NoteIcon's plain diagonal pencil
 * (used for "add a note" right next to this one in MindMapView) so the
 * two different actions don't share a look. Symmetric — no RTL
 * mirroring needed. */
/** A bordered square with 4 swatch dots — "colour the boxes" (task #211,
 * Mind Maps' per-node colour picker). Matches EditIcon's own outer-rect
 * sizing (same x/y/width/rx/strokeWidth) so the two sit at equal visual
 * weight next to each other in the same toolbar row. Monochrome
 * `currentColor` like every other icon in this set — the SQUARE shape
 * (not the dots' own hue) is what reads as "colour picker" here, the
 * same convention any single-colour line-icon set uses for this glyph. */
export function PaletteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="8.3" cy="8.3" r="1.6" fill="currentColor" />
      <circle cx="15.7" cy="8.3" r="1.6" fill="currentColor" />
      <circle cx="8.3" cy="15.7" r="1.6" fill="currentColor" />
      <circle cx="15.7" cy="15.7" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path
        d="M9 15.5l.6-2.4 5.3-5.3a1.3 1.3 0 0 1 1.8 0l.5.5a1.3 1.3 0 0 1 0 1.8l-5.3 5.3-2.4.6-.4-.5.4-.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A plus in a circle — the universal "add" glyph (Mind Maps' "add a
 * branch" affordance). Symmetric — no RTL mirroring needed. */
export function AddIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** A down-arrow into a tray — the universal "download/export" glyph
 * (Mind Maps' export-to-image button). Symmetric — no RTL mirroring
 * needed (matches how download icons read in every real platform icon
 * set, LTR or RTL — it signals "save this," not reading order). */
export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M12 3.5v11.5M7.5 10.5 12 15l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --- Added for the Techniques 3-category redesign (2026-08-13): 3
   category icons + per-technique content icons, so a technique card
   carries a meaningful icon about its OWN idea, not just the generic
   read-aloud speaker control. All symmetric/non-directional — none
   need RTL mirroring. */

/** An open book — the Reading category. Distinct from BrandMarkIcon
 * (the brand's own abstract wordmark glyph) — this is a plainer,
 * literal "book" shape, purpose-built for this one category. */
export function CategoryReadingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M12 6c-1.8-1.2-4-1.7-6.5-1.5v13c2.5-.2 4.7.3 6.5 1.5 1.8-1.2 4-1.7 6.5-1.5v-13C16 4.3 13.8 4.8 12 6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M12 6v13" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

/** A brain outline — the Comprehension category (understanding,
 * making sense of ideas). */
export function CategoryComprehensionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M9.5 4.5c-2 0-3.5 1.5-3.5 3.3 0 .5.1 1 .3 1.4C5 9.8 4.3 11 4.3 12.3c0 1.4.8 2.6 2 3.2-.1.3-.1.7-.1 1 0 2 1.7 3.5 3.7 3.5.8 0 1.5-.2 2.1-.6V6.8c-.6-1.4-1.9-2.3-3.5-2.3ZM12.5 6.8v12.6c.6.4 1.3.6 2.1.6 2 0 3.7-1.5 3.7-3.5 0-.3 0-.7-.1-1 1.2-.6 2-1.8 2-3.2 0-1.3-.7-2.5-1.9-3.1.2-.4.3-.9.3-1.4 0-1.8-1.5-3.3-3.5-3.3-1.6 0-2.9.9-3.5 2.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A target/bullseye — the Focus category. */
export function CategoryFocusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** An ear with sound waves — "Read while listening" (distinct from
 * SpeakerIcon, which marks the interactive read-aloud button itself;
 * this is the technique's own topic icon). */
export function EarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M14.5 4.5c-3 0-5.5 2.5-5.5 5.5 0 1.5-1 2-1 3.5a3 3 0 0 0 3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M14.5 7.5c-1.4 0-2.5 1.2-2.5 2.7 0 1 .7 1.4.7 2.3a1.8 1.8 0 0 1-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M17 8.5a5.5 8 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Three horizontal lines with visible gaps — "Give the text room to
 * breathe" (line/paragraph spacing). */
export function SpacingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="5.5" x2="20" y2="5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="18.5" x2="20" y2="18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** A narrow column of short lines — "Shorten the line" (a narrower
 * reading measure). */
export function NarrowColumnIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="7" y="4" width="10" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="9.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="11.3" x2="14.5" y2="11.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="14.6" x2="14.5" y2="14.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** A few small separated blocks — "Read in small chunks". */
export function ChunksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="4" y="4.5" width="16" height="4" rx="1.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <rect x="4" y="10.5" width="16" height="4" rx="1.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <rect x="4" y="16.5" width="10" height="4" rx="1.3" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

/** An eye — "Look before you read" (preview/skim first). Distinct from
 * EarIcon's listening theme. */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" fill="none" />
    </svg>
  )
}

/** A plain speech bubble (no dots) — "Say it in your own words".
 * Deliberately simpler than ChatIcon, which is reserved for the AI
 * Assistant feature specifically — this shouldn't visually imply "AI"
 * for a plain retelling-in-your-own-words study technique. */
export function SpeechBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.5 4V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A bell with a slash through it — "Clear the clutter" (silence
 * distractions). */
export function NoDistractionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M6 10.5a6 6 0 0 1 8.6-5.4M18 10.5c0 3 .8 4.6 1.5 5.5H5.2M10.3 19a1.8 1.8 0 0 0 3.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** A single checked box — "One task at a time" (one item, not a long
 * list). */
export function SingleCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M8.5 12.3 11 14.8l4.5-5.6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A short ruled line with a small tracking marker — "Keep your
 * place" (echoes the Reader's own Reading Ruler feature). */
export function TrackLineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="16.5" x2="20" y2="16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="9.5" x2="15" y2="9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
      <path d="M8 13v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 17.7 8 20.2l2.5-2.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A simple house — the "Dashboard" nav item (home). Symmetric — no
 * RTL mirroring needed (a house glyph has no inherent reading
 * direction). */
export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M10 20.5v-6h4v6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

/** A question mark in a circle — the "How to use Nibras" guide link.
 * Distinct from InfoIcon (which marks "more detail about THIS thing")
 * — this specifically means "learn how to use the app." Symmetric —
 * no RTL mirroring needed. */
export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M9.3 9.3a2.8 2.8 0 1 1 4.4 2.3c-.9.6-1.7 1.1-1.7 2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17.3" r="1.05" fill="currentColor" />
    </svg>
  )
}

/** Three book spines of different heights on a shared baseline — the
 * "Library" nav item. Distinct from DocumentIcon's single
 * page-with-lines glyph (Reader) — this reads as a small shelf, not
 * one document. Symmetric — no RTL mirroring needed (like
 * BookmarkIcon/SpeakerIcon, a row of book spines has no inherent
 * left/right reading-direction meaning). */
export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="3.5" y="6.5" width="4" height="13.5" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <rect x="10" y="3.5" width="4" height="16.5" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <line x1="10" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="16.5" y="8" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

/** A center dot with two soft, fading rings — the «سُكون»/"Calmness"
 * trigger button (a gentle ripple, standing in for a breath expanding
 * outward). Deliberately distinct from CategoryFocusIcon's bullseye
 * (solid, evenly-stepped rings, full opacity throughout, target-like)
 * — this one fades toward the edge and has a tighter center + wider
 * spread, reading as a ripple rather than a target. Symmetric — no RTL
 * mirroring needed. */
export function BreathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55" />
      <circle cx="12" cy="12" r="9.8" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.3" />
    </svg>
  )
}

/** A trash can — the Library's "remove this book" action. Symmetric —
 * no RTL mirroring needed. */
export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M5 7.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9.5 7.5V5.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M7 7.5 7.8 19a1.2 1.2 0 0 0 1.2 1.1h6a1.2 1.2 0 0 0 1.2-1.1l.8-11.5"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="10.2" y1="11" x2="10.4" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="13.8" y1="11" x2="13.6" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Three-line "menu" glyph — opens the mobile navigation drawer
 * (AppShellSidebar, below the `md:` breakpoint). Symmetric — no RTL
 * mirroring needed. */
export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** A simple padlock — the sidebar's quiet "Privacy" link (nibras-qa
 * P1-5, 2026-08-13: Privacy was only reachable from Landing, never
 * from inside the app itself). Symmetric — no RTL mirroring needed. */
export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="5" y="11" width="14" height="9.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.3" r="1.15" fill="currentColor" />
    </svg>
  )
}

/** A simple microphone — the Reading Buddy coach's "listen to me read"
 * direction (task #150, 2026-08-14). Symmetric — no RTL mirroring
 * needed. */
export function MicrophoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Four outward corner brackets — the universal "fullscreen/focus
 * mode" glyph (task #360). ONE icon for both directions, like this
 * app's other toggle buttons (e.g. the Reader's own "Reading settings"
 * button) — the pressed/unpressed STYLE change plus the button's own
 * label text carry the state, not a second "contract" glyph. Symmetric
 * — no RTL mirroring needed. */
export function FullscreenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <polyline points="8 4 4 4 4 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 4 20 4 20 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="4 16 4 20 8 20" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="20 16 20 20 16 20" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A camera body with a lens circle — "Read from an image" (OCR,
 * roadmap placeholder, task #465). A camera reads the same either
 * direction — not mirrored for RTL, like PersonIcon/SpeakerIcon above. */
export function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M9 5.5 8 7.5H4.5a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V8.5a1 1 0 0 0-1-1H16l-1-2H9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.3" r="3.6" stroke="currentColor" strokeWidth="1.7" fill="none" />
    </svg>
  )
}

/** A chain link — "Read from a link" (URL import, roadmap placeholder,
 * task #465). Two interlocking loops has no inherent left/right
 * reading-flow meaning — not mirrored for RTL. */
export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M10 14 14 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11 7.5 12.6 5.9a3.3 3.3 0 0 1 4.7 4.7L15.7 12.2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M13 16.5 11.4 18.1a3.3 3.3 0 0 1-4.7-4.7L8.3 11.8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** «مرشد نبراس» / the Nibras voice-guide mascot's face (task #366) — a
 * simple, friendly robot: a rounded head, two round side "ear" nubs, a
 * small antenna, dot eyes, and a curved smile — same restrained
 * stroke-plus-filled-dot style as the rest of this file's icons (e.g.
 * InfoIcon's filled dot, PersonIcon's plain stroke figure), not a new
 * illustration language. A face has no inherent left/right
 * reading-flow meaning — not mirrored for RTL, like NoteIcon/
 * SpeakerIcon above. */
export function RobotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect x="2" y="11" width="2.4" height="5" rx="1.2" fill="currentColor" />
      <rect x="19.6" y="11" width="2.4" height="5" rx="1.2" fill="currentColor" />
      <line x1="12" y1="7" x2="12" y2="3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="2.6" r="1.3" fill="currentColor" />
      <rect x="4.5" y="7" width="15" height="13" rx="4.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="9.3" cy="13" r="1.35" fill="currentColor" />
      <circle cx="14.7" cy="13" r="1.35" fill="currentColor" />
      <path d="M9 16.6c1 .9 5 .9 6 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** نبراس's lantern/beacon — the guide-grid glyph for the «مرشد نبراس»
 * chapter (task #518, Amal 2026-09-15: «نوحد الهوية البصرية»). That one
 * tile used to render the colour, animated NibrasGuideFace, which stuck
 * out beside its flat single-colour line-icon siblings; this replaces it
 * with a drawn glyph in the exact same restrained language as the rest of
 * this file — a carry-handle arc, a trapezoid cap, a rounded glass body
 * on a small flared foot, and a single filled flame. The flame is the
 * beacon's own light (نبراس means "beacon/lantern/light") and is the one
 * solid accent, same stroke-plus-filled-shape vocabulary as LightbulbIcon
 * and PaletteIcon's dots. Amal ruled a lantern, NOT a robot — so this is
 * deliberately distinct from RobotIcon above. A lantern has no inherent
 * left/right reading-flow meaning, so it is not mirrored for RTL. */
export function LanternIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M9.8 5.3a2.2 2.2 0 0 1 4.4 0" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M9.5 5.3H14.5L16.4 7.5H7.6Z" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round" />
      <rect x="7.6" y="7.5" width="8.8" height="9.6" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M9.5 17.1l-.7 2.4h6.4l-.7-2.4" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9.7C14 11.86 13.8 13.78 12 14.5C10.2 13.78 10 11.86 12 9.7Z" fill="currentColor" />
    </svg>
  )
}

/** Outline 5-point star — the "Rate Nibras" feedback trigger's icon
 * (components/RateNibras.tsx). A star has no inherent left/right
 * reading-flow meaning, so it is not mirrored for RTL (same reasoning
 * as BookmarkIcon/LanternIcon above). */
export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A broken loading ring — the "preparing…" state for a neural
 * read-aloud button while the voice is being generated (a few seconds).
 * DELIBERATELY a distinct shape at rest, not the play/speaker glyph it
 * replaces: a faint full ring plus one bold quarter-arc reads as
 * "working/loading" even with NO animation, so reduce-motion readers
 * (who never see the spin, and often prefer reduced motion) still get an
 * unmistakable "this isn't a play button, something is happening" cue —
 * the exact gap that made the old dimmed-triangle look like "nothing
 * happened" (nibras-neural-latency diagnosis, 2026-09-21). Callers add
 * `motion-safe:animate-spin` for the rotation; motion-reduce keeps the
 * static broken ring. `data-icon="spinner"` is a stable hook the
 * preparing-indicator regression check queries. A ring has no inherent
 * left/right reading-flow meaning — not mirrored for RTL. */
export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon="spinner" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2" fill="none" opacity="0.3" />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
