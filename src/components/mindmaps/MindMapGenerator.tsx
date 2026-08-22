import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessTokenError, generateMindMap, isAiBackendConfigured, SpendCapError, type MindMapResult } from '../../lib/aiService'
import { MINDMAP_EXAMPLE_PARAGRAPH, MINDMAP_EXAMPLE_TREE, MINDMAP_GENERATION_EXAMPLE_ID } from '../../content/mindmapGenerationExample'
import { MindMapView } from './MindMapView'
import { MindMapIcon } from '../icons'
import { focusRing } from '../../lib/focus'

/** "Paste a paragraph" per the reference page's own copy — a UI-level
 * mirror of mindmap.ts's own MAX_MINDMAP_CHARS (4000). Kept as a
 * separate constant (not imported — this is a Vite CLIENT file, that
 * one is server-only Node code) so the textarea can stop a reader
 * before they type past what the server would reject anyway. */
const MAX_CHARS = 4000

type GeneratorState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'needsBackend' }
  | { kind: 'error' }
  // Task #219's honest 402 handling — this volunteer's own budget, or
  // the backend's global backstop, is spent. Distinct from 'error'
  // (which now means a genuine unexpected failure) so the copy can be
  // honest about WHY, matching AiAssistantPanel's own errorKind split.
  // `reason` (AI-on honesty pass, 2026-08-19, spec in
  // teamlead/ai-on-honesty-copy-spec.md) carries WHICH cap fired:
  // 'token_cap_reached' = this volunteer's own budget, PERMANENT for
  // the pilot (never "try again later"); 'global_cap_reached' = the
  // shared service-wide backstop, genuinely TEMPORARY ("busy" framing).
  | { kind: 'limitReached'; reason: 'token_cap_reached' | 'global_cap_reached' }
  | { kind: 'result'; result: MindMapResult; isExample: boolean; mapId: string }

