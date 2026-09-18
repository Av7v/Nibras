/**
 * Reading-settings model: types, script-aware defaults, and on-device
 * (localStorage) persistence. No server, no accounts — privacy-first
 * per project rules.
 *
 * Script-aware by design (learning-science-audit F11/F12): Latin and
 * Arabic are two separate settings profiles, not one shared shape with
 * a slider that happens to be disabled for Arabic. Arabic has NO
 * letterSpacing field at all — the control must not exist, not just be
 * hidden, so it can never accidentally apply.
 */

import { isValidHex } from './color'
import type { VoiceGender } from './textToSpeech'

// Expanded increment 4 (Amal): Open Sans (familiar sans) + Lora (serif
// choice) + OpenDyslexic (self-hosted, offered per Amal's request even
// though the evidence for a reading-rate/accuracy benefit is mixed —
// this used to be disclosed via a per-option UI sub-label,
// settings.hintOpenDyslexic; Amal had all such sub-labels removed
// app-wide 2026-08-13, so this comment is now the only place that
// caveat is recorded) join Lexend (default) + Atkinson Hyperlegible.
// ~/Desktop/AI/research/nibras/content/arabic-typefaces.md Part 2.
export type LatinTypeface = 'lexend' | 'atkinson' | 'openSans' | 'lora' | 'openDyslexic'
// Tajawal dropped as a *reading* option (Amal, increment 4) — it stays
// the UI/brand chrome font, but the reading picker is Naskh/Modern/Kufi
// per ~/Desktop/AI/research/nibras/content/arabic-typefaces.md.
export type ArabicTypeface = 'notoNaskh' | 'ibmPlexSansArabic' | 'reemKufi'
export type Tint = 'cream' | 'blue' | 'green' | 'rose' | 'white'

// Reading Ruler color choice (Amal, 2026-08-13: «مسطرة القراءة ممكن
// نغير ألوانها»). Deliberately a DIFFERENT palette from TINTS above —
// tints are near-white background washes meant to sit *behind* body
// text at full opacity; the ruler band is always rendered translucent
// (see components/reader/ReadingRuler.tsx) *over* whatever tint is
// active, so it needs actual hue presence to read as a visible color
// choice at low opacity — a pale tint swatch would barely show at all.
export type RulerColor = '#004aad' | '#2f9e44' | '#f7a062' | '#d6336c' | '#7048e8' | '#0ca678'

// Task #361 (2026-09-13, Amal via team-lead) — the ruler's two
// selectable mechanisms: 'line' is the existing pointer-following band
// (ReadingRuler.tsx, unchanged); 'wordSync' is the new mode that
// highlights one word at a time, paced to voice speed
// (WordHighlightRuler.tsx). Each has its OWN colour choice (below),
// since the two render very differently (a translucent line wash vs a
// solid word chip) and a reader may want a different hue for each.
// Task #465 (2026-09-14, Amal via team-lead) — 'lineFocus' is a third
// mechanism (LineFocusRuler.tsx): like 'line', it follows the same
// live pointer position, but instead of washing the current line it
// DIMS every line above and below it, leaving only the current one at
// full, untouched clarity (Microsoft Immersive Reader's own "Line
// Focus"). No colour choice of its own — it's a dim, not a hue pick —
// see LINE_FOCUS_DIM_OPACITY below.
export type ReadingRulerMode = 'line' | 'wordSync' | 'lineFocus'

// Text colour (task #83, 2026-08-14, Amal: «مثل ما فيه أيقونة لتغيير
// لون الخلفية نبي أيقونة لتغيير لون الخط من دائرة الألوان» — "like
// there's an icon to change the background colour, we want one to
// change the text colour from a colour wheel"). A free hex, not a
// closed enum like Tint/RulerColor — the whole point is "any colour,"
// via components/reader/SettingsFields.tsx's new ColorWheelField. Kept
// per-script (like `tint` already is) rather than shared, same
// reasoning: Latin and Arabic are read at different times/settings by
// the same person and shouldn't force one shared choice.
export const DEFAULT_TEXT_COLOR = '#37312b' // == index.css's --color-ink, unchanged default (no visual change for existing users)

