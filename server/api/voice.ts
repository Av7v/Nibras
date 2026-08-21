/**
 * Platform-agnostic core of `POST /voice` — synthesizes `text` as
 * speech via the xAI adapter and returns audio the client can play
 * immediately. `server/index.ts` is the one concrete transport
 * currently wired to this (a local Node http server); a future
 * Vercel/Netlify function would just call this same function from its
 * own handler shape, request validation and provider choice both stay
 * right here either way. See ../README.md for the full contract.
 *
 * IMPLEMENTED 2026-08-13 (task #106) — was a stub ("Not implemented");
 * now calls the real xAI provider adapter (`_xaiTts.ts`, proven live
 * against api.x.ai the same day). xAI returns raw MP3 bytes, not a
 * hosted URL — rather than uploading/hosting a file somewhere (the
 * original TODO's assumption), this base64-encodes the bytes into a
 * `data:audio/mpeg;base64,...` URI for the `url` field. A `data:` URI
 * is a fully valid `<audio>`/`<video>` src per the HTML spec, so the
 * EXISTING client contract (`{mode:'audio', url, demo:false}`, the
 * client already does `audio.src = result.url`) needed ZERO changes
 * on either side — proven end-to-end in `_verify/proof-xai-backend-e2e.mjs`
 * (real request -> real response -> browser genuinely decodes it,
 * reports a real positive `duration`, both EN and AR). Trade-off,
 * stated plainly: this re-encodes the whole clip into the JSON
 * response rather than a separately-fetchable file — fine for this
 * app's actual call sizes (a sentence to a few short paragraphs); real
 * file storage + a signed URL would be the right call for arbitrarily
 * long text in a future, separately-scoped iteration.
 */
import { synthesizeSpeechXai } from './_xaiTts.ts'

interface VoiceRequest {
  text: string
  lang: 'en' | 'ar'
  gender: 'male' | 'female'
  rate: number
}

interface VoiceResponse {
  mode: 'audio'
  url: string
  demo: false
}

export async function handleVoiceRequest(body: VoiceRequest): Promise<VoiceResponse> {
  const { audio, contentType } = await synthesizeSpeechXai(body)
  const url = `data:${contentType};base64,${audio.toString('base64')}`
  return { mode: 'audio', url, demo: false }
}
