import { getDemoMindMap, type MindMapTreeNode } from './demoMindMaps'
import { TECHNIQUES, type TechniqueCategory } from './techniques'

/**
 * Builds the consolidated «تقنيات القراءة» / "Reading Techniques"
 * example — ONE 4-level mind map replacing the earlier 12 separate
 * per-technique picker entries on the Mind Maps page (Amal,
 * 2026-08-13: "the three techniques categories, and under each
 * technique its own sections" — «التقنيات الثلاثة، وتحت كل تقنية
 * أقسامها»). Nothing is lost: every technique and every one of its
 * steps is still here, just organized into the full teaching hierarchy
 * instead of 12 similar small maps.
 *
 * L1 root -> L2 the 3 families (categories) -> L3 each family's 4
 * techniques -> L4 each technique's own steps. Built PROGRAMMATICALLY
 * from content/techniques.ts (titles) + each technique's OWN demo map
 * in content/demoMindMaps.ts (its step1/step2/step3 branches — the
 * "why it helps" branch is deliberately excluded here: Amal asked for
 * a technique's "sections", i.e. its steps, not its rationale) —
 * never hand-typed a third time, so this can't silently drift out of
 * sync with either source.
 *
 * Family (L2) labels are passed in by the caller (MindMaps.tsx) rather
 * than hardcoded here, specifically so they come from the SAME i18n
 * keys (techniques.categoryReading/categoryComprehension/categoryFocus,
 * via Techniques.tsx's CATEGORY_TITLE_KEY) as the Techniques page's own
 * category headings. This module has no i18next access of its own —
 * kept a plain data file, like demoMindMaps.ts — so it can't call t()
 * directly.
 *
 * Ids are namespaced (family-<category>, <techniqueId>,
 * <techniqueId>-stepN) so a ~50-node tree has no collisions, and —
 * critically — built by the SAME loop for both language calls, so the
 * en and ar trees always have IDENTICAL id sets. That identity is what
 * lets a note or edit made on a node survive a language switch: both
 * are keyed by node id, never by the node's (language-dependent) label
 * text — see mindMapNotes.ts/mindMapEdits.ts.
 */

export const READING_TECHNIQUES_MAP_ID = 'reading-techniques'

const CATEGORY_ORDER: TechniqueCategory[] = ['reading', 'comprehension', 'focus']

const READING_TECHNIQUES_TITLE: Record<'en' | 'ar', string> = {
  en: 'Reading Techniques',
  ar: 'تقنيات القراءة',
}

export function buildReadingTechniquesTree(
  lang: 'en' | 'ar',
  familyLabel: Record<TechniqueCategory, string>,
): MindMapTreeNode {
  return {
    id: 'root',
    label: READING_TECHNIQUES_TITLE[lang],
    children: CATEGORY_ORDER.map((category) => ({
      id: `family-${category}`,
      label: familyLabel[category],
      children: TECHNIQUES.filter((technique) => technique.category === category).map((technique) => {
        const demo = getDemoMindMap(technique.id)
        // Only the step1/step2/step3 branches — excludes the "why"
        // branch on purpose (see file comment above).
        const steps = (demo?.[lang].children ?? []).filter((child) => child.id.startsWith('step'))
        return {
          id: technique.id,
          label: technique[lang].title,
          children: steps.map((step, index) => ({
            id: `${technique.id}-step${index + 1}`,
            label: step.label,
          })),
        }
      }),
    })),
  }
}
