/**
 * Hand-authored DEMO mind maps — one per TECHNIQUE in content/techniques.ts
 * (all 13 techniques, across all 3 categories; f5 "Slow your breathing"
 * added 2026-08-19 so the consolidated techniques map has no childless
 * leaf), replacing the earlier 2 generic
 * example-text maps (Amal, 2026-08-13: "the Mind Maps examples become
 * the actual educational techniques"). Each root is the technique's own
 * title; branches are short phrases distilled from that technique's
 * `steps` + `whyItHelps` — genuine mind-map style (short phrases, not
 * full sentences), not a verbatim copy of the how-to prose.
 *
 * Bilingual per-map (a real change from the old shape): each technique
 * already has both `en`/`ar` copy in content/techniques.ts, so its
 * mind map follows the CURRENT UI language rather than being locked to
 * one language — MindMaps.tsx passes whichever `lang` the interface is
 * in. Node ids are IDENTICAL across a map's `en`/`ar` trees on purpose
 * — a note or edit made on a node while browsing in English still
 * applies to "the same idea" if you switch to Arabic, since notes/
 * edits (useMindMapNotes/useMindMapEdits) are keyed by techniqueId+
 * nodeId, not by language.
 *
 * Real generation (any text, via an LLM) wires to lib/aiService.ts's
 * generateMindMap() once an AI backend is keyed — see MindMaps.tsx for
 * how a document that ISN'T one of these 12 techniques shows an honest
 * "needs an AI key" state instead of a fake map.
 *
 * Build flexibly per Amal's note ("may later narrow to the القراءة
 * category only"): every entry already carries an implicit category
 * via its techniqueId prefix (r=reading, c=comprehension, f=focus,
 * matching content/techniques.ts's own ids) — MindMaps.tsx groups the
 * picker by TECHNIQUES' own `category` field, so narrowing to one
 * category later is a one-line filter change there, not a content
 * rewrite here.
 */

export interface MindMapTreeNode {
  id: string
  label: string
  children?: MindMapTreeNode[]
}

export interface DemoMindMap {
  /** Matches an id in content/techniques.ts. */
  techniqueId: string
  en: MindMapTreeNode
  ar: MindMapTreeNode
}

