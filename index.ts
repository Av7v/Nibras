import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ar from './locales/ar.json'

export const RTL_LANGS = ['ar'] as const
export type AppLanguage = 'en' | 'ar'

const STORAGE_KEY = 'nibras-lang'

/** Mirrors the blocking inline script in index.html, so the very first
 * paint and every later render agree on the language. */
function detectInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ar' || saved === 'en') return saved
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall through.
  }
  return (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

function applyDocumentDirection(lang: string) {
  const dir = (RTL_LANGS as readonly string[]).includes(lang) ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}

const initialLanguage = detectInitialLanguage()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

// Keep <html lang/dir> and the on-device preference in sync with
// i18next no matter how the language changes (toggle click today;
// a deep link or profile setting later). Privacy-first: this is a
// single string in localStorage, never sent anywhere.
applyDocumentDirection(initialLanguage)
i18n.on('languageChanged', (lng) => {
  applyDocumentDirection(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Persistence is a nicety, not a requirement — ignore failures.
  }
})

export default i18n
