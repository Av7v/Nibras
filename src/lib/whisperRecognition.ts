// On-device Arabic listening (#150) — main-thread orchestration.
// Mirrors lib/speechRecognition.ts's shape (English path). The heavy
// Whisper model load + WASM inference happen in workers/whisperWorker.ts
// (a Web Worker, never this thread); this file owns the two things that
// MUST run on the main thread — getUserMedia() and the AudioContext/
// AudioWorklet graph — plus simple energy-based pause detection so we
// hand the coach one "sentence" at a time, matching the spec's
// segment-at-a-time (not live word-by-word) design for Arabic.
//
// LAZY LOAD, non-negotiable: the worker + its ~300MB model are only
// created/requested the first time startArabicListening() is actually
// called by a user action. Nothing here runs on import or page load.

const REQUIRED_SAMPLE_RATE = 16000
const SILENCE_RMS_THRESHOLD = 0.01 // heuristic noise-floor cut, not a tuned/validated VAD model — see #150 build notes
const SILENCE_HOLD_MS = 900 // trailing silence required to treat a pause as a sentence boundary
const MIN_SPEECH_MS = 400 // ignore blips shorter than this (mic pops, breaths) — never transcribed, never shown as a "miss"
const MAX_UTTERANCE_MS = 20_000 // safety cap so one unbroken utterance can't grow unbounded

export type ModelLoadProgress = { loaded: number; total: number; percent: number }

export interface ArabicListeningCallbacks {
  /** Fired once per detected sentence/pause, with the transcribed text. */
  onSentence: (text: string) => void
  /** Model-download progress, only fires the FIRST time a session is started (cached after). */
  onModelProgress?: (progress: ModelLoadProgress) => void
  /** A transient download hiccup (e.g. a large-file cache write failure) is being retried automatically. */
  onModelRetry?: (attempt: number) => void
  /** Fired once the model has finished loading and live listening has actually begun. */
  onModelReady?: () => void
  onError?: (message: string) => void
}

export interface ArabicListeningHandle {
  stop: () => void
}

let worker: Worker | null = null
let modelLoadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
let pendingReadyCallbacks: Array<() => void> = []
let pendingErrorCallbacks: Array<(message: string) => void> = []
let pendingProgressCallbacks: Array<(progress: ModelLoadProgress) => void> = []
let pendingRetryCallbacks: Array<(attempt: number) => void> = []
let transcribeResolvers = new Map<string, { resolve: (text: string) => void; reject: (message: string) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/whisperWorker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (event) => {
    const data = event.data as
      | { type: 'progress'; loaded: number; total: number; percent: number }
      | { type: 'retrying'; attempt: number }
      | { type: 'ready' }
      | { type: 'load-error'; message: string }
      | { type: 'result'; requestId: string; text: string }
      | { type: 'transcribe-error'; requestId: string; message: string }

    if (data.type === 'progress') {
      pendingProgressCallbacks.forEach((cb) => cb({ loaded: data.loaded, total: data.total, percent: data.percent }))
      return
    }
    if (data.type === 'retrying') {
      pendingRetryCallbacks.forEach((cb) => cb(data.attempt))
      return
    }
    if (data.type === 'ready') {
      modelLoadState = 'ready'
      pendingReadyCallbacks.forEach((cb) => cb())
      pendingReadyCallbacks = []
      return
    }
    if (data.type === 'load-error') {
      modelLoadState = 'error'
      pendingErrorCallbacks.forEach((cb) => cb(data.message))
      pendingErrorCallbacks = []
      return
    }
    if (data.type === 'result') {
      transcribeResolvers.get(data.requestId)?.resolve(data.text)
      transcribeResolvers.delete(data.requestId)
      return
    }
    if (data.type === 'transcribe-error') {
      transcribeResolvers.get(data.requestId)?.reject(data.message)
      transcribeResolvers.delete(data.requestId)
    }
  })
  return worker
}

