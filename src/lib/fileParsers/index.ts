import type { DocumentSection, SourceType } from '../documents'
import { chunkPlainText } from '../textChunking'
import { detectLanguage, tagSectionLanguages } from '../detectLanguage'

export interface ParsedFile {
  title?: string
  sourceType: SourceType
  sections: DocumentSection[]
  /** The document's overall/dominant script — always populated. Each
   * section in `sections` also carries its own detected `lang`, which
   * is what actually drives rendering (see tagSectionLanguages) — this
   * top-level value is a fallback and a sensible default for e.g. new
   * sections added later. */
  lang: 'en' | 'ar'
}

async function parseTxt(file: File): Promise<{ title?: string; sections: DocumentSection[] }> {
  const text = await file.text()
  const sections = chunkPlainText(text).map((chunk) => ({ text: chunk }))
  if (sections.length === 0) throw new Error('This file appears to be empty.')
  return { title: file.name.replace(/\.txt$/i, ''), sections }
}

/** Dispatches to the right parser by extension/MIME type, then tags
 * the document AND each individual section with its own detected
 * language (see detectLanguage.ts) — a document is mostly one script,
 * but a section quoting the other one still renders correctly instead
 * of being forced into whichever script dominates the rest. The PDF
 * and EPUB parsers are dynamically imported *inside* their own
 * modules, so this function — and importing it — doesn't pull either
 * library into the main bundle; only opening that file type does. */
export async function parseFile(file: File, uiLanguageFallback: 'en' | 'ar'): Promise<ParsedFile> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { parsePdf } = await import('./pdf')
    const result = await parsePdf(file)
    return finalize(result, 'pdf', uiLanguageFallback)
  }

  if (name.endsWith('.epub') || file.type === 'application/epub+zip') {
    const { parseEpub } = await import('./epub')
    const result = await parseEpub(file)
    return finalize(result, 'epub', uiLanguageFallback, result.lang)
  }

  if (name.endsWith('.txt') || file.type === 'text/plain') {
    const result = await parseTxt(file)
    return finalize(result, 'txt', uiLanguageFallback)
  }

  throw new Error('Please choose a PDF, EPUB, or .txt file.')
}

function finalize(
  result: { title?: string; sections: DocumentSection[] },
  sourceType: SourceType,
  uiLanguageFallback: 'en' | 'ar',
  /** A format-declared language (e.g. EPUB's dc:language), preferred
   * over guessing from content when present. */
  declaredLang?: 'en' | 'ar',
): ParsedFile {
  const docLang = declaredLang ?? detectDominantLanguage(result.sections, uiLanguageFallback)
  return {
    title: result.title,
    sourceType,
    lang: docLang,
    sections: tagSectionLanguages(result.sections, docLang),
  }
}

function detectDominantLanguage(sections: DocumentSection[], fallback: 'en' | 'ar'): 'en' | 'ar' {
  const sample = sections
    .slice(0, 3)
    .map((s) => s.text)
    .join(' ')
  return detectLanguage(sample, fallback)
}
