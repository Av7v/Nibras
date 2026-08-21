/**
 * «أصوات الحروف» / "Letter Sounds" — the FULL alphabet build (task
 * #118, 2026-08-14, Amal approved #110's visual-slice layout: «قسم
 * الأصوات عجبني»). Content sourced verbatim from the co-signed build
 * spec at teamlead/letter-sounds-build-spec.md (nibras-ar's 28-letter
 * Arabic table + nibras-en's 33-grapheme English tables, phonics-ev's
 * audio-tier sign-off) — every keyword/soundTts/dot/form value below
 * was copied from that document, not re-derived or improvised.
 *
 * Shared card seam (per the spec): `{ grapheme, display, keyword,
 * keywordTts, soundClip?, soundTts?, soundVariants?, forms? }`. This
 * file keeps the same field NAMES #110 already shipped (`display` was
 * never actually a separate field from `soundTts`/`grapheme` in this
 * codebase's own implementation — `grapheme` is the tile glyph,
 * `soundTts` already IS the vocalized "display" form for Arabic, and
 * English's `grapheme` already IS its own undecorated display per the
 * spec's "NO IPA" rule) rather than introducing a redundant `display`
 * field that would just duplicate one of the two.
 *
 * Resolution order for any "hear X" action (unchanged from #110):
 * soundClip -> soundTts -> keywordTts. NO soundClip exists yet for
 * ANY letter — the generate->verify->bundle curated-audio pass is a
 * separate step (team-lead, explicit: "don't block the UI on it").
 * Arabic ships today on live TTS of the diacritized syllable itself
 * (soundTts); English ships on the real keyword word (no soundTts
 * path exists for English at all — see the spec's own "Interim"
 * rule: the sound button honestly plays the keyword, not a faked
 * isolated phoneme, until a real curated clip lands).
 *
 * Scope calls made while building (flagged to team-lead, not silent):
 * 1. #110's `soundsLikeHintKey` ("Sounds like the a in apple") is
 *    DROPPED here, not extended to all 33 English graphemes. It
 *    duplicated the keyword already shown right next to it, isn't in
 *    the #118 spec's own seam mapping, and would have needed its own
 *    adult/standard-mode variant text for the 17 swapped keywords —
 *    real added complexity for content the spec never asked for.
 * 2. The alif/hamza entry (`ا`, id 'alif') deliberately has NO
 *    `soundVariants` — kasra/ḍamma of a bare alif isn't a real,
 *    pronounceable Arabic form the way بِ/بُ etc. are (alif is a
 *    vowel-bearer, not a true consonant); every other Arabic letter
 *    gets the normal pair.
 */

export type LetterSoundLang = 'ar' | 'en'
export type DotPosition = 'above' | 'below'

export interface LetterSoundVariant {
  /** Visible chip text, e.g. "بِ". */
  label: string
  /** What gets spoken for this specific chip. */
  tts: string
}

export interface LetterPositionalForm {
  /** i18n key for this position's short label ("Isolated"/"Initial"/…). */
  positionLabelKey: string
  glyph: string
}

export interface LetterSound {
  id: string
  /** The letter/digraph itself — the big glyph shown on the tile. */
  grapheme: string
  /** A real word containing the sound — shown + spoken, never the bare
   * letter name. The STANDARD-mode word (English) or the only word
   * (Arabic, no mode toggle). */
  keyword: string
  keywordTts: string
  /** English only: the ADULT-mode keyword swap. Undefined = this
   * grapheme "keeps" the same keyword in both modes (per the spec's
   * own "17 swaps, 16 keeps" table) — the UI falls back to
   * `keyword`/`keywordTts` whenever these are unset, so a "keep" entry
   * needs no duplicate data at all. */
  keywordAdult?: string
  keywordTtsAdult?: string
  /** Not yet authored for any entry — the curated-audio pass is a
   * separate step (see this file's own header). Kept in the shape so
   * wiring a real clip later is a pure data change, zero component
   * change (the resolution order already checks this first). */
  soundClip?: string
  /** Arabic only: the primary (fatḥa) syllable, spoken text. */
  soundTts?: string
  /** Arabic only: the OTHER syllables (kasra, ḍamma) — NOT the primary
   * one, which lives in `soundTts` above. Absent for the alif/hamza
   * entry (see this file's own header, scope call #2). */
  soundVariants?: LetterSoundVariant[]
  /** Arabic only: positional allographs, shown in the "see it in a
   * word" expander. 4 entries (isolated/initial/medial/final) for a
   * normal connecting letter; exactly 2 (isolated/final) for the 6
   * non-connectors (ا د ذ ر ز و) — real, not fabricated, per the spec's
   * own explicit rule. */
  forms?: LetterPositionalForm[]
  /** How many dots distinguish this letter within its rasm-family — 0
   * for "no dots". Arabic only; drives the family/dot-count-and-
   * position caption (dyslexia dot-confusion is a top-2 error source
   * per the spec, hence tracking POSITION too, not just count). */
  dotCount?: number
  /** Omitted whenever dotCount is 0/undefined — a letter with no dots
   * has no position to speak of. */
  dotPosition?: DotPosition
}

