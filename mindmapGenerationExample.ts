/**
 * The "AI Text → Mind Map" module's sample input paragraph (task #151,
 * 2026-08-14) — see MindMapGenerator.tsx's own header comment for the
 * full honesty split (pre-authored example always works offline; a
 * reader's own pasted text only ever attempts a real backend call,
 * never a faked map).
 *
 * #281 (2026-08-26, Amal: «الخريطة الذهنية المثال حق تقنيات القراءة مو
 * كامل، ابغى يظهر فيه الثلاث تقنيات بعدين تتفرع» — wants the example to
 * show the 3 technique FAMILIES, then branch): the default example map
 * itself is no longer built here. It used to be a hand-typed, flat
 * root -> 4 techniques -> 2 steps tree (`MINDMAP_EXAMPLE_TREE` and its
 * companion id `MINDMAP_GENERATION_EXAMPLE_ID`, both removed);
 * MindMapGenerator.tsx now builds the tree by calling
 * `buildReadingTechniquesTree()` (content/readingTechniquesMap.ts) —
 * the SAME full root -> 3 families -> techniques -> steps teaching map
 * the standalone Reading-Techniques example used pre-#264, which
 * itself is built PROGRAMMATICALLY from content/techniques.ts +
 * content/demoMindMaps.ts so it can never drift out of sync with
 * either source — and uses that module's own
 * `READING_TECHNIQUES_MAP_ID` as the example's stable id (not a
 * second, separately-named id for the same map). This file now only
 * keeps the sample PARAGRAPH.
 *
 * Paragraph rewritten for the same reason (#281): the old paragraph's
 * 4 sentences named the SAME 4 techniques the old flat tree branched
 * into, verbatim, so a real xAI generation of it would plausibly
 * reproduce roughly that shape — an honest pairing at the time. Once
 * the default example became the full ~53-node, 4-level family tree,
 * keeping that same short paragraph next to it would create a real
 * content mismatch (a paragraph naming 4 specific techniques beside a
 * map of 13 different techniques across 3 families) — and, more
 * fundamentally, the /mindmap backend's own schema
 * (server/api/mindmap.ts's ROOT_SCHEMA) caps a REAL generation at
 * root -> up to 6 branches -> up to 6 leaves, a flat 3-level shape
 * that can never actually reproduce the family tree's 4-level nesting
 * no matter what paragraph is pasted. So this paragraph now names the
 * example map's own TOP level honestly instead: the 3 real family
 * names (Reading/Comprehension/Focus — the same
 * techniques.categoryReading/categoryComprehension/categoryFocus
 * titles the map's own L2 branches use), one descriptive sentence
 * each. A real generation from this text would plausibly produce a
 * root + 3 top-level branches (well within the schema) — an honest,
 * if partial (top-level only, not all 53 nodes), correspondence to
 * what "Try the example" actually shows, rather than a full one that
 * was never achievable once the tree gained a 4th level.
 *
 * Arabic register: plain الفصحى (Modern Standard Arabic), matching
 * this file's own established light diacritic weight (shaddas where
 * they clarify a doubled root letter or a genuinely ambiguous short
 * vowel, no full letter-by-letter تشكيل). Drafted by the web/hybrid
 * engineer for #281 — flagged to team-lead as PENDING a native-Arabic
 * review pass (nibras-ar), same review step every other Arabic string
 * in this file has already had; not yet re-confirmed after this edit.
 */

export const MINDMAP_EXAMPLE_PARAGRAPH: Record<'en' | 'ar', string> = {
  en: 'There are many techniques that make reading easier, and they generally fall into three families: Reading, Comprehension, and Focus. Some shape the text itself, giving it more room to breathe with wider spacing and a shorter line. Others help you understand and remember what you read, like breaking it into small chunks and retelling it in your own words. And others help you keep your focus while you read, by clearing the clutter around you and taking a calm breath when your attention drifts.',
  ar: 'هناك تقنيات كثيرة تجعل القراءة أسهل، وتنقسم عمومًا إلى ثلاث عائلات: القراءة، والفهم، والتركيز. بعضها يشكّل النص نفسه، فيمنحه مساحةً أوسع بتباعد أكبر وسطر أقصر. وبعضها يساعدك على فهم ما تقرأ وتذكّره، كتقسيمه إلى مقاطع صغيرة وإعادة سرده بكلماتك. وبعضها الآخر يساعدك على الحفاظ على تركيزك أثناء القراءة، بإبعاد المشتّتات من حولك وأخذ نفَس هادئ حين يشرد انتباهك.',
}
