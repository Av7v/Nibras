/**
 * The client-side seam between Nibras's AI-powered features (AI
 * Assistant summarize/explain, Mind Maps, Reading Buddy's neural voice)
 * and however they're actually implemented — a DEMO path that works
 * today with zero keys, and a REAL path that calls a server-side
 * backend once one is configured. Every AI feature in the app should
 * go through this module, never call a provider directly from client
 * code and never hold an API key here — see server/README.md for the
 * backend contract this is designed to call, and
 * project_nibras.md/[[project-nibras]] for why (keys must be
 * server-side only, per the project's privacy-first architecture).
 *
 * DEMO vs REAL switch: controlled by `VITE_AI_BACKEND_URL` (a plain
 * URL, not a secret — safe to ship in the client bundle, same as any
 * other API base path). Unset (the default today, since no backend is
 * deployed yet) → every method below runs its DEMO implementation.
 * Set → REAL methods POST to `{VITE_AI_BACKEND_URL}/<endpoint>`; the
 * backend holds the actual provider key server-side (env vars
 * documented in server/README.md) and Nibras's client never sees it.
 *
 * Build status per method (2026-08-13): `synthesizeVoice` has a working
 * DEMO path (browser Web Speech, see lib/textToSpeech.ts) AND a REAL
 * path (calls the backend, falls back to DEMO on any failure).
 * `summarize`/`explain`/`generateMindMap` are typed and structured now
 * but their DEMO implementations ship in the Mind Maps / AI Assistant
 * slices that follow this one — calling them today throws a clear
 * "not built yet" error rather than silently returning nothing, so a
 * caller can't accidentally ship a broken button before its slice
 * lands.
 */

import { getAccessToken, reportInvalidToken } from './accessToken'

export type AiLang = 'en' | 'ar'

function backendUrl(): string | undefined {
  const url = import.meta.env.VITE_AI_BACKEND_URL as string | undefined
  return url && url.trim() !== '' ? url.replace(/\/$/, '') : undefined
}

/** Whether a real backend is configured at all — UI can use this to
 * decide whether to show a "Demo" note; true does not guarantee the
 * backend is actually reachable right now (a real call can still fail
 * and fall back to demo behavior where a feature has one). */
export function isAiBackendConfigured(): boolean {
  return backendUrl() !== undefined
}

/** The volunteer's access code is missing, unknown, or was rejected
 * (server: 401 — see server/index.ts's access-gate check; 403 handled
 * the same way defensively, though the current server only ever emits
 * 401 for this case). postJson has ALREADY cleared the bad code and
 * told <AccessGate> to reopen (see reportInvalidToken()) by the time
 * this reaches a caller — a caller does NOT need to show its own
 * "invalid code" message, just avoid claiming a normal failure
 * happened (no generic "something went wrong"/demo-fallback UI). */
export class AccessTokenError extends Error {
  constructor(message = 'AI access code missing or invalid') {
    super(message)
    this.name = 'AccessTokenError'
  }
}

/** This volunteer's own $1.50 budget, or the backend's global backstop,
 * has been reached (server: 402 + `reason`, see server/api/_spendCap.ts).
 * Unlike AccessTokenError, re-entering a code doesn't fix this — the
 * code is fine, the budget is spent — so callers must show their OWN
 * honest message rather than re-prompting or (for synthesizeVoice
 * specifically) silently degrading to the demo browser voice, which
 * would look like nothing was ever wrong. Every current call site
 * branches on `reason` for its own translated i18n copy (AI-on honesty
 * pass, 2026-08-19, spec in teamlead/ai-on-honesty-copy-spec.md):
 * `token_cap_reached` is this volunteer's own budget, PERMANENT for the
 * pilot, never "try again later"; `global_cap_reached` is the shared
 * backstop, genuinely TEMPORARY. The `message` default below (plain
 * English, no i18n access at this layer) is only ever used if the
 * server's 402 body is missing/unparseable — not rendered anywhere
 * today, kept reason-aware anyway as a defensive fallback. */
export class SpendCapError extends Error {
  reason: 'token_cap_reached' | 'global_cap_reached'
  constructor(
    reason: 'token_cap_reached' | 'global_cap_reached',
    message = reason === 'global_cap_reached'
      ? 'The AI service has reached its usage limit. Please try again later.'
      : "You've reached the AI limit included with your access code.",
  ) {
    super(message)
    this.name = 'SpendCapError'
    this.reason = reason
  }
}

