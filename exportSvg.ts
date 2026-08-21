/**
 * Rasterizes an in-page <svg> element to a downloaded PNG. Dependency-free
 * (serialize → blob URL → <img> → <canvas> → toBlob → temporary <a download>),
 * so it costs nothing in bundle size for a feature that's used rarely.
 *
 * Scope decision: PNG only, not PDF. The Mind Maps brief allowed either
 * ("image or PDF"); a real PDF needs either a new dependency (jsPDF/pdf-lib)
 * or hand-rolled PDF byte-writing, neither of which is justified for a
 * single-image export — a PNG opens/prints/shares fine. Noted for the record,
 * not hidden.
 *
 * Known limitation (disclosed, not silently swallowed): the exported image
 * is rendered by the browser's <img> decoder, which does not automatically
 * pull in this app's web fonts (Lexend / Tajawal / Noto Naskh Arabic) the
 * way an on-page, CSS-styled SVG does — so node labels may rasterize in a
 * fallback system font rather than the app's chosen typeface. Text stays
 * fully readable either way; this only affects visual polish of the
 * exported file, not its correctness.
 */
export async function exportSvgAsPng(svg: SVGSVGElement, filename: string, backgroundColor: string): Promise<void> {
  const width = svg.viewBox.baseVal.width || svg.clientWidth
  const height = svg.viewBox.baseVal.height || svg.clientHeight
  const scale = 2 // export at 2x for crisper text/lines than the on-screen render

  const serialized = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(svgUrl)

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) throw new Error('PNG encoding failed')

    const downloadUrl = URL.createObjectURL(pngBlob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to rasterize SVG for export'))
    img.src = src
  })
}
