/**
 * Optional pointer-following reading guide — a translucent horizontal
 * band that tracks the mouse over the reading area, helping some
 * readers keep their place on the current line. OFF by default
 * (Amal: explicitly optional) — see settings.readingRuler in the
 * Reading Settings panel. Color is user-chosen (Amal, 2026-08-13:
 * «مسطرة القراءة ممكن نغير ألوانها») from RULER_COLORS
 * (lib/readingSettings.ts) — defaults to the brand accent, matching
 * this band's original fixed color.
 *
 * Mechanism choice: a pointer-following band, not a "highlight the
 * current line" effect. The Reader renders its content as flowing
 * paragraphs (one `<p>`), not discrete per-line elements, so detecting
 * "the current line" would mean splitting text into line-wrapped spans
 * — fragile, and it would need re-computing every time the reader
 * changes font size/line height/line width in this same settings
 * panel. A pointer-following overlay needs no knowledge of line
 * boundaries at all: it degrades gracefully across every typography
 * setting, and it's trivially RTL-safe (a horizontal band has no
 * inherent reading direction, unlike per-line logic that would need to
 * know which script it's tracking).
 *
 * Purely presentational — position is fully controlled by the parent
 * (Reader.tsx tracks the pointer via onMouseMove on the `<article>`
 * and passes the resulting Y down). `pointer-events-none` throughout
 * so it never intercepts clicks or drag-selection; `aria-hidden` since
 * this is a visual aid, not content (confirmed acceptable — team-lead).
 * `motion-safe:` gates the position transition so a
 * prefers-reduced-motion reader sees the band snap instantly with zero
 * animation, never a moving/jarring element.
 */
export function ReadingRuler({
  y,
  fontSize,
  lineHeight,
  color,
}: {
  /** Pointer Y, relative to the positioned ancestor's own box. */
  y: number
  fontSize: number
  lineHeight: number
  /** A RulerColor hex value — rendered translucent regardless of hue,
   * so every choice reads as an equally gentle wash, not a solid block. */
  color: string
}) {
  // A bit taller than one line, so it comfortably covers the line the
  // reader is pointing at without feeling like a thin, hard-to-aim strip.
  const height = fontSize * lineHeight * 1.3

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 rounded-md motion-safe:transition-[top] motion-safe:duration-100 motion-safe:ease-out"
      style={{ top: y - height / 2, height, backgroundColor: hexToRgba(color, 0.16) }}
    />
  )
}

/** Fixed 16% alpha for every color choice — chosen to roughly match
 * the band's original fixed appearance (`bg-accent/10` looked a touch
 * too faint once tested across the full color set, especially the
 * lighter amber; 16% keeps every option clearly visible while staying
 * translucent enough that the text underneath is never obscured). */
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
