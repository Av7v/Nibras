/**
 * Task #367 (2026-09-13, Amal via team-lead): extends the #350 global
 * page-colour system so the CHOSEN colour drives the whole theme, not
 * just backgrounds — every element currently on `--color-accent`
 * (buttons, the play button, active pills, the Reading Buddy/Reader
 * voice bar, the sidebar rail) should recolour to match too. See
 * App.tsx's own root effect for where this actually gets applied (the
 * SAME `document.documentElement.style.setProperty` mechanism #350
 * already uses for the 3 light-surface vars).
 *
 * The hard constraint (why aieng originally kept `--color-accent` a
 * fixed navy, per team-lead): a light background TINT and a button
 * that has to sit clearly on top of it, with white button-text that
 * has to stay >= WCAG AA 4.5:1, are two genuinely different jobs — you
 * cannot just reuse the light tint's own hex as the accent.
 *
 * Method — HOLD the chosen colour's HUE (so the button family
 * genuinely reads as "the same colour" the reader picked), FORCE full
 * saturation (100%, matching this app's own EXISTING accent recipe:
 * index.css's own comment documents `#004aad -> HSL(214.3°, 100%,
 * 33.9%)` — the current navy accent is itself already fully
 * saturated, this isn't a new stylistic choice), then SEARCH for the
 * lightness that guarantees white text stays >= AA against the
 * LIGHTEST family member (accent-hover, `l + 10`) — contrast with a
 * fixed white foreground is monotonic in lightness at a fixed
 * hue+saturation (darker -> more contrast), so if the lightest member
 * clears AA, accent/-active/-darker (all darker than hover) clear it
 * automatically too. A small buffer above the legal 4.5:1 floor
 * (SAFE_AA_FLOOR = 4.6) absorbs real-browser colour-rounding, the same
 * caution index.css's own already-verified navy numbers have plenty of
 * room for (white-on-accent-hover there is 5.60:1).
 *
 * Why the search can't be a single fixed lightness for every hue: HSL
 * lightness is NOT perceptually/luminance-uniform across hues — a
 * yellow-green at L=34% has a much HIGHER relative luminance (and
 * therefore much LESS contrast with white) than a blue or red at that
 * same L=34%, because WCAG's relative-luminance formula weights the
 * green channel far more heavily (0.7152) than red (0.2126) or blue
 * (0.0722). Confirmed empirically before shipping this: at a single
 * fixed L=34%, cream/blue/green all FAILED white-on-accent (as low as
 * 2.91:1 for green), while rose and a sample purple passed easily —
 * exactly the uneven-across-hues failure a fixed lightness can't avoid.
 *
 * Sanity-checked against the app's own already-approved values: running
 * this exact function on the CURRENT navy accent (#004aad) reproduces
 * #004aad/#0060e0/#004096/#003a87 byte-for-byte (lands on l=34, the
 * same lightness index.css's own comment already documents) — this is
 * a faithful generalization of the existing recipe, not a divergent
 * new one.
 */
import { hexToHsl, hslToHex } from './color'
import { contrastRatio } from './contrast'

export interface AccentTheme {
  accent: string
  accentHover: string
  accentActive: string
  accentDarker: string
  accentTint: string
}

const BASE_SATURATION = 100 // matches the current navy accent's own 100% S
const STARTING_LIGHTNESS = 34 // matches the current navy accent's own ~33.9% L
const LIGHTNESS_FLOOR = 8 // never search below this (near-black; unreached in practice — even worst-case pure yellow, h=60, lands at l=13)
const SAFE_AA_FLOOR = 4.6 // WCAG AA is 4.5:1; a small buffer for real-browser rounding

export function deriveAccentTheme(hex: string): AccentTheme {
  const { h } = hexToHsl(hex)
  let l = STARTING_LIGHTNESS
  while (l > LIGHTNESS_FLOOR && contrastRatio('#ffffff', hslToHex({ h, s: BASE_SATURATION, l: l + 10 })) < SAFE_AA_FLOOR) {
    l -= 1
  }
  return {
    accent: hslToHex({ h, s: BASE_SATURATION, l }),
    accentHover: hslToHex({ h, s: BASE_SATURATION, l: l + 10 }),
    accentActive: hslToHex({ h, s: BASE_SATURATION, l: l - 4.5 }),
    accentDarker: hslToHex({ h, s: BASE_SATURATION, l: l - 7.5 }),
    // accent-tint (pale badge-background wash): the SAME fixed recipe
    // index.css's own comment already documents for the navy swap
    // ("reuses the OLD tint's own S~=4.75%, L~=95.5% recipe with the
    // new hue... that recipe's job is 'match the old tint's
    // whisper-subtlety,' not derive a fresh cap") — reused verbatim,
    // just with this theme's own hue.
    accentTint: hslToHex({ h, s: 4.75, l: 95.5 }),
  }
}

// The 5 CSS custom properties App.tsx's root effect sets/removes
// together — kept as one ordered list so that effect and this module
// can't drift out of sync about which vars belong to "the accent
// family" if a future change adds/removes one.
export const ACCENT_THEME_VARS: Record<keyof AccentTheme, string> = {
  accent: '--color-accent',
  accentHover: '--color-accent-hover',
  accentActive: '--color-accent-active',
  accentDarker: '--color-accent-darker',
  accentTint: '--color-accent-tint',
}
