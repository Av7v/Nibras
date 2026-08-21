import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { ARABIC_LISTENING_ENABLED } from './src/config/features.ts'

/** Release-hygiene guard (#132): a production build must never bake in a
 * localhost/insecure AI backend URL. VITE_* is inlined at build time, so a
 * dev-only demo value left in `.env` would ship to volunteers and flip the
 * privacy copy to over-disclose (nibras-qa/pm P0, 2026-08-14). Unset →
 * on-device/demo build (the pilot default). Set → must be a real https,
 * non-loopback URL (for when the audited backend is live). */
function guardProdBackendUrl(): Plugin {
  return {
    name: 'nibras-guard-prod-backend-url',
    apply: 'build',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const raw = (env.VITE_AI_BACKEND_URL ?? '').trim()
      if (raw === '') return // on-device/demo build — fine
      let url: URL
      try { url = new URL(raw) } catch {
        throw new Error(`[nibras] VITE_AI_BACKEND_URL is not a valid URL: "${raw}" — refusing to build.`)
      }
      // url.hostname keeps IPv6 brackets (confirmed: new URL('https://[::1]:8787')
      // .hostname === '[::1]', not '::1') — strip them before comparing, or the
      // bracket-less '::1' check below never matches a real bracketed loopback
      // URL (#147 P2-a).
      const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      const loopback =
        host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
        host === '::1' || host.endsWith('.local')
      // RFC1918 private + RFC3927 link-local IPv4 ranges — this guard exists to
      // stop a backend URL that's only reachable from the machine/LAN that built
      // it from shipping in a production bundle; loopback alone misses a backend
      // bound to a LAN/private IP (#147 P2-a).
      const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
      const privateOrLinkLocal = ipv4 !== null && (() => {
        const a = Number(ipv4[1])
        const b = Number(ipv4[2])
        return (
          a === 10 || // 10.0.0.0/8
          (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
          (a === 192 && b === 168) || // 192.168.0.0/16
          (a === 169 && b === 254) // 169.254.0.0/16 (link-local)
        )
      })()
      if (url.protocol !== 'https:' || loopback || privateOrLinkLocal) {
        throw new Error(
          `[nibras] Refusing to bake VITE_AI_BACKEND_URL="${raw}" into a production build. ` +
          `A shipped bundle must not point at a localhost/private-network/insecure backend (it flips ` +
          `the privacy copy to over-disclose). For local demos use "npm run dev" with ` +
          `.env.development.local; only set a real https backend URL for a real release. See task #132.`,
        )
      }
    },
  }
}

// #150 (2026-08-14): Amal deferred Arabic on-device LISTENING for the
// pilot (src/config/features.ts's own header has the full why). When
// off, redirect lib/whisperRecognition.ts's own specifier to a tiny
// stub (src/lib/whisperRecognition.stub.ts) so the real file — and its
// `new Worker(new URL('../workers/whisperWorker.ts', ...))` call —
// never enters Vite's build graph at all. A dynamic import() alone
// (already used at the one call site, ReadingBuddy.tsx) is NOT
// sufficient on its own: confirmed via a real build+measure that Vite's
// Worker/asset-URL static analysis bundles whatever it finds in any
// module that's part of the graph, static or dynamic import alike —
// only excluding the file itself (via this alias) keeps the ~24MB
// worker+WASM-runtime chunk (@huggingface/transformers + onnxruntime-web)
// out of dist/. No effect when the flag is on — the alias key doesn't
// exist, so Vite resolves the real file normally.
const __dirname = path.dirname(new URL(import.meta.url).pathname)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), guardProdBackendUrl()],
  resolve: {
    alias: ARABIC_LISTENING_ENABLED
      ? {}
      : {
          './lib/whisperRecognition': path.resolve(__dirname, 'src/lib/whisperRecognition.stub.ts'),
          '../lib/whisperRecognition': path.resolve(__dirname, 'src/lib/whisperRecognition.stub.ts'),
        },
  },
})
