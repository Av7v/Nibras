/**
 * Splits pasted or plain-text (.txt) content into readable sections,
 * so a long paste/file gets the same comfortable pagination as a PDF
 * or EPUB rather than one endless block. Short text (the common case —
 * a paragraph or two) produces exactly one section, so nothing changes
 * for the existing paste-and-format flow.
 */

const TARGET_CHUNK_SIZE = 2400

/** Prefers splitting at paragraph breaks; falls back to sentence
 * boundaries for text with no blank-line breaks (e.g. one big pasted
 * blob). Includes Arabic "؟" alongside ".!?" so sentence-splitting
 * isn't Latin-only. */
export function chunkPlainText(text: string, targetSize = TARGET_CHUNK_SIZE): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= targetSize) return [trimmed]

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length > 1) {
    return chunkUnits(paragraphs, targetSize, '\n\n')
  }
  const sentences = trimmed.match(/[^.!?؟]+[.!?؟]*/g) ?? [trimmed]
  return chunkUnits(
    sentences.map((s) => s.trim()).filter(Boolean),
    targetSize,
    ' ',
  )
}

function chunkUnits(units: string[], targetSize: number, joiner: string): string[] {
  const chunks: string[] = []
  let current = ''
  for (const unit of units) {
    if (current && current.length + joiner.length + unit.length > targetSize) {
      chunks.push(current)
      current = unit
    } else {
      current = current ? `${current}${joiner}${unit}` : unit
    }
  }
  if (current) chunks.push(current)
  return chunks
}
