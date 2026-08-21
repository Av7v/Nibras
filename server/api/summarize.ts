/**
 * POST /summarize — real implementation (was a stub). Returns a short,
 * plain-language summary of the reader's OWN text via the xAI text adapter
 * (`_xaiChat.generateText`, same `AI_VOICE_API_KEY` as /voice + /mindmap —
 * Amal's one xAI key, NOT the never-chosen `AI_TEXT_API_KEY` the old stub
 * referenced). Same generic shape as mindmap.ts: returns the client
 * response PLUS the provider's token usage so `server/index.ts` trues the
 * per-volunteer spend cap up to the ACTUAL cost incl. reasoning tokens
 * (task #148).
 *
 * QUALITY: the LLM generates on the reader's own (dynamic) text, so quality
 * is a SYSTEM-PROMPT + sample-output review gate (nibras-ar for فصحى,
 * nibras-en for English), not a pre-blessable fixed output. Non-clinical,
 * warm, educational; Arabic is Modern Standard Arabic (الفصحى) with no
 * em-dashes (Amal's standing rule). `buildSummarizeSystemPrompt` is
 * exported for that review + for the real-run proof.
 */
import { generateText, type XaiUsage } from './_xaiChat.ts'
import { stripDashes } from './_text.ts'

interface SummarizeRequest {
  text: string
  lang: 'en' | 'ar'
}

interface SummarizeResponse {
  summary: string
  demo: false
}

export interface SummarizeHandlerResult {
  response: SummarizeResponse
  usage: XaiUsage | null
}

/** Mirrors _xaiTts.ts / server/index.ts's reader-text ceiling. */
const MAX_SUMMARIZE_CHARS = 15000

export function buildSummarizeSystemPrompt(lang: 'en' | 'ar'): string {
  const languageRule =
    lang === 'ar'
      ? 'Write the summary in Modern Standard Arabic (الفصحى) only, never a regional dialect. Do not use em-dashes; use commas or periods.'
      : 'Write the summary in clear, simple English. Do not use em-dashes; use commas or periods.'
  return [
    "You summarize a reader's own text for a reading-accessibility app used by people with dyslexia.",
    'Rules:',
    '- Write a SHORT, plain-language summary (2 to 4 short sentences) that captures the main idea.',
    '- Use simple, everyday words and short sentences.',
    '- Stay faithful to the text; never add facts, opinions, or advice that are not in it.',
    '- Be warm and encouraging, but NON-CLINICAL: never diagnose, assess, label, or make any therapeutic or medical claim.',
    languageRule,
    'Output only the summary itself, with no preamble, heading, label, or quotation marks.',
  ].join('\n')
}

export async function handleSummarizeRequest(body: SummarizeRequest): Promise<SummarizeHandlerResult> {
  const text = (body.text ?? '').slice(0, MAX_SUMMARIZE_CHARS)
  if (!text.trim()) {
    throw new Error('summarize: empty text')
  }
  const { text: summary, usage } = await generateText({
    systemPrompt: buildSummarizeSystemPrompt(body.lang),
    userText: text,
  })
  return { response: { summary: stripDashes(summary, body.lang), demo: false }, usage }
}
