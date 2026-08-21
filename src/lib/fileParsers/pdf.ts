import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
import type { DocumentSection } from '../documents'

/**
 * PDF text streams record items in *paint* order, not necessarily
 * logical reading order — for right-to-left runs this commonly comes
 * out as each line's words in reverse (confirmed empirically against
 * this project's own Arabic test fixture: naive concatenation produced
 * exact word-order reversal per line, e.g. "الصفحة الثالثة" became
 * "الثالثة الصفحة"). Individual item strings were NOT internally
 * scrambled, only their sequence — so the fix is: group items into
 * visual lines by Y position, sort each line left-to-right by X
 * position, and reverse that order specifically for lines pdf.js
 * itself marks as RTL (via TextItem.dir — more reliable than guessing
 * from character ranges, since it reflects the PDF's own text-run
 * direction rather than just which Unicode block a glyph falls in). */
function extractPageText(items: (TextItem | TextMarkedContent)[]): string {
  type Positioned = { str: string; x: number; y: number; isRtl: boolean }
  const positioned: Positioned[] = []
  for (const item of items) {
    if (!('str' in item) || !item.str) continue
    const [, , , , x, y] = item.transform
    positioned.push({ str: item.str, x: Number(x) || 0, y: Number(y) || 0, isRtl: item.dir === 'rtl' })
  }

  // Group into lines: items whose Y positions are within a small
  // tolerance of each other (PDF y increases upward).
  const lines: Positioned[][] = []
  for (const item of positioned) {
    const line = lines.find((l) => Math.abs(l[0].y - item.y) < 2)
    if (line) line.push(item)
    else lines.push([item])
  }
  lines.sort((a, b) => b[0].y - a[0].y) // top of page first

  const pageLines = lines.map((line) => {
    const sortedLtr = [...line].sort((a, b) => a.x - b.x)
    // Whitespace-only items are tagged 'ltr' by pdf.js regardless of
    // the words around them, and roughly half of any line's items are
    // the space runs between words — including them in the ratio
    // dilutes even a fully-Arabic line below 50%. Judge direction only
    // by the actual word tokens.
    const wordItems = sortedLtr.filter((i) => i.str.trim() !== '')
    const rtlCount = wordItems.filter((i) => i.isRtl).length
    const isRtlLine = wordItems.length > 0 && rtlCount > wordItems.length / 2
    const ordered = isRtlLine ? [...sortedLtr].reverse() : sortedLtr
    return ordered.map((i) => i.str).join('')
  })

  return pageLines.join(' ').replace(/\s+/g, ' ').trim()
}

/** Extracts plain text per PDF page — client-side only, the file never
 * leaves the device. One section per page: pdf.js's own page boundary
 * *is* the natural pagination unit for a PDF, so "Next/Prev" and the
 * "Page X of Y" indicator line up with the real document. Lazy-loaded
 * (dynamic import) so pdf.js's parser only ships to a user who
 * actually opens a PDF. */
export async function parsePdf(file: File): Promise<{ title?: string; sections: DocumentSection[] }> {
  const pdfjsLib = await import('pdfjs-dist')
  // Vite can't statically resolve a bare worker import; resolving via
  // import.meta.url lets it correctly bundle/serve the worker file.
  // Verified against the installed package: pdfjs-dist/build/pdf.worker.min.mjs
  // exists at this exact path in the installed version (6.2.108).
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const sections: DocumentSection[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    sections.push({ text: extractPageText(content.items) })
  }

  let title: string | undefined
  try {
    const meta = await pdf.getMetadata()
    const info = meta.info as { Title?: string } | undefined
    title = info?.Title?.trim() || undefined
  } catch {
    // metadata is optional — fall back to the file name below
  }

  return { title: title || file.name.replace(/\.pdf$/i, ''), sections }
}
