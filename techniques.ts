/**
 * Techniques library — real content, transcribed from
 * ~/Desktop/AI/research/nibras/content/techniques-starter.md
 * (learning-science-advisor, 2026-08-12). 13 cards: Reading ×4,
 * Comprehension ×4, Focus ×5 (f5, the breathing technique, added
 * 2026-08-14, task #131). Every "why it helps" carries a named
 * source — kept as a separate field (not concatenated into the prose)
 * so the UI can display it distinctly and TTS can skip it (a citation
 * read aloud mid-sentence is not useful listening).
 *
 * Bilingual: Arabic is idiomatic (per the source doc's own note), not
 * a literal translation. Written undiacritized (adult default, per
 * audit F15) — a tashkeel toggle is a future increment, not this one.
 */

export type TechniqueCategory = 'reading' | 'comprehension' | 'focus'
export type EvidenceLevel = 'well-established' | 'promising' | 'weak'

interface TechniqueCopy {
  title: string
  summary: string
  steps: string[]
  whyItHelps: string
  source: string
  /** Only present where the source doc itself flags a nuance beyond
   * the single evidence badge (e.g. "strong as a principle, weak for
   * the specific mechanism"). */
  evidenceNote?: string
}

export interface Technique {
  id: string
  category: TechniqueCategory
  evidence: EvidenceLevel
  en: TechniqueCopy
  ar: TechniqueCopy
}