export interface LetterSoundGroup {
  id: string
  /** i18n key for the group heading (e.g. "the ب family", "Letters"). */
  labelKey: string
  letters: LetterSound[]
}

// ---------------------------------------------------------------------
// Arabic — 28 letters, rasm-family order (nibras-ar's table order IS
// standard Arabic alphabetical order — the modern abjad's own ordering
// already clusters same-skeleton letters together, e.g. ب ت ث, ج ح خ,
// س ش — so no separate reshuffling was needed, just grouping the
// table's own rows into their natural family clusters).
// ---------------------------------------------------------------------

const KASRA = 'ِ'
const DAMMA = 'ُ'

/** Normal 4-form connector (isolated/initial/medial/final), built from
 * tatweel-joined sequences (ب + ـ = بـ, etc.) — REAL Arabic text
 * shaping via the font's own OpenType joining rules, not hand-picked
 * Presentation-Forms codepoints (the spec's own explicit instruction:
 * "font-shaped from the base letter — don't hand-type presentation
 * glyphs"). Same technique #110 already shipped and had reviewed for
 * ب/ت/س/ش/ع/ص — extended here to every connecting letter. */
function connectorForms(grapheme: string): LetterPositionalForm[] {
  return [
    { positionLabelKey: 'letterSounds.positionIsolated', glyph: grapheme },
    { positionLabelKey: 'letterSounds.positionInitial', glyph: `${grapheme}ـ` },
    { positionLabelKey: 'letterSounds.positionMedial', glyph: `ـ${grapheme}ـ` },
    { positionLabelKey: 'letterSounds.positionFinal', glyph: `ـ${grapheme}` },
  ]
}

/** The 6 non-connectors (ا د ذ ر ز و) only ever join to a PRECEDING
 * letter, never to a following one — 2 real shapes, not 4 fabricated
 * ones (spec, explicit). */
function nonConnectorForms(grapheme: string): LetterPositionalForm[] {
  return [
    { positionLabelKey: 'letterSounds.positionIsolated', glyph: grapheme },
    { positionLabelKey: 'letterSounds.positionFinal', glyph: `ـ${grapheme}` },
  ]
}

/** Kasra/ḍamma variant pair — mechanical, rule-based (base letter +
 * one combining mark), generated rather than hand-typed 27×2 times to
 * remove transcription risk on linguistically-sensitive content;
 * codepoints self-verified against #110's own already-reviewed ب
 * entry before use (U+0650 kasra, U+064F ḍamma). NOT used for the
 * alif/hamza entry — see this file's header. */
function kasraDammaVariants(grapheme: string): LetterSoundVariant[] {
  const kasraForm = `${grapheme}${KASRA}`
  const dammaForm = `${grapheme}${DAMMA}`
  return [
    { label: kasraForm, tts: kasraForm },
    { label: dammaForm, tts: dammaForm },
  ]
}