/** AI-ON only: the neural /voice call failed for a NON-actionable reason
 * (network error, 5xx, a 429 rate-limit, a client timeout). Distinct from
 * AccessTokenError (the code is fixable) and SpendCapError (budget spent) —
 * this one is transient. `synthesizeVoice` throws this instead of quietly
 * degrading to a FREE browser voice, so when AI is on ONLY the two chosen
 * neural voices (rex/eve) ever play — Amal's explicit requirement
 * (2026-08-19: she heard the robotic browser voice on تقنيات القراءة when a
 * /voice call failed). Callers show an honest "voice unavailable, try
 * again" state (or just reset the control) and NEVER a browser voice. */
export class VoiceUnavailableError extends Error {
  constructor() {
    super('The AI reading voice is temporarily unavailable.')
    this.name = 'VoiceUnavailableError'
  }
}

async function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  const base = backendUrl()
  if (!base) throw new Error('No AI backend configured')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Bound every AI call so a cold-starting or hung backend can't spin
  // forever. The server caps its own work at ~90s, so abort a little ABOVE
  // that (100s). On abort the fetch rejects (AbortError), taking the SAME
  // path a network failure already does — synthesizeVoice degrades to the
  // browser voice, the AI panels show their honest error state — so no new
  // UI is needed (task P1-a, 2026-08-19).
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 100_000)
  try {
    const res = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 401 || res.status === 403) {
      // The code we sent (or the absence of one) was rejected — clear it
      // and tell the globally-mounted <AccessGate> to reopen with an
      // honest "that code isn't valid" message (server/README.md's
      // "Client access-token contract"). Fires even when NO code was
      // ever entered (identical 401 either way), which is exactly the
      // "prompt for a code" moment for a first-time volunteer.
      reportInvalidToken()
      throw new AccessTokenError()
    }
    if (res.status === 402) {
      const parsed = (await res.json().catch(() => null)) as { reason?: 'token_cap_reached' | 'global_cap_reached'; error?: string } | null
      const reason = parsed?.reason === 'global_cap_reached' ? 'global_cap_reached' : 'token_cap_reached'
      throw new SpendCapError(reason, parsed?.error)
    }
    if (!res.ok) throw new Error(`AI backend request failed: ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------
// summarize / explain / generateMindMap — interface defined now,
// DEMO implementations land in the Mind Maps / AI Assistant slices.
// ---------------------------------------------------------------------

export interface SummarizeResult {
  summary: string
  /** True whenever this came from a canned/demo response rather than a
   * real model call — callers must surface this honestly (a small
   * "Demo" note), never present demo output as if it analyzed the
   * user's actual text when it didn't. */
  demo: boolean
}

export interface ExplainResult {
  explanation: string
  demo: boolean
}

export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
}

export interface MindMapResult {
  root: MindMapNode
  demo: boolean
}

export async function summarize(_text: string, _lang: AiLang): Promise<SummarizeResult> {
  if (isAiBackendConfigured()) {
    return postJson<SummarizeResult>('/summarize', { text: _text, lang: _lang })
  }
  throw new Error('summarize(): demo implementation ships in the AI Assistant slice')
}

export async function explain(_text: string, _lang: AiLang): Promise<ExplainResult> {
  if (isAiBackendConfigured()) {
    return postJson<ExplainResult>('/explain', { text: _text, lang: _lang })
  }
  throw new Error('explain(): demo implementation ships in the AI Assistant slice')
}

export async function generateMindMap(_text: string, _lang: AiLang): Promise<MindMapResult> {
  if (isAiBackendConfigured()) {
    return postJson<MindMapResult>('/mindmap', { text: _text, lang: _lang })
  }
  throw new Error('generateMindMap(): demo implementation ships in the Mind Maps slice')
}

// ---------------------------------------------------------------------
// translate — task #112 (2026-08-14). Reader-driven, auto-translate on
// language switch. NO demo implementation is possible here, unlike
// summarize/explain/mindmap's example-matched canned responses — a
// faked/canned "translation" of arbitrary reader-supplied text would
// be actively misleading (the reader has no way to tell it's fake
// without already knowing the target language), so this ALWAYS throws
// until a real backend is configured — the caller (Reader.tsx) is
// responsible for showing the honest "needs an AI connection" state,
// exactly like AiAssistantPanel already does for summarize/explain.
// ---------------------------------------------------------------------

export interface TranslateResult {
  translatedText: string
  demo: false
}

export async function translate(text: string, from: AiLang, to: AiLang): Promise<TranslateResult> {
  if (isAiBackendConfigured()) {
    return postJson<TranslateResult>('/translate', { text, from, to })
  }
  throw new Error('translate(): no demo path — a canned/fake translation would be dishonest, needs a real AI connection')
}

// ---------------------------------------------------------------------
// synthesizeVoice — fully built this slice (Reading Buddy).
// ---------------------------------------------------------------------

export interface SynthesizeVoiceRequest {
  text: string
  lang: AiLang
  gender: 'male' | 'female'
  /** Playback rate, 0.5–2 (1 = normal speed). */
  rate: number
  /** Voice pitch, 0–2 (1 = normal pitch). Optional — Reading Buddy has
   * never needed anything but the default; «سُكون»'s calm voice
   * (2026-08-13) is the first caller to set this, for a deliberately
   * lower, calmer pitch. Forwarded to a real backend once one exists
   * (same "same seam, real value later" contract as `rate`), currently
   * unused by the demo path itself — the caller applies it directly to
   * lib/textToSpeech.ts's `speak()` for the browser-voice branch. */
  pitch?: number
}

/** The two playback mechanisms are genuinely different (a browser
 * speaking directly vs. an app-controlled <audio> element playing a
 * server-rendered file) — the result says which one a caller got back
 * rather than pretending they're the same thing dressed up identically. */
export type SynthesizeVoiceResult =
  | { mode: 'browser'; demo: true }
  | { mode: 'audio'; url: string; demo: false }

/** DEMO (today, always, since no backend is configured yet): confirms
 * a matching browser voice exists and hands back `{mode: 'browser'}` —
 * the caller (ReadingBuddyPlayer) then drives lib/textToSpeech.ts's
 * `speak()` directly with the same gender/rate, since Web Speech has no
 * "give me an audio file" mode to return here.
 * REAL (once VITE_AI_BACKEND_URL is set): POSTs to the backend, which
 * returns a URL to a rendered audio file; falls back to the DEMO
 * result if the real call fails for any reason, so Reading Buddy never
 * goes silent just because a backend call had a bad moment. */
export async function synthesizeVoice(req: SynthesizeVoiceRequest): Promise<SynthesizeVoiceResult> {
  if (isAiBackendConfigured()) {
    try {
      return await postJson<SynthesizeVoiceResult>('/voice', req)
    } catch (err) {
      // AccessTokenError/SpendCapError are MEANINGFUL, actionable states —
      // re-throw them so the caller shows the honest "enter your code" /
      // "limit reached" message (task #219). EVERY OTHER failure (network,
      // 5xx, a 429 rate-limit, a client timeout) becomes a
      // VoiceUnavailableError — it must NOT silently drop to the FREE
      // browser voice, which is exactly what Amal heard on تقنيات القراءة
      // when a /voice call failed (2026-08-19, "only my two neural voices").
      if (err instanceof AccessTokenError || err instanceof SpendCapError) throw err
      throw new VoiceUnavailableError()
    }
  }
  // AI-OFF (demo build, no neural backend at all) is the ONLY place a
  // browser voice is ever returned now — never as an AI-on failure fallback.
  return { mode: 'browser', demo: true }
}

// ---------------------------------------------------------------------
// transcribe — Arabic listening (server/README.md's "Server-side STT",
// xAI /v1/stt, Amal's Option A). Same "no demo path" rule as
// translate() above and for the same reason: a canned/fake transcript
// of the reader's OWN spoken audio would be actively dishonest (there
// is no way to fake "what did you actually say" the way summarize/
// explain can fake a response to one of 2 KNOWN example texts) — this
// always throws until a real backend is configured. Reading Buddy's
// own `listeningAvailable` gate (useReadingCoachSession.ts) already
// keeps the Arabic mic UI from rendering at all in that case, so this
// throw path is a defensive backstop, not the primary "not available"
// signal a reader ever sees.
// ---------------------------------------------------------------------

export interface TranscribeResult {
  text: string
  demo: false
}

/** Converts a recorded clip to base64 for the JSON body `/stt` expects
 * (`{audio: <base64>, mimeType, lang}, server/index.ts's own
 * `validateSttRequest`). A plain byte-by-byte loop, not
 * `String.fromCharCode(...bytes)` — the spread form can overflow the
 * call stack on a large array; a short reading clip is well within
 * MAX_STT_SECONDS (120s) either way, but there's no reason to risk it. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** `audio` is the RAW recorded clip (e.g. `audio/webm;codecs=opus` from
 * `lib/speechRecording.ts`) — no client-side transcode, matching
 * server/README.md's own confirmed-live note that xAI accepts the
 * browser's native format directly. */
export async function transcribe(audio: Blob, lang: AiLang): Promise<TranscribeResult> {
  if (isAiBackendConfigured()) {
    const base64 = await blobToBase64(audio)
    return postJson<TranscribeResult>('/stt', { audio: base64, mimeType: audio.type, lang })
  }
  throw new Error('transcribe(): no demo path — a canned/fake transcript would be dishonest, needs a real AI connection')
}
