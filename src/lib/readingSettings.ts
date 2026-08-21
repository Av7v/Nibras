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
}

export interface ArabicSettings {
  typeface: ArabicTypeface
  fontSize: number
  lineHeight: number
  lineWidth: number
  wordSpacing: number
  tint: Tint
  textColor: string
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
}

export const DEFAULT_ARABIC_SETTINGS: ArabicSettings = {
  typeface: 'notoNaskh', // the canonical readable Naskh body script — arabic-typefaces.md recommended default
  fontSize: 20, // ~11% larger than Latin default — F12
  lineHeight: 1.8, // more generous than Latin's 1.7 — F12
  lineWidth: 48, // shorter measure than Latin's 64 — F4 + F12
  wordSpacing: 0.15, // carries more of the spacing load without letter-spacing — F11
  tint: 'cream',
  textColor: DEFAULT_TEXT_COLOR,
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

// 6 soft, moderately-saturated hues — calm, not neon/harsh (checked
// against the same "gentle, low-stress" bar as TINTS, just a stronger
// base hue since this renders translucent, not as a solid fill). The
// blue is the app's own brand accent (and the ruler's original fixed
// color, kept first/default); the amber reuses the app's one other
// established warm accent (#f7a062, the Dashboard "continue reading"
// highlight) rather than inventing a fresh orange.
export const RULER_COLORS: RulerColor[] = ['#004aad', '#2f9e44', '#f7a062', '#d6336c', '#7048e8', '#0ca678']
export const DEFAULT_RULER_COLOR: RulerColor = '#004aad'

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
    const latin = { ...DEFAULT_LATIN_SETTINGS, ...parsed.latin }
    if (!VALID_LATIN_TYPEFACES.includes(latin.typeface)) {
      latin.typeface = DEFAULT_LATIN_SETTINGS.typeface
    }
    if (!isValidHex(latin.textColor)) {
      latin.textColor = DEFAULT_LATIN_SETTINGS.textColor
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
    return { latin, arabic, readingRuler, readingRulerColor, voiceRate, voiceGender }
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
