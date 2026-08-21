/**
 * POST /translate — real implementation (was a stub). Translates `text`
 * from one language to the other for the Reader's auto-translate-on-
 * language-switch feature (task #112: Reader.tsx calls this ONCE PER
 * SECTION and caches every result; no demo/canned path — a faked
 * translation would be actively misleading, so the client shows an honest
 * "needs an AI connection" state when no backend is configured).
 *
 * Uses the xAI text adapter (`_xaiChat.generateText`, same `AI_VOICE_API_KEY`
 * as /voice + /mindmap — NOT the never-chosen `AI_TEXT_API_KEY` the old stub
 * referenced). Same generic shape as mindmap.ts: returns the client response
 * PLUS token usage so `server/index.ts` trues the per-volunteer spend cap up
 * to the ACTUAL cost incl. reasoning tokens (task #148).
 *
 * QUALITY: LLM on the reader's own (dynamic) text → SYSTEM-PROMPT + sample
 * review gate (nibras-ar / nibras-en). Arabic output is Modern Standard
 * Arabic (الفصحى) with no em-dashes. `buildTranslateSystemPrompt` is
 * exported for that review + the real-run proof.
 */
import { generateText, type XaiUsage } from './_xaiChat.ts'
import { stripDashes } from './_text.ts'

interface TranslateRequest {
  text: string
  from: 'en' | 'ar'
  to: 'en' | 'ar'
}

interface TranslateResponse {
  translatedText: string
  demo: false
}

export interface TranslateHandlerResult {
  response: TranslateResponse
  usage: XaiUsage | null
}

const MAX_TRANSLATE_CHARS = 15000

export function buildTranslateSystemPrompt(from: 'en' | 'ar', to: 'en' | 'ar'): string {
  const fromName = from === 'ar' ? 'Arabic' : 'English'
  const toName = to === 'ar' ? 'Arabic' : 'English'
  const toRule =
    to === 'ar'
      ? 'When translating into Arabic, prefer plain, widely-understood Modern Standard Arabic, the everyday فصحى a 12-year-old reader would know, whenever it carries the same meaning as the source. Never use dialect or colloquial Arabic. Do not make the Arabic more formal, literary, or archaic than the source; match the source\'s own register. Do not use em-dashes; use commas or periods.'
      : 'Translate into clear, natural English. Prefer plain, everyday words a young reader would know when they carry the same meaning (for example "vocabulary", not "linguistic repertoire"); do not make the English more formal than the source. Do not start an English sentence with \'And\' as a literal of the Arabic و; drop it, or use the connective the meaning calls for (but, so, then). Do not use em-dashes; use commas or periods.'
  return [
    `You translate a reader's text from ${fromName} to ${toName} for a reading-accessibility app used by people with dyslexia.`,
    'Rules:',
    '- Translate faithfully and naturally, preserving the full meaning and tone.',
    '- Do NOT summarize, explain, comment, add, or omit anything. Translate only.',
    toRule,
    'Output only the translation itself, with no preamble, notes, or quotation marks.',
  ].join('\n')
}

export async function handleTranslateRequest(body: TranslateRequest): Promise<TranslateHandlerResult> {
  const text = (body.text ?? '').slice(0, MAX_TRANSLATE_CHARS)
  if (!text.trim()) {
    throw new Error('translate: empty text')
  }
  const { text: translatedText, usage } = await generateText({
    systemPrompt: buildTranslateSystemPrompt(body.from, body.to),
    userText: text,
  })
  return { response: { translatedText: stripDashes(translatedText, body.to), demo: false }, usage }
}
