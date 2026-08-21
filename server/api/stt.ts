/**
 * Platform-agnostic core of `POST /stt` — transcribes a short audio clip to
 * text via the xAI STT adapter (`_xaiStt.ts`). Same shape as `voice.ts` /
 * `mindmap.ts`: `server/index.ts` is the concrete transport; a future
 * serverless function would call this same function.
 *
 * Returns the transcript PLUS the provider-reported `durationSeconds` so
 * `server/index.ts` can record the EXACT spend (STT bills per audio-second)
 * after gating on a conservative pre-estimate — the same gate-then-true-up
 * pattern the mind-map path uses (task #148).
 *
 * The audio is never stored or logged (see `_xaiStt.ts`); consent + the
 * "your voice is sent to xAI, never used to train AI, deleted within 30
 * days" disclosure are the client's job (#125).
 */
import { transcribeSpeechXai } from './_xaiStt.ts'

interface SttRequest {
  audio: Buffer
  mimeType: string
  lang: 'en' | 'ar'
}

interface SttResult {
  text: string
  /** Provider-reported audio seconds, for exact spend accounting in index.ts. */
  durationSeconds: number
  demo: false
}

export async function handleSttRequest(body: SttRequest): Promise<SttResult> {
  const { text, durationSeconds } = await transcribeSpeechXai(body)
  return { text, durationSeconds, demo: false }
}
