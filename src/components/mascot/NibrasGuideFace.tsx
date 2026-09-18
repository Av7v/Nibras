import { useLayoutEffect, useRef } from 'react'
import guideSvgRaw from './nibras-guide.svg?raw'

/**
 * «مرشد نبراس» — vdesign's animation-ready lantern guide (task #366/#381),
 * rendered inline so its ONE state line can be driven from the voice:
 *
 *     root.setAttribute('class', '<expression> <mouth>')
 *
 * (NOT root.className = '...' — on an SVG element className is a read-only
 * SVGAnimatedString and assigning to it throws; the useLayoutEffect below
 * uses setAttribute, which is what actually runs.) Exactly as vdesign's own
 * contract (see the comment block at the top of
 * nibras-guide.svg) specifies. The SVG is a self-contained state machine:
 * a `<style>` inside it shows exactly one mouth and one eye-set for any
 * pair of classes, and its own `@media (prefers-reduced-motion)` block
 * pins the mouth shut regardless of what class the driver sets — so
 * reduced-motion safety holds even if the JS driver keeps running.
 *
 * WHY inject the raw file rather than hand-port to JSX: the file is the
 * single source of truth vdesign maintains and gates (verify-states.html,
 * 30/30). We copy it VERBATIM into the client (byte-identical, checked)
 * and inject the whole `<svg>` markup the exact way that standing gate
 * proves works (innerHTML of a container, then set the root class) — so
 * the in-app render and the gate exercise the identical state machine.
 * The container is aria-hidden: this face always lives inside a button
 * that carries its own aria-label, so the decorative <title>/<desc>
 * inside the SVG must NOT double-announce (and per vdesign's contract the
 * label must never churn per mouth frame anyway).
 */

// The complete `<svg>…</svg>` element, dropping only the XML declaration
// and the leading authoring comment (everything before the opening tag).
// Computed once at module load from the imported raw string.
const SVG_MARKUP = guideSvgRaw.slice(guideSvgRaw.indexOf('<svg '))

export interface NibrasGuideFaceProps {
  /** The two state classes, space-joined, e.g. "expr-talking mouth-a".
   * One expression (expr-idle | expr-talking | expr-warm) + one mouth
   * (mouth-rest | mouth-m | mouth-e | mouth-a | mouth-o). */
  stateClass: string
  /** Rendered edge length in px. vdesign measured the talking mouth reads
   * as a shimmer below 64px and is unambiguous at 96px, so callers that
   * TALK should pass >= 64 (ideally 96). */
  size: number
  className?: string
}

export function NibrasGuideFace({ stateClass, size, className }: NibrasGuideFaceProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  // useLayoutEffect (not useEffect) so the state class + fill sizing are
  // applied before the browser paints — no one-frame flash of the SVG's
  // baked default ("expr-idle mouth-rest", 96×96).
  useLayoutEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg) return
    svg.setAttribute('class', stateClass)
    // Let the SVG fill the sized container via its viewBox rather than its
    // baked 96×96 intrinsic size.
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
  }, [stateClass])

  return (
    <span
      ref={containerRef}
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex', width: size, height: size }}
      // Injected verbatim; the string is a constant, so React sets it once
      // on mount and the useLayoutEffect above owns the root class after.
      dangerouslySetInnerHTML={{ __html: SVG_MARKUP }}
    />
  )
}
