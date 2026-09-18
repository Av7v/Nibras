/**
 * Pre-loaded example reading texts, offered in the Reader before a
 * guest has opened anything of their own (Amal: "أضفت الأمثلة الي
 * بنبراس الأصلي للقراءة وأي مستخدم زائر يقدر يمسحها ويحط نص من عنده" —
 * examples a guest can try, then clear and replace with their own).
 *
 * Original, calm, tasteful passages — the original nibrasapp.com's
 * exact demo text isn't available and isn't needed; these are written
 * fresh, in the spirit of the Reader's own existing sample text
 * (reader.sampleText). One is English, one is Arabic — "bilingual" here
 * means the SET covers both scripts, not that each individual example
 * is itself translated both ways (each stays in its own language, same
 * as any real document a reader opens).
 *
 * `title` and `text` are fixed plain strings, not i18n keys — like a
 * real PDF/EPUB's title, this is CONTENT tied to one specific
 * language, not UI chrome that should follow the interface language.
 */
export interface ExampleText {
  id: string
  title: string
  text: string
  lang: 'en' | 'ar'
}

// Task #231 (2026-08-19, elevated pass same day) — Amal-approved,
// blessed by both language specialists as TTS/tap-word-clean (plain
// commas/periods, common words, no em-dashes, homograph-free) for
// Reading Buddy's read-aloud + tap-a-word practice. Shares the SAME id
// (both filtered by `.lang` before ever being shown together, so no
// key-collision risk in practice). This file is also the Reader's own
// "try an example" source (see the file header above) — that surface
// picks this up too, not just Reading Buddy.
//
// Elevated pass, same day: Amal found the first version's Arabic too
// plain («ركيك») — nibras-ar rewrote it in eloquent فصحى بليغة, English
// re-translated to match; the targeted tashkeel below (العالَم/ضياءً/
// تمهّل/تذوّق) is deliberate and must be kept exactly as given, not
// simplified away.
export const EXAMPLE_TEXTS: ExampleText[] = [
  {
    id: 'reading',
    title: 'Reading',
    lang: 'en',
    text: 'Reading is a light that brightens the mind, and a door that opens endless worlds to the soul. With every page your horizons widen, and the world grows greater in your eyes. Take your time as you read, for its beauty lies in savouring each word, not in rushing to the end. Read with love, and in every line you will find a radiance that carries you further than you ever imagined.',
  },
  {
    id: 'reading',
    title: 'القراءة',
    lang: 'ar',
    text: 'القراءة نور يضيء الفكر، وباب يفتح للروح عوالم لا حد لها. ومع كل صفحة تتسع آفاقك، ويكبر العالَم في عينيك. تمهّل في قراءتك، فجمالها في تذوّق كل كلمة، لا في سرعة الوصول. اقرأ بحب، تجد في كل سطر ضياءً يقودك إلى أبعد مما تتخيل.',
  },
]
