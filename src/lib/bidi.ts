/**
 * Task #398 review (nibras-ar's precise bidi-token list, 2026-09-14) —
 * isolates a Latin/digit token so it reads and renders correctly no
 * matter what script surrounds it, for the cases dir="ltr" can't reach:
 * a plain STRING passed into an i18next translation template (an
 * aria-label, or any {{value}} interpolated into Arabic prose) has no
 * DOM element of its own to hang a `dir` attribute on.
 *
 * Uses the Unicode Bidirectional Algorithm's explicit ISOLATE controls
 * (U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE) —
 * UAX #9's own recommended mechanism for exactly this "embed a
 * foreign-direction run inside plain text" case, primary source:
 * https://www.unicode.org/reports/tr9/#Explicit_Directional_Isolates.
 * Preferred over the older LRM mark (U+200E): LRM is a single weak
 * character that nudges neighbouring neutrals but can still be
 * overridden by a stronger character on either side (the exact failure
 * mode behind FIX 2's hex-input bug and the #398 speed-pill bug); an
 * isolate fully contains the wrapped run so nothing leaks across the
 * boundary in either direction, regardless of what the run itself
 * contains (digits, hex letters, decimal points, unit suffixes).
 * Invisible either way — renders as zero-width, and every mainstream
 * screen reader (VoiceOver/NVDA/JAWS) already treats these as the
 * normal signal for "read this span in its own direction," so this
 * also fixes the announced reading order, not just the visual one.
 *
 * CALLER TRAP, confirmed empirically (2026-09-14) — include any GLUED
 * (no space) literal suffix INSIDE the call, don't leave it in the i18n
 * template: `isolateLtr(20) + 'px'` renders as "px20" under RTL, not
 * "20px" — closing the isolate right before unspaced Latin letters (or
 * another digit, e.g. a template's own literal ":1") makes the outer
 * RTL context treat that trailing bit as a SEPARATE foreign-direction
 * island and reorders the two islands relative to each other. The fix
 * is `isolateLtr('20px')` — isolate the WHOLE glued unit as one run.
 * This is why `reader.metaTemplate`'s "{{size}}px" and
 * `settings.contrastRatioLabel`'s "{{ratio}}:1" moved the unit/suffix
 * OUT of the template and into the interpolated value (Reader.tsx,
 * useProfileData.ts, SettingsFields.tsx). A suffix with a SPACE before
 * it ("{{lineHeight}} line-height") is unaffected either way. A glued
 * European-Terminator suffix like '%' is NOT safe once the number is
 * isolated: the closing isolate (U+2069) cuts '%' off from its number,
 * so a template's "{{percent}}% ..." renders "%42" under RTL. Put the
 * suffix in the call instead, isolateLtr(`${percent}%`), verified by a
 * rendered-order test (2026-09-14). This corrects an earlier note here
 * that wrongly called '%' "unaffected either way".
 */
export function isolateLtr(value: string | number): string {
  return `⁦${value}⁩`
}
