/**
 * POST /explain — real implementation (was a stub). Rephrases the reader's
 * OWN text in simpler, plainer words via the xAI text adapter
 * (`_xaiChat.generateText`, same `AI_VOICE_API_KEY` as /voice + /mindmap).
 * Same generic shape as mindmap.ts: returns the client response PLUS the
 * provider's token usage so `server/index.ts` trues the per-volunteer spend
 * cap up to the ACTUAL cost incl. reasoning tokens (task #148).
 *
 * QUALITY: LLM on the reader's own (dynamic) text → SYSTEM-PROMPT + sample
 * review gate (nibras-ar فصحى / nibras-en English). Non-clinical, warm;
 * Arabic is Modern Standard Arabic (الفصحى) with no em-dashes.
 * `buildExplainSystemPrompt` is exported for that review + the real-run proof.
 */
import { generateText, type XaiUsage } from './_xaiChat.ts'
import { stripDashes } from './_text.ts'

interface ExplainRequest {
  text: string
  lang: 'en' | 'ar'
}

interface ExplainResponse {
  explanation: string
  demo: false
}

export interface ExplainHandlerResult {
  response: ExplainResponse
  usage: XaiUsage | null
}

const MAX_EXPLAIN_CHARS = 15000

export function buildExplainSystemPrompt(lang: 'en' | 'ar'): string {
  const languageRule =
    lang === 'ar'
      ? 'Write the explanation in Modern Standard Arabic (الفصحى) only, never a regional dialect. Do not use em-dashes; use commas or periods.'
      : 'Write the explanation in clear, simple English. Do not use em-dashes; use commas or periods.'
  return [
    "You explain a reader's own text in simpler words for a reading-accessibility app used by people with dyslexia.",
    'Rules:',
    '- Rephrase the text in plain, everyday language with short sentences and concrete words.',
    '- Keep the meaning fully faithful; do not add new facts, opinions, or advice, and do not leave anything out.',
    '- Be warm and encouraging, but NON-CLINICAL: never diagnose, assess, label, or make any therapeutic or medical claim.',
    languageRule,
    'Output only the explanation itself, with no preamble, heading, label, or quotation marks.',
  ].join('\n')
}

export async function handleExplainRequest(body: ExplainRequest): Promise<ExplainHandlerResult> {
  const text = (body.text ?? '').slice(0, MAX_EXPLAIN_CHARS)
  if (!text.trim()) {
    throw new Error('explain: empty text')
  }
  const { text: explanation, usage } = await generateText({
    systemPrompt: buildExplainSystemPrompt(body.lang),
    userText: text,
  })
  return { response: { explanation: stripDashes(explanation, body.lang), demo: false }, usage }
}