export const DEMO_MIND_MAPS: DemoMindMap[] = [
  // ---------- READING · القراءة ----------
  {
    techniqueId: 'r1',
    en: {
      id: 'root',
      label: 'Read while listening',
      children: [
        { id: 'step1', label: 'Open in Reading Buddy' },
        { id: 'step2', label: 'Follow along as you listen' },
        { id: 'step3', label: 'Slow down if needed' },
        { id: 'why', label: 'Strengthens the letter-sound link' },
      ],
    },
    ar: {
      id: 'root',
      label: 'اقرأ وأنت تستمع',
      children: [
        { id: 'step1', label: 'افتح في رفيق القراءة' },
        { id: 'step2', label: 'تابع الكلمات وأنت تستمع' },
        { id: 'step3', label: 'أبطئ عند الحاجة' },
        { id: 'why', label: 'يقوّي الرابط بين الحرف وصوته' },
      ],
    },
  },
  {
    techniqueId: 'r2',
    en: {
      id: 'root',
      label: 'Give the text room to breathe',
      children: [
        { id: 'step1', label: 'Wider line spacing' },
        { id: 'step2', label: 'Clear gaps between paragraphs' },
        { id: 'step3', label: 'Keep paragraphs short' },
        { id: 'why', label: 'Less visual crowding' },
      ],
    },
    ar: {
      id: 'root',
      label: 'أعطِ النص مساحةً ليتنفّس',
      children: [
        { id: 'step1', label: 'تباعد أوسع بين الأسطر' },
        { id: 'step2', label: 'فراغ واضح بين الفقرات' },
        { id: 'step3', label: 'فقرات قصيرة' },
        { id: 'why', label: 'ازدحام بصري أقل' },
      ],
    },
  },
  {
    techniqueId: 'r3',
    en: {
      id: 'root',
      label: 'Shorten the line',
      children: [
        { id: 'step1', label: 'Narrower reading column' },
        { id: 'step2', label: 'About 60-70 characters' },
        { id: 'step3', label: 'Left-aligned, not stretched' },
        { id: 'why', label: 'Eye finds the next line faster' },
      ],
    },
    ar: {
      id: 'root',
      label: 'قصّر طول السطر',
      children: [
        { id: 'step1', label: 'عمود قراءة أضيق' },
        { id: 'step2', label: 'نحو 60 إلى 70 حرفًا' },
        { id: 'step3', label: 'محاذاة إلى جهة واحدة' },
        { id: 'why', label: 'العين تجد السطر التالي أسرع' },
      ],
    },
  },
  {
    techniqueId: 'r4',
    en: {
      id: 'root',
      label: 'Make the text yours',
      children: [
        { id: 'step1', label: 'Make it larger' },
        { id: 'step2', label: 'Try a clearer font' },
        { id: 'step3', label: 'Pick a soft background' },
        { id: 'why', label: "Everyone's needs are different" },
      ],
    },
    ar: {
      id: 'root',
      label: 'اجعل النص على مقاسك',
      children: [
        { id: 'step1', label: 'كبّره' },
        { id: 'step2', label: 'جرّب خطًا أوضح' },
        { id: 'step3', label: 'اختر خلفية هادئة' },
        { id: 'why', label: 'احتياجات كل شخص تختلف' },
      ],
    },
  },

  // ---------- COMPREHENSION · الفهم ----------
  {
    techniqueId: 'c1',
    en: {
      id: 'root',
      label: 'Read in small chunks',
      children: [
        { id: 'step1', label: 'Split into short sections' },
        { id: 'step2', label: 'Read one, then pause' },
        { id: 'step3', label: 'Check you understood it' },
        { id: 'why', label: 'Fits inside working memory' },
      ],
    },
    ar: {
      id: 'root',
      label: 'اقرأ النص على مقاطع صغيرة',
      children: [
        { id: 'step1', label: 'قسّم إلى مقاطع قصيرة' },
        { id: 'step2', label: 'اقرأ مقطعًا ثم توقف' },
        { id: 'step3', label: 'تأكد من فهمك' },
        { id: 'why', label: 'يناسب الذاكرة العاملة' },
      ],
    },
  },
  {
    techniqueId: 'c2',
    en: {
      id: 'root',
      label: 'Look before you read',
      children: [
        { id: 'step1', label: 'Read title and headings' },
        { id: 'step2', label: 'Glance at pictures & bold words' },
        { id: 'step3', label: 'Guess the topic first' },
        { id: 'why', label: 'Activates what you already know' },
      ],
    },
    ar: {
      id: 'root',
      label: 'تصفّح قبل أن تقرأ',
      children: [
        { id: 'step1', label: 'اقرأ العنوان والعناوين الفرعية' },
        { id: 'step2', label: 'ألقِ نظرة على الصور والبارز' },
        { id: 'step3', label: 'خمّن الموضوع أولًا' },
        { id: 'why', label: 'ينشّط معرفتك السابقة' },
      ],
    },
  },
  {
    techniqueId: 'c3',
    en: {
      id: 'root',
      label: 'Say it in your own words',
      children: [
        { id: 'step1', label: 'Read a short part' },
        { id: 'step2', label: 'Look away from the text' },
        { id: 'step3', label: 'Retell it in 1-2 sentences' },
        { id: 'why', label: 'Forces you to build real meaning' },
      ],
    },
    ar: {
      id: 'root',
      label: 'أعد صياغته بكلماتك',
      children: [
        { id: 'step1', label: 'اقرأ جزءًا قصيرًا' },
        { id: 'step2', label: 'ارفع نظرك عن النص' },
        { id: 'step3', label: 'أعد سرده بجملة أو جملتين' },
        { id: 'why', label: 'يُلزمك ببناء معنى حقيقي' },
      ],
    },
  },
  {
    techniqueId: 'c4',
    en: {
      id: 'root',
      label: 'Map the ideas',
      children: [
        { id: 'step1', label: 'Main idea in the middle' },
        { id: 'step2', label: 'Branch out key points' },
        { id: 'step3', label: 'Link connected ideas' },
        { id: 'why', label: 'Shows structure a wall of text hides' },
      ],
    },
    ar: {
      id: 'root',
      label: 'ارسم خريطةً للأفكار',
      children: [
        { id: 'step1', label: 'الفكرة الرئيسة في المنتصف' },
        { id: 'step2', label: 'فرّع النقاط المهمة' },
        { id: 'step3', label: 'صِل بين الأفكار المترابطة' },
        { id: 'why', label: 'يُظهر بنية يخفيها النص المتصل' },
      ],
    },
  },

  // ---------- FOCUS · التركيز ----------
  {
    techniqueId: 'f1',
    en: {
      id: 'root',
      label: 'Focus sprints',
      children: [
        { id: 'step1', label: 'Pick one small task' },
        { id: 'step2', label: 'Set a short timer' },
        { id: 'step3', label: 'Take a brief break after' },
        { id: 'why', label: 'Resets your attention' },
      ],
    },
    ar: {
      id: 'root',
      label: 'جلسات تركيز قصيرة',
      children: [
        { id: 'step1', label: 'اختر مهمة صغيرة' },
        { id: 'step2', label: 'اضبط مؤقتًا قصيرًا' },
        { id: 'step3', label: 'خذ استراحة قصيرة بعده' },
        { id: 'why', label: 'يُعيد ضبط انتباهك' },
      ],
    },
  },
  {
    techniqueId: 'f2',
    en: {
      id: 'root',
      label: 'Clear the clutter',
      children: [
        { id: 'step1', label: 'Close extra tabs' },
        { id: 'step2', label: 'Put the phone out of reach' },
        { id: 'step3', label: "Hide what you don't need now" },
        { id: 'why', label: 'Lowers the demand on attention' },
      ],
    },
    ar: {
      id: 'root',
      label: 'أبعِد المشتّتات',
      children: [
        { id: 'step1', label: 'أغلق النوافذ الزائدة' },
        { id: 'step2', label: 'ضع الهاتف بعيدًا' },
        { id: 'step3', label: 'أخفِ ما لا تحتاجه الآن' },
        { id: 'why', label: 'يقلّل الضغط على الانتباه' },
      ],
    },
  },
  {
    techniqueId: 'f3',
    en: {
      id: 'root',
      label: 'One task at a time',
      children: [
        { id: 'step1', label: 'Choose the task that matters most' },
        { id: 'step2', label: 'Finish or reach a stopping point' },
        { id: 'step3', label: 'Only then move on' },
        { id: 'why', label: 'Avoids the hidden cost of switching' },
      ],
    },
    ar: {
      id: 'root',
      label: 'مهمّة واحدة في كل مرّة',
      children: [
        { id: 'step1', label: 'اختر المهمّة الأهمّ' },
        { id: 'step2', label: 'أنجزها أو صِل إلى نقطة توقف' },
        { id: 'step3', label: 'عندها فقط انتقل' },
        { id: 'why', label: 'يتجنّب كلفة التنقّل الخفية' },
      ],
    },
  },
  {
    techniqueId: 'f4',
    en: {
      id: 'root',
      label: 'Keep your place',
      children: [
        { id: 'step1', label: 'Finger or cursor under the words' },
        { id: 'step2', label: 'Move it steadily along the line' },
        { id: 'step3', label: 'A ruler can cover lines below' },
        { id: 'why', label: 'Helps some readers a lot' },
      ],
    },
    ar: {
      id: 'root',
      label: 'تتبّع موضعك أثناء القراءة',
      children: [
        { id: 'step1', label: 'إصبعك أو المؤشر تحت الكلمات' },
        { id: 'step2', label: 'حرّكه بثبات على السطر' },
        { id: 'step3', label: 'مسطرة تغطي السطور الأسفل' },
        { id: 'why', label: 'تساعد بعض القراء كثيرًا' },
      ],
    },
  },
  {
    techniqueId: 'f5',
    en: {
      id: 'root',
      label: 'Slow your breathing',
      children: [
        { id: 'step1', label: 'Open Calmness and set the pace' },
        { id: 'step2', label: 'Breathe in 4, out 6' },
        { id: 'step3', label: 'Keep the rhythm about five minutes' },
        { id: 'why', label: "Calms the body's stress response" },
      ],
    },
    ar: {
      id: 'root',
      label: 'تنفّس ببطء',
      children: [
        { id: 'step1', label: 'افتح «سُكون» ودعه يضبط الإيقاع' },
        { id: 'step2', label: 'شهيق أربع ثوانٍ، وزفير ست ثوانٍ' },
        { id: 'step3', label: 'واصِل الإيقاع خمس دقائق' },
        { id: 'why', label: 'يهدّئ استجابة الجسم للتوتّر' },
      ],
    },
  },
]

export function getDemoMindMap(techniqueId: string): DemoMindMap | undefined {
  return DEMO_MIND_MAPS.find((m) => m.techniqueId === techniqueId)
}
