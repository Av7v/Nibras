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

/** Blends a hex colour toward white in RGB space — `amount` 0 (unchanged)
 * to 1 (pure white). Used by App.tsx's page-tint effect (task #398 review,
 * FIX 3) to derive `--color-card` as a lighter shade of the chosen page
 * tint, rather than reusing the SAME hex as `--color-page-bg`/
 * `--color-cream` (which made cards visually collapse into the page and
 * lose their elevation). 0.55 reproduces this app's own already-approved
 * default relationship almost exactly: feeding the `cream` preset
 * (`#f5efe2`, byte-identical to index.css's default `--color-page-bg`)
 * through this at 0.55 yields `#fbf8f2`, one bit off `--color-card`'s own
 * hand-picked default of `#fbf8f0` in a single channel — not a
 * coincidence chased for its own sake, but the same sanity check
 * accentTheme.ts's own derivation uses against the existing navy accent. */
export function mixWithWhite(hex: string, amount: number): string {
  return mixColors(hex, '#ffffff', amount)
}

/** Blends `hexA` toward `hexB` in RGB space — `amount` 0 (pure `hexA`) to
 * 1 (pure `hexB`) — the same per-channel alpha-compositing math a
 * translucent CSS overlay actually performs. `mixWithWhite` above is the
 * one-target-fixed special case this generalizes (task #398 review, item
 * 4: the Reader's light-reduction dimmer needs the SAME blend but toward
 * its own overlay colour, not white, to compute the reading text's real
 * contrast once the scrim sits on top of it — see SettingsPanel.tsx's
 * own use of this for the live warning). */
export function mixColors(hexA: string, hexB: string, amount: number): string {
  const a = parseInt(hexA.replace('#', ''), 16)
  const b = parseInt(hexB.replace('#', ''), 16)
  const clamped = clamp(amount, 0, 1)
  const mix = (ca: number, cb: number) => Math.round(ca + (cb - ca) * clamped)
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  const channel = (n: number, shift: number) => (n >> shift) & 255
  return `#${toHex(mix(channel(a, 16), channel(b, 16)))}${toHex(mix(channel(a, 8), channel(b, 8)))}${toHex(mix(channel(a, 0), channel(b, 0)))}`
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
