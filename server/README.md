# Nibras AI backend — contract for the handoff team

Nibras's AI features (AI Assistant summarize/explain, Mind Maps generation, Reading Buddy's neural voice) are built to call a **server-side backend that this repo does not deploy publicly**. Per the project's handoff model (see `~/Desktop/AI/research/nibras/` / project memory), Amal hands the finished code to the co-owning company, who deploys it for real — this folder is the **documented contract** the client (`src/lib/aiService.ts`) already expects.

**By default, nothing in here needs to run for the app to work.** Until `VITE_AI_BACKEND_URL` is set, the client runs entirely in DEMO mode (canned responses for the Mind Maps/AI Assistant examples, the browser's own built-in voice for Reading Buddy/Calmness/the guide) — see each feature's own "Demo" labeling in the UI. **No real key lives anywhere in this repo** — the one real key that exists (xAI, for `/voice`) lives only in a gitignored, chmod-600 `server/.env` on this machine, never committed, never printed.

**Update, task #106 (2026-08-13): `POST /voice` is no longer just a documented contract — it's a genuinely runnable local backend now**, proven end-to-end against the real xAI provider (see "Running it locally" below). **Update, task #151 (2026-08-14): `POST /mindmap` is real too** — the first real xAI TEXT-completion call in this backend (structured JSON output, not TTS). **Update (AI-on, 2026-08-19): `POST /summarize`, `/explain`, `/translate` are now implemented too** — real xAI text-completion calls via `_xaiChat.generateText`, same access-gate + per-token spend-cap + rate-limit pipeline as the others, with exact cost accounting incl. reasoning tokens. Built + offline-verified; a real-run verification + nibras-ar/en Arabic-quality review are pending before ship.

## Running it locally (task #106/#151 — proof of the real path, not a public deploy)

```
npm run server
```

Runs `server/index.ts` directly via Node's native TypeScript support (Node 24+, zero build step, zero new dependencies) and Node's built-in `--env-file` loader, so `AI_VOICE_API_KEY` reaches the process from `server/.env` without ever being printed. Listens on `http://127.0.0.1:8787` — **loopback-only, by design, never exposed to the network** — with real security/cost guards (access-token gate, hard monthly spend cap, per-client rate limit, CORS allowlist, request/text size caps; see `server/index.ts`'s own header comment for the full list, "Public-exposure hardening (#148)" below, and `_verify/proof-148-backend-hardening.mjs` for the standing offline proof that all three abuse guards actually fire).

**Since task #148 the access gate is ON and FAILS CLOSED:** with no `AI_ACCESS_TOKENS` set, every `/voice` and `/mindmap` request is refused with 503 (a loud startup warning says so). To run the real local voice/mindmap path (incl. Amal's `npm run dev` demo), set a token in `server/.env` (e.g. `AI_ACCESS_TOKENS=some-long-random-string`) **and** have the client send it as `Authorization: Bearer <token>` (see "Client access-token contract" below — the client wiring is nibras-eng's, not yet applied). `_verify/proof-xai-backend-e2e.mjs` (the real-key end-to-end proof) likewise now needs a token configured on both sides before it will reach 200.

To point the CLIENT at it locally, use `npm run dev` (Vite's dev server), never a production build:
1. `npm run server` (separate terminal/background process)
2. Create a project-root `.env.development.local` with `VITE_AI_BACKEND_URL=http://127.0.0.1:8787` — **not** plain `.env`, and never `npm run build`/`npm run preview` with this set. `.env.development.local` is dev-only by Vite's own convention (never loaded by `npm run build`), and `vite.config.ts`'s `guardProdBackendUrl()` plugin refuses to even PRODUCE a production build with a localhost/private-network `VITE_AI_BACKEND_URL` baked in — a shipped bundle must never point at a backend only reachable from the machine that built it (task #132, hardened #147 P2-a). A demo-mode `.env`-based build-then-revert workflow was the pre-#132 approach and is no longer how this works.
3. `npm run dev`
4. Stop `npm run dev` and delete `.env.development.local` once done — the regular verify suite assumes no backend is configured and runs against `npm run build && npm run preview` (port 4173).

Arabic voice is **eve** (female, default/«الصوت الثاني») / **rex** (male/«الصوت الأول»), both on `ar-SA` — locked by Amal's own ear-test across xAI's 5 voices, both confirmed clean فصحى (Modern Standard Arabic). English voice pick is still pending nibras-en, non-blocking.

## Why a backend at all

The whole point: **AI provider API keys must never reach the client bundle.** A key embedded in client-side JavaScript is trivially extractable by anyone who opens the app — see the project's privacy rules (`CLAUDE.md` / `project_nibras.md`: "AI runs server-side; keys never in the client bundle"). This backend's only real job is to hold that key and proxy requests.

## Client-side switch

`src/lib/aiService.ts` checks `import.meta.env.VITE_AI_BACKEND_URL` (a plain base URL — safe to ship publicly, it's not a secret):

- **Unset** (default, today): every AI method runs its DEMO implementation. No network calls, no backend needed.
- **Set**: `summarize`/`explain`/`generateMindMap`/`synthesizeVoice` POST to `{VITE_AI_BACKEND_URL}/<endpoint>` (see below). A failed/unreachable real call for `synthesizeVoice` falls back to the demo browser-voice path rather than going silent; `generateMindMap` shows an honest "needs an AI connection" state instead (task #151 — no fake map for the reader's own real text, matching `translate()`'s established rule); `summarize`/`explain` currently throw (their demo implementations aren't built in this slice yet — see `aiService.ts`'s own comments for build status).

Set `VITE_AI_BACKEND_URL` in the deployed frontend's environment once a real backend exists at that URL. Nothing else in the client needs to change.

## Endpoints

All POST, JSON in, JSON out. Request/response shapes below match `aiService.ts`'s own TypeScript types exactly — keep them in sync if either side changes.

### `POST /summarize`
```json
// request
{ "text": "the reader's text", "lang": "en" | "ar" }
// response
{ "summary": "a short summary", "demo": false }
```

### `POST /explain`
```json
// request
{ "text": "the reader's text", "lang": "en" | "ar" }
// response
{ "explanation": "a plain-language explanation", "demo": false }
```

### `POST /mindmap` — IMPLEMENTED (task #151), see "Running it locally" above
```json
// request
{ "text": "a short paragraph, capped at 4000 chars", "lang": "en" | "ar" }
// response
{
  "root": {
    "id": "aigen-0",
    "label": "central topic",
    "children": [
      { "id": "aigen-1", "label": "branch 1", "children": [ { "id": "aigen-2", "label": "leaf" } ] }
    ]
  },
  "demo": false
}
```
Real xAI chat-completions call (`_xaiChat.ts`), NOT the `/v1/tts` endpoint `_xaiTts.ts` uses — schema-constrained via xAI's own structured-outputs feature (`response_format: {type:"json_schema", ...}`) to a bounded 3-level tree (root → up to 6 branches → up to 6 leaves, short labels only — deliberately not the reference nibrasapp.com/mindmaps page's own full-sentence-fragment style, which is what produces its truncated/overlapping nodes). The parsed result is still independently shape-validated server-side (`mindmap.ts`'s own `validateRawTree`, exported for direct testing — see `_verify/proof-151-mindmap-generator.mjs`) before ever being trusted — xAI's own "strict" guarantee is not treated as a substitute for that. `id`s are assigned server-side by a plain counter; the model never invents them. No demo path for a reader's OWN pasted text (same rule `/translate` already established below) — the client instead shows a pre-authored, hand-built example map (`content/mindmapGenerationExample.ts`) when no backend is configured.

### `POST /translate`
```json
// request
{ "text": "the reader's text", "from": "en" | "ar", "to": "en" | "ar" }
// response
{ "translatedText": "النص المُترجَم", "demo": false }
```
Task #112 (the Reader's auto-translate-on-language-switch) calls this ONCE PER SECTION of the currently-open document and caches every result client-side — never re-sends the same section+direction twice. No demo path exists for this one (unlike `/summarize`/`/explain`/`/mindmap`'s example-matched canned responses) — a faked translation of arbitrary reader text would be actively misleading, so the client always shows an honest "needs an AI connection" state instead of a canned result when no backend is configured. Arabic output must be فصحى/MSA.

### `POST /voice` — IMPLEMENTED (task #106), see "Running it locally" above
```json
// request
{ "text": "the reader's text", "lang": "en" | "ar", "gender": "male" | "female", "rate": 1.0 }
// response
{ "mode": "audio", "url": "data:audio/mpeg;base64,//PExAB...", "demo": false }
```
`url` should point to a playable audio file — a `data:` URI (what the local implementation actually returns, since xAI hands back raw MP3 bytes rather than a hosted URL) or a signed/expiring URL to real storage both satisfy this exactly the same way; the client just sets it as an `<audio>` `src` either way, no client change needed to switch between them. If synthesis fails server-side, return a non-2xx status; the client already falls back to the browser voice on any error.

## Public-exposure hardening (#148)

Before this backend is ever reachable from the public internet, three guards make it safe to expose. They are enforced server-side in `server/index.ts` (pipeline order: **rate limit → access gate → spend cap → handler**), each isolated in its own `api/_*.ts` module, and proven end-to-end offline by `_verify/proof-148-backend-hardening.mjs` (real server, real HTTP, zero xAI cost). All three are needed: CORS alone stops only browsers, and a rate limit alone bounds the *rate* of spend but not the *total*.

### 1. Access gate — `AI_ACCESS_TOKENS`

Every AI request must carry `Authorization: Bearer <token>` matching one of the comma-separated tokens in `AI_ACCESS_TOKENS`. One token per volunteer is the intended use, so a single leaked token can be revoked (drop it from the list, restart) without disrupting the others. Comparison is constant-time (SHA-256 + `timingSafeEqual`). **Fails closed:** if `AI_ACCESS_TOKENS` is unset, every request is refused with 503 — an unconfigured gate on a paid public endpoint is exactly the hole #148 exists to close, so "no config" never means "open".

Honest limits: when the client is a public static SPA, a token shipped in the bundle is **not** a strong secret — anyone who opens the deployed site's devtools can read it. It is a real speed-bump against opportunistic/automated abuse (bare-URL `curl`, scrapers), and it pairs with the two guards below that bound the **damage** regardless of who calls. For a 5-volunteer pilot that is a reasonable posture. If the pilot widens, step up to a stronger gate (a passphrase page that exchanges a shared secret for a short-lived token kept in memory, or a host-level auth proxy such as Cloudflare Access) — neither requires changing the endpoints, only how the token reaches the client.

### 2. Per-volunteer hard spend cap — `PER_TOKEN_CAP_USD` (default $1.50) + `GLOBAL_CAP_USD` (default $10)

Amal's design: each volunteer has their OWN access token, and each token has its OWN hard budget of **$1.50**. Each call's cost is estimated from grounded xAI pricing (constants in `api/_spendCap.ts` — TTS $15/1M chars, grok-4.6 $2/1M input + $6/1M output tokens, STT `/v1/stt` $0.10/hr, per docs.x.ai/developers/pricing) and summed **per token** in a **persisted JSON ledger** (`server/.usage/usage.json` by default, gitignored, keyed on a hash of the token — never the raw token) so a restart cannot reset anyone's budget. A call that would cross that volunteer's $1.50 is refused with **402** and a `reason` (`token_cap_reached`) before it ever bills — the client turns that into an honest "this session's limit is reached", never a silent failure. This is a **lifetime** budget for the pilot (no time-based reset); to top a volunteer back up, clear their entry from the ledger or raise the constant. TTS/`/voice` is exact (billed per input character = the estimate). For `/mindmap` (chat) the ledger is **trued up to xAI's actual reported usage** after the call — crucially INCLUDING reasoning tokens, which grok-4.6 bills as output and reports SEPARATELY from completion (a real Arabic map measured 3833 reasoning + 130 completion ≈ 3963 output tokens ≈ **$0.025/map**; billing completion alone under-counted ~12x — caught and fixed via `proof-148-realmoney-mindmap.mjs`, 2026-08-19). A conservative estimate gates the call beforehand; the real bill is always ≤ the recorded actual + any rounding is in the safe (over-count) direction. At ~$0.025/map, one volunteer's $1.50 covers ~60 maps.

**Three layers, honestly:** (1) the per-token cap above (primary); (2) a backend GLOBAL backstop `GLOBAL_CAP_USD` across all tokens — **default $10** (= 5 × $1.50 + margin; a 402 with `reason: global_cap_reached`), so extra or misconfigured tokens can't mint spend past the intended total; (3) the **xAI account-level spend limit** — the EXACT hard backstop that holds even against a bug, a bypass, or multiple instances that don't share this ledger. A multi-instance deploy also needs a shared store implementing the same `SpendCap` interface.

**xAI account billing cap (do this in the xAI console, not in code):** In the xAI Console → Billing, set an account/API-key spend limit. The backend already caps at $1.50/volunteer and $10 global; set the account cap a bit ABOVE the backend global (≈ $12–15) so the backend's honest 402 fires first, and comfortably under Amal's $30 credit. This is the one control that cannot be coded around; set it before the key is used by a public deployment.

### 3. Proxy-correct rate limiter — `TRUST_PROXY`, `CLIENT_IP_HEADER`, `CLIENT_IP_LIST_POSITION`

Fixed-window per-client limit (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS`, default 20/60s), shared across both routes. The key is the **correctly-derived client IP**, not the raw socket peer — because behind a proxy/CDN every request arrives from the proxy's single IP, which would otherwise lump all users into one bucket (global lockout, or no limit at all).

- **Default (no proxy):** `TRUST_PROXY` unset → key on the socket peer. Correct for the loopback proof and any direct connection. A client-supplied `X-Forwarded-For` is **ignored** (unspoofable).
- **Behind one proxy:** set `TRUST_PROXY=1` and point `CLIENT_IP_HEADER` at the header your host sets with the real client IP. Prefer a platform's dedicated single-IP header where one exists — it's set from the real TCP peer and can't be spoofed:
  - Cloudflare → `CLIENT_IP_HEADER=cf-connecting-ip`
  - Fly.io → `CLIENT_IP_HEADER=fly-client-ip`
  - generic nginx/`x-real-ip` → `CLIENT_IP_HEADER=x-real-ip`
  - `x-forwarded-for` (list): keep the default and set `CLIENT_IP_LIST_POSITION` to `last` (right-most = the hop your trusted proxy appended; ignores a spoofed left-most value) or `first` for hosts that prepend/overwrite the real client (e.g. some managed platforms). Vercel exposes the client as the first `x-forwarded-for` entry.

The default limiter is in-memory + per-instance (resets on restart, doesn't coordinate across instances). Fine for the single-instance pilot, and the **money** guarantee does not rest on it — it rests on the persistent spend cap + the account cap. A multi-instance deploy swaps in a shared store behind the same `RateLimiter` interface.

## Client access-token contract — APPLIED (task #219, 2026-08-19)

`src/lib/aiService.ts`'s `postJson` now sends the volunteer's access token on every call, exactly as this section originally specified:

```ts
// in postJson(), alongside the existing Content-Type header:
const token = getAccessToken()
const headers: Record<string, string> = { 'Content-Type': 'application/json' }
if (token) headers['Authorization'] = `Bearer ${token}`
```

**Delivery: the RECOMMENDED "enter your access code" gate**, built as `src/components/AccessGate.tsx` (+ `src/lib/accessToken.ts` for the sessionStorage read/write/clear and a small pub/sub, `src/hooks/useAccessGate.ts` for the reactive open/close state) — real per-volunteer tokens, never baked into the bundle. Mounted once in `AppShell.tsx`, above every AI-touching route. **Deliberately REACTIVE, not proactive**: it never appears just because a backend is configured — it only opens the instant a real `postJson()` call actually gets a 401/403 (covers both "no code yet" and "a wrong code" identically, since the server returns the same 401 either way), and reopens with the honest "that code isn't valid" message specifically when a PREVIOUSLY-ENTERED code gets rejected (not on a first-time "you need one" open — those are different messages, both applied). Demo-inert by construction, verified live: with no `VITE_AI_BACKEND_URL` configured, the gate never renders regardless of interaction.

On an HTTP **402**, the client shows the honest "this session's limit is reached" message (mapping `reason`: `token_cap_reached`/`global_cap_reached`) instead of silently swapping to a fallback — `aiService.ts` now exports `AccessTokenError`/`SpendCapError` (thrown by `postJson` on 401/403/402 respectively) so every caller can distinguish "needs a code" from "hit the limit" from a genuine generic failure. `synthesizeVoice`'s previous "fall back to browser voice on ANY error" now re-throws these two specifically (ReadingBuddyPlayer.tsx/ReadingBuddy.tsx/CalmSpace.tsx all updated); AiAssistantPanel.tsx and MindMapGenerator.tsx show a distinct "session limit reached" state instead of their generic error state. AR/EN wording is a first-pass engineer draft (plain, functional copy, not the AI Assistant's own richer prose) — **flagged for the language specialists' review** (#125/#133), not yet blessed.

**Verified against the REAL local backend** (`server/index.ts`, test `AI_ACCESS_TOKENS`, zero xAI cost — 401/402 both short-circuit before the provider handler runs): missing code → real 401 → gate opens; wrong code → real 401 → gate reopens with the invalid-code message; correct code → passes the gate, a real `PER_TOKEN_CAP_USD=0` test then produces a genuine 402 → the honest limit-reached message shows, gate stays closed (the code itself was fine); the code survives a same-tab route change (sessionStorage); the real `/voice` request was intercepted and its `Authorization` header confirmed to read exactly `Bearer <code>`. Full existing verify-suite: clean.

## Server-side STT (`POST /stt`) — provider = xAI; route BUILT (pending a real ar-SA clip verify)

The pilot needs Arabic **listening** (speech-to-text) server-side (Amal approved Path A, with consent). **Amal chose xAI (Option A)** — simplicity over the strict immediate-deletion promise: same `AI_VOICE_API_KEY` as `/voice` + `/mindmap`, no new vendor/account/key. Verified against primary sources 2026-08-19:

- **Endpoint + shape (docs.x.ai — Speech-to-Text):** `POST https://api.x.ai/v1/stt`, **multipart/form-data** with fields `language`, `format`, and `file` (the file MUST be the LAST field). Response JSON `{ text, language, duration, words }`. No token/usage block, but `duration` (audio seconds) is what STT is billed on, so the ledger is trued up to the exact cost from `duration` (`_xaiStt.ts` returns it; `index.ts` records it — mirrors the mind-map true-up).
- **Arabic (docs.x.ai):** `ar` is a supported language code. Real ar-SA MSA accuracy still to be confirmed with a live clip (see below).
- **Retention/consent (the honest promise, #125):** xAI does NOT train on API data; default 30-day encrypted abuse-retention then deletion (docs.x.ai/developers/faq/security). Honest consent copy (nibras-ar/en own the exact wording): **"your recording is sent to xAI's transcription service (a third party, on U.S. servers), used only to turn it into text, never used to train any AI, and deleted within 30 days."** It must NOT imply "never leaves your device" — the audio IS sent to a third party (same honesty nuance flagged for the Deepgram option; it applies to xAI too). NOT "not stored / immediate deletion" (that was the Deepgram path Amal dropped). Consent-gated (opt-in); Nibras itself never stores or logs the audio (streamed to xAI, transcript returned, buffer dropped). A client-side "delete & start over" control clears the local session; it does not reach into xAI (xAI's own 30-day auto-delete covers the provider side).
- **Pricing (docs.x.ai/developers/pricing):** `/v1/stt` **$0.10/hour**. Folded into `estimateSttCostUsd` (`USD_PER_STT_SECOND = 0.1/3600`). A 30s clip ≈ $0.0008, so a volunteer's $1.50 covers thousands of clips.

**Route (built — `stt.ts` + `_xaiStt.ts`, behind the #148 pipeline):** `POST /stt` `{ audio: <base64>, mimeType, lang: 'ar'|'en' }` → `{ text, demo:false }`. Same access-gate + rate-limit + per-token spend-cap as `/voice` + `/mindmap`; gated on a conservative pre-estimate (`MAX_STT_SECONDS`) then trued up to the real `duration`. Body cap raised to `MAX_STT_BODY_BYTES` (3 MB) for the base64 audio; `mimeType` allow-listed. **Still to do before it ships: a real ar-SA clip test** (with nibras-ar) to confirm xAI accepts the browser's audio format (e.g. `audio/webm`) and transcribes فصحى accurately — a fraction of a cent, propose before spending. Client `transcribe()` seam + the mic/consent UI + the "delete & start over" control are nibras-eng's.

## Deploy build — always `npm run build`, never a bare `vite build`

Build the shippable frontend with **`npm run build`**. That runs `prebuild` (fetch models to `public/`), then `tsc -b && vite build`, then **`postbuild` = `scripts/assert-no-model-artifacts.mjs`** — the guard that fails the build if the (shelved) on-device Whisper stack gets re-bundled into the JS. A bare/concurrent `vite build` SKIPS that postbuild assertion and has been observed to produce a ~28 MB dirty bundle (Whisper re-bundled) vs the clean ~4.7 MB `npm run build` output. Keep `npm run build` in the deploy pipeline; never ship a bare `vite build`.

## Environment variables (placeholders — never commit real values)

| Variable | Purpose | Used by |
|---|---|---|
| `AI_TEXT_API_KEY` | UNUSED / dead placeholder. `/summarize`, `/explain`, `/translate` now use `AI_VOICE_API_KEY` (xAI) like `/mindmap` — Amal's one xAI key covers all text calls. Kept only so a future switch to a separate text vendor has a name; nothing reads it today. | *(none)* |
| *(none new)* | `/summarize`, `/explain`, `/translate`, `/mindmap` all reuse `AI_VOICE_API_KEY` below — one xAI key for every text + voice call. | `api/summarize.ts`, `api/explain.ts`, `api/translate.ts`, `api/mindmap.ts` |
| `AI_VOICE_API_KEY` | The xAI (Grok) key used by `/voice` (`/v1/tts`, task #106), `/mindmap` (`/v1/chat/completions`, task #151), AND `/stt` (`/v1/stt`, Arabic listening — Amal's Option A, same key, no new vendor). **Resolved: xAI (Grok)** (voice proven live 2026-08-13, text 2026-08-14). Separate variable from `AI_TEXT_API_KEY` on purpose (a different vendor could serve `/summarize`/`/explain` later without touching this one). | `api/_xaiTts.ts`, `api/_xaiChat.ts`, `api/_xaiStt.ts` |

Add these to whatever secrets mechanism the deploy target uses (Vercel/Netlify environment variables, a `.env` on a small Node server — never a `.env` committed to this repo; see the project root `.gitignore`). Reference them by name only in code, exactly as the stub handlers in `api/` already do.

### #148 hardening config (non-secret, safe defaults)

| Variable | Default | Purpose |
|---|---|---|
| `AI_ACCESS_TOKENS` | *(unset → fail closed, 503)* | Comma-separated access tokens; the client sends one as `Authorization: Bearer <token>`. One per volunteer for easy revocation. Semi-secret (see access-gate honesty note). |
| `PER_TOKEN_CAP_USD` | `1.5` | Hard per-volunteer (per-token) estimated-spend ceiling. A call that would cross it is refused with 402 + `reason: token_cap_reached`. |
| `GLOBAL_CAP_USD` | `10` | Backend global ceiling across all tokens (402 + `reason: global_cap_reached`); default $10 = 5 × $1.50 + margin. `0` = hard kill-switch. The xAI account-level cap is the exact backstop above this. |
| `USAGE_FILE` | `server/.usage/usage.json` | Path to the persistent per-token spend ledger (gitignored machine-local state; keyed on token hashes, never raw tokens). |
| `RATE_LIMIT_MAX_REQUESTS` | `20` | Requests per client per window. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window length (ms). |
| `TRUST_PROXY` | *(off)* | `1`/`true` to derive the client IP from a proxy header instead of the socket peer. Only enable when genuinely behind that proxy. |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | Header the trusted proxy sets with the real client IP (e.g. `cf-connecting-ip`, `fly-client-ip`, `x-real-ip`). |
| `CLIENT_IP_LIST_POSITION` | `last` | For a list-valued `x-forwarded-for`, which entry is the real client (`last` = right-most/appended; `first` for prepend-style hosts). |

`PER_TOKEN_CAP_USD` + `GLOBAL_CAP_USD` are the backend's own guards; they do **not** replace the account-level billing cap in the xAI console (the exact backstop — see "Public-exposure hardening" above).

## Files in this folder

- `api/summarize.ts`, `api/explain.ts`, `api/translate.ts` — **implemented** (AI-on): each builds a non-clinical, warm system prompt (Arabic = فصحى, no em-dashes) and calls `_xaiChat.generateText`, returning the client response PLUS token usage so index.ts trues the spend cap up to the ACTUAL cost incl. reasoning tokens (same shape as mindmap.ts). Each exports its `build*SystemPrompt` for nibras-ar/en review + the real-run proof. Built + offline-verified; real-run + Arabic review pending.
- `api/voice.ts` — **implemented** (task #106). Same generic `(request) => response` shape as the stubs above (`handleVoiceRequest`), but now genuinely calls the xAI adapter and returns real playable audio. Deliberately kept platform-agnostic — a future serverless function would call this exact same function from its own handler, no changes needed here.
- `api/_xaiTts.ts` — the xAI voice/TTS provider adapter `handleVoiceRequest` calls. Isolated on purpose: swapping providers later means changing this one file, not the transport or validation code around it.
- `api/mindmap.ts` — **implemented** (task #151). Same generic shape (`handleMindMapRequest`), genuinely calls the xAI TEXT adapter and returns a real, validated node tree. Also exports `validateRawTree` specifically so its malformed-input handling is directly, deterministically testable (see `_verify/proof-151-mindmap-generator.mjs`) rather than depending on a live model call misbehaving on demand.
- `api/_xaiChat.ts` — the xAI chat/text-completion provider adapter `handleMindMapRequest` calls (`/v1/chat/completions`, structured JSON-schema output). Isolated the same way `_xaiTts.ts` is.
- `index.ts` — a real, runnable Node HTTP server (task #106, extended #151) wrapping `voice.ts` + `mindmap.ts` with shared transport concerns: CORS, per-IP rate limiting, request/text size caps, method/path routing (an explicit route allowlist, `/voice` and `/mindmap`). Loopback-only (127.0.0.1) — see its own header comment for the full security posture. Run via `npm run server`.

`summarize`/`explain`/`translate` are now wired into the runnable server (`index.ts` routes + dispatch) and `tsconfig.node.json`'s typecheck coverage, same as `voice`/`mindmap`/`stt`. None of this folder is part of the Vite client build (`npm run build`/`npm run dev`) — the client only ever talks to whatever `VITE_AI_BACKEND_URL` points at over HTTP, never imports anything from `server/` directly.
