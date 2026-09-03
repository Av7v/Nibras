// Stub swapped in for lib/whisperRecognition.ts via vite.config.ts's
// resolve.alias, ONLY when ARABIC_LISTENING_ENABLED (src/config/features.ts)
// is false — keeps the real implementation's ~24MB worker+WASM-runtime
// chunk (workers/whisperWorker.ts bundling @huggingface/transformers +
// onnxruntime-web) OUT of dist/ entirely for the pilot build. A dynamic
// import() alone (ReadingBuddy.tsx already uses one) is NOT enough to
// achieve this — confirmed via a real build+measure, not assumed: Vite's
// Worker/asset-URL static analysis scans every module actually included
// in the build graph for a `new Worker(new URL(...))` pattern and
// unconditionally bundles what it finds, regardless of whether the
// IMPORT of that module was static or dynamic. The alias prevents the
// real file (and its own `new Worker(...)` call) from ever entering
// the graph at all for a disabled build.
//
// Never actually reached at runtime — the only call site
// (ReadingBuddy.tsx's Arabic branch) is itself gated behind the same
// flag, so this throwing is a defensive backstop, not a real UX path.
export async function startArabicListening(): Promise<never> {
  throw new Error('Arabic on-device listening is deferred in this build (see src/config/features.ts).')
}
