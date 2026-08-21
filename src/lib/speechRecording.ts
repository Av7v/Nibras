/**
 * Microphone CAPTURE for Reading Buddy's Arabic listening coach — the
 * client half of the server-side `/stt` path (xAI Speech-to-Text,
 * `server/README.md`'s own "Server-side STT" section). A genuinely
 * different mechanism from `lib/speechRecognition.ts`'s English path,
 * kept honestly separate rather than forced into one shared shape
 * (same reasoning that file's own header already gives for English vs.
 * the earlier on-device-Whisper Arabic path):
 *
 * - English (`speechRecognition.ts`): the browser's own on-device
 *   `SpeechRecognition`, event-driven, genuinely live/incremental,
 *   audio never leaves the device.
 * - Arabic (this file): plain `MediaRecorder` capture — raw
 *   `audio/webm;codecs=opus`, NO transcode (xAI's `/v1/stt` accepts it
 *   directly per server/README.md's own confirmed-live note) — a
 *   single clip, uploaded ONCE when the reader taps stop, via
 *   `aiService.ts`'s `transcribe()`. NOT incremental: `/stt` is a
 *   one-shot upload-then-transcribe endpoint (docs.x.ai — multipart
 *   `file` field), not a streaming API, so this file makes no attempt
 *   to fake live/interim results it has no way to actually produce —
 *   see `readingCoach.modeArabicBatch`'s own copy for how this is
 *   honestly described to the reader.
 *
 * PRIVACY: the opposite promise from English's on-device path — this
 * audio DOES leave the device (sent to xAI to transcribe). Consent is
 * gated at the UI layer (ReadingBuddy.tsx's own consent dialog, opt-in,
 * before the FIRST Arabic recording) — this file only captures/hands
 * back the clip, it never uploads or stores anything itself.
 */

/** Coarse feature-detect — `MediaRecorder` + `getUserMedia` are both
 * long-stable, non-experimental Web APIs (unlike English's still-
 * experimental `SpeechRecognition.available()`), so this is mainly a
 * defensive check for a genuinely very old/unusual browser, not an
 * expected everyday branch. */
export function isMediaRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

// Preferred first (raw, no-transcode path per server/README.md); the
// rest are honest fallbacks so a genuinely different browser can still
// record SOMETHING rather than fail outright — the server allow-lists
// all of these (`server/index.ts`'s `ALLOWED_STT_MIME`).
const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

function pickSupportedMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder?.isTypeSupported !== 'function') return undefined
  return CANDIDATE_MIME_TYPES.find((type) => window.MediaRecorder.isTypeSupported(type))
}

export interface ArabicRecordingHandle {
  /** Stops capture and resolves with the full recorded clip. Releases
   * the microphone (stops every track) as soon as the recorder has
   * genuinely flushed its last chunk — never leaves a mic indicator
   * lit after the reader taps stop. */
  stop: () => Promise<Blob>
}

/** Starts raw microphone capture for one Arabic reading attempt.
 * Returns `null` (never throws) on ANY failure — unsupported browser,
 * denied/unavailable permission, or a `MediaRecorder` construction
 * error — so the caller has exactly one "couldn't start" branch to
 * handle, same convention `speechRecognition.ts`'s own
 * `startEnglishListening` already uses. */
export async function startArabicRecording(opts: { onError?: (message: string) => void }): Promise<ArabicRecordingHandle | null> {
  if (!isMediaRecordingSupported()) return null

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    // Permission denied, no device, or the browser blocked the prompt
    // (e.g. not a secure context) — all genuinely normal outcomes a
    // caller should treat as "couldn't start," not a bug.
    return null
  }

  const mimeType = pickSupportedMimeType()
  let recorder: MediaRecorder
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  } catch {
    stream.getTracks().forEach((track) => track.stop())
    return null
  }

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onerror = () => opts.onError?.('recording-error')

  try {
    recorder.start()
  } catch {
    stream.getTracks().forEach((track) => track.stop())
    return null
  }

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          // Release the microphone the instant the last chunk has
          // landed — never keep the mic indicator lit past this point.
          stream.getTracks().forEach((track) => track.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }))
        }
        recorder.stop()
      }),
  }
}
