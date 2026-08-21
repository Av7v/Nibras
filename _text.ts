/**
 * Deterministic no-em-dash normalization for DYNAMIC LLM output (task
 * AI-on, 2026-08-19). Amal's no-em-dash rule is standing + app-wide; the
 * client already hand-strips STATIC strings (#182/#183), and dynamic model
 * output needs it MORE — the system prompts also forbid em-dashes, but a
 * prompt rule reduces, it can't GUARANTEE. This is the guarantee, applied
 * at each chat handler's output (summarize/explain/translate + mind-map
 * node labels).
 *
 * Meaning-preserving formatting ONLY: an em-dash (—) or en-dash (–), with
 * any surrounding spaces, becomes a comma + space — the Arabic comma (،)
 * for Arabic text, the Latin comma for English. Nothing else is touched.
 */
export function stripDashes(s: string, lang: 'en' | 'ar'): string {
  const comma = lang === 'ar' ? '، ' : ', '
  return s.replace(/\s*[—–]\s*/g, comma).trim()
}
