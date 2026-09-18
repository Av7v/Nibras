import { LINE_FOCUS_DIM_OPACITY } from '../../lib/readingSettings'

/**
 * Task #465 (2026-09-14, Amal via team-lead) — the reading ruler's
 * THIRD mode: like ReadingRuler.tsx's own pointer-following band, this
 * tracks the exact same live pointer Y, but instead of washing the
 * current line it DIMS every line above and below it, leaving only the
 * current one at full, untouched clarity — Microsoft Immersive Reader's
 * own "Line Focus." A distinct aid from the plain line band: that one
 * marks WHERE you are; this one also suppresses everything ELSE
 * competing for attention, which is the specific difficulty some
 * dyslexic readers describe (neighbouring lines pulling the eye before
 * they finish the current one).
 *
 * Two full-width bands, not one shape with a cut-out: `inset-x-0` (no
 * left/right positioning at all) makes both bands inherently RTL-safe,
 * the exact reasoning ReadingRuler.tsx's own file comment already
 * gives for why a horizontal band has no reading direction to get
 * wrong — true here too, unchanged. The TOP band spans from the
 * article's own top (0) down to just above the current line; the
 * BOTTOM band spans from just below the current line down to the
 * article's own bottom (`bottom: 0`, not a computed height, so it
 * always reaches the real end of the content regardless of how long
 * the open document is). The current line's own space is simply the
 * GAP between the two bands — never rendered, never dimmed, always at
 * the reader's original, chosen contrast. `rounded-t-card`/
 * `rounded-b-card` match the reading panel's own corner radius
 * (Reader.tsx's `<article>` is `rounded-card`) so the two bands don't
 * visibly square off a rounded corner they otherwise sit flush against.
 *
 * Reuses the #360 screen-dimmer's own overlay colour — the SAME
 * `var(--color-ink)` Reader.tsx's own dimmer `<div>` paints with
 * (not a hardcoded hex mirror of it), so if that CSS variable is ever
 * retuned, this stays in visual lockstep with the other overlay
 * automatically — at LINE_FOCUS_DIM_OPACITY, see that constant's own
 * comment for why it's fixed rather than a second user-tunable slider,
 * and deliberately stronger than the #360 overlay's own cap.
 * `pointer-events-none` + `aria-hidden="true"`,
 * same as every other ruler overlay: purely presentational, never
 * blocks a click or drag-selection, and never removes the underlying
 * paragraph from the accessibility tree — a screen-reader user gets
 * the exact same text either way; only sighted rendering changes.
 * `motion-safe:` gates the transition so a prefers-reduced-motion
 * reader sees both bands snap instantly with zero animation, matching
 * ReadingRuler.tsx's own convention (and this task's own "dim is
 * static" requirement) rather than an animated resize.
 */
export function LineFocusRuler({
  y,
  fontSize,
  lineHeight,
}: {
  /** Pointer Y, relative to the positioned ancestor's own box — the
   * SAME value Reader.tsx already tracks for the 'line' mode (see
   * ReadingRuler.tsx's own `y` prop comment); this mode reuses that
   * exact pointer-tracking wiring rather than a second mechanism. */
  y: number
  fontSize: number
  lineHeight: number
}) {
  // Same "a bit taller than one line" formula as ReadingRuler.tsx's own
  // `height`, reused rather than re-derived differently, so the CLEAR
  // window this mode leaves matches the size the 'line' mode's own
  // band already covers — switching between the two modes at the same
  // pointer position keeps the same amount of text legible either way.
  const half = (fontSize * lineHeight * 1.3) / 2
  const clearTop = Math.max(0, y - half)
  const clearBottom = y + half

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 rounded-t-card motion-safe:transition-[height] motion-safe:duration-100 motion-safe:ease-out"
        style={{ height: clearTop, backgroundColor: 'var(--color-ink)', opacity: LINE_FOCUS_DIM_OPACITY }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-card motion-safe:transition-[top] motion-safe:duration-100 motion-safe:ease-out"
        style={{ top: clearBottom, backgroundColor: 'var(--color-ink)', opacity: LINE_FOCUS_DIM_OPACITY }}
      />
    </>
  )
}
