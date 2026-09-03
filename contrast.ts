/**
 * WCAG 2.x contrast-ratio math — relative luminance + contrast ratio,
 * the same public formula this project's own verify scripts already
 * implement standalone (e.g. `_verify/verify-dashboard-promotion.mjs`'s
 * own `hexToRgb`/`relLuminance`/`contrastHex` helpers, used there for
 * build-time evidence) but now as real, shared APP code — task #83's
 * text-colour picker needs a LIVE, in-browser contrast check as the
 * reader drags the wheel, not just a build-time one.
 *
 * Source (primary): WCAG 2.2's own "relative luminance" and "contrast
 * ratio" definitions —
 * https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)]
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/** WCAG contrast ratio between two hex colours — 1 (identical) to 21
 * (pure black vs pure white). Order-independent (doesn't matter which
 * one is "the text" vs "the background"). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexToRgb(hexA))
  const lb = relativeLuminance(hexToRgb(hexB))
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG 2.x AA threshold for normal (non-large) body text — the bar
 * task #83's live safeguard checks against, matching what this app's
 * own verify suite already treats as the standard everywhere else. */
export const WCAG_AA_BODY_TEXT_RATIO = 4.5
