import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { RULER_COLORS, TINTS, type RulerColor, type Tint } from '../../lib/readingSettings'
import { hexToHsl, hslToHex, normalizeHex } from '../../lib/color'
import { contrastRatio, WCAG_AA_BODY_TEXT_RATIO } from '../../lib/contrast'
import { isolateLtr } from '../../lib/bidi'
import { InfoIcon } from '../icons'

/** Reusable "label + range slider + live value" row. Used for text
 * size, line height, line width, letter spacing (Latin only), and word
 * spacing — every numeric reading-setting control shares this shape. */
export function SliderField({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  startGlyph,
  endGlyph,
}: {
  id: string
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  formatValue: (value: number) => string
  startGlyph?: ReactNode
  endGlyph?: ReactNode
}) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2.5">
        {startGlyph !== undefined && (
          <span aria-hidden="true" className="flex-none text-xs leading-none text-ink-muted">
            {startGlyph}
          </span>
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-5 flex-1 accent-accent"
        />
        {endGlyph !== undefined && (
          <span aria-hidden="true" className="flex-none text-lg leading-none text-ink-muted">
            {endGlyph}
          </span>
        )}
        <output
          htmlFor={id}
          className="min-w-[5.2em] text-end text-[0.8125rem] font-semibold tabular-nums text-accent"
        >
          {formatValue(value)}
        </output>
      </div>
    </div>
  )
}

/** Label + description + a switch-styled checkbox — same visually-
 * hidden-input-plus-styled-sibling idiom as TypefaceField/TintField
 * below, for a single on/off preference (currently just the Reading
 * Ruler). The thumb position uses logical `start`/`end` insets, so it
 * mirrors correctly under `dir="rtl"` the same way the rest of the
 * app's directional UI does — no separate RTL-only styling needed. */
