import type { DocumentSection } from '../documents'
import { chunkPlainText } from '../textChunking'

/**
 * Extracts plain text from a Word (.docx) file — client-side only, the
 * file never leaves the device. mammoth reads the underlying .docx XML
 * (itself a zip, like an EPUB) and returns the document's raw text
 * with all formatting stripped; Nibras reformats that text with its
 * own reading settings anyway, so preserving the original .docx's
 * fonts/styling is not the goal here, same reasoning as parseEpub's
 * own comment. Mammoth's own documented behaviour puts a blank line
 * after every paragraph, which chunkPlainText already treats as a
 * paragraph boundary — the SAME pagination path .txt/pasted text
 * already uses, not a new per-format unit (a .docx, unlike a PDF page
 * or an EPUB chapter, has no comparable built-in navigation unit).
 *
 * mammoth ships its own browser build (verified in its own
 * package.json `browser` field, which swaps in browser-safe internals
 * for zip/file access) and is lazy-loaded here (dynamic import),
 * exactly like pdf.js and jszip elsewhere in this folder — it only
 * ships to a user who actually opens a .docx. Its own lib/index.d.ts
 * is `export =` (the same CJS shape jszip's own typings use), so the
 * default is destructured off the dynamic import's namespace — the
 * exact pattern parseEpub already uses for jszip, not a static
 * top-level import. `{ arrayBuffer }` (not `{ buffer }`) is mammoth's
 * own documented browser input shape; `{ buffer }` is Node-only.
 */
export async function parseDocx(file: File): Promise<{ title?: string; sections: DocumentSection[] }> {
  const { default: mammoth } = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const { value: text } = await mammoth.extractRawText({ arrayBuffer })

  const sections = chunkPlainText(text).map((chunk) => ({ text: chunk }))
  if (sections.length === 0) {
    throw new Error("Couldn't find any readable text in this Word document.")
  }
  return { title: file.name.replace(/\.docx$/i, ''), sections }
}
