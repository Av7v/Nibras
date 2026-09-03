import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocuments } from '../hooks/useDocuments'
import { SOURCE_LABEL_KEY } from '../hooks/useProfileData'
import { MindMapGenerator } from '../components/mindmaps/MindMapGenerator'
import { isAiBackendConfigured } from '../lib/aiService'
import { focusRing } from '../lib/focus'

/**
 * Mind Maps — ONE full-width display area, mirroring the Reader (Amal,
 * 2026-08-22, #264: «نفس فكرة القارئ فيه مثال الآن لكن المستخدمين يقدرون
 * يحطون شي ثاني»): the generator (MindMapGenerator) shows a pre-authored
 * example map BY DEFAULT and a reader's own pasted paragraph replaces it in
 * that same big area. The earlier separate click-to-open «شاهد المثال»
 * example card + its own empty-state placeholder box were CONSOLIDATED away
 * into that default-shown example, so there is no duplicate example section
 * and no wasted placeholder rectangle.
 *
 * Real generation from *any* text still calls lib/aiService.ts's
 * generateMindMap() once an AI backend is configured; the honest split lives
 * in MindMapGenerator (pre-authored example always works; the reader's own
 * text only ever attempts a real call, never a faked map). Saved-documents ->
 * map is still offered below for anyone who has saved documents: picking one
 * shows an honest "needs an AI connection" message (same honesty pattern),
 * since turning a saved document into a map is a real backend feature.
 */
export function MindMaps() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const { documents } = useDocuments()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  const docList = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt)
  const selectedDocTitle = selectedDocId
    ? documents[selectedDocId]?.title || t('profile.untitledDocument')
    : undefined

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('mindMaps.title')}</h1>
      {/* #P1-C honesty gate (mirrors Privacy #120): only assert "needs an AI
          connection that isn't set up yet" in demo; when the backend IS
          configured, the accurate live copy (paste your own -> a map). */}
      <p className="mb-8 max-w-[46rem] text-[0.9375rem] text-ink-muted">
        {isAiBackendConfigured() ? t('mindMaps.subtitleLive') : t('mindMaps.subtitle')}
      </p>

      {/* The one big display area: example by default, the reader's own
          generated map on generate (see MindMapGenerator's own header). */}
      <MindMapGenerator lang={lang} />

      {docList.length > 0 && (
        <section aria-labelledby="mindmap-documents-heading" className="mb-6">
          <h2
            id="mindmap-documents-heading"
            className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase"
          >
            {t('mindMaps.yourDocumentsTitle')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {docList.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  aria-pressed={selectedDocId === doc.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-control border-[1.5px] border-line bg-card px-4 py-3 text-start transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-tint ${focusRing}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                      {doc.title || t('profile.untitledDocument')}
                    </span>
                    <span className="block text-[0.8125rem] text-ink-muted">{t(SOURCE_LABEL_KEY[doc.sourceType])}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedDocId && (
        <div role="status" className="rounded-card border border-line bg-card p-5">
          <p className="m-0 text-[0.9375rem] font-semibold text-ink">
            {t('mindMaps.needsBackendTitle', { title: selectedDocTitle })}
          </p>
          <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">
            {isAiBackendConfigured() ? t('mindMaps.needsBackendBodyLive') : t('mindMaps.needsBackendBody')}
          </p>
        </div>
      )}
    </main>
  )
}