function newGeneratedMapId(): string {
  // Same `${prefix}_${Date.now()}_${random}` shape useDocuments.ts's
  // own newId()/useMindMapEdits.ts's own newNodeId() already use — a
  // fresh id per REAL generation so a brand-new map never inherits
  // stale notes/edits a previous generation happened to leave under
  // the same mapId.
  return `aigen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * "AI Text → Mind Map" (task #151, 2026-08-14) — recreates
 * nibrasapp.com/mindmaps' own core feature (paste a paragraph,
 * generate a spatial node map) inside Amal's existing Mind Maps page,
 * alongside (not replacing) its existing Reading Techniques example
 * and saved-documents sections — team-lead's explicit brief: align to
 * the reference's design, keep this app's own existing strengths.
 *
 * Honesty split, matching #112's (`translate()`) already-established
 * rule for "a real backend feature with no safe demo path": generating
 * a map from the reader's OWN pasted text is only ever attempted with
 * a real AI backend configured — never faked. With no backend
 * configured, clicking Generate on real text shows an honest "needs an
 * AI connection" state (checked via `isAiBackendConfigured()` BEFORE
 * even attempting the call, the same upfront-check pattern
 * MindMaps.tsx's own document-picker already used) rather than a
 * silently-wrong result. Separately, "Try the example" ALWAYS works —
 * a pre-authored, hand-built tree (content/mindmapGenerationExample.ts),
 * clearly labeled the same "مثال/Example" way the Reader's own example
 * texts already are, so a demo-mode volunteer can still see the
 * feature genuinely working.
 *
 * Renders the actual result through the EXISTING MindMapView — no
 * parallel diagram renderer — so node editing, the whole-map/per-node
 * listen controls (already on the #145 global voice preference), and
 * PNG export all come for free, unchanged.
 *
 * Bilingual/RTL (Amal's own added requirement, relayed via team-lead):
 * a genuine UI-language switch resets this module back to its initial
 * empty state — mirrors task #143's own on-device Reader pattern
 * (reset non-destructively on a real language change) — there is no
 * mind-map auto-translate feature to fall back on instead (unlike the
 * Reader's own /translate path, which is itself still unimplemented —
 * see mindmap.ts's own header comment), so silently trying to keep a
 * stale-language result on screen after a switch would be actively
 * confusing, not helpful.
 */
export function MindMapGenerator({ lang }: { lang: 'en' | 'ar' }) {
  const { t } = useTranslation()

  // #264 (Amal: «نفس فكرة القارئ ... فيه مثال الآن لكن المستخدمين يقدرون
  // يحطون شي ثاني») — mirror the Reader: the pre-authored example map shows
  // BY DEFAULT in the big display area on load (no click needed); a reader's
  // own pasted paragraph REPLACES it in that same area. The example always
  // works offline/demo; a real generation runs only with an AI backend
  // configured (handleGenerate), otherwise the honest needs-a-connection state.
  const exampleState = (l: 'en' | 'ar'): GeneratorState => ({
    kind: 'result',
    result: { root: MINDMAP_EXAMPLE_TREE[l], demo: true },
    isExample: true,
    // Stable across re-renders AND across languages (readingTechniquesMap.ts's
    // own convention) so a note/edit on the example survives a language switch.
    mapId: MINDMAP_GENERATION_EXAMPLE_ID,
  })

  const [sourceText, setSourceText] = useState('')
  const [state, setState] = useState<GeneratorState>(() => exampleState(lang))
  const prevLangRef = useRef(lang)

  // #129/#143 (same as the Reader): on a GENUINE UI-language change reset to
  // the example in the NEW language — the example follows the UI language, and
  // a reader's own in-progress result is cleared rather than left stale.
  useEffect(() => {
    if (prevLangRef.current === lang) return
    prevLangRef.current = lang
    setSourceText('')
    setState(exampleState(lang))
  }, [lang])

  async function handleGenerate() {
    if (!sourceText.trim()) return
    if (!isAiBackendConfigured()) {
      setState({ kind: 'needsBackend' })
      return
    }
    setState({ kind: 'generating' })
    try {
      const result = await generateMindMap(sourceText.trim().slice(0, MAX_CHARS), lang)
      setState({ kind: 'result', result, isExample: false, mapId: newGeneratedMapId() })
    } catch (err) {
      if (err instanceof AccessTokenError) {
        // The globally-mounted <AccessGate> has already reopened
        // itself with its own "enter your code" message (aiService.ts's
        // postJson calls reportInvalidToken() before throwing) — back
        // to idle here rather than a second, competing local error.
        setState({ kind: 'idle' })
      } else if (err instanceof SpendCapError) {
        setState({ kind: 'limitReached', reason: err.reason })
      } else {
        // Covers BOTH a network/provider failure AND the server rejecting
        // a malformed/invalid LLM response (mindmap.ts's own
        // validateRawTree) — either way this is a graceful, honest
        // in-UI state, never a silent failure or a crash.
        setState({ kind: 'error' })
      }
    }
  }

  // «جرّب المثال» loads the example's own source paragraph too, so a reader
  // can see (and tweak) the text that produced the default example map.
  function handleTryExample() {
    setSourceText(MINDMAP_EXAMPLE_PARAGRAPH[lang])
    setState(exampleState(lang))
  }

  // "Reset" returns to the DEFAULT example (empty input + example map), not a
  // blank page — mirrors the Reader returning to its example.
  function handleReset() {
    setSourceText('')
    setState(exampleState(lang))
  }

  const isGenerating = state.kind === 'generating'
  // The reset control shows only once the reader has DEVIATED from the default
  // example (typed their own text, or generated their own non-example map).
  const hasContent = sourceText.trim() !== '' || (state.kind === 'result' && !state.isExample)

  return (
    <section aria-labelledby="mindmap-generator-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-control bg-accent-tint text-accent">
            <MindMapIcon className="size-4" />
          </span>
          <h2 id="mindmap-generator-heading" className="text-[1.0625rem] font-bold text-ink">
            {t('mindMaps.generator.title')}
          </h2>
        </span>
        {hasContent && (
          <button
            type="button"
            onClick={handleReset}
            className={`rounded-control border-[1.5px] border-line-strong px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
          >
            {t('mindMaps.generator.resetButton')}
          </button>
        )}
      </div>
      <p className="mb-4 max-w-[46rem] text-[0.9375rem] text-ink-muted">{t('mindMaps.generator.subtitle')}</p>

      {/* #264 (Amal: «ابي الخريطة المولدة تطلع مكان المثال») — STACKED,
          full-width: the paste-a-paragraph input on top, then the result
          (or the honest state) FULL-WIDTH below, so the generated / tried
          map renders BIG in the main display area instead of a cramped
          half-width side column. This removes the wasted top-left preview
          rectangle the two-column grid used to leave when idle. */}
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-card p-5">
          <label htmlFor="mindmap-source" className="mb-1 block text-[0.9375rem] font-bold text-ink">
            {t('mindMaps.generator.sourceLabel')}
          </label>
          <p className="mb-3 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.sourceHint')}</p>
          <textarea
            id="mindmap-source"
            rows={7}
            value={sourceText}
            maxLength={MAX_CHARS}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={t('mindMaps.generator.placeholder')}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className={`w-full resize-y rounded-control border-[1.5px] border-line-strong bg-cream/50 p-3 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!sourceText.trim() || isGenerating}
              aria-busy={isGenerating}
              className={`inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              <span className={isGenerating ? 'motion-safe:animate-pulse' : undefined}>
                {isGenerating ? t('mindMaps.generator.generatingStatus') : t('mindMaps.generator.generateButton')}
              </span>
            </button>
            <button
              type="button"
              onClick={handleTryExample}
              disabled={isGenerating}
              className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {t('mindMaps.generator.tryExampleButton')}
            </button>
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.tip')}</p>
        </div>

        <div>
          {state.kind === 'result' && (
            <>
              {/* Result-card framing (task #204, 2026-08-18): the
                  reference page's right card has its OWN persistent
                  title+subtitle+badge, distinct from the map's own
                  title inside MindMapView below (e.g. "Water Cycle" +
                  the "مثال/Example" pill) — these two headers answer
                  different questions ("what section is this" vs "which
                  specific map is this") so both stay, not a
                  replacement of one by the other. `resultLabel`/
                  `resultHint` already existed in both language catalogs
                  since #151 but were never rendered anywhere — wiring
                  them here, not adding new copy.
                  Badge honesty (team-lead's explicit brief, mirrors the
                  AI Assistant/#178 "coming soon" pattern): a real
                  "AI-generated" claim only when a real backend produced
                  THIS result. The example is truthfully labeled by its
                  OWN separate «مثال» pill already — never doubled up
                  with "AI-generated" (false) or "Coming soon" (also
                  wrong, misreads as "this specific map isn't ready"
                  when it's a working demo) once AI is actually live. */}
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <span>
                  <h3 className="text-[0.9375rem] font-bold text-ink">{t('mindMaps.generator.resultLabel')}</h3>
                  <p className="m-0 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.resultHint')}</p>
                </span>
                {!isAiBackendConfigured() && (
                  <span className="flex-none rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
                    {t('dashboard.comingSoonBadge')}
                  </span>
                )}
                {isAiBackendConfigured() && !state.isExample && (
                  <span className="flex-none rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
                    {t('mindMaps.generator.aiGeneratedBadge')}
                  </span>
                )}
              </div>
              <MindMapView
                mapId={state.mapId}
                title={state.result.root.label}
                root={state.result.root}
                lang={lang}
                isExample={state.isExample}
                colorByBranch
              />
            </>
          )}

          {state.kind === 'needsBackend' && (
            <div role="status" className="rounded-card border border-line bg-card p-5">
              <p className="m-0 text-[0.9375rem] font-semibold text-ink">{t('mindMaps.generator.needsBackendTitle')}</p>
              <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.needsBackendBody')}</p>
            </div>
          )}

          {state.kind === 'error' && (
            <div role="alert" className="rounded-card border border-line bg-card p-5">
              <p className="m-0 text-[0.9375rem] font-semibold text-ink">{t('mindMaps.generator.errorTitle')}</p>
              <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.errorBody')}</p>
            </div>
          )}

          {state.kind === 'limitReached' && (
            <div role="alert" className="rounded-card border border-line bg-card p-5">
              {state.reason === 'global_cap_reached' ? (
                <>
                  <p className="m-0 text-[0.9375rem] font-semibold text-ink">{t('mindMaps.generator.busyTitle')}</p>
                  <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.busyBody')}</p>
                </>
              ) : (
                <>
                  <p className="m-0 text-[0.9375rem] font-semibold text-ink">{t('mindMaps.generator.limitReachedTitle')}</p>
                  <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.limitReachedBody')}</p>
                </>
              )}
            </div>
          )}

          {state.kind === 'generating' && (
            // A distinct state from idle (was sharing the SAME static
            // "paste a paragraph" placeholder until team-lead flagged a
            // 35+s Arabic generation looking dead behind unrelated,
            // stale copy) — a warm, motion-safe-animated "creating your
            // map" message, live-announced (aria-live, matching the
            // needsBackend/error states' own role="status"/"alert"
            // pattern) since this genuinely updates while the reader
            // waits. Arabic gets its own honest latency note — measured
            // directly (proof-151-mindmap-generator.mjs), Arabic
            // generation is genuinely slower than English's own
            // comfortably-sub-30s response, not a stall or a bug.
            <div role="status" aria-live="polite" className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong p-8 text-center">
              {/* Decorative progress affordance ONLY — the actual
                  status is the text below, already in this aria-live
                  region; announcing "dot dot dot" would just be noise
                  for a screen-reader user. Gated behind motion-safe:
                  the same way as everywhere else in this app — under
                  reduced motion the 3 dots simply sit still, still
                  visually signaling "something is happening here"
                  without any animation. */}
              <div aria-hidden="true" className="flex gap-1.5">
                <span className="size-2 rounded-full bg-accent motion-safe:animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-2 rounded-full bg-accent motion-safe:animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-2 rounded-full bg-accent motion-safe:animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="m-0 motion-safe:animate-pulse text-[0.9375rem] font-semibold text-ink">{t('mindMaps.generator.generatingStatus')}</p>
              {lang === 'ar' && <p className="m-0 text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.arabicLatencyNote')}</p>}
            </div>
          )}

          {/* #264 — a slim one-line hint instead of the old tall dashed
              placeholder rectangle (the wasted top-left box). When idle the
              page is just the input + this hint; the big display area only
              appears once there's a real map to show. */}
          {state.kind === 'idle' && (
            <p className="m-0 text-center text-[0.8125rem] text-ink-muted">{t('mindMaps.generator.emptyHint')}</p>
          )}
        </div>
      </div>
    </section>
  )
}
