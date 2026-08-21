import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildReadingTechniquesTree, READING_TECHNIQUES_MAP_ID } from '../content/readingTechniquesMap'
import { type TechniqueCategory } from '../content/techniques'
import { useDocuments } from '../hooks/useDocuments'
import { SOURCE_LABEL_KEY } from '../hooks/useProfileData'
import { MindMapView } from '../components/mindmaps/MindMapView'
import { MindMapGenerator } from '../components/mindmaps/MindMapGenerator'
import { CATEGORY_TITLE_KEY } from './Techniques'
import { MindMapIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

type Selection = { kind: 'document'; id: string } | { kind: 'example' }

/**
 * Mind Maps — one self-explanatory example today (Amal, 2026-08-13):
 * the earlier 12 separate per-technique picker entries are consolidated
 * into ONE "Reading Techniques" example, a 4-level map (families ->
 * techniques -> steps) built by content/readingTechniquesMap.ts from
 * content/techniques.ts + content/demoMindMaps.ts — nothing is lost,
 * it is just organized into the full teaching hierarchy instead of 12
 * similar small maps. Real generation from *any* text still calls
 * lib/aiService.ts's generateMindMap() once an AI backend is
 * configured — not built yet, so picking one of your own saved
 * documents here shows an honest "needs an AI connection" message
 * instead of a fake map, same honesty pattern as the Dashboard's other
 * not-yet-built cards.
 *
 * "Self-explanatory" (Amal: «وتكتب عنوان مثال حتى الي يفتح الصفحة
 * يفهم»): the page intro now explains what a mind map actually is (not
 * just what this page does with one), the example card names itself
 * and carries the SAME "مثال/Example" pill the Reader already uses for
 * its own example texts (not a new badge), and the pill repeats inside
 * the diagram header once opened — so it's unmistakable this is
 * Nibras's own canned content, not something generated from the
 * reader's own writing.
 */
export function MindMaps() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const { documents } = useDocuments()
  const [selected, setSelected] = useState<Selection | null>(null)

  const docList = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt)
  const isExampleSelected = selected?.kind === 'example'
  const selectedDocTitle =
    selected?.kind === 'document' ? documents[selected.id]?.title || t('profile.untitledDocument') : undefined

  // Family (L2) labels come from the SAME i18n keys as the Techniques
  // page's own category headings (CATEGORY_TITLE_KEY) — resolved here,
  // where t() is available, and passed into the plain-data builder
  // function (see readingTechniquesMap.ts for why that file can't call
  // t() itself).
  const familyLabel: Record<TechniqueCategory, string> = {
    reading: t(CATEGORY_TITLE_KEY.reading),
    comprehension: t(CATEGORY_TITLE_KEY.comprehension),
    focus: t(CATEGORY_TITLE_KEY.focus),
  }
  const readingTechniquesRoot = buildReadingTechniquesTree(lang, familyLabel)

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('mindMaps.title')}</h1>
      <p className="mb-8 max-w-[46rem] text-[0.9375rem] text-ink-muted">{t('mindMaps.subtitle')}</p>

      {/* Task #151 — recreates nibrasapp.com/mindmaps' own core feature
          (paste a paragraph, AI generates a spatial map), leading the
          page since it's the officially-referenced page's whole
          identity. The Reading Techniques example + saved-documents
          sections below are this app's own established, additional
          content — kept, not replaced (team-lead's explicit brief). */}
      <MindMapGenerator lang={lang} />

      <section aria-labelledby="mindmap-example-heading" className="mb-6">
        <h2 id="mindmap-example-heading" className="mb-3 text-sm font-bold tracking-[0.08em] text-accent uppercase">
          {t('mindMaps.exampleSectionTitle')}
        </h2>
        <button
          type="button"
          onClick={() => setSelected({ kind: 'example' })}
          aria-pressed={isExampleSelected}
          className={`flex w-full items-center gap-4 rounded-card border-[1.5px] border-line-strong bg-card p-5 text-start transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-tint ${focusRing}`}
        >
          <span
            aria-hidden="true"
            className="flex size-11 flex-none items-center justify-center rounded-control bg-accent-tint text-accent"
          >
            <MindMapIcon className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[1.0625rem] font-bold text-ink">{readingTechniquesRoot.label}</span>
              <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
                {t('profile.sourceExample')}
              </span>
            </span>
            <span className="block text-[0.8125rem] text-ink-muted">{t('mindMaps.exampleCardDescription')}</span>
          </span>
        </button>
      </section>

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
                  onClick={() => setSelected({ kind: 'document', id: doc.id })}
                  aria-pressed={selected?.kind === 'document' && selected.id === doc.id}
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

      {isExampleSelected && (
        <MindMapView
          mapId={READING_TECHNIQUES_MAP_ID}
          title={readingTechniquesRoot.label}
          root={readingTechniquesRoot}
          lang={lang}
          isExample
          colorByBranch
        />
      )}

      {selected?.kind === 'document' && (
        <div role="status" className="rounded-card border border-line bg-card p-5">
          <p className="m-0 text-[0.9375rem] font-semibold text-ink">
            {t('mindMaps.needsBackendTitle', { title: selectedDocTitle })}
          </p>
          <p className="m-0 mt-1.5 text-[0.8125rem] text-ink-muted">{t('mindMaps.needsBackendBody')}</p>
        </div>
      )}

      {!selected && (
        <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
          <p className="m-0 text-[0.9375rem] text-ink-muted">{t('mindMaps.emptyHint')}</p>
        </div>
      )}
    </main>
  )
}