export interface LatinSettings {
  typeface: LatinTypeface
  fontSize: number // px
  lineHeight: number
  lineWidth: number // ch (characters)
  letterSpacing: number // em — Latin only, never ported to Arabic
  wordSpacing: number // em
  tint: Tint
  textColor: string // hex, see DEFAULT_TEXT_COLOR above
  /** Task #364 (2026-09-13, Amal): a free-hex CUSTOM background for the
   * Reader's reading panel, picked from the new colour wheel below the
   * preset tint swatches. `null` = no custom colour → the panel uses the
   * chosen preset `tint` exactly as before (so this is byte-identical for
   * everyone who never opens the wheel). The 5 `tint` swatches stay as
   * quick shortcuts: clicking one clears this back to null. The effective
   * background is always `effectiveReadingBg(...)` below — never read
   * `tint` for the actual colour once this exists. Per-script (like
   * `tint`/`textColor`) and stays INDEPENDENT of the global page
   * background (`pageBackground`), per Amal's Flag #2. */
  backgroundColor: string | null
}

export interface ArabicSettings {
  typeface: ArabicTypeface
  fontSize: number
  lineHeight: number
  lineWidth: number
  wordSpacing: number
  tint: Tint
  textColor: string
  /** Task #364 — see LatinSettings.backgroundColor. Per-script, so the
   * Arabic reading panel keeps its own custom background choice. */
  backgroundColor: string | null
}