export const ARABIC_LETTER_GROUPS: LetterSoundGroup[] = [
  {
    id: 'alif-hamza',
    labelKey: 'letterSounds.groupAlifHamza',
    letters: [
      {
        // Teaches the HAMZA (glottal stop) via أَ — alif's own long-
        // vowel role (ā) is a later layer (spec). No soundVariants:
        // a bare alif can't take kasra/ḍamma the way a real consonant
        // does (see this file's header, scope call #2).
        id: 'alif',
        grapheme: 'ا',
        keyword: 'أَسَد',
        keywordTts: 'أَسَد',
        soundTts: 'أَ',
        forms: nonConnectorForms('ا'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'ba-family',
    labelKey: 'letterSounds.groupBaFamily',
    letters: [
      {
        id: 'ba',
        grapheme: 'ب',
        keyword: 'بَطّة',
        keywordTts: 'بَطّة',
        soundTts: 'بَ',
        soundVariants: kasraDammaVariants('ب'),
        forms: connectorForms('ب'),
        dotCount: 1,
        dotPosition: 'below',
      },
      {
        id: 'ta',
        grapheme: 'ت',
        keyword: 'تُفّاحة',
        keywordTts: 'تُفّاحة',
        soundTts: 'تَ',
        soundVariants: kasraDammaVariants('ت'),
        forms: connectorForms('ت'),
        dotCount: 2,
        dotPosition: 'above',
      },
      {
        id: 'tha',
        grapheme: 'ث',
        keyword: 'ثَعْلَب',
        keywordTts: 'ثَعْلَب',
        soundTts: 'ثَ',
        soundVariants: kasraDammaVariants('ث'),
        forms: connectorForms('ث'),
        dotCount: 3,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'jeem-family',
    labelKey: 'letterSounds.groupJeemFamily',
    letters: [
      {
        id: 'jeem',
        grapheme: 'ج',
        keyword: 'جَمَل',
        keywordTts: 'جَمَل',
        soundTts: 'جَ',
        soundVariants: kasraDammaVariants('ج'),
        forms: connectorForms('ج'),
        dotCount: 1,
        dotPosition: 'below',
      },
      {
        id: 'ha-pharyngeal',
        grapheme: 'ح',
        keyword: 'حِصان',
        keywordTts: 'حِصان',
        soundTts: 'حَ',
        soundVariants: kasraDammaVariants('ح'),
        forms: connectorForms('ح'),
        dotCount: 0,
      },
      {
        id: 'kha',
        grapheme: 'خ',
        keyword: 'خَروف',
        keywordTts: 'خَروف',
        soundTts: 'خَ',
        soundVariants: kasraDammaVariants('خ'),
        forms: connectorForms('خ'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'dal-family',
    labelKey: 'letterSounds.groupDalFamily',
    letters: [
      {
        id: 'dal',
        grapheme: 'د',
        keyword: 'دُبّ',
        keywordTts: 'دُبّ',
        soundTts: 'دَ',
        soundVariants: kasraDammaVariants('د'),
        forms: nonConnectorForms('د'),
        dotCount: 0,
      },
      {
        id: 'thal',
        grapheme: 'ذ',
        keyword: 'ذِئْب',
        keywordTts: 'ذِئْب',
        soundTts: 'ذَ',
        soundVariants: kasraDammaVariants('ذ'),
        forms: nonConnectorForms('ذ'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'ra-family',
    labelKey: 'letterSounds.groupRaFamily',
    letters: [
      {
        id: 'ra',
        grapheme: 'ر',
        keyword: 'رُمّان',
        keywordTts: 'رُمّان',
        soundTts: 'رَ',
        soundVariants: kasraDammaVariants('ر'),
        forms: nonConnectorForms('ر'),
        dotCount: 0,
      },
      {
        id: 'zay',
        grapheme: 'ز',
        keyword: 'زَرافة',
        keywordTts: 'زَرافة',
        soundTts: 'زَ',
        soundVariants: kasraDammaVariants('ز'),
        forms: nonConnectorForms('ز'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'seen-family',
    labelKey: 'letterSounds.groupSeenFamily',
    letters: [
      {
        id: 'seen',
        grapheme: 'س',
        keyword: 'سَمَكة',
        keywordTts: 'سَمَكة',
        soundTts: 'سَ',
        soundVariants: kasraDammaVariants('س'),
        forms: connectorForms('س'),
        dotCount: 0,
      },
      {
        id: 'sheen',
        grapheme: 'ش',
        keyword: 'شَمْس',
        keywordTts: 'شَمْس',
        soundTts: 'شَ',
        soundVariants: kasraDammaVariants('ش'),
        forms: connectorForms('ش'),
        dotCount: 3,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'sad-family',
    labelKey: 'letterSounds.groupSadFamily',
    letters: [
      {
        id: 'sad',
        grapheme: 'ص',
        keyword: 'صَقْر',
        keywordTts: 'صَقْر',
        soundTts: 'صَ',
        soundVariants: kasraDammaVariants('ص'),
        forms: connectorForms('ص'),
        dotCount: 0,
      },
      {
        id: 'dad',
        grapheme: 'ض',
        keyword: 'ضِفْدَع',
        keywordTts: 'ضِفْدَع',
        soundTts: 'ضَ',
        soundVariants: kasraDammaVariants('ض'),
        forms: connectorForms('ض'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'taa-family',
    labelKey: 'letterSounds.groupTaaFamily',
    letters: [
      {
        id: 'taa',
        grapheme: 'ط',
        keyword: 'طائِر',
        keywordTts: 'طائِر',
        soundTts: 'طَ',
        soundVariants: kasraDammaVariants('ط'),
        forms: connectorForms('ط'),
        dotCount: 0,
      },
      {
        id: 'dhaa',
        grapheme: 'ظ',
        keyword: 'ظَبْي',
        keywordTts: 'ظَبْي',
        soundTts: 'ظَ',
        soundVariants: kasraDammaVariants('ظ'),
        forms: connectorForms('ظ'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'ain-family',
    labelKey: 'letterSounds.groupAinFamily',
    letters: [
      {
        id: 'ain',
        grapheme: 'ع',
        keyword: 'عَيْن',
        keywordTts: 'عَيْن',
        soundTts: 'عَ',
        soundVariants: kasraDammaVariants('ع'),
        forms: connectorForms('ع'),
        dotCount: 0,
      },
      {
        id: 'ghain',
        grapheme: 'غ',
        keyword: 'غُراب',
        keywordTts: 'غُراب',
        soundTts: 'غَ',
        soundVariants: kasraDammaVariants('غ'),
        forms: connectorForms('غ'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'fa-family',
    labelKey: 'letterSounds.groupFaFamily',
    letters: [
      {
        id: 'fa',
        grapheme: 'ف',
        keyword: 'فيل',
        keywordTts: 'فيل',
        soundTts: 'فَ',
        soundVariants: kasraDammaVariants('ف'),
        forms: connectorForms('ف'),
        dotCount: 1,
        dotPosition: 'above',
      },
      {
        id: 'qaf',
        grapheme: 'ق',
        keyword: 'قَمَر',
        keywordTts: 'قَمَر',
        soundTts: 'قَ',
        soundVariants: kasraDammaVariants('ق'),
        forms: connectorForms('ق'),
        dotCount: 2,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'kaf',
    labelKey: 'letterSounds.groupKaf',
    letters: [
      {
        id: 'kaf',
        grapheme: 'ك',
        keyword: 'كِتاب',
        keywordTts: 'كِتاب',
        soundTts: 'كَ',
        soundVariants: kasraDammaVariants('ك'),
        forms: connectorForms('ك'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'lam',
    labelKey: 'letterSounds.groupLam',
    letters: [
      {
        // The لا (lām-alif) ligature is a real, automatic font-shaping
        // behaviour whenever ل is followed by ا in actual text — no
        // special data/UI handling needed here since none of this
        // card's own strings happen to contain that exact sequence;
        // the font (Noto Naskh Arabic) renders it correctly on its own
        // wherever it genuinely occurs.
        id: 'lam',
        grapheme: 'ل',
        keyword: 'لَيْمون',
        keywordTts: 'لَيْمون',
        soundTts: 'لَ',
        soundVariants: kasraDammaVariants('ل'),
        forms: connectorForms('ل'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'meem',
    labelKey: 'letterSounds.groupMeem',
    letters: [
      {
        id: 'meem',
        grapheme: 'م',
        keyword: 'مَوْز',
        keywordTts: 'مَوْز',
        soundTts: 'مَ',
        soundVariants: kasraDammaVariants('م'),
        forms: connectorForms('م'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'noon',
    labelKey: 'letterSounds.groupNoon',
    letters: [
      {
        id: 'noon',
        grapheme: 'ن',
        keyword: 'نَحلة',
        keywordTts: 'نَحلة',
        soundTts: 'نَ',
        soundVariants: kasraDammaVariants('ن'),
        forms: connectorForms('ن'),
        dotCount: 1,
        dotPosition: 'above',
      },
    ],
  },
  {
    id: 'ha',
    labelKey: 'letterSounds.groupHa',
    letters: [
      {
        id: 'ha',
        grapheme: 'ه',
        keyword: 'هُدْهُد',
        keywordTts: 'هُدْهُد',
        soundTts: 'هَ',
        soundVariants: kasraDammaVariants('ه'),
        forms: connectorForms('ه'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'waw',
    labelKey: 'letterSounds.groupWaw',
    letters: [
      {
        // Diacritized وَ forces the CONSONANT /w/ reading — the long-
        // vowel (ū) role is a later layer (spec, build-only IPA note).
        id: 'waw',
        grapheme: 'و',
        keyword: 'وَرْدة',
        keywordTts: 'وَرْدة',
        soundTts: 'وَ',
        soundVariants: kasraDammaVariants('و'),
        forms: nonConnectorForms('و'),
        dotCount: 0,
      },
    ],
  },
  {
    id: 'ya',
    labelKey: 'letterSounds.groupYa',
    letters: [
      {
        // Diacritized يَ forces the CONSONANT /j/ reading — same
        // dual-role note as waw above.
        id: 'ya',
        grapheme: 'ي',
        keyword: 'يَد',
        keywordTts: 'يَد',
        soundTts: 'يَ',
        soundVariants: kasraDammaVariants('ي'),
        forms: connectorForms('ي'),
        dotCount: 2,
        dotPosition: 'below',
      },
    ],
  },
]

// ---------------------------------------------------------------------
// English — Tier A (26 single-letter primary sounds, SSP order given
// in the # column) + Tier B (7 "letter teams" = digraphs). Standard/
// adult keyword swap per the spec's own table (17 swaps, 16 keeps).
// ---------------------------------------------------------------------

export const ENGLISH_TIER_A: LetterSoundGroup = {
  id: 'tier-a',
  labelKey: 'letterSounds.tierLetters',
  letters: [
    { id: 'a', grapheme: 'a', keyword: 'apple', keywordTts: 'apple' },
    { id: 'b', grapheme: 'b', keyword: 'ball', keywordTts: 'ball', keywordAdult: 'bridge', keywordTtsAdult: 'bridge' },
    { id: 'c', grapheme: 'c', keyword: 'cat', keywordTts: 'cat', keywordAdult: 'coffee', keywordTtsAdult: 'coffee' },
    { id: 'd', grapheme: 'd', keyword: 'dog', keywordTts: 'dog', keywordAdult: 'desk', keywordTtsAdult: 'desk' },
    { id: 'e', grapheme: 'e', keyword: 'egg', keywordTts: 'egg', keywordAdult: 'envelope', keywordTtsAdult: 'envelope' },
    { id: 'f', grapheme: 'f', keyword: 'fish', keywordTts: 'fish', keywordAdult: 'file', keywordTtsAdult: 'file' },
    { id: 'g', grapheme: 'g', keyword: 'goat', keywordTts: 'goat', keywordAdult: 'garden', keywordTtsAdult: 'garden' },
    { id: 'h', grapheme: 'h', keyword: 'hat', keywordTts: 'hat', keywordAdult: 'house', keywordTtsAdult: 'house' },
    { id: 'i', grapheme: 'i', keyword: 'igloo', keywordTts: 'igloo', keywordAdult: 'ink', keywordTtsAdult: 'ink' },
    { id: 'j', grapheme: 'j', keyword: 'jam', keywordTts: 'jam', keywordAdult: 'jacket', keywordTtsAdult: 'jacket' },
    // Shares /k/ with c — a future curated clip reuses c's, not a new one (spec).
    { id: 'k', grapheme: 'k', keyword: 'kite', keywordTts: 'kite', keywordAdult: 'key', keywordTtsAdult: 'key' },
    { id: 'l', grapheme: 'l', keyword: 'leaf', keywordTts: 'leaf', keywordAdult: 'lamp', keywordTtsAdult: 'lamp' },
    { id: 'm', grapheme: 'm', keyword: 'moon', keywordTts: 'moon' },
    { id: 'n', grapheme: 'n', keyword: 'nest', keywordTts: 'nest', keywordAdult: 'needle', keywordTtsAdult: 'needle' },
    { id: 'o', grapheme: 'o', keyword: 'orange', keywordTts: 'orange' },
    // Deliberately "pen", not "pig" — pork-imagery sensitivity in a
    // Saudi context (spec, explicit).
    { id: 'p', grapheme: 'p', keyword: 'pen', keywordTts: 'pen' },
    { id: 'q', grapheme: 'q', keyword: 'queen', keywordTts: 'queen' },
    { id: 'r', grapheme: 'r', keyword: 'rabbit', keywordTts: 'rabbit', keywordAdult: 'radio', keywordTtsAdult: 'radio' },
    { id: 's', grapheme: 's', keyword: 'sun', keywordTts: 'sun' },
    { id: 't', grapheme: 't', keyword: 'tap', keywordTts: 'tap', keywordAdult: 'table', keywordTtsAdult: 'table' },
    { id: 'u', grapheme: 'u', keyword: 'umbrella', keywordTts: 'umbrella' },
    { id: 'v', grapheme: 'v', keyword: 'van', keywordTts: 'van' },
    { id: 'w', grapheme: 'w', keyword: 'web', keywordTts: 'web', keywordAdult: 'wallet', keywordTtsAdult: 'wallet' },
    // /ks/ is FINAL (bo-x) — x is rarely word-initial (spec note).
    { id: 'x', grapheme: 'x', keyword: 'box', keywordTts: 'box' },
    { id: 'y', grapheme: 'y', keyword: 'yo-yo', keywordTts: 'yo-yo', keywordAdult: 'yacht', keywordTtsAdult: 'yacht' },
    { id: 'z', grapheme: 'z', keyword: 'zip', keywordTts: 'zip' },
  ],
}

export const ENGLISH_TIER_B: LetterSoundGroup = {
  id: 'tier-b',
  labelKey: 'letterSounds.tierLetterTeams',
  letters: [
    { id: 'sh', grapheme: 'sh', keyword: 'ship', keywordTts: 'ship' },
    { id: 'ch', grapheme: 'ch', keyword: 'chair', keywordTts: 'chair' },
    // Both th's are in v1 (unvoiced /θ/ + voiced /ð/) — genuinely
    // different sounds, same spelling; ids disambiguate them.
    { id: 'th-unvoiced', grapheme: 'th', keyword: 'thumb', keywordTts: 'thumb' },
    { id: 'th-voiced', grapheme: 'th', keyword: 'feather', keywordTts: 'feather' },
    // FINAL only — never starts a word (spec note).
    { id: 'ng', grapheme: 'ng', keyword: 'ring', keywordTts: 'ring' },
    // Spelling pattern (/k/ after a short vowel) — reuses /k/'s future
    // clip, adds zero new sounds; still swaps in adult mode (spec).
    { id: 'ck', grapheme: 'ck', keyword: 'duck', keywordTts: 'duck', keywordAdult: 'clock', keywordTtsAdult: 'clock' },
    // Spelling pattern (q+u) — reuses /kw/'s future clip.
    { id: 'qu', grapheme: 'qu', keyword: 'queen', keywordTts: 'queen' },
    // ----- Vowel teams (Phase-3 SSP order), en-GB targets -----
    { id: 'ai', grapheme: 'ai', keyword: 'rain', keywordTts: 'rain' },
    { id: 'ee', grapheme: 'ee', keyword: 'tree', keywordTts: 'tree' },
    { id: 'igh', grapheme: 'igh', keyword: 'light', keywordTts: 'light' },
    { id: 'oa', grapheme: 'oa', keyword: 'boat', keywordTts: 'boat' },
    { id: 'oo-long', grapheme: 'oo', keyword: 'spoon', keywordTts: 'spoon' },
    { id: 'oo-short', grapheme: 'oo', keyword: 'book', keywordTts: 'book' },
    { id: 'ar', grapheme: 'ar', keyword: 'car', keywordTts: 'car' },
    { id: 'or', grapheme: 'or', keyword: 'fork', keywordTts: 'fork' },
    { id: 'ur', grapheme: 'ur', keyword: 'nurse', keywordTts: 'nurse' },
    { id: 'er', grapheme: 'er', keyword: 'letter', keywordTts: 'letter' },
    { id: 'ow', grapheme: 'ow', keyword: 'cow', keywordTts: 'cow', keywordAdult: 'town', keywordTtsAdult: 'town' },
    { id: 'oi', grapheme: 'oi', keyword: 'coin', keywordTts: 'coin' },
    { id: 'oy', grapheme: 'oy', keyword: 'boy', keywordTts: 'boy' },
    { id: 'ou', grapheme: 'ou', keyword: 'cloud', keywordTts: 'cloud' },
    { id: 'air', grapheme: 'air', keyword: 'hair', keywordTts: 'hair' },
    { id: 'ear', grapheme: 'ear', keyword: 'ear', keywordTts: 'ear' },
    { id: 'wh', grapheme: 'wh', keyword: 'whale', keywordTts: 'whale' },
    { id: 'ph', grapheme: 'ph', keyword: 'phone', keywordTts: 'phone' },
  ],
}

export const ENGLISH_LETTER_GROUPS: LetterSoundGroup[] = [ENGLISH_TIER_A, ENGLISH_TIER_B]