function ensureModelLoaded(
  onProgress?: (p: ModelLoadProgress) => void,
  onRetry?: (attempt: number) => void,
): Promise<void> {
  const w = getWorker()
  if (modelLoadState === 'ready') return Promise.resolve()

  if (onProgress) pendingProgressCallbacks.push(onProgress)
  if (onRetry) pendingRetryCallbacks.push(onRetry)

  if (modelLoadState === 'loading') {
    return new Promise((resolve, reject) => {
      pendingReadyCallbacks.push(resolve)
      pendingErrorCallbacks.push(reject)
    })
  }

  modelLoadState = 'loading'
  const promise = new Promise<void>((resolve, reject) => {
    pendingReadyCallbacks.push(resolve)
    pendingErrorCallbacks.push(reject)
  })
  w.postMessage({ type: 'load' })
  return promise
}

let transcribeRequestCounter = 0
function transcribe(audio: Float32Array): Promise<string> {
  const w = getWorker()
  const requestId = `req-${++transcribeRequestCounter}`
  return new Promise((resolve, reject) => {
    transcribeResolvers.set(requestId, { resolve, reject })
    const buffer = audio.buffer as ArrayBuffer
    w.postMessage({ type: 'transcribe', requestId, audio }, [buffer])
  })
}

/** True resampling (not a cheap decimation) via an OfflineAudioContext — used only in the
 * defensive case where the live AudioContext didn't honor the requested 16000Hz rate. */
async function resampleTo16k(samples: Float32Array<ArrayBuffer>, fromRate: number): Promise<Float32Array> {
  const durationS = samples.length / fromRate
  const offline = new OfflineAudioContext(1, Math.ceil(durationS * REQUIRED_SAMPLE_RATE), REQUIRED_SAMPLE_RATE)
  const sourceBuffer = offline.createBuffer(1, samples.length, fromRate)
  sourceBuffer.copyToChannel(samples, 0)
  const source = offline.createBufferSource()
  source.buffer = sourceBuffer
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice(0)
}

export async function startArabicListening(callbacks: ArabicListeningCallbacks): Promise<ArabicListeningHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const audioContext = new AudioContext({ sampleRate: REQUIRED_SAMPLE_RATE })
  const actualRate = audioContext.sampleRate
  await audioContext.audioWorklet.addModule(new URL('../workers/pcmCaptureProcessor.js', import.meta.url))

  const source = audioContext.createMediaStreamSource(stream)
  const capture = new AudioWorkletNode(audioContext, 'pcm-capture-processor')
  source.connect(capture)

  let stopped = false
  let speechChunks: Float32Array[] = []
  let speechMs = 0
  let silenceMs = 0
  let hasHeardSpeech = false

  async function flush() {
    if (speechChunks.length === 0 || speechMs < MIN_SPEECH_MS) {
      speechChunks = []
      speechMs = 0
      silenceMs = 0
      return
    }
    const totalLength = speechChunks.reduce((sum, c) => sum + c.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of speechChunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    speechChunks = []
    speechMs = 0
    silenceMs = 0

    try {
      const audioForModel = actualRate === REQUIRED_SAMPLE_RATE ? merged : await resampleTo16k(merged, actualRate)
      const text = await transcribe(audioForModel)
      if (text) callbacks.onSentence(text)
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err.message : String(err))
    }
  }

  capture.port.onmessage = (event: MessageEvent<{ samples: Float32Array; rms: number }>) => {
    if (stopped) return
    const { samples, rms } = event.data
    const chunkMs = (samples.length / actualRate) * 1000

    if (rms >= SILENCE_RMS_THRESHOLD) {
      hasHeardSpeech = true
      speechChunks.push(samples)
      speechMs += chunkMs
      silenceMs = 0
      if (speechMs >= MAX_UTTERANCE_MS) void flush()
      return
    }

    if (!hasHeardSpeech) return // pure leading silence, nothing to hold onto yet

    silenceMs += chunkMs
    if (speechChunks.length > 0) speechChunks.push(samples) // keep a little trailing silence for natural word endings
    if (silenceMs >= SILENCE_HOLD_MS) void flush()
  }

  ensureModelLoaded(
    (progress) => callbacks.onModelProgress?.(progress),
    (attempt) => callbacks.onModelRetry?.(attempt),
  )
    .then(() => {
      if (stopped) return
      callbacks.onModelReady?.()
    })
    .catch((message: string) => {
      if (!stopped) callbacks.onError?.(message)
    })

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      void flush()
      capture.port.onmessage = null
      source.disconnect()
      capture.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      void audioContext.close()
    },
  }
}

export function isArabicModelReady(): boolean {
  return modelLoadState === 'ready'
}
