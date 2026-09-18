// Shared feature flag — a plain .ts module (no framework/React
// dependency) so it can be imported identically by the Vite/React app
// AND scripts/fetch-models.mjs (a standalone Node prebuild script that
// runs before any bundler tooling). Confirmed directly, not assumed:
// Node 24's native TypeScript support strips types from an imported
// .ts DEPENDENCY the same way it does for a .ts entry point (this
// project already relies on the latter for server/index.ts). One
// source of truth for both runtimes.

// #150 (2026-08-14): Arabic on-device LISTENING (the self-hosted Whisper
// worker path — src/workers/whisperWorker.ts, src/lib/whisperRecognition.ts)
// is deliberately OFF for the pilot. Amal's explicit choice: defer it
// rather than ship a real ~317MB one-time download, pending the
// upstream q8 fix (huggingface/transformers.js#1707, currently open)
// that would shrink the model to ~80MB.
//
// The mechanism itself is fully built and independently proven working
// end-to-end (real Chrome, real production build, real Arabic speech,
// self-hosted/zero-external-requests, retry-hardened against a real
// Chrome disk-cache flake — see the #150 build notes) — this flag does
// NOT remove or disable that code. It only gates whether the pilot UI
// (ReadingBuddy.tsx) wires a mic-based Arabic listening session, and
// whether scripts/fetch-models.mjs actually downloads the model at
// build time. Flip to `true` once the upstream q8 fix lands and
// `dtype:'q8'` is reconfirmed working in whisperWorker.ts (swap fp32
// back to q8 there too, restoring the original ~80MB size).
//
// Task #398 review (askreview P1-b, 2026-09-14) — `@huggingface/transformers`
// lives in package.json's `devDependencies`, not `dependencies`, while
// this flag is off: with the vite.config.ts alias excluding
// whisperWorker.ts from the build graph entirely, the shipped bundle
// never needs it at runtime (confirmed absent from dist/), but `tsc -b`
// still type-checks that file (it's not excluded from tsconfig.app.json's
// `include`), so the package must still be INSTALLED for a normal build
// to succeed — `devDependencies` is the accurate category for "needed to
// build, never shipped," and it's what makes `npm audit --omit=dev` stop
// reporting the 4 unfixable HIGH advisories in its transitive
// onnxruntime-node/adm-zip and sharp deps (neither has a patched version
// yet) for a dependency that was already zero-exposure at runtime.
// REMINDER when flipping this flag to `true` for a real release: move
// `@huggingface/transformers` back to `dependencies` in package.json
// FIRST — a strict production install (`npm ci --omit=dev`) skips
// devDependencies entirely and would otherwise break that build.
export const ARABIC_LISTENING_ENABLED = false
