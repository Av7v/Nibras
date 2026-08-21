/** Standard visible-focus recipe (WCAG 2.2 AA 2.4.11/2.4.13): suppress
 * the default outline for pointer clicks, but always show a clear 3px
 * accent ring for keyboard/assistive-tech focus. Ported from the
 * approved static mockup's global `:focus-visible` rule. */
export const focusRing =
  'outline-none focus-visible:outline-[3px] focus-visible:outline-accent focus-visible:outline-offset-[3px]'

/** Same, but drawn *inside* the element's own box. Use for controls
 * that sit inside an `overflow-hidden` ancestor (e.g. the pill-shaped
 * language toggle) where a positive offset would be clipped and look
 * broken instead of missing. */
export const focusRingInset =
  'outline-none focus-visible:outline-[3px] focus-visible:outline-accent focus-visible:outline-offset-[-3px]'
