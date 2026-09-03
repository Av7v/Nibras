/**
 * Persisted opt-in consent for Arabic listening (the reader's voice is
 * sent to xAI's `/stt` transcription service — a real, honest tradeoff
 * English's on-device path never has, so it needs its own explicit
 * gate). `localStorage`, not `sessionStorage` (contrast with
 * `lib/accessToken.ts`'s own deliberate choice): this is a durable
 * PREFERENCE ("yes, I understand and I'm fine with this"), the same
 * category as e.g. Reading Ruler's own saved settings — asking again
 * every single session would be needless friction for something the
 * reader already agreed to, unlike the access code, which is a
 * privacy-sensitive secret this app deliberately does NOT want to
 * persist to disk.
 */

const STORAGE_KEY = 'nibras.arabicSttConsent'

export function hasArabicSttConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'granted'
  } catch {
    // Storage disabled/unavailable — treat as "not yet granted" so the
    // consent dialog simply asks again next time, a safe default.
    return false
  }
}

export function grantArabicSttConsent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'granted')
  } catch {
    // If storage genuinely can't persist, the dialog will just show
    // again on the next attempt — no worse than not having this at all.
  }
}
