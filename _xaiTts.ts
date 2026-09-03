/**
 * xAI (Grok) Text-to-Speech provider adapter for the /voice endpoint.
 *
 * This is the real provider call that server/api/voice.ts's `// TODO`
 * asked for. It is deliberately a SMALL, isolated, transport-agnostic
 * function: it takes Nibras's own request shape and returns raw MP3
 * bytes + a content-type. How the HTTP endpoint hands those bytes back
 * to the client (stream directly / data URL / stored URL) is voice.ts's
 * decision, kept separate on purpose so the provider logic and the
 * client contract can evolve independently.
 *
 * Verified live against api.x.ai on 2026-08-13: POST /v1/tts with an
 * Authorization: Bearer key returns `audio/mpeg` bytes (HTTP 200) for
 * both Arabic (auto-detect) and English test phrases. Endpoint + schema
 * per docs.x.ai (Text-to-Speech): text ≤ 15,000 chars, `voice_id`,
 * `language` (BCP-47 or `auto`), `speed` 0.7–1.5, MP3 out.
 *
 * SECURITY: the key is read from process.env.AI_VOICE_API_KEY and is
 * NEVER logged, echoed, or returned to the client. Errors thrown here
 * carry only status/short text, never the key or auth header.
 */

export interface XaiTtsRequest {
  text: string
  lang: 'en' | 'ar'
  gender: 'male' | 'female'
  /** Nibras playback rate 0.5–2 (1 = normal); clamped to xAI's 0.7–1.5. */
  rate: number
}

export interface XaiTtsResult {
  audio: Buffer
  contentType: string
}

/** xAI's TTS endpoint (POST returns raw audio bytes by default). */
const XAI_TTS_URL = 'https://api.x.ai/v1/tts'

/** #151 P2-a (nibras-web-reviewer): the fetch below had no timeout —
 * a hung/indefinitely-slow provider call would spin forever, taking
 * Reading Buddy's Play button with it. Generous, not tight: team-lead's
 * own explicit fallback for "no direct measurement of Arabic TTS's own
 * worst-case" is ~60s with margin — used as-is. The goal is killing a
 * truly stuck request, never capping a normal-but-slow one. */
const REQUEST_TIMEOUT_MS = 60_000

/** xAI hard limit per call (docs.x.ai). Also a cost/abuse guard: a
 * single request can never bill for more than this many characters. */
const MAX_CHARS = 15000

/** Arabic target register is MODERN STANDARD ARABIC (الفصحى) — Amal's
 * explicit requirement for the reading voice: فصحى only, no regional
 * dialect. 'ar-SA' is Amal's confirmed setting (reads clean فصحى on
 * xAI's multilingual voices). `en` → en-GB (British English — Amal's
 * ear-confirmed choice 2026-08-20, both voices rex + eve; xAI voices are
 * all "multilingual" so this language hint, not a dedicated voice, is
 * what steers the accent). */
const XAI_LANGUAGE: Record<'en' | 'ar', string> = {
  en: 'en-GB',
  ar: 'ar-SA',
}

/** gender → built-in xAI voice_id. Both CONFIRMED by Amal's ear-test on
 * ar-SA (2026-08-13), clean فصحى:
 *   female = 'eve'  → «الصوت الثاني» (default), her primary pick
 *   male   = 'rex'  → «الصوت الأول»
 * The «صوت ١/٢» labels are neutral numbers (no gender text); the
 * male/female keys here are just the selection mechanism, mirroring
 * Reading Buddy's existing gender→voice path so the two features match. */
const XAI_VOICE_ID: Record<'male' | 'female', string> = {
  female: 'eve',
  male: 'rex',
}

/**
 * Synthesize speech with xAI. Returns MP3 bytes on success; throws a
 * key-free Error on any failure (the caller — voice.ts — already
 * returns a non-2xx so the client falls back to the browser voice).
 */
export async function synthesizeSpeechXai(req: XaiTtsRequest): Promise<XaiTtsResult> {
  const apiKey = process.env.AI_VOICE_API_KEY
  if (!apiKey) {
    throw new Error('AI_VOICE_API_KEY is not configured — see server/README.md')
  }

  const text = (req.text ?? '').slice(0, MAX_CHARS)
  if (!text.trim()) {
    throw new Error('xAI TTS: empty text')
  }

  // Nibras rate (0.5–2) → xAI speed (0.7–1.5).
  const speed = Math.min(1.5, Math.max(0.7, req.rate || 1))

  const body = {
    text,
    voice_id: XAI_VOICE_ID[req.gender] ?? 'eve',
    language: XAI_LANGUAGE[req.lang] ?? 'auto',
    speed,
    output_format: { codec: 'mp3' },
  }

  let res: Response
  try {
    res = await fetch(XAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    // AbortSignal.timeout() firing throws a DOMException named
    // 'TimeoutError' (confirmed directly against this exact Node
    // version, not assumed) — distinguished here so a genuine hang is
    // diagnosable server-side as exactly that, not lumped in with an
    // ordinary connection failure. Never includes the key or headers
    // either way.
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`xAI TTS: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
    }
    // Network-level failure — never include the key or headers.
    throw new Error(`xAI TTS: network error contacting the provider`)
  }

  if (!res.ok) {
    // Read a short, safe snippet of the error body for diagnostics.
    // Provider error bodies do not contain the request auth header.
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new Error(`xAI TTS: provider returned ${res.status} ${res.statusText} ${detail}`.trim())
  }

  const contentType = res.headers.get('content-type') ?? 'audio/mpeg'
  const audio = Buffer.from(await res.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error('xAI TTS: provider returned empty audio')
  }

  return { audio, contentType }
}
