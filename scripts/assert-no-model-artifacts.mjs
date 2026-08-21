#!/usr/bin/env node
// Postbuild guard (#150 fix-pass, 2026-08-14, nibras-web-reviewer P2
// fold-in) — a durable, automated check that dist/ never ships the
// ~24MB Whisper worker+WASM-runtime chunk (or the ~317MB model itself)
// while Arabic on-device listening is deferred. This is a REGRESSION
// GUARD, not a duplicate of vite.config.ts's own resolve.alias fix —
// that fix is what keeps the chunk out of the build graph TODAY; this
// script is what stops a FUTURE change (a new import path to
// lib/whisperRecognition.ts the alias doesn't happen to catch, a
// dependency upgrade that changes how Vite's asset-URL detection
// resolves paths, etc.) from silently re-introducing it without
// anyone noticing until a real volunteer's browser downloads bytes it
// was never supposed to.
//
// Runs unconditionally on every build (both flag states) — when
// ARABIC_LISTENING_ENABLED is true, these artifacts are EXPECTED, so
// the check simply passes them through rather than failing a build
// that's correctly shipping the real feature.
//
// Wired as npm's own `postbuild` lifecycle hook (mirrors `prebuild` ->
// fetch-models.mjs) — runs automatically after every `npm run build`,
// no separate command to remember.

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARABIC_LISTENING_ENABLED } from '../src/config/features.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

if (ARABIC_LISTENING_ENABLED) {
  console.log(
    '[assert-no-model-artifacts] ARABIC_LISTENING_ENABLED is true — model/onnx/ort artifacts are expected in dist/, skipping this check.',
  )
  process.exit(0)
}

// .onnx/.wasm by extension; models//ort/ by path segment (this
// project's only source of either is public/models/ + public/ort/,
// copied verbatim into dist/models/ + dist/ort/ by Vite's public-dir
// convention when fetch-models.mjs has populated them — this build
// should never reach that state while the flag is off, since
// fetch-models.mjs's own gate no-ops first, but this checks the actual
// shipped OUTPUT, not just that the fetch step was skipped).
const FORBIDDEN_PATTERNS = [/\.onnx$/i, /\.wasm$/i, /[\\/]models[\\/]/i, /[\\/]ort[\\/]/i]

function walk(dir) {
  const found = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...walk(full))
    } else if (FORBIDDEN_PATTERNS.some((re) => re.test(full))) {
      found.push(full)
    }
  }
  return found
}

const distStat = (() => {
  try {
    return statSync(DIST_DIR)
  } catch {
    return null
  }
})()
if (!distStat || !distStat.isDirectory()) {
  console.log('[assert-no-model-artifacts] dist/ does not exist — nothing to check (this only runs after a real `vite build`).')
  process.exit(0)
}

const offenders = walk(DIST_DIR)
if (offenders.length > 0) {
  console.error(
    '[assert-no-model-artifacts] FAILED: found model/onnx/wasm/ort artifact(s) in dist/ while ARABIC_LISTENING_ENABLED is false:',
  )
  for (const f of offenders) console.error(`  ${path.relative(DIST_DIR, f)}`)
  console.error(
    "This means the ~24MB Whisper worker+WASM chunk (or the model itself) leaked into the pilot build. See src/config/features.ts and vite.config.ts's own resolve.alias comment for the mechanism this is meant to protect.",
  )
  process.exit(1)
}

console.log('[assert-no-model-artifacts] OK — zero .onnx/.wasm/model/ort artifacts in dist/ (ARABIC_LISTENING_ENABLED is false).')
process.exit(0)