export interface ReadingSettingsState {
  latin: LatinSettings
  arabic: ArabicSettings
  /** Reading Ruler — a pointer-following visual guide in the Reader
   * (see components/reader/ReadingRuler.tsx). Script-independent (a
   * mechanism preference, not a typography choice), so it lives at the
   * top level rather than duplicated inside `latin`/`arabic`. OFF by
   * default — optional, per Amal. */
  readingRuler: boolean
  /** The ruler band's color when readingRuler is on. Also top-level and
   * script-independent, same reasoning as readingRuler itself. Defaults
   * to the brand accent — matches the ruler's ORIGINAL fixed color
   * (`bg-accent/10`), so nobody who already has the ruler on sees an
   * unexpected color change the first time this loads. */
  readingRulerColor: RulerColor
  /** Task #127 (2026-08-14), superseded by #145 (2026-08-14) — this
   * field's own PERSISTED SHAPE is unchanged (still `voiceRate` in the
   * same `nibras-reading-settings` JSON blob, so an existing user's
   * saved speed survives the upgrade untouched), but it's no longer
   * read/written through THIS hook's own per-instance load — see
   * lib/voicePreference.ts + hooks/useVoicePreference.ts for the new
   * LIVE-reactive (useSyncExternalStore-based) owner. Kept here,
   * still loaded/defaulted/migrated by loadReadingSettings() below,
   * because voicePreference.ts's own persist() reads+writes through
   * these SAME load/save functions to merge its 2 fields into the one
   * shared JSON object without clobbering the OTHER (typography)
   * fields a different concurrently-open surface might have just
   * saved — see useReadingSettings.ts's own save-effect comment for
   * the symmetric half of that same race-safety concern. */
  voiceRate: number
  /** Task #145 (2026-08-14, Amal) — voice TYPE (eve/rex = Voice 2/
   * Voice 1) joins voiceRate as the second half of the one global,
   * persisted, live-reactive voice preference. Same
   * lib/voicePreference.ts ownership as voiceRate above — not read/
   * written through this hook's own per-instance state. */
  voiceGender: VoiceGender
  /** Task #350 (2026-09-08, Amal via team-lead) — the page CANVAS
   * background colour, shared by every routed page (applied via
   * index.css's `--color-page-bg` + the App-root effect in App.tsx).
   * Deliberately a DIFFERENT field from `latin.tint`/`arabic.tint`
   * above: those two colour only the Reader's own `<article>` reading
   * surface and are picked per-script; this one applies everywhere
   * else and isn't script-dependent (a page's canvas colour has
   * nothing to do with which script its text happens to be in), so —
   * like `readingRuler`/voice above — it lives at the top level, not
   * nested inside `latin`/`arabic`. Same closed `Tint` palette (reused,
   * not duplicated) — see lib/pageBackgroundPreference.ts +
   * hooks/usePageBackgroundPreference.ts for the live-reactive
   * (useSyncExternalStore-based) owner; same shape as voiceRate/
   * voiceGender above, this field is still loaded/defaulted/migrated
   * here because that module's own persist() reads+writes through
   * these SAME load/save functions. `'none'` (task #350 whole-screen
   * follow-up, Amal 2026-09-13) means NO colour override at all: the
   * app's native default look (the App-root effect removes the vars). */
  pageBackground: PageBackground
  /** Task #360 (2026-09-10, Amal) — the reading-comfort light/glare
   * reducer: a warm, fixed-viewport overlay (rendered by Reader.tsx)
   * whose opacity this controls. Script-independent (a display
   * preference, not typography), same reasoning as readingRuler above,
   * so it lives at the top level too. OFF by default — optional, same
   * posture as the ruler. */
  dimmerEnabled: boolean
  /** 0-100 (percent) — how strong the overlay is once dimmerEnabled is
   * on. Only meaningful (and only shown in the UI) while enabled, same
   * "colour only shown once the ruler is on" convention readingRulerColor
   * already established just above. */
  dimmerIntensity: number
  /** Task #361 — which of the ruler's two mechanisms is active while
   * readingRuler is on. Top-level and script-independent, same
   * reasoning as readingRuler itself. Defaults to 'line' — the ORIGINAL
   * (and only) mechanism before this task — so nobody who already has
   * the ruler on sees a behaviour change the first time this loads. */
  readingRulerMode: ReadingRulerMode
  /** The word-highlight mode's own colour choice — independent of
   * readingRulerColor (the line mode's), same "each mode owns its own
   * preference" reasoning the type comment above gives. */
  wordSyncRulerColor: RulerColor
}

// Defaults ported from the approved reader-en.png / reader-ar.png mockups.
export const DEFAULT_LATIN_SETTINGS: LatinSettings = {
  typeface: 'lexend',
  fontSize: 18,
  lineHeight: 1.7,
  lineWidth: 64,
  letterSpacing: 0.02,
  wordSpacing: 0.08,
  tint: 'cream',
  textColor: DEFAULT_TEXT_COLOR,
  backgroundColor: null, // #364 — no custom bg by default → uses `tint`
}

export const DEFAULT_ARABIC_SETTINGS: ArabicSettings = {
  typeface: 'notoNaskh', // the canonical readable Naskh body script — arabic-typefaces.md recommended default
  fontSize: 20, // ~11% larger than Latin default — F12
  lineHeight: 1.8, // more generous than Latin's 1.7 — F12
  lineWidth: 48, // shorter measure than Latin's 64 — F4 + F12
  wordSpacing: 0.15, // carries more of the spacing load without letter-spacing — F11
  tint: 'cream',
  textColor: DEFAULT_TEXT_COLOR,
  backgroundColor: null, // #364 — no custom bg by default → uses `tint`
}

// Same 4 steps ReadingBuddyPlayer.tsx has always offered — reused
// verbatim (task #127) rather than inventing a different scale for the
// shared preference.
export const VOICE_RATES = [0.75, 1, 1.25, 1.5] as const
export const DEFAULT_VOICE_RATE = 1
// eve = Voice 2 = female — Amal's own pick (task #106/#127), kept as
// the default here too (task #145).
export const DEFAULT_VOICE_GENDER: VoiceGender = 'female'

