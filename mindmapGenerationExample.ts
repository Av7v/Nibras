import type { MindMapTreeNode } from './demoMindMaps'

/**
 * Task #151 (2026-08-14) — the "AI Text → Mind Map" module's ONE
 * hand-built, pre-authored worked example: a source paragraph +
 * matching mind map, shown when no AI backend is configured so a
 * demo-mode volunteer can still see what the feature produces without
 * this app ever faking analysis of a real user's own pasted text (see
 * MindMapGenerator.tsx's own header comment for the full honesty
 * reasoning — same rule #112/`translate()` already established).
 *
 * Content (2026-08-19, Amal): the example is Nibras's OWN «تقنيات
 * القراءة» / "Reading Techniques" (was a neutral water-cycle demo),
 * so the generator's worked example teaches the app's own material.
 * Every node label here is pulled VERBATIM from the two source files
 * this app already ships, by id, so the demo example and the static
 * Reading-Techniques map can never drift apart in wording:
 * - the root title = readingTechniquesMap.ts's READING_TECHNIQUES_TITLE
 * - each branch title = a technique's own title (techniques.ts) = the
 *   matching demoMindMaps.ts root label (r2, c1, c3, f2)
 * - each leaf = that technique's own step label (demoMindMaps.ts steps)
 * The paragraph is a short expository lead-in whose sentences name the
 * same four techniques in order, so a real xAI generation of it would
 * plausibly produce this same shape (mindmap.ts's system prompt).
 * Reviewed both languages by nibras-ar + nibras-en.
 *
 * Same "identical ids across en/ar" convention as
 * readingTechniquesMap.ts — a note or edit made while reading this
 * example in one language still applies to "the same idea" after a
 * language switch, since useMindMapNotes/useMindMapEdits key by
 * mapId+nodeId, never by the (language-dependent) label text.
 *
 * Arabic register: plain الفصحى (Modern Standard Arabic), the same
 * light/natural diacritic weight already used for demoMindMaps.ts's
 * own display content (shaddas where they clarify a doubled root
 * letter, no full letter-by-letter تشكيل — that heavier register is
 * reserved for CalmSpace's fixed spoken cues, see calm-cue-wording-136.md).
 */

export const MINDMAP_GENERATION_EXAMPLE_ID = 'ai-generation-example'

export const MINDMAP_EXAMPLE_PARAGRAPH: Record<'en' | 'ar', string> = {
  en: 'A few simple techniques make reading easier and clearer. Give the text room to breathe, with wider line spacing and short paragraphs, so the words feel less crowded. Read the text in small chunks, and after each one, pause to check that you understood it. Then say what you read in your own words: look away from the text, and retell it in a sentence or two, so the meaning sticks. Before you start, clear the clutter around you: close any extra tabs and put your phone out of reach, so your attention stays on the reading.',
  ar: 'هناك تقنيات بسيطة تجعل القراءة أسهل وأوضح. أعطِ النص مساحةً ليتنفّس، بتباعد أوسع بين الأسطر وفقرات قصيرة، حتى يقلّ ازدحام الكلمات. اقرأ النص على مقاطع صغيرة، وبعد كل مقطع توقّف لتتأكّد من فهمك. ثم عبّر بكلماتك عمّا قرأته: ارفع نظرك عن النص، وأعد سرده بجملة أو جملتين حتى يرسخ المعنى. وقبل أن تبدأ، أبعِد المشتّتات من حولك، فأغلق النوافذ الزائدة وضع الهاتف بعيدًا، ليبقى انتباهك على القراءة.',
}

export const MINDMAP_EXAMPLE_TREE: Record<'en' | 'ar', MindMapTreeNode> = {
  en: {
    id: 'rt-root',
    label: 'Reading Techniques',
    children: [
      {
        id: 'rt-r2',
        label: 'Give the text room to breathe',
        children: [
          { id: 'rt-r2-a', label: 'Wider line spacing' },
          { id: 'rt-r2-b', label: 'Keep paragraphs short' },
        ],
      },
      {
        id: 'rt-c1',
        label: 'Read in small chunks',
        children: [
          { id: 'rt-c1-a', label: 'Read one, then pause' },
          { id: 'rt-c1-b', label: 'Check you understood it' },
        ],
      },
      {
        id: 'rt-c3',
        label: 'Say it in your own words',
        children: [
          { id: 'rt-c3-a', label: 'Look away from the text' },
          { id: 'rt-c3-b', label: 'Retell it in 1-2 sentences' },
        ],
      },
      {
        id: 'rt-f2',
        label: 'Clear the clutter',
        children: [
          { id: 'rt-f2-a', label: 'Close extra tabs' },
          { id: 'rt-f2-b', label: 'Put the phone out of reach' },
        ],
      },
    ],
  },
  ar: {
    id: 'rt-root',
    label: 'تقنيات القراءة',
    children: [
      {
        id: 'rt-r2',
        label: 'أعطِ النص مساحةً ليتنفّس',
        children: [
          { id: 'rt-r2-a', label: 'تباعد أوسع بين الأسطر' },
          { id: 'rt-r2-b', label: 'فقرات قصيرة' },
        ],
      },
      {
        id: 'rt-c1',
        label: 'اقرأ النص على مقاطع صغيرة',
        children: [
          { id: 'rt-c1-a', label: 'اقرأ مقطعًا ثم توقف' },
          { id: 'rt-c1-b', label: 'تأكد من فهمك' },
        ],
      },
      {
        id: 'rt-c3',
        label: 'أعد صياغته بكلماتك',
        children: [
          { id: 'rt-c3-a', label: 'ارفع نظرك عن النص' },
          { id: 'rt-c3-b', label: 'أعد سرده بجملة أو جملتين' },
        ],
      },
      {
        id: 'rt-f2',
        label: 'أبعِد المشتّتات',
        children: [
          { id: 'rt-f2-a', label: 'أغلق النوافذ الزائدة' },
          { id: 'rt-f2-b', label: 'ضع الهاتف بعيدًا' },
        ],
      },
    ],
  },
}
