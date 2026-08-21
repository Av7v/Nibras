#!/usr/bin/env node
// Prebuild step (#150) — vendors the on-device Arabic speech-recognition
// assets into public/ so the shipped app is fully self-hosted at runtime
// (never fetches from huggingface.co or cdn.jsdelivr.net from a user's
// browser). This script itself DOES reach those hosts, once, at build
// time — that's the point: bake the bytes into our own dist/, not proxy
// the dependency into production.
//
// Model: Xenova/whisper-base, dtype 'fp32' (NOT the spec's original
// q8 — q8's ONNX export fails to build a session in a real browser,
// root-caused to huggingface/transformers.js#1707, confirmed 3x
// independently). Amal's call on the size tradeoff (2026-08-14): DEFER
// Arabic listening for the pilot rather than ship this — see
// src/config/features.ts's own header. This script is now GATED behind
// that flag (checked first below) and stays a no-op while it's off; the
// fp32 manifest below stays accurate and ready for whenever it's
// flipped back on.
//
// File list + exact byte sizes below were captured from a REAL browser
// network trace (Playwright + system Chrome hitting a live pipeline()
// call), not guessed — see the #150 build notes. Byte sizes are used as
// an integrity check (skip re-download if already correct; fail loudly
// if a download comes back short/corrupt) rather than a hash because
// upstream doesn't publish per-file checksums in an easy machine-readable
// form for these paths; size-match plus HTTPS transport is the practical
// bar here, consistent with this repo's existing verify-script rigor.
//
// Idempotent: safe to run on every `npm run build` — already-correct
// files are skipped, so CI/dev machines only pay the ~317MB cost once.

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARABIC_LISTENING_ENABLED } from '../src/config/features.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PUBLIC_DIR = path.join(REPO_ROOT, 'public')

// Amal's decision, 2026-08-14: defer Arabic on-device listening for the
// pilot (see src/config/features.ts's own header for the full why) —
// the shipped build never downloads or carries this ~317MB one-time
// asset while the flag is off. Checked FIRST, before touching
// node_modules/network/anything else, so a disabled build's `prebuild`
// step is a true no-op.
if (!ARABIC_LISTENING_ENABLED) {
  console.log('[fetch-models] Arabic on-device listening is deferred (src/config/features.ts) — skipping the model fetch entirely. Nothing downloaded, nothing shipped.')
  process.exit(0)
}

// Must match @huggingface/transformers' onnxruntime-web peer version
// exactly (env.backends.onnx.wasm.wasmPaths serves these two files) —
// read from the installed package so an npm upgrade can't silently
// desync this script from what the library actually requests.
const ortPkg = JSON.parse(
  await import('node:fs/promises').then((fs) =>
    fs.readFile(path.join(REPO_ROOT, 'node_modules/onnxruntime-web/package.json'), 'utf8'),
  ),
)
const ORT_VERSION = ortPkg.version

const MODEL_ID = 'Xenova/whisper-base'
const MODEL_DIR = path.join(PUBLIC_DIR, 'models', MODEL_ID)
const ORT_DIR = path.join(PUBLIC_DIR, 'ort')

const FILES = [
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/config.json`, dest: path.join(MODEL_DIR, 'config.json'), bytes: 2248 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer_config.json`, dest: path.join(MODEL_DIR, 'tokenizer_config.json'), bytes: 282683 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/preprocessor_config.json`, dest: path.join(MODEL_DIR, 'preprocessor_config.json'), bytes: 339 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer.json`, dest: path.join(MODEL_DIR, 'tokenizer.json'), bytes: 2480466 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/generation_config.json`, dest: path.join(MODEL_DIR, 'generation_config.json'), bytes: 3776 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/onnx/encoder_model.onnx`, dest: path.join(MODEL_DIR, 'onnx', 'encoder_model.onnx'), bytes: 82474863 },
  { url: `https://huggingface.co/${MODEL_ID}/resolve/main/onnx/decoder_model_merged.onnx`, dest: path.join(MODEL_DIR, 'onnx', 'decoder_model_merged.onnx'), bytes: 208560983 },
  { url: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.asyncify.wasm`, dest: path.join(ORT_DIR, 'ort-wasm-simd-threaded.asyncify.wasm'), bytes: 23567050 },
  { url: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.asyncify.mjs`, dest: path.join(ORT_DIR, 'ort-wasm-simd-threaded.asyncify.mjs'), bytes: 47389 },
]

const MAX_ATTEMPTS = 3

function humanBytes(n) {
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function alreadyCorrect(file) {
  if (!existsSync(file.dest)) return false
  try {
    return statSync(file.dest).size === file.bytes
  } catch {
    return false
  }
}

async function downloadOnce(file) {
  mkdirSync(path.dirname(file.dest), { recursive: true })
  const res = await fetch(file.url)
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} fetching ${file.url}`)
  }
  const tmpDest = `${file.dest}.download`
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpDest))
  const actualSize = statSync(tmpDest).size
  if (actualSize !== file.bytes) {
    unlinkSync(tmpDest)
    throw new Error(
      `size mismatch for ${path.basename(file.dest)}: expected ${file.bytes} bytes, got ${actualSize}. ` +
        `Upstream file may have changed — re-check the manifest in scripts/fetch-models.mjs.`,
    )
  }
  const { renameSync } = await import('node:fs')
  renameSync(tmpDest, file.dest)
}

async function fetchWithRetry(file) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await downloadOnce(file)
      return
    } catch (err) {
      lastErr = err
      if (attempt < MAX_ATTEMPTS) {
        const waitMs = attempt * 2000
        console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS} failed (${err.message}); retrying in ${waitMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }
  throw lastErr
}

async function main() {
  console.log(`[fetch-models] on-device Arabic speech assets (${MODEL_ID}, fp32 + onnxruntime-web ${ORT_VERSION})`)
  let downloaded = 0
  let skipped = 0
  let totalBytes = 0
  for (const file of FILES) {
    totalBytes += file.bytes
    if (alreadyCorrect(file)) {
      skipped++
      continue
    }
    console.log(`  fetching ${path.relative(PUBLIC_DIR, file.dest)} (${humanBytes(file.bytes)})...`)
    await fetchWithRetry(file)
    downloaded++
  }
  console.log(
    `[fetch-models] done: ${downloaded} downloaded, ${skipped} already present, ${humanBytes(totalBytes)} total on disk.`,
  )
}

main().catch((err) => {
  console.error(`[fetch-models] FAILED: ${err.message}`)
  console.error('The build cannot ship a working Arabic listening feature without these files.')
  process.exit(1)
})
