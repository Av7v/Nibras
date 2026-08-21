/**
 * xAI (Grok) Speech-to-Text provider adapter for `POST /stt` — Arabic (and
 * English) listening for the pilot. Amal's Option A: the SAME
 * `AI_VOICE_API_KEY` as `/voice` and `/mindmap`, no new vendor/account/key.
 *
 * Endpoint + shape verified against docs.x.ai (2026-08-19): `POST
 * https://api.x.ai/v1/stt`, **multipart/form-data** with fields `language`,
 * `format`, and `file` — the file MUST be the LAST field. Response JSON is
 * `{ text, language, duration, words }`. There is NO token/usage block, but
 * `duration` (audio seconds) is exactly what STT is billed on ($0.10/hour),
 * so the caller records the exact cost from `durationSeconds` (mirrors the
 * mind-map true-up, task #148).
 *
 * PRIVACY (Amal's consent promise, #125): the audio is forwarded to xAI to
 * be transcribed and is NEVER logged or stored by this adapter (or anywhere
 * in Nibras). xAI's own API data handling — not used for training; 30-day
 * encrypted abuse-retention then deleted — is what the consent copy
 * discloses. Consent gating (opt-in) is the client's responsibility.
 * SECURITY: the key is read from `process.env.AI_VOICE_API_KEY` and is
 * NEVER logged, echoed, or returned to the client; neither is the audio.
 */
export interface XaiSttRequest {
  audio: Buffer
  mimeType: string
  lang: 'en' | 'ar'
}

export interface XaiSttResult {
  text: string
  /** Provider-reported audio duration in seconds — used for exact billing. */
  durationSeconds: number
}

const XAI_STT_URL = 'https://api.x.ai/v1/stt'

/** Generous, like the TTS/chat adapters: kill a truly stuck request, never
 * cap a normal-but-slow one. A short reading clip transcribes fast; 60s is
 * comfortable headroom. */
const REQUEST_TIMEOUT_MS = 60_000

/** `en`/`ar` map straight to xAI's language codes (docs.x.ai lists `ar`).
 * Arabic target register is MODERN STANDARD ARABIC (الفصحى) — the reading
 * clips are فصحى; a real ar-SA clip accuracy check happens at wiring/verify
 * time before this ships. */
const XAI_LANGUAGE: Record<'en' | 'ar', string> = { en: 'en', ar: 'ar' }

/** mimeType → file extension for the multipart filename (xAI keys the codec
 * off the audio bytes, but a sensible extension is polite + unambiguous). */
const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
}

/** Audio mime types accepted for `/stt`, as BARE types (no codec suffix) —
 * single source of truth with EXT_BY_MIME above. */
export const SUPPORTED_STT_MIME: ReadonlySet<string> = new Set(Object.keys(EXT_BY_MIME))

/** Normalize a client-supplied mime type to a supported BARE type, or null
 * if unsupported. REAL `MediaRecorder.mimeType` is CODEC-SUFFIXED, e.g.
 * "audio/webm;codecs=opus" — strip the `;codecs=...` suffix and lowercase
 * before the allowlist check, and return the bare type (what EXT_BY_MIME and
 * xAI's proven-accepted set use). A strict `Set.has` on the suffixed string
 * 400s every real recording — caught by nibras-eng's real client; the
 * synthetic proof used a hand-built bare string and missed it. */
export function normalizeSttMime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const bare = raw.split(';')[0].trim().toLowerCase()
  return SUPPORTED_STT_MIME.has(bare) ? bare : null
}

export async function transcribeSpeechXai(req: XaiSttRequest): Promise<XaiSttResult> {
  const apiKey = process.env.AI_VOICE_API_KEY
  if (!apiKey) {
    throw new Error('AI_VOICE_API_KEY is not configured — see server/README.md')
  }
  if (req.audio.byteLength === 0) {
    throw new Error('xAI STT: empty audio')
  }

  const ext = EXT_BY_MIME[req.mimeType] ?? 'mp3'
  const form = new FormData()
  form.append('language', XAI_LANGUAGE[req.lang] ?? 'auto')
  form.append('format', 'true')
  // `file` MUST be the last field (docs.x.ai). FormData preserves insertion
  // order, so appending it last satisfies that.
  form.append('file', new Blob([req.audio], { type: req.mimeType || 'application/octet-stream' }), `audio.${ext}`)

  let res: Response
  try {
    res = await fetch(XAI_STT_URL, {
      method: 'POST',
      // No Content-Type header — fetch sets the multipart boundary itself.
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`xAI STT: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    throw new Error('xAI STT: network error contacting the provider')
  }

  if (!res.ok) {
    // Short, safe snippet for server-side diagnostics; server/index.ts's
    // catch-all sanitizes this before any client ever sees it (#147 P2-c).
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new Error(`xAI STT: provider returned ${res.status} ${res.statusText} ${detail}`.trim())
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error('xAI STT: provider returned a non-JSON response')
  }

  const text = (json as { text?: unknown })?.text
  if (typeof text !== 'string') {
    throw new Error('xAI STT: provider returned no transcript')
  }
  const duration = Number((json as { duration?: unknown })?.duration)
  return { text, durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0 }
}
