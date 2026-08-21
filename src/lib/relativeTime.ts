/**
 * Locale-aware "2 hours ago" / "منذ ساعتين" formatting via the
 * standard Intl.RelativeTimeFormat — no extra i18n keys needed, the
 * browser already ships correct Arabic + English wording (including
 * Arabic's dual/plural forms, which a hand-written key like
 * "{{n}} hours ago" could not get right on its own).
 */

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
]

export function formatRelativeTime(timestampMs: number, lang: 'en' | 'ar'): string {
  const diff = timestampMs - Date.now() // negative = past
  const abs = Math.abs(diff)

  if (abs < 60 * 1000) {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    return rtf.format(0, 'second') // "now" / "الآن"
  }

  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const { unit, ms } of UNITS) {
    if (abs >= ms || unit === 'minute') {
      const value = Math.round(diff / ms)
      return rtf.format(value, unit)
    }
  }
  return rtf.format(0, 'second')
}
