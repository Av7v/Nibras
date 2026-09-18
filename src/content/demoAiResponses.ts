/**
 * Hand-authored DEMO summarize/explain responses, one per example text
 * in content/exampleTexts.ts — same shape and reasoning as
 * content/demoMindMaps.ts. AI Assistant's demo mode (team-lead,
 * 2026-08-13): "canned responses for the examples." Real generation
 * (any text, via an LLM) wires to lib/aiService.ts's summarize()/
 * explain() once an AI backend is keyed — see
 * components/reader/AiAssistantPanel.tsx for how text that ISN'T one of
 * these two shows an honest "needs an AI connection" state instead of a
 * fake response.
 *
 * Each entry is in the SAME language as its source example — a
 * summary/explanation of an English passage reads naturally in
 * English, same for Arabic; this mirrors what a real model would
 * produce unless explicitly asked to translate.
 */

export interface DemoAiResponse {
  /** Matches an id in content/exampleTexts.ts. */
  exampleId: string
  lang: 'en' | 'ar'
  summary: string
  explanation: string
}

export const DEMO_AI_RESPONSES: DemoAiResponse[] = [
  {
    // Task #231 (2026-08-19), rewritten a second time same day for the
    // ELEVATED passage (Amal found the first version's Arabic too
    // plain; nibras-ar's rewrite uses light/door/soul/radiance imagery
    // instead of "a journey" — this summary/explanation updated to
    // match, not left describing the earlier, now-replaced wording).
    // Own EN summary/explanation, written directly, same house style —
    // no specialist gate needed for EN content like this.
    exampleId: 'reading',
    lang: 'en',
    summary:
      'A reflection on reading as light and an open door: each page widens your world, and its real beauty is found by savouring every word rather than hurrying through it.',
    explanation:
      "This passage describes reading as a light for the mind and a door to endless worlds for the soul, one that widens your view of things with every page you turn. It treats patience, savouring each word rather than rushing to the end, as the source of that beauty. The main idea: reading with love and unhurried attention is what lets a passage's own radiance carry you further than you expected.",
  },
  // Task #231 (2026-08-19): the OLD 'simple-lesson' AR entry (for the
  // old «درس بسيط» passage) is deliberately DELETED, not renamed —
  // exampleTexts.ts's AR entry is now id 'reading' too (same id as the
  // EN entry above, since it's the SAME bilingual passage), but there is
  // NO new Arabic summary/explanation to go with it yet. Inventing one
  // here would cross this codebase's established "route new Arabic
  // prose through nibras-ar" discipline; reusing the EN entry's id
  // without matching AR prose would silently show ENGLISH text to an
  // Arabic reader (the exact bug this lang-scoped lookup below exists to
  // prevent). With no {exampleId:'reading', lang:'ar'} entry present,
  // getDemoAiResponse('reading', 'ar') correctly returns undefined, and
  // AiAssistantPanel.tsx's own existing honest "needs an AI connection"
  // fallback shows — a real feature gap (flagged to team-lead), never a
  // mismatched-language or fabricated one. Add the matching AR entry
  // here once nibras-ar's new Arabic summary/explanation for the
  // 'reading' passage lands.
]

// Scoped by BOTH id AND language, not id alone — exampleTexts.ts's EN
// and AR entries for the same bilingual passage now deliberately SHARE
// one id (e.g. both 'reading'), so an id-only lookup would return
// whichever language's entry happens to appear first in the array
// regardless of which language was actually being read (found live,
// task #231: an id-only version of this function returned the EN
// explanation text for the AR example, since both shared exampleId
// 'reading' and .find() takes the first match — a real content-language
// mismatch, not a test artifact).
export function getDemoAiResponse(exampleId: string, lang: 'en' | 'ar'): DemoAiResponse | undefined {
  return DEMO_AI_RESPONSES.find((r) => r.exampleId === exampleId && r.lang === lang)
}
