/**
 * SERVER-OWNED grounding context for POST /ask (task #369 — the mascot's
 * «اسألني عن الصفحة» grounded page Q&A). The per-page FEATURE FACTS the
 * model is allowed to answer from live here, on the server, NOT sent by
 * the client. That is the core hallucination + integrity guard: a
 * buggy or hostile client can only pick a pageId (validated against this
 * allowlist); it can never inject a fake "feature" for the model to
 * repeat. The client sends {pageId, question}; the real capabilities
 * come from here.
 *
 * The facts are lifted from the honesty-VETTED per-page guide scripts
 * (mascot-scripts.md, task #366 — "only real, shipped behaviour",
 * reviewed for honesty) and, crucially, its explicit "do NOT claim"
 * notes are encoded here as NEGATIVE facts (e.g. the Library holds up to
 * 10 books; turning your own text into a mind map needs the AI
 * connection; device-sync accounts are not available yet). So the model
 * is grounded AGAINST over-claiming, not just toward the feature list.
 * Keep these facts FRESH: they are the /ask hallucination guard, so a
 * stale fact makes the mascot confidently wrong (e.g. the pre-#217
 * "Reading Buddy has no live mic listening" note was corrected on
 * 2026-09-14 once the listening coach shipped).
 *
 * English only, on purpose: the /ask system prompt tells the model to
 * ANSWER in the page's language (see ask.ts) — one compact English
 * context is cheaper than maintaining a parallel Arabic copy, and the
 * short answer is what gets translated, not this reference. (If Arabic
 * answer quality proves weak in review, a per-language context is a
 * small follow-up.)
 *
 * Keyed by the app's real route pathnames (same keys guideMascotScripts
 * uses) so the client can pass the current pathname straight through.
 */

/** The pages that HAVE vetted context — the /ask allowlist. A pathname
 * not in here is refused (400) rather than answered from empty context. */
export type AskPageId =
  | '/'
  | '/dashboard'
  | '/reader'
  | '/techniques'
  | '/mind-maps'
  | '/reading-buddy'
  | '/letter-sounds'
  | '/library'
  | '/profile'
  | '/guide'

export interface PageContext {
  /** Human page name, used in the prompt so the model knows "this page". */
  title: string
  /** Compact real-feature facts (+ negative caveats) for this page. */
  facts: string
}

// Cross-cutting facts true on EVERY page — appended to each page's own
// facts so basic questions ("is it free?", "does it save my data?") are
// answerable anywhere, still only from vetted truth.
export const GENERAL_FACTS = [
  'Nibras is a free, browser-based, bilingual (Arabic and English) reading app for people with dyslexia (it can help other readers too).',
  'It reformats text and reads it aloud to make reading more comfortable. For support with dyslexia itself, a specialist is the right person to help.',
  'No account is needed for the core features.',
  'You can change the background colour on any page; the choice is saved on your own device.',
  'Settings and saved reading stay on your device; Nibras does not send them anywhere.',
].join(' ')

const CONTEXTS: Record<AskPageId, PageContext> = {
  '/': {
    title: 'Welcome (Landing)',
    facts:
      'The welcome page, shown before you enter the app. It introduces Nibras and what it can do, and has a Start button (ابدأ) that opens the app at the Dashboard. From the Dashboard you can reach the Reader, Reading Techniques, Mind Maps, Reading Buddy, Letter Sounds, the Library, and your Profile.',
  },
  '/dashboard': {
    title: 'Dashboard (home)',
    facts:
      'The home page. From here you can open any tool: the Reader, Reading Techniques, Mind Maps, Reading Buddy, Letter Sounds, the Library, and the Profile. It also shows your recent reading activity. Tap any tool card to open it.',
  },
  '/reader': {
    title: 'Reader',
    facts:
      'The main reading tool. Add text by pasting it, typing it, opening a file (PDF, EPUB, or TXT), or opening a book from your Library. Nibras reformats the text to be easier to read. Reading settings let you change the font, text size, line height, line width, word spacing, the text colour, and the reading panel background colour. Letter spacing applies to Latin text only, because Arabic letters join together and spacing them apart would break the letter shapes; for Arabic, use text size, line height, and word spacing instead. For Arabic the fonts are Naskh, Modern, or Kufi; for Latin text there are several fonts including OpenDyslexic, which is a Latin-only font. You can pick any background or text colour from a colour wheel, and Nibras gently warns you if the colours become hard to read. There is an optional reading ruler with two modes: a band that highlights the line under your pointer, or a word-by-word highlight that follows along as the Reading Buddy voice reads. A focus mode hides the rest of the app for distraction-free reading, and an adjustable screen dimmer softens the screen glare. A Reading Buddy reads the text aloud. Settings are saved on your device.',
  },
  '/techniques': {
    title: 'Reading Techniques',
    facts:
      'Short, evidence-based tips to help with reading, focus, and understanding, sorted into three simple groups. Open a tip to read it, and press listen to hear it read aloud.',
  },
  '/mind-maps': {
    title: 'Mind Maps',
    facts:
      'Turns ideas into a visual map: one main idea in the middle with its parts branching around it. You can explore the ready-made example, add your own notes and branches, recolour individual nodes and the map background, zoom in and out, listen to the map, and download it as an image. Turning your OWN pasted text into a new map uses the AI connection and only works when AI is switched on.',
  },
  '/reading-buddy': {
    title: 'Reading Buddy',
    facts:
      'Reads text aloud in a calm voice so you can listen while you read: choose between two voices, change the speed, and paste your own text to hear it. It also has a listening coach that listens as you read aloud through your microphone and gives gentle feedback; nothing you read is ever marked wrong. For English it can follow along word by word, but only on browsers that support private on-device speech, so it is not available everywhere; when it is not, you still get the calm read-aloud. For Arabic it works a sentence at a time, and only when the AI connection is switched on: after you agree to share your microphone, it records what you read and turns it into text, which is used only for this, is never used to train AI, and is deleted within 30 days.',
  },
  '/letter-sounds': {
    title: 'Letter Sounds',
    facts:
      'Helps you learn the sound each letter makes. Tap any letter to hear its sound and see it inside a simple example word. It covers the letters in both Arabic and English, grouped so similar sounds sit together.',
  },
  '/library': {
    title: 'Library',
    facts:
      'Keeps your saved books and files together in one place. Open a file or paste text to add it, then pick it back up where you left off. You can sort books into coloured folders. Everything stays on your device. The Library holds up to 10 books and removes the oldest when it is full.',
  },
  '/profile': {
    title: 'Profile',
    facts:
      'Brings your reading together in one place: your settings, your saved books, and your reading progress, kept private on your device. Accounts to sync across your devices are coming soon and are NOT available yet.',
  },
  '/guide': {
    title: 'Usage Guide (How to use Nibras)',
    facts:
      'Shows a grid of feature tiles; tap any tile to open a short explainer for it, usually a short video with optional captions. A couple of features (Library, AI Assistant) show a short written explainer instead, since they only activate once an account or the AI connection is switched on.',
  },
}

export function isAskPageId(value: unknown): value is AskPageId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONTEXTS, value)
}

export function getAskContext(pageId: AskPageId): PageContext {
  return CONTEXTS[pageId]
}