export function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Added 2026-08-13 for «سُكون»'s voice-guidance toggle — the first
   * ToggleField caller that can be genuinely UNAVAILABLE (no TTS voice
   * for the current language), not just off. Disables the checkbox +
   * visually dims the whole control via the SAME peer-* mechanism
   * already used for checked/focus, rather than a separate style path. */
  disabled?: boolean
  /** Overrides the checkbox's accessible name. Without this, a wrapping
   * `<label>` gives the checkbox the LABEL text + DESCRIPTION text
   * concatenated as its announced name — fine for a short toggle, but
   * verbose once `description` is a full sentence; pass a short
   * standalone string here to keep the announced name to just the
   * control's own purpose. */
  ariaLabel?: string
}) {
  return (
    <div className="mb-5">
      <label
        htmlFor={id}
        className={`flex items-center justify-between gap-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">{description}</span>}
        </span>
        <span className="relative inline-flex h-6 w-11 flex-none items-center">
          <input
            id={id}
            type="checkbox"
            aria-label={ariaLabel}
            disabled={disabled}
            className="peer sr-only"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="h-6 w-11 rounded-full border-[1.5px] border-line-strong bg-cream transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]" />
          <span className="pointer-events-none absolute start-[3px] size-[18px] rounded-full bg-card transition-[inset-inline-start] peer-checked:start-[calc(100%-21px)] peer-checked:bg-white" />
        </span>
      </label>
    </div>
  )
}

export interface TypefaceOption<T extends string> {
  value: T
  label: string
  sampleText: string
  fontFamily: string
}

/** Custom radio "pills" for typeface choice — visually-hidden-but-
 * focusable input + a styled sibling via Tailwind's peer-* variants
 * (the idiomatic-Tailwind version of the input:checked+sibling CSS
 * pattern proven in the static mockup). */
export function TypefaceField<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: TypefaceOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="inline-flex cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2 text-sm font-medium text-ink peer-checked:border-accent peer-checked:bg-accent-tint peer-checked:text-accent peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]">
              <span style={{ fontFamily: opt.fontFamily }} className="text-[1.05rem] font-semibold">
                {opt.sampleText}
              </span>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
}

/** Generic radio "cards" for a small closed set of choices that each
 * need a short description, not just a label — same peer-radio idiom
 * as TypefaceField above, but plain text (no font sample/swatch).
 * First use: the Reading Ruler's mode picker (task #361, line vs
 * word-by-word). The peer-checked colour change lives on the OUTER
 * span (the input's actual sibling — Tailwind's `peer-checked:` only
 * ever matches a direct sibling of the `.peer` element, never a
 * grandchild), and the label text inherits it for free since `color`
 * cascades; the description underneath sets its OWN muted colour so it
 * deliberately never follows the label's accent colour, same as
 * ToggleField's description always staying muted regardless of
 * checked. */
export function ChoiceField<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: ChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="inline-flex min-w-[150px] flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="block w-full rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2.5 text-start text-ink peer-checked:border-accent peer-checked:bg-accent-tint peer-checked:text-accent peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]">
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.description && <span className="mt-0.5 block text-[0.75rem] text-ink-muted">{opt.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const TINT_ORDER: Tint[] = ['cream', 'blue', 'green', 'rose', 'white']

/** Custom radio "swatches" for background tint. */
export function TintField({
  legend,
  name,
  value,
  onChange,
  caption,
  tintLabels,
  active = true,
}: {
  legend: string
  name: string
  value: Tint
  onChange: (value: Tint) => void
  caption: string
  tintLabels: Record<Tint, string>
  /** When false, NO swatch shows as selected — used by the Reader's
   * background control (task #364) once a free custom colour (from the
   * new colour wheel below the swatches) is active, so a preset and a
   * custom colour are never both shown as "chosen" at once. Clicking a
   * swatch still fires onChange (the parent clears the custom override),
   * which flips this back to true. Defaults true → unchanged everywhere
   * that doesn't pass it. */
  active?: boolean
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {TINT_ORDER.map((key) => (
          <label key={key} className="inline-flex cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={active && value === key}
              onChange={() => onChange(key)}
            />
            <span
              style={{ background: TINTS[key] }}
              className="inline-flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-line-strong text-xs font-bold text-ink peer-checked:shadow-[0_0_0_3px_var(--color-card),0_0_0_5px_var(--color-accent)] peer-checked:after:content-['✓'] peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]"
            />
            <span className="sr-only">{tintLabels[key]}</span>
          </label>
        ))}
      </div>
      <p className="mt-2.5 text-[0.8125rem] text-ink-muted">{caption}</p>
    </fieldset>
  )
}

/** Custom radio "swatches" for the Reading Ruler's color — same visual
 * idiom as TintField above (a deliberate, small duplication rather
 * than forcing TintField to also handle a second, differently-typed
 * palette). Swatches show the full-saturation color, same as
 * TintField's own swatches — the ruler renders that color translucent
 * when actually applied, visible live in the Reader itself. */
export function RulerColorField({
  legend,
  name,
  value,
  onChange,
  colorLabels,
}: {
  legend: string
  name: string
  value: RulerColor
  onChange: (value: RulerColor) => void
  colorLabels: Record<RulerColor, string>
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {RULER_COLORS.map((color) => (
          <label key={color} className="inline-flex cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={value === color}
              onChange={() => onChange(color)}
            />
            <span
              style={{ background: color }}
              className="inline-flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-line-strong text-xs font-bold text-white peer-checked:shadow-[0_0_0_3px_var(--color-card),0_0_0_5px_var(--color-accent)] peer-checked:after:content-['✓'] peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]"
            />
            <span className="sr-only">{colorLabels[color]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const WHEEL_SIZE = 132 // px
const WHEEL_RADIUS = WHEEL_SIZE / 2
const PUCK_SIZE = 18 // px
const HUE_STEP = 6 // degrees per arrow-key press
const SAT_STEP = 5 // percent per arrow-key press

// Hue ring built from the 6 pure-hue stops 60° apart (0/60/.../360).
// `conic-gradient(from 0deg, ...)`'s 0deg is 12-o'clock, going
// CLOCKWISE by CSS's own default — the puck-placement/pointer-reading
// math below MUST agree with this exact orientation, or the puck would
// visually land on the wrong hue relative to what's actually drawn.
const HUE_RING_GRADIENT =
  'conic-gradient(from 0deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))'
// White fading to TRANSPARENT WHITE (not the bare `transparent`
// keyword, which resolves to transparent BLACK — `rgba(0,0,0,0)` — and
// would interpolate through a visibly muddy grey fringe partway out) —
// desaturates toward the wheel's centre, on top of the hue ring above
// (first-listed CSS background layer wins).
const DESATURATION_OVERLAY_GRADIENT = 'radial-gradient(circle, white 0%, rgb(255 255 255 / 0) 72%)'

/** Pointer position (relative to the wheel's own top-left corner) ->
 * {hue, saturation}. Hue 0 = top (12 o'clock), increasing CLOCKWISE —
 * see HUE_RING_GRADIENT's comment above for why. Saturation 0 = centre
 * (white/desaturated), 100 = the wheel's outer edge. */
function pointerToHueSat(offsetX: number, offsetY: number): { hue: number; saturation: number } {
  const dx = offsetX - WHEEL_RADIUS
  const dy = WHEEL_RADIUS - offsetY // flip screen-Y-down to standard maths Y-up
  const mathAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI // standard trig angle: 0 = pointing right (3 o'clock), counter-clockwise-positive
  const hue = (((90 - mathAngleDeg) % 360) + 360) % 360 // convert to "clockwise from top"
  const dist = Math.sqrt(dx * dx + dy * dy)
  const saturation = Math.min(100, (dist / WHEEL_RADIUS) * 100)
  return { hue, saturation }
}

/** The inverse of pointerToHueSat — where the puck sits (relative to
 * the wheel's own top-left corner) for a given {hue, saturation}. */
function hueSatToPuckPosition(hue: number, saturation: number): { x: number; y: number } {
  const mathAngleRad = ((90 - hue) * Math.PI) / 180
  const radius = (saturation / 100) * WHEEL_RADIUS
  return {
    x: WHEEL_RADIUS + radius * Math.cos(mathAngleRad),
    y: WHEEL_RADIUS - radius * Math.sin(mathAngleRad),
  }
}

/**
 * The text-colour picker (task #83, 2026-08-14, Amal: a colour WHEEL,
 * not just presets, parallel to the existing background-tint picker —
 * plus a CRITICAL accessibility safeguard, since a free colour wheel
 * against a tinted background can produce genuinely hard-to-read text
 * in an app whose entire mission is readability).
 *
 * Three redundant ways to reach the exact same `value` (a single hex
 * string, always the one source of truth — none of the three below
 * hold separate state):
 * 1. The WHEEL — hue (angle) + saturation (distance from centre),
 *    dragged via Pointer Events (mouse/touch/pen unified) — the
 *    prominent, literal "colour wheel" Amal asked for.
 * 2. The lightness SLIDER below it (reuses SliderField verbatim, the
 *    same control every other numeric reading-setting already uses) —
 *    a wheel can only show 2 of HSL's 3 dimensions at once; lightness
 *    is conventionally always a separate control (same shape macOS's
 *    own "Color Wheel" picker uses).
 * 3. A plain hex TEXT INPUT — genuinely useful on its own (typing an
 *    exact code you already know), but also this control's real
 *    accessibility backstop: WAI-ARIA has no first-class pattern for a
 *    genuinely 2-D pointer widget like the wheel (a real, documented
 *    gap — `role="slider"` requires a SINGLE numeric range, which
 *    hue+saturation-together isn't). Rather than paper over that gap
 *    with a technically-misapplied ARIA role, the wheel's puck is left
 *    as a plain focusable element with a descriptive `aria-label` and
 *    real arrow-key support (a genuine, if informally-specified,
 *    keyboard path) — but the GUARANTEED, unambiguous, zero-judgment-
 *    call path for a keyboard/screen-reader user is this hex field,
 *    built from a single native `<input type="text">`. The wheel is
 *    the delightful primary path; the hex field is the honest
 *    fallback that makes the whole control fully WCAG-operable
 *    regardless of how well any given AT handles the wheel itself.
 */
export function ColorWheelField({
  legend,
  caption,
  value,
  onChange,
  backgroundHex,
  lightnessLabel,
  hexLabel,
  previewLabel,
  wheelAriaLabel,
  formatContrastLabel,
  contrastGoodLabel,
  contrastWarningLabel,
  sampleText,
  idPrefix,
  valueIsBackground = false,
}: {
  legend: string
  caption?: string
  value: string
  onChange: (hex: string) => void
  /** The active background TINT's own hex — the live contrast check is
   * against what the reader will ACTUALLY see this text sit on, not
   * some fixed/arbitrary reference colour. */
  backgroundHex: string
  lightnessLabel: string
  hexLabel: string
  previewLabel: string
  wheelAriaLabel: (hex: string) => string
  formatContrastLabel: (ratio: string) => string
  contrastGoodLabel: string
  contrastWarningLabel: string
  /** A short script-representative glyph for the live preview swatch —
   * 'Aa' / 'أب', same inline-literal convention TypefaceField's own
   * `sampleText` already uses (a representative glyph, not a sentence
   * needing translation). */
  sampleText: string
  /** Latin and Arabic each get their OWN instance of this field (text
   * colour is per-script, like tint already is) — element ids must be
   * unique across both or the two `<label htmlFor>` pairs collide. */
  idPrefix: string
  /** Task #364: when true, `value` is a BACKGROUND colour (the reader's
   * reading-panel background, or a mind-map's canvas) and `backgroundHex`
   * is the FOREGROUND it's checked against (the text/ink). Flips ONLY the
   * little preview swatch so it always shows foreground-on-background
   * truthfully; the contrast RATIO is order-independent so the number and
   * the pass/warn logic are identical either way. Defaults false → the
   * original text-colour behaviour (value = the text, backgroundHex = the
   * surface behind it) is unchanged. */
  valueIsBackground?: boolean
}) {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const { h, s, l } = hexToHsl(value)
  const [hexDraft, setHexDraft] = useState(value)

  // Keeps the visible hex textbox in sync whenever `value` changes from
  // OUTSIDE the hex input itself (wheel drag, lightness slider, or the
  // panel's own "Reset to defaults") — never fights the reader mid-
  // keystroke inside the box (that path calls onChange directly, which
  // flows back here as a new, already-equal `value`).
  useEffect(() => {
    setHexDraft(value)
  }, [value])

  function applyFromWheelEvent(clientX: number, clientY: number) {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    const { hue, saturation } = pointerToHueSat(clientX - rect.left, clientY - rect.top)
    onChange(hslToHex({ h: hue, s: saturation, l }))
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyFromWheelEvent(e.clientX, e.clientY)
  }
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return
    applyFromWheelEvent(e.clientX, e.clientY)
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    isDraggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Informal but real keyboard support for the wheel itself (on top of
  // the guaranteed-accessible hex field above) — Left/Right adjust hue
  // (wraps, since hue is genuinely circular), Up/Down adjust saturation
  // (clamps, since saturation is not).
  function handlePuckKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let nextHue = h
    let nextSat = s
    switch (e.key) {
      case 'ArrowLeft':
        nextHue = h - HUE_STEP
        break
      case 'ArrowRight':
        nextHue = h + HUE_STEP
        break
      case 'ArrowUp':
        nextSat = Math.min(100, s + SAT_STEP)
        break
      case 'ArrowDown':
        nextSat = Math.max(0, s - SAT_STEP)
        break
      default:
        return
    }
    e.preventDefault()
    onChange(hslToHex({ h: nextHue, s: nextSat, l }))
  }

  function commitHexDraft(raw: string) {
    const normalized = normalizeHex(raw)
    // An invalid/partial draft is left showing exactly what the reader
    // typed (not silently reverted mid-edit) — it just doesn't
    // propagate to onChange (and therefore doesn't persist) until it
    // actually parses as a real hex colour.
    if (normalized) onChange(normalized)
  }

  const puck = hueSatToPuckPosition(h, s)
  const ratio = contrastRatio(value, backgroundHex)
  const passesAA = ratio >= WCAG_AA_BODY_TEXT_RATIO

  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap items-start gap-5">
        <div
          ref={wheelRef}
          className="relative flex-none touch-none rounded-full border-[1.5px] border-line-strong"
          style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, background: HUE_RING_GRADIENT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ background: DESATURATION_OVERLAY_GRADIENT }}
          />
          {/* No `role` override here, deliberately — see this
              component's own doc comment above for why (a real ARIA
              gap for 2-D widgets, and the hex field below is the
              guaranteed-compliant path regardless of how this is
              announced). Plain focusable element + a descriptive,
              live-updating aria-label + real arrow-key handling. */}
          <div
            tabIndex={0}
            aria-label={wheelAriaLabel(isolateLtr(value))}
            onKeyDown={handlePuckKeyDown}
            className="absolute rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)] focus-visible:outline-[3px] focus-visible:outline-accent focus-visible:outline-offset-2"
            style={{
              width: PUCK_SIZE,
              height: PUCK_SIZE,
              left: puck.x,
              top: puck.y,
              transform: 'translate(-50%, -50%)',
              background: value,
            }}
          />
        </div>

        <div className="min-w-[170px] flex-1">
          <SliderField
            id={`${idPrefix}-lightness`}
            label={lightnessLabel}
            min={0}
            max={100}
            value={l}
            onChange={(newL) => onChange(hslToHex({ h, s, l: newL }))}
            formatValue={(v) => `${Math.round(v)}%`}
          />

          <label htmlFor={`${idPrefix}-hex`} className="mb-1.5 block text-sm font-semibold text-ink">
            {hexLabel}
          </label>
          <input
            id={`${idPrefix}-hex`}
            type="text"
            dir="ltr"
            value={hexDraft}
            onChange={(e) => {
              setHexDraft(e.target.value)
              commitHexDraft(e.target.value)
            }}
            onBlur={() => setHexDraft(value)} // snap back to the last VALID value if left mid-invalid edit
            spellCheck={false}
            className="mb-3.5 w-full rounded-control border-[1.5px] border-line-strong bg-card px-3 py-1.5 text-sm tabular-nums text-ink"
          />

          {/* One aria-live region wrapping BOTH the ratio text and the
              good/warning message that follows it — announces as a
              unit even though the good/warning half swaps which
              element is mounted (a live region correctly announces
              child additions/removals, not just textContent mutations
              on one unchanging node). */}
          <div aria-live="polite" className="flex items-center gap-2.5 rounded-control border border-line bg-cream px-3 py-2">
            <span
              aria-hidden="true"
              style={valueIsBackground ? { color: backgroundHex, background: value } : { color: value, background: backgroundHex }}
              className="flex size-9 flex-none items-center justify-center rounded-control text-base font-bold"
            >
              {sampleText}
            </span>
            <div className="min-w-0">
              <span className="sr-only">{previewLabel}</span>
              <p className="m-0 text-[0.8125rem] font-semibold text-ink">{formatContrastLabel(isolateLtr(`${ratio.toFixed(1)}:1`))}</p>
              <p className="m-0 mt-0.5 flex items-start gap-1 text-[0.8125rem] text-ink-muted">
                {!passesAA && <InfoIcon className="mt-0.5 size-3.5 flex-none text-accent" />}
                {passesAA ? contrastGoodLabel : contrastWarningLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      {caption && <p className="mt-2.5 text-[0.8125rem] text-ink-muted">{caption}</p>}
    </fieldset>
  )
}