export const TINTS: Record<Tint, string> = {
  cream: '#F5EFE2',
  blue: '#E4EDF0',
  green: '#E6EEE1',
  rose: '#F3E7E2',
  white: '#FFFFFF',
}

/** Task #364 — the ACTUAL reading-panel background hex for a script's
 * settings: the reader's free custom colour if they picked one from the
 * wheel, otherwise the chosen preset tint. This is the single source of
 * truth for the rendered surface (Reader `<article>`) AND the contrast
 * reference the text-colour wheel checks against — never read `tint`
 * directly for the colour once `backgroundColor` exists. `null` custom
 * colour → `TINTS[tint]`, i.e. the pre-#364 behaviour, unchanged. */
export function effectiveReadingBg(s: { tint: Tint; backgroundColor: string | null }): string {
  return s.backgroundColor ?? TINTS[s.tint]
}

// Task #350 — the page-background preference type + default. `'none'`
// (whole-screen follow-up, Amal 2026-09-13) = NO colour override: the
// App-root effect removes the CSS vars so the app shows its native
// default look. `'none'` is the DEFAULT, so a reader who never touches
// the control sees the original appearance (zero visual change — the
// native default already resolves to cream). The 5 named tints are the
// opt-in colours.
export type PageBackground = Tint | 'none'
export const DEFAULT_PAGE_BACKGROUND: PageBackground = 'none'

// 6 soft, moderately-saturated hues — calm, not neon/harsh (checked
// against the same "gentle, low-stress" bar as TINTS, just a stronger
// base hue since this renders translucent, not as a solid fill). The
// blue is the app's own brand accent (and the ruler's original fixed
// color, kept first/default); the amber reuses the app's one other
// established warm accent (#f7a062, the Dashboard "continue reading"
// highlight) rather than inventing a fresh orange.
export const RULER_COLORS: RulerColor[] = ['#004aad', '#2f9e44', '#f7a062', '#d6336c', '#7048e8', '#0ca678']
export const DEFAULT_RULER_COLOR: RulerColor = '#004aad'

// Task #361 — 'line' preserves the ruler's original (and, until this
// task, only) behaviour for every existing reader who already has it
// on. wordSyncRulerColor reuses the SAME default hex as the line
// mode's own default — an independent choice a reader can repoint, not
// a signal the two modes are meant to always match.
export const DEFAULT_RULER_MODE: ReadingRulerMode = 'line'
export const DEFAULT_WORD_SYNC_RULER_COLOR: RulerColor = DEFAULT_RULER_COLOR

// Task #360 — a moderate, clearly-visible-but-not-overwhelming starting
// point for a reader who turns the dimmer on for the first time; the
// intensity slider covers the full 0-100 range regardless.
export const DEFAULT_DIMMER_ENABLED = false
export const DEFAULT_DIMMER_INTENSITY = 40

// Task #398 review, item 4 — extracted from Reader.tsx's own overlay
// style (`opacity: (dimmerIntensity / 100) * DIMMER_MAX_OPACITY`) so
// SettingsPanel's live contrast warning (below) computes against the
// EXACT same formula that actually paints the scrim, rather than a
// second, driftable copy of the same magic number.
export const DIMMER_MAX_OPACITY = 0.7
// The dimmer overlay's own colour (Reader.tsx paints it as
// `var(--color-ink)`) — kept here as a plain hex, same "documented
// equality, not a live read" convention DEFAULT_TEXT_COLOR above already
// uses for the identical value, since a JS contrast calculation needs a
// concrete hex, not a CSS custom property. If index.css's --color-ink
// ever changes, update this to match (there is exactly one definition
// app-wide today — no dark-theme variant to track).
export const DIMMER_OVERLAY_COLOR = '#37312b'

