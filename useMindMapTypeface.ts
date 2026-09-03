import { useEffect, useState } from 'react'
import {
  DEFAULT_ARABIC_SETTINGS,
  DEFAULT_LATIN_SETTINGS,
  type ArabicTypeface,
  type LatinTypeface,
} from '../lib/readingSettings'

/** Mind-map node-label typeface, per script, persisted on-device (#126/#263).
 * Reuses the Reader's typeface options + FONT_STACKS, but is a SEPARATE
 * choice the user makes on the Mind Maps page (independent of the reading
 * typeface). Mirrors useMindMapColors' load-on-init + save-on-change shape.
 * Validates on read so a hand-edited/legacy value never yields a broken font. */
const STORAGE_KEY = 'nibras-mindmap-typeface'

export const MINDMAP_LATIN_TYPEFACES: readonly LatinTypeface[] = ['lexend', 'atkinson', 'openSans', 'lora', 'openDyslexic']
export const MINDMAP_ARABIC_TYPEFACES: readonly ArabicTypeface[] = ['notoNaskh', 'ibmPlexSansArabic', 'reemKufi']

interface StoredTypefaces {
  latin: LatinTypeface
  arabic: ArabicTypeface
}

function loadTypefaces(): StoredTypefaces {
  const fallback: StoredTypefaces = { latin: DEFAULT_LATIN_SETTINGS.typeface, arabic: DEFAULT_ARABIC_SETTINGS.typeface }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredTypefaces> | null
    return {
      latin: (MINDMAP_LATIN_TYPEFACES as readonly string[]).includes(parsed?.latin ?? '') ? (parsed!.latin as LatinTypeface) : fallback.latin,
      arabic: (MINDMAP_ARABIC_TYPEFACES as readonly string[]).includes(parsed?.arabic ?? '') ? (parsed!.arabic as ArabicTypeface) : fallback.arabic,
    }
  } catch {
    return fallback
  }
}

export function useMindMapTypeface(lang: 'en' | 'ar') {
  const [all, setAll] = useState<StoredTypefaces>(loadTypefaces)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      /* ignore quota/private-mode */
    }
  }, [all])

  const typeface: LatinTypeface | ArabicTypeface = lang === 'ar' ? all.arabic : all.latin
  const setTypeface = (tf: LatinTypeface | ArabicTypeface) =>
    setAll((prev) => (lang === 'ar' ? { ...prev, arabic: tf as ArabicTypeface } : { ...prev, latin: tf as LatinTypeface }))

  return { typeface, setTypeface }
}
