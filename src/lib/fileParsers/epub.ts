import type { DocumentSection } from '../documents'

const OPF_NS = 'http://www.idpf.org/2007/opf'
const DC_NS = 'http://purl.org/dc/elements/1.1/'

function assertParsed(doc: Document, what: string) {
  if (doc.querySelector('parsererror')) {
    throw new Error(`Couldn't read this EPUB's ${what} — the file may be corrupted.`)
  }
}

/** Extracts each chapter's plain text, in the book's own reading order
 * (its "spine") — client-side only, the file never leaves the device.
 * One section per spine chapter: an EPUB's own chapter structure *is*
 * the natural navigation unit, unlike a PDF or plain text which have
 * no such structure of their own. Lazy-loaded (dynamic import of
 * jszip) so it only ships to a user who actually opens an EPUB.
 *
 * An EPUB is a zip archive. We read just enough of the OCF/OPF
 * structure to get the reading order and chapter files — not a full
 * rendering engine (deliberately: Nibras reformats the extracted text
 * with its own reading settings, so preserving the original EPUB's
 * typesetting/CSS is not the goal here). */
export async function parseEpub(
  file: File,
): Promise<{ title?: string; sections: DocumentSection[]; lang?: 'en' | 'ar' }> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)

  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new Error("This doesn't look like a valid EPUB file (missing container.xml).")
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  assertParsed(containerDoc, 'container')
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error("This doesn't look like a valid EPUB file (missing the content file path).")

  const opfXml = await zip.file(opfPath)?.async('string')
  if (!opfXml) throw new Error("This EPUB's content file is missing.")
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml')
  assertParsed(opfDoc, 'content file')
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''

  const manifest = new Map<string, string>()
  for (const item of Array.from(opfDoc.getElementsByTagNameNS(OPF_NS, 'item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) manifest.set(id, opfDir + href)
  }

  const spineIds = Array.from(opfDoc.getElementsByTagNameNS(OPF_NS, 'itemref'))
    .map((el) => el.getAttribute('idref'))
    .filter((id): id is string => Boolean(id))

  const title =
    opfDoc.getElementsByTagNameNS(DC_NS, 'title')[0]?.textContent?.trim() ||
    file.name.replace(/\.epub$/i, '')

  // Prefer the EPUB's own declared language (authoritative) over
  // guessing from content — falls through to content-based detection
  // in the caller if this is absent or not one of our two scripts.
  const declaredLang = opfDoc
    .getElementsByTagNameNS(DC_NS, 'language')[0]
    ?.textContent?.trim()
    .toLowerCase()
  const lang = declaredLang?.startsWith('ar') ? 'ar' : declaredLang?.startsWith('en') ? 'en' : undefined

  const sections: DocumentSection[] = []
  for (const id of spineIds) {
    const href = manifest.get(id)
    if (!href) continue
    const chapterHtml = await zip.file(href)?.async('string')
    if (!chapterHtml) continue
    // Parsed as HTML (not XML) deliberately — real-world EPUB chapter
    // files are occasionally not perfectly well-formed XML, and the
    // browser's HTML parser is far more forgiving; we only need the
    // text content, not to preserve exact XHTML structure.
    const chapterDoc = new DOMParser().parseFromString(chapterHtml, 'text/html')
    const heading = chapterDoc.querySelector('h1, h2, h3')?.textContent?.trim()
    const text = (chapterDoc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) sections.push({ title: heading || undefined, text })
  }

  if (sections.length === 0) {
    throw new Error("Couldn't find any readable chapters in this EPUB.")
  }

  return { title, sections, lang }
}