// Task #465 — Line Focus's own dim strength for the two bands ABOVE and
// BELOW the current line (LineFocusRuler.tsx), reusing the #360
// dimmer's own overlay colour (DIMMER_OVERLAY_COLOR) just above, so
// both "dim" features read as the same visual language. Fixed, not a
// second user-tunable slider — the ruler's OTHER two modes each fix
// their own single tuned constant the same way (WordHighlightRuler's
// 0.45 highlight alpha; ReadingRuler's 0.16 wash), rather than exposing
// one, and this mode is no different. Unlike DIMMER_MAX_OPACITY (0.7),
// which sits over text the reader is still meant to read (just
// glare-reduced) and so stays capped short of unreadable, these two
// bands sit over lines the reader is deliberately NOT meant to read
// right now — the current line itself is the gap BETWEEN the two bands
// and is never touched by either one, so it stays at full, untouched
// contrast regardless of this value. Started at 0.75 (deliberately past
// DIMMER_MAX_OPACITY, since these bands never need to stay legible);
// revised down to 0.60 (quality review P2-1, 2026-09-14) as gentler and
// calmer while still reading as a clear, unambiguous de-emphasis — the
// number no longer needs to exceed 0.7, since nothing about correctness
// here ever depended on beating that other constant, only on being far
// past ReadingRuler's 0.16 "gentle wash" territory.
export const LINE_FOCUS_DIM_OPACITY = 0.6

// BDA (British Dyslexia Association) fallback trio — Verdana, Arial,
// Tahoma — appended to every Latin stack so a reader sees an
// instantly-available, dyslexia-guidance-approved system sans the
// moment the page paints, before the chosen web font has finished
// loading (or on the rare device where it fails to load), rather than
// falling straight to the browser's generic sans-serif. For Lora (the
// one serif option) Georgia — a near-universal serif system font —
// goes first, so a not-yet-loaded Lora falls back to *another serif*
// instead of visibly flashing sans; the BDA trio still follows as a
// deeper safety net. Team-lead + arabic-typefaces.md Part 2 note 2.
const LATIN_SYSTEM_FALLBACK = 'Verdana, Arial, Tahoma'

export const FONT_STACKS: Record<LatinTypeface | ArabicTypeface, string> = {
  lexend: `'Lexend', ${LATIN_SYSTEM_FALLBACK}, sans-serif`,
  atkinson: `'Atkinson Hyperlegible', ${LATIN_SYSTEM_FALLBACK}, sans-serif`,
  openSans: `'Open Sans', ${LATIN_SYSTEM_FALLBACK}, sans-serif`,
  lora: `'Lora', Georgia, ${LATIN_SYSTEM_FALLBACK}, serif`,
  openDyslexic: `'OpenDyslexic', ${LATIN_SYSTEM_FALLBACK}, sans-serif`,
  notoNaskh: "'Noto Naskh Arabic', serif",
  ibmPlexSansArabic: "'IBM Plex Sans Arabic', system-ui, sans-serif",
  reemKufi: "'Reem Kufi', system-ui, sans-serif",
}

// i18n key lookups (not the labels themselves) — kept next to the types
// so a caller never has to hand-build a translation key from a value.
export const TINT_LABEL_KEY: Record<Tint, string> = {
  cream: 'settings.tintCream',
  blue: 'settings.tintBlue',
  green: 'settings.tintGreen',
  rose: 'settings.tintRose',
  white: 'settings.tintWhite',
}
export const LATIN_TYPEFACE_LABEL_KEY: Record<LatinTypeface, string> = {
  lexend: 'settings.typefaceLexend',
  atkinson: 'settings.typefaceAtkinson',
  openSans: 'settings.typefaceOpenSans',
  lora: 'settings.typefaceLora',
  openDyslexic: 'settings.typefaceOpenDyslexic',
}
export const ARABIC_TYPEFACE_LABEL_KEY: Record<ArabicTypeface, string> = {
  notoNaskh: 'settings.typefaceNotoNaskh',
  ibmPlexSansArabic: 'settings.typefaceIbmPlex',
  reemKufi: 'settings.typefaceReemKufi',
}
export const RULER_COLOR_LABEL_KEY: Record<RulerColor, string> = {
  '#004aad': 'settings.rulerColorBlue',
  '#2f9e44': 'settings.rulerColorGreen',
  '#f7a062': 'settings.rulerColorAmber',
  '#d6336c': 'settings.rulerColorRose',
  '#7048e8': 'settings.rulerColorPurple',
  '#0ca678': 'settings.rulerColorTeal',
}

