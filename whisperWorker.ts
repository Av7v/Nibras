// On-device Arabic speech recognition (#150) — runs entirely inside this
// Web Worker so the ~300MB model load and the WASM inference itself never
// block the main thread / UI (non-negotiable per the #150 build spec).
//
// Self-hosted deliberately: env.allowRemoteModels = false means this code
// CANNOT fall back to huggingface.co or cdn.jsdelivr.net even by accident
// — if the vendored files under public/models/ and public/ort/ (see
// scripts/fetch-models.mjs) are missing, loading fails loudly instead of
// silently phoning out. That failure mode is the correct one for a
// privacy feature: "broken" is honest, "quietly not private" is not.
//
// LAZY BY DESIGN: creating this worker does nothing by itself. The
// ~300MB download + model init only starts when the main thread posts an
// explicit {type:'load'} message, which whisperRecognition.ts only does
// on the user's first actual attempt to use Arabic listening — never on
// page load, never on worker construction. Users who never touch Arabic
// listening never fetch a byte of this.
import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'
// `wasm` itself is a read-only property on this type (always populated by
// onnxruntime-web at import time in a browser context) — only its
// `wasmPaths` field is ours to set, never the object reference itself.
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/ort/'
}

const MODEL_ID = 'Xenova/whisper-base'

type WhisperWorkerRequest = { type: 'load' } | { type: 'transcribe'; requestId: string; audio: Float32Array }

type WhisperWorkerResponse =
  | { type: 'progress'; loaded: number; total: number; percent: number }
  | { type: 'retrying'; attempt: number }
  | { type: 'ready' }
  | { type: 'load-error'; message: string }
  | { type: 'result'; requestId: string; text: string }
  | { type: 'transcribe-error'; requestId: string; message: string }

function post(message: WhisperWorkerResponse) {
  self.postMessage(message)
}

// AutomaticSpeechRecognitionPipeline instance type isn't exported in a
// way that's convenient to name from this package's public d.ts, and
// pinning it down isn't load-bearing here (the only calls made against
// it below are the documented pipeline-call and are already verified
// against the installed source at scripts/fetch-models.mjs comment /
// the #150 build notes).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null

// Real Chrome disk-cache writes for the two large .onnx files (82MB /
// 208MB, single responses) intermittently fail with
// net::ERR_CACHE_WRITE_FAILURE — confirmed directly (2 back-to-back
// production-build runs: 1 clean load, 1 hard failure, same machine,
// same files) via Playwright's requestfailed events, not guessed. The
// failure is Chrome's disk-cache layer, not our server or the model
// files themselves — @huggingface/transformers' own application-level
// cache (unaffected by that failure) means a bare retry re-fetches into
// a fresh attempt rather than compounding the problem. Bounded to 3
// total attempts so a genuinely broken/missing deployment still fails
// loudly instead of hanging.
const MAX_LOAD_ATTEMPTS = 3

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attemptLoad(): Promise<any> {
  return pipeline('automatic-speech-recognition', MODEL_ID, {
    dtype: 'fp32',
    progress_callback: (data: { status: string; loaded?: number; total?: number; progress?: number }) => {
      if (data.status === 'progress_total' && typeof data.loaded === 'number' && typeof data.total === 'number') {
        post({
          type: 'progress',
          loaded: data.loaded,
          total: data.total,
          percent: data.total > 0 ? (data.loaded / data.total) * 100 : 0,
        })
      }
    },
  })
}

function loadPipeline() {
  if (pipelinePromise) return pipelinePromise

  pipelinePromise = (async () => {
    let lastErr: unknown
    for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        post({ type: 'retrying', attempt })
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
      try {
        return await attemptLoad()
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr
  })()

  pipelinePromise
    .then(() => post({ type: 'ready' }))
    .catch((err: unknown) => {
      pipelinePromise = null // allow a fresh retry cycle on the next 'load'
      post({ type: 'load-error', message: err instanceof Error ? err.message : String(err) })
    })

  return pipelinePromise
}

self.addEventListener('message', (event: MessageEvent<WhisperWorkerRequest>) => {
  const msg = event.data

  if (msg.type === 'load') {
    loadPipeline()
    return
  }

  if (msg.type === 'transcribe') {
    const { requestId, audio } = msg
    loadPipeline()
      .then(async (transcriber) => {
        const result = await transcriber(audio, { language: 'arabic', task: 'transcribe' })
        const text = Array.isArray(result) ? (result[0]?.text ?? '') : (result.text ?? '')
        post({ type: 'result', requestId, text: String(text).trim() })
      })
      .catch((err: unknown) => {
        post({ type: 'transcribe-error', requestId, message: err instanceof Error ? err.message : String(err) })
      })
  }
})