export const TECHNIQUES: Technique[] = [
  // ---------- READING · القراءة ----------
  {
    id: 'r1',
    category: 'reading',
    evidence: 'well-established',
    en: {
      title: 'Read while listening',
      summary: 'Follow the words with your eyes while a voice reads them aloud.',
      steps: [
        'Open the text in Reading Buddy and press play.',
        "Let your eyes follow along with the words as they're read aloud.",
        'Slow the voice down if the words move too fast.',
      ],
      whyItHelps:
        'Seeing and hearing each word together strengthens the link between the letters and their sounds, which improves comprehension for readers with reading difficulties.',
      source:
        'Wood et al., Journal of Learning Disabilities, 2018 (text-to-speech meta-analysis); Keelor et al., Annals of Dyslexia, 2023 (synchronized highlighting); Gerbier et al., Computer Speech & Language, 2018 (audio-visual synchronization).',
    },
    ar: {
      title: 'اقرأ وأنت تستمع',
      summary: 'تابِع الكلمات بعينيك بينما يقرؤها لك صوت مسموع.',
      steps: [
        'افتح النص في «رفيق القراءة» واضغط تشغيل.',
        'دع عينيك تتابع الكلمات مع قراءتها بصوتٍ مسموع.',
        'أبطِئ الصوت إذا كانت الكلمات تمرّ بسرعة.',
      ],
      whyItHelps:
        'رؤية الكلمة وسماعها معاً تقوّي الرابط بين الحروف وأصواتها، وهذا يحسّن الفهم لدى من يجدون صعوبة في القراءة.',
      source: 'وود وزملاؤه، Journal of Learning Disabilities، 2018؛ كيلور وزملاؤه، Annals of Dyslexia، 2023؛ جيربييه وزملاؤه، Computer Speech & Language، 2018.',
    },
  },
  {
    id: 'r2',
    category: 'reading',
    evidence: 'well-established',
    en: {
      title: 'Give the text room to breathe',
      summary: 'Add space between lines and words so letters feel less crowded.',
      steps: [
        'Increase the line spacing to about one-and-a-half.',
        'Leave a clear gap between paragraphs.',
        'Keep paragraphs short, a few sentences each.',
      ],
      whyItHelps:
        'Extra spacing reduces visual crowding, and the reading gain long credited to "dyslexia fonts" mostly comes from spacing, not letter shape. (For Arabic, space out lines and words only, never letters.)',
      source: 'BDA Dyslexia Style Guide, 2023; WCAG 2.2 SC 1.4.12; Marinus et al., 2016.',
    },
    ar: {
      title: 'أعطِ النص مساحةً ليتنفّس',
      summary: 'زِد المسافة بين السطور والكلمات حتى تبدو الحروف أقل ازدحاماً.',
      steps: [
        'باعِد بين السطور حتى نحو مرّة ونصف.',
        'اترك فراغاً واضحاً بين الفقرات.',
        'اجعل الفقرات قصيرة، بضع جُمل لكلٍّ منها.',
      ],
      whyItHelps:
        'المسافات الأوسع تقلّل الازدحام البصري، والتحسّن الذي يُنسب غالباً لِـ«خطوط عسر القراءة» مصدره التباعد لا شكل الحرف. (في العربية باعِد بين السطور والكلمات فقط، لا بين الحروف.)',
      source: 'دليل BDA، 2023؛ WCAG 2.2؛ مارينوس وزملاؤه، 2016.',
    },
  },
  {
    id: 'r3',
    category: 'reading',
    evidence: 'well-established',
    en: {
      title: 'Shorten the line',
      summary: 'Narrow the text so each line holds fewer words.',
      steps: [
        'Narrow the reading column so lines are shorter.',
        'Aim for roughly sixty to seventy characters per line.',
        'Keep the text left-aligned, and never stretch it to both edges.',
      ],
      whyItHelps:
        'Shorter lines make it easier for the eye to find the start of the next line, and stretched (justified) text creates uneven "rivers" of white that slow reading.',
      source: 'WCAG 2.2 SC 1.4.8; BDA Dyslexia Style Guide, 2023.',
    },
    ar: {
      title: 'قصّر طول السطر',
      summary: 'ضيّق عرض النص حتى يحمل كل سطر كلماتٍ أقل.',
      steps: [
        'ضيّق عمود القراءة حتى تصبح السطور أقصر.',
        'اجعل السطر نحو ستين إلى سبعين حرفاً.',
        'أبقِ النص بمحاذاة جهة واحدة، ولا تمدّه إلى الحافتين.',
      ],
      whyItHelps:
        'السطور الأقصر تسهّل على العين العثور على بداية السطر التالي، والنص الممدود إلى الحافتين يُحدث فراغاتٍ متقطّعة تُبطئ القراءة.',
      source: 'WCAG 2.2؛ دليل BDA، 2023.',
    },
  },
  {
    id: 'r4',
    category: 'reading',
    evidence: 'well-established',
    en: {
      title: 'Make the text yours',
      summary: 'Adjust the font, size, and background until reading feels comfortable to you.',
      steps: [
        'Make the text larger until it feels easy.',
        'Try a clear font and keep the one that suits you.',
        'Pick a soft background, like cream, instead of bright white.',
      ],
      whyItHelps:
        'Dyslexia varies from person to person, so the strongest, best-supported principle is letting each reader adjust the display; a soft off-white background also cuts glare. There is no single "magic" font, and coloured tints are a matter of comfort.',
      source:
        'CAST UDL Guidelines 3.0; BDA Dyslexia Style Guide, 2023; on the honest limits: Wery & Diliberto, 2017; Griffiths et al., 2016.',
      evidenceNote: 'As a general principle; specific "dyslexia fonts" and colour tints are weak evidence.',
    },
    ar: {
      title: 'اجعل النص على مقاسك',
      summary: 'اضبط الخط والحجم والخلفية حتى تصبح القراءة مريحةً لك.',
      steps: [
        'كبّر النص حتى يصبح مريحاً للعين.',
        'جرّب خطاً واضحاً واحتفظ بالذي يناسبك.',
        'اختر خلفيةً هادئة، كلون الكريم، بدل الأبيض الناصع.',
      ],
      whyItHelps:
        'عسر القراءة يختلف من شخص لآخر، لذا فأقوى مبدأ مدعوم هو أن يضبط كل قارئ العرض بنفسه، والخلفية الفاتحة الهادئة تخفّف الوهج. لا يوجد خطّ «سحري» واحد، والتلوين مسألة راحة.',
      source: 'CAST UDL 3.0؛ دليل BDA، 2023؛ وحول الحدود بأمانة: ويري وديليبرتو، 2017؛ غريفيثس وزملاؤه، 2016.',
      evidenceNote: 'كمبدأ عام؛ أما خطوط عسر القراءة المحددة والتلوين فأدلتها ضعيفة.',
    },
  },

  // ---------- COMPREHENSION · الفهم ----------
  {
    id: 'c1',
    category: 'comprehension',
    evidence: 'well-established',
    en: {
      title: 'Read in small chunks',
      summary: 'Break long text into small pieces and take one at a time.',
      steps: [
        'Split the text into short sections.',
        'Read one section, then pause.',
        'Make sure you understood it before moving on.',
      ],
      whyItHelps:
        'Small chunks fit within working memory and let you grasp each main point before attention fades.',
      source: 'W3C COGA, "Making Content Usable for People with Cognitive and Learning Disabilities."',
    },
    ar: {
      title: 'اقرأ النص على مقاطع صغيرة',
      summary: 'قسّم النص الطويل إلى أجزاء صغيرة، وخذ جزءاً واحداً في كل مرّة.',
      steps: ['قسّم النص إلى مقاطع قصيرة.', 'اقرأ مقطعاً واحداً ثم توقّف.', 'تأكّد أنك فهمته قبل الانتقال إلى التالي.'],
      whyItHelps:
        'المقاطع الصغيرة تناسب الذاكرة العاملة، وتتيح لك استيعاب كل فكرة رئيسة قبل أن يتشتّت الانتباه.',
      source: 'W3C COGA، «جعل المحتوى قابلاً للاستخدام».',
    },
  },
  {
    id: 'c2',
    category: 'comprehension',
    evidence: 'well-established',
    en: {
      title: 'Look before you read',
      summary: 'Skim the headings and pictures first to know where the text is going.',
      steps: [
        'Read the title and any headings.',
        'Glance at pictures, bold words, and the first line.',
        'Guess what the text will be about before you start.',
      ],
      whyItHelps:
        'Previewing and predicting activates what you already know, giving new information a place to attach. It is one of the comprehension strategies with the strongest research support.',
      source: 'National Reading Panel, 2000; Palincsar & Brown (reciprocal teaching), 1984.',
    },
    ar: {
      title: 'تصفّح قبل أن تقرأ',
      summary: 'تصفّح العناوين والصور أولاً لتعرف إلى أين يتّجه النص.',
      steps: [
        'اقرأ العنوان وأيّ عناوين فرعية.',
        'ألقِ نظرة على الصور والكلمات البارزة والسطر الأول.',
        'خمّن موضوع النص قبل أن تبدأ.',
      ],
      whyItHelps:
        'التصفّح والتوقّع ينشّطان معرفتك السابقة، فيجد المحتوى الجديد مكاناً يتعلّق به، وهذه من أكثر استراتيجيات الفهم دعماً بالبحث.',
      source: 'National Reading Panel، 2000؛ بالينكسار وبراون، 1984.',
    },
  },
  {
    id: 'c3',
    category: 'comprehension',
    evidence: 'well-established',
    en: {
      title: 'Say it in your own words',
      summary: 'After each part, retell the main idea in your own words.',
      steps: [
        'Read a short part, then look away.',
        'Say the main idea aloud in one or two sentences.',
        'If you cannot, read that part again.',
      ],
      whyItHelps:
        'Putting an idea into your own words forces you to build meaning instead of just passing your eyes over the text, and it shows you at once what you did not understand.',
      source: 'National Reading Panel, 2000 (summarization); Palincsar & Brown, 1984.',
    },
    ar: {
      title: 'أعد صياغته بكلماتك',
      summary: 'بعد كل جزء، أعد سرد الفكرة الرئيسة بكلماتك أنت.',
      steps: [
        'اقرأ جزءاً قصيراً ثم ارفع نظرك عنه.',
        'قُل الفكرة الرئيسة بصوتٍ مسموع في جملة أو جملتين.',
        'إن لم تستطع، فأعد قراءة ذلك الجزء.',
      ],
      whyItHelps:
        'صياغة الفكرة بكلماتك تُلزمك ببناء المعنى بدل مرور عينيك على النص فحسب، وتكشف لك فوراً ما لم تفهمه.',
      source: 'National Reading Panel، 2000؛ بالينكسار وبراون، 1984.',
    },
  },
  {
    id: 'c4',
    category: 'comprehension',
    evidence: 'well-established',
    en: {
      title: 'Map the ideas',
      summary: 'Turn the text into a simple map that shows how the ideas connect.',
      steps: [
        'Put the main idea in the middle.',
        'Branch out the key points around it.',
        'Draw lines to link ideas that belong together.',
      ],
      whyItHelps:
        'A visual map shows structure that a wall of text hides, and building one raises comprehension and vocabulary for learners with learning difficulties.',
      source: 'Dexter & Hughes, 2011 (graphic-organizer meta-analysis); National Reading Panel, 2000.',
      evidenceNote: 'Evidence is strongest for school-age learners; for adults, treat it as a sound study strategy.',
    },
    ar: {
      title: 'ارسم خريطةً للأفكار',
      summary: 'حوّل النص إلى خريطة بسيطة تُظهر كيف تترابط الأفكار.',
      steps: ['ضع الفكرة الرئيسة في المنتصف.', 'فرّع النقاط المهمّة حولها.', 'ارسم خطوطاً تربط الأفكار المتّصلة ببعضها.'],
      whyItHelps:
        'الخريطة البصرية تُظهر البنية التي يخفيها النص المتّصل، وبناؤها يرفع الفهم والحصيلة اللغوية لدى من يجدون صعوبة في التعلّم.',
      source: 'دكستر وهيوز، 2011؛ National Reading Panel، 2000.',
      evidenceNote: 'الدليل أقوى لدى الأطفال في سنّ المدرسة، وهي للكبار استراتيجية مذاكرة جيدة.',
    },
  },

  // ---------- FOCUS · التركيز ----------
  {
    id: 'f1',
    category: 'focus',
    evidence: 'promising',
    en: {
      title: 'Focus sprints',
      summary: 'Work in short focused bursts with a small break in between.',
      steps: [
        'Pick one small task and set a short timer.',
        'Focus only on that until the timer ends.',
        'Take a brief break, then start the next sprint.',
      ],
      whyItHelps:
        'Attention naturally fades on a long unchanging task; brief, deliberate breaks reset the goal in your mind and restore concentration. The exact timing is a personal rule of thumb, so adjust it to suit you.',
      source: 'Ariga & Lleras, Cognition, 2011; distributed practice: Dunlosky et al., 2013.',
    },
    ar: {
      title: 'جلسات تركيز قصيرة',
      summary: 'اعمل على دفعاتٍ قصيرة من التركيز، بينها استراحة صغيرة.',
      steps: [
        'اختر مهمّة صغيرة واضبط مؤقّتاً قصيراً.',
        'ركّز عليها وحدها حتى ينتهي الوقت.',
        'خذ استراحة قصيرة ثم ابدأ الجلسة التالية.',
      ],
      whyItHelps:
        'ينخفض الانتباه طبيعياً في المهام الطويلة الرتيبة، والاستراحات القصيرة المقصودة تُعيد تثبيت الهدف في ذهنك وتستعيد التركيز. أما المدّة الدقيقة فقاعدة شخصية، عدّلها كما يناسبك.',
      source: 'أريغا ولييراس، Cognition، 2011؛ التوزيع الزمني: دنلوسكي وزملاؤه، 2013.',
    },
  },
  {
    id: 'f2',
    category: 'focus',
    evidence: 'well-established',
    en: {
      title: 'Clear the clutter',
      summary: 'Remove what pulls your eyes and ears away before you start.',
      steps: [
        'Close extra tabs and put the phone out of reach.',
        'Hide anything on screen you do not need right now.',
        'Lower background noise, or use steady quiet sound.',
      ],
      whyItHelps:
        'A calm, uncluttered space lowers the demands on attention, which is guidance built into both cognitive-accessibility and universal-design standards.',
      source: 'W3C COGA, "Making Content Usable"; CAST UDL Guidelines 3.0 (minimize distractions).',
    },
    ar: {
      title: 'أبعِد المشتّتات',
      summary: 'أبعِد ما يجذب عينيك وأذنيك قبل أن تبدأ.',
      steps: [
        'أغلق النوافذ الزائدة، وضع الهاتف بعيداً عن يدك.',
        'أخفِ كل ما لا تحتاجه الآن على الشاشة.',
        'اخفض ضجيج المكان، أو استخدم صوتاً هادئاً ثابتاً.',
      ],
      whyItHelps:
        'المكان الهادئ الخالي من الفوضى يقلّل الضغط على الانتباه، وهذا توجيه أساسي في معايير الوصول المعرفي والتصميم الشامل.',
      source: 'W3C COGA؛ CAST UDL 3.0.',
    },
  },
  {
    id: 'f3',
    category: 'focus',
    evidence: 'well-established',
    en: {
      title: 'One task at a time',
      summary: 'Do a single thing at a time instead of switching back and forth.',
      steps: [
        'Choose the one task that matters most now.',
        'Finish it, or reach a clear stopping point.',
        'Only then move to the next task.',
      ],
      whyItHelps:
        'Switching between tasks adds a hidden mental cost and overloads limited working memory; staying on one task keeps that load manageable.',
      source: 'Cognitive Load Theory (Sweller).',
    },
    ar: {
      title: 'مهمّة واحدة في كل مرّة',
      summary: 'أنجز شيئاً واحداً في كل مرّة بدل التنقّل ذهاباً وإياباً.',
      steps: ['اختر المهمّة الأهمّ الآن.', 'أنجزها، أو صِل إلى نقطة توقّف واضحة.', 'عندها فقط انتقل إلى المهمّة التالية.'],
      whyItHelps:
        'التنقّل بين المهام يضيف كلفةً ذهنية خفيّة ويُثقل الذاكرة العاملة المحدودة، والبقاء على مهمّة واحدة يُبقي هذا الحِمل في حدود المُحتمَل.',
      source: 'نظرية الحِمل المعرفي: سويلر.',
    },
  },
  {
    id: 'f4',
    category: 'focus',
    evidence: 'weak',
    en: {
      title: 'Keep your place',
      summary: 'Guide your eyes along the line with a finger, cursor, or marker.',
      steps: [
        'Rest a finger or the cursor under the words as you read.',
        'Move it steadily along the line.',
        'Use a ruler or a card to cover the lines below if that helps.',
      ],
      whyItHelps:
        'Guiding the eye helps some readers stop skipping or re-reading lines and keeps attention on one line at a time. It is a widely used practical aid, though the direct research evidence is limited. Keep it if it helps you.',
      source: 'BDA / dyslexia-support practitioner guidance (practical aid; limited controlled evidence).',
    },
    ar: {
      title: 'تتبّع موضعك أثناء القراءة',
      summary: 'وجّه عينيك على طول السطر بإصبعك أو المؤشّر أو مِسطرة.',
      steps: [
        'ضع إصبعك أو المؤشّر تحت الكلمات وأنت تقرأ.',
        'حرّكه بثبات على طول السطر.',
        'استخدم مِسطرة أو بطاقة لتغطية السطور الأسفل إن ساعدك ذلك.',
      ],
      whyItHelps:
        'توجيه العين يساعد بعض القرّاء على تجنّب تخطّي السطور أو تكرارها، ويُبقي الانتباه على سطرٍ واحد في المرّة. وهي وسيلة عملية شائعة، وإن كان الدليل البحثي المباشر محدوداً، فاحتفظ بها إن نفعتك.',
      source: 'إرشادات BDA ومختصّي دعم عسر القراءة (وسيلة عملية، دليلها المباشر محدود).',
    },
  },
  // f5 (task #131, 2026-08-14) — drafted by nibras-edu, Arabic
  // register-passed by nibras-ar («ترافقه القراءة» -> «يرافق القراءة»),
  // em-dashes removed both languages per Amal's standing preference.
  // Ties to «سُكون» (#93) and reuses its exact dose wording (#84: خمس
  // دقائق / ثلاثين نفَساً) so the two surfaces never disagree on how
  // long/how many breaths. Evidence badge 'promising': the calming
  // effect itself is well-established, but its benefit FOR READING
  // specifically is an indirect, untested link (evidenceNote says so
  // explicitly) — refs = references-master §H 30-32.
  {
    id: 'f5',
    category: 'focus',
    evidence: 'promising',
    en: {
      title: 'Slow your breathing',
      summary: 'Breathe slowly and evenly to calm yourself and settle before you read.',
      steps: [
        'Open Calmness (سُكون) and let it set the pace.',
        'Breathe in for four seconds, then breathe out for six.',
        'Keep the slow rhythm for at least five minutes (around thirty breaths), and repeat until you feel calm.',
      ],
      whyItHelps:
        "Slow, paced breathing calms the body's stress response and eases the everyday tension that reading can bring, making it easier to settle and hold your focus, before or while you read.",
      source:
        'Magnon et al., Scientific Reports, 2021; Laborde et al., 2022 (meta-analysis); Zaccaro et al., 2018 (systematic review).',
      evidenceNote:
        'The calming, tension-easing effect of slow breathing is well-supported; its help for reading specifically is a sensible, indirect link rather than something tested directly.',
    },
    ar: {
      title: 'تنفّس ببطء',
      summary: 'تنفّس ببطء وانتظام لتهدأ وتستقرّ قبل القراءة.',
      steps: [
        'افتح «سُكون» ودعه يضبط إيقاع نفَسك.',
        'شهيق أربع ثوانٍ، ثم زفير ست ثوانٍ.',
        'واصِل الإيقاع البطيء خمس دقائق على الأقل، قرابة ثلاثين نفَساً، وكرّر حتى تشعر بالهدوء.',
      ],
      whyItHelps:
        'التنفّس البطيء المنتظم يهدّئ استجابة الجسم للتوتّر، ويخفّف التوتّر اليومي الذي قد يرافق القراءة، فيسهُل أن تستقرّ وتحافظ على تركيزك، قبل القراءة أو أثناءها.',
      source: 'ماغنون وزملاؤه، Scientific Reports، 2021؛ لابورد وزملاؤه، 2022 (تحليل بَعدي)؛ زاكارو وزملاؤه، 2018 (مراجعة منهجية).',
      evidenceNote:
        'الأثر المهدّئ للتنفّس البطيء مدعوم جيداً بالبحث؛ أما نفعه للقراءة تحديداً فرابط معقول غير مُختبَر مباشرةً.',
    },
  },
]

export function getTechniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id)
}

/** Text to actually speak aloud: title + summary + steps + why-it-helps
 * — deliberately excluding the source citation, which reads awkwardly
 * out loud and matters for visual trust, not listening. */
export function buildTtsText(technique: Technique, lang: 'en' | 'ar'): string {
  const copy = technique[lang]
  return [copy.title, copy.summary, ...copy.steps, copy.whyItHelps].join('. ')
}