// Defensive, same as VALID_ARABIC_TYPEFACES below — no Latin value has
// actually been removed (this list can only grow so far), but the
// migration guard costs nothing and means a future narrowing never
// needs a second thought.
const VALID_LATIN_TYPEFACES: readonly LatinTypeface[] = ['lexend', 'atkinson', 'openSans', 'lora', 'openDyslexic']
const VALID_ARABIC_TYPEFACES: readonly ArabicTypeface[] = ['notoNaskh', 'ibmPlexSansArabic', 'reemKufi']
// Same defensive shape, for task #350's new top-level field.
const VALID_TINTS: readonly Tint[] = ['cream', 'blue', 'green', 'rose', 'white']

// Exported (task #145) — lib/voicePreference.ts listens for this
// SAME key's own `storage` events (cross-tab sync), so it must never
// drift out of sync with a hardcoded copy of the string elsewhere.
export const STORAGE_KEY = 'nibras-reading-settings'

function defaults(): ReadingSettingsState {
  return {
    latin: { ...DEFAULT_LATIN_SETTINGS },
    arabic: { ...DEFAULT_ARABIC_SETTINGS },
    readingRuler: false,
    readingRulerColor: DEFAULT_RULER_COLOR,
    voiceRate: DEFAULT_VOICE_RATE,
    voiceGender: DEFAULT_VOICE_GENDER,
    pageBackground: DEFAULT_PAGE_BACKGROUND,
    dimmerEnabled: DEFAULT_DIMMER_ENABLED,
    dimmerIntensity: DEFAULT_DIMMER_INTENSITY,
    readingRulerMode: DEFAULT_RULER_MODE,
    wordSyncRulerColor: DEFAULT_WORD_SYNC_RULER_COLOR,
  }
}

/** Reads saved settings from localStorage, merged over the defaults so
 * a partially-saved or older-shaped object (e.g. after a future field
 * is added) never produces `undefined` values. Never throws. */
