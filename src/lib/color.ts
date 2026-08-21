/**
 * Colour-space conversions for the Reading Settings text-colour wheel
 * (task #83). HSL <-> hex, the two directions needed: seed the wheel's
 * puck position + lightness slider FROM a persisted hex value on load,
 * and produce a hex value FROM the wheel's hue/saturation + the
 * lightness slider as the reader drags. Pure, dependency-free —
 * standard HSL<->RGB math (the same algorithm the CSS Color spec
 * itself uses to resolve `hsl()`), not worth an npm colour library for
 * something this small and this well-defined.
 */

export interface Hsl {
  h: number // 0-360 (hue)
  s: number // 0-100 (saturation, %)
  l: number // 0-100 (lightness, %)
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/** HSL -> 6-digit lowercase hex (`#rrggbb`). */
export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360 // normalize into [0, 360)
  const sat = clamp(s, 0, 100) / 100
  const light = clamp(l, 0, 100) / 100

  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** 6-digit hex (with or without leading `#`) -> HSL. Grey (s=0) inputs
 * return h=0 (hue is meaningless for a fully desaturated colour) —
 * callers seeding a wheel puck position from this should treat h as
 * "keep whatever angle the puck was already at" for that case if they
 * want to avoid a visible jump; the reading-settings wheel doesn't
 * need that nuance since it always starts from a real, hued default. */
export function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return { h, s: s * 100, l: l * 100 }
}

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** Normalizes a hex string a reader might type without a leading `#`
 * or in mixed case — returns null (not a fallback colour) if it still
 * isn't a valid 6-digit hex once normalized, so a caller can decide
 * for itself whether/how to reject the edit rather than silently
 * accepting something malformed. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isValidHex(withHash) ? withHash.toLowerCase() : null
}