export function loadReadingSettings(): ReadingSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<ReadingSettingsState>
    const arabic = { ...DEFAULT_ARABIC_SETTINGS, ...parsed.arabic }
    // Migration: 'tajawal' was a valid reading-typeface value before
    // increment 4 (Amal narrowed the Arabic picker to Naskh/Modern/
    // Kufi). A saved 'tajawal' — or any other no-longer-valid value —
    // falls back to the default rather than silently rendering with
    // an undefined font (Amal's own test sessions may have this saved).
    if (!VALID_ARABIC_TYPEFACES.includes(arabic.typeface)) {
      arabic.typeface = DEFAULT_ARABIC_SETTINGS.typeface
    }
    // Same defensive-fallback shape as the typeface migration above —
    // a free hex (not a closed enum) has its own failure mode: a
    // corrupted/hand-edited localStorage value that isn't valid CSS
    // hex at all. Falls back to the default rather than feeding a
    // bogus string straight into an inline `style.color`.
    if (!isValidHex(arabic.textColor)) {
      arabic.textColor = DEFAULT_ARABIC_SETTINGS.textColor
    }
    // #364 — the custom reading-panel background is a free hex OR null (no
    // override). A stored value that isn't valid hex (hand-edited storage,
    // a future shape change) falls back to null → the panel uses the
    // preset `tint`, exactly the safe state a reader who never opened the
    // wheel is already in.
    if (arabic.backgroundColor !== null && !isValidHex(arabic.backgroundColor)) {
      arabic.backgroundColor = null
    }
    const latin = { ...DEFAULT_LATIN_SETTINGS, ...parsed.latin }
    if (!VALID_LATIN_TYPEFACES.includes(latin.typeface)) {
      latin.typeface = DEFAULT_LATIN_SETTINGS.typeface
    }
    if (!isValidHex(latin.textColor)) {
      latin.textColor = DEFAULT_LATIN_SETTINGS.textColor
    }
    if (latin.backgroundColor !== null && !isValidHex(latin.backgroundColor)) {
      latin.backgroundColor = null
    }
    const readingRuler = typeof parsed.readingRuler === 'boolean' ? parsed.readingRuler : false
    const readingRulerColor = RULER_COLORS.includes(parsed.readingRulerColor as RulerColor)
      ? (parsed.readingRulerColor as RulerColor)
      : DEFAULT_RULER_COLOR
    const voiceRate = (VOICE_RATES as readonly number[]).includes(parsed.voiceRate as number)
      ? (parsed.voiceRate as number)
      : DEFAULT_VOICE_RATE
    // Defensive fallback, same shape as every other field above — an
    // older saved object (pre-#145) simply won't have this key at all.
    const voiceGender: VoiceGender =
      parsed.voiceGender === 'male' || parsed.voiceGender === 'female' ? parsed.voiceGender : DEFAULT_VOICE_GENDER
    // Same defensive-fallback shape as every other field above — an
    // older saved object (pre-#350) simply won't have this key at all.
    // `'none'` (whole-screen follow-up) is a valid stored value too: no
    // colour override, the app's native default look.
    const pageBackground: PageBackground =
      parsed.pageBackground === 'none' || VALID_TINTS.includes(parsed.pageBackground as Tint)
        ? (parsed.pageBackground as PageBackground)
        : DEFAULT_PAGE_BACKGROUND
    // Task #360 — same defensive-fallback shape as every other field
    // above. Intensity is clamped to 0-100 rather than rejected outright
    // on an out-of-range number (a hand-edited or future-format value),
    // matching how a real slider input can never itself go out of range.
    const dimmerEnabled = typeof parsed.dimmerEnabled === 'boolean' ? parsed.dimmerEnabled : DEFAULT_DIMMER_ENABLED
    const dimmerIntensity =
      typeof parsed.dimmerIntensity === 'number' && Number.isFinite(parsed.dimmerIntensity)
        ? Math.min(100, Math.max(0, parsed.dimmerIntensity))
        : DEFAULT_DIMMER_INTENSITY
    // Task #361 — same defensive-fallback shape as every other field
    // above. An older saved object (pre-#361) simply won't have either
    // key at all, which correctly falls through to 'line'/the default
    // colour — i.e., exactly the single-mode behaviour that reader
    // already had.
    const readingRulerMode: ReadingRulerMode =
      parsed.readingRulerMode === 'line' ||
      parsed.readingRulerMode === 'wordSync' ||
      // Task #465 — a third valid saved value; an older saved object
      // (pre-#465) simply won't have it, which correctly falls through
      // to 'line'/the default, same as every other migration guard here.
      parsed.readingRulerMode === 'lineFocus'
        ? parsed.readingRulerMode
        : DEFAULT_RULER_MODE
    const wordSyncRulerColor = RULER_COLORS.includes(parsed.wordSyncRulerColor as RulerColor)
      ? (parsed.wordSyncRulerColor as RulerColor)
      : DEFAULT_WORD_SYNC_RULER_COLOR
    return {
      latin,
      arabic,
      readingRuler,
      readingRulerColor,
      voiceRate,
      voiceGender,
      pageBackground,
      dimmerEnabled,
      dimmerIntensity,
      readingRulerMode,
      wordSyncRulerColor,
    }
  } catch {
    return defaults()
  }
}

/** Best-effort save — a quota error or private-browsing restriction
 * should never crash the reading experience. */
export function saveReadingSettings(state: ReadingSettingsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
