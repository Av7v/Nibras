/**
 * The Privacy Policy — real content, not placeholder copy, grounded in
 * Nibras's ACTUAL architecture as built (2026-08-12, updated 2026-08-13
 * for Library folders + Mind Maps notes/edits): no accounts, no
 * server, reading settings/documents/bookmarks/notes/folders/mind-map
 * notes+edits in localStorage only, files parsed client-side
 * (src/lib/fileParsers/), read-aloud via the browser's own Web Speech
 * API (src/lib/textToSpeech.ts). Every claim below should stay true to
 * what the code actually does — if the architecture changes, this file
 * needs to change with it, not after (nibras-qa's P1-5 pre-share
 * review, 2026-08-13, caught this drifting — the "what we store"
 * section hadn't been updated when Library folders and Mind Maps
 * notes/edits were added, both real localStorage stores by then).
 *
 * The 'ai-features' section (2026-08-14, task #120) is the one EXCEPTION
 * to "this file alone determines the copy" — it also carries an
 * `enReal`/`arReal` variant, switched on automatically by
 * `isAiBackendConfigured()` in Privacy.tsx, because its own claim
 * ("nothing is sent to an outside AI service") is only true while no
 * real AI backend is configured. See the `PrivacySection` interface's
 * own comment below for the full reasoning.
 *
 * Bilingual: Arabic is natural/idiomatic MSA, not a literal translation
 * (same approach as content/techniques.ts). No clinical "not a
 * treatment/diagnosis" language anywhere (project-wide ban, see agent
 * memory feedback-literal-removal-instructions.md).
 *
 * `lastUpdated` is a fixed historical fact (when this text was
 * authored) — deliberately NOT computed from the current date, which
 * would wrongly imply the policy changes every time someone visits.
 * `contactPlaceholder` was a bracketed TODO ("[Contact email to be
 * added by the Nibras team]") that rendered visibly to users — QA
 * flagged it (2026-08-13) as reading like an unfinished page. First
 * replaced with an honest, permanent-reading sentence that named no
 * specific address at all. SAME DAY, once Amal confirmed a real
 * address, replaced again — it now NAMES a real one, Info@nibrasapp.com
 * (the SITE's own domain, not nibras.com — corrected same day, before
 * this ever shipped, once Amal confirmed which one), but explicitly
 * marked "coming soon" / «قريبًا» in both languages,
 * because the address isn't actually monitored/live yet. This must
 * stay true on BOTH axes if this file is touched again: the address
 * itself must be real (not a placeholder), and the "coming soon"
 * qualifier must stay until it genuinely is live — dropping either
 * half would make this line false in a new way. Rendered as plain
 * text (`Privacy.tsx`), never a clickable `mailto:` link, on purpose —
 * a working link would itself imply "this works today" regardless of
 * what the sentence says. A genuine data-subject-request channel is
 * still required before the public/app-store launch (tracked
 * separately, not this file alone) — naming an inbox is not the same
 * as that channel being live.
 */

export interface PrivacySection {
  id: string
  en: { heading: string; body: string[] }
  ar: { heading: string; body: string[] }
  /**
   * Optional REAL-AI-backend variant (task #120, 2026-08-14). When
   * present, Privacy.tsx renders THIS instead of `en`/`ar` whenever
   * `isAiBackendConfigured()` is true — the exact same switch that
   * already drives every feature's own "Demo voice" badge.
   *
   * Why this exists: the 'ai-features' section below claims "nothing
   * about your own reading material is sent to an outside AI service."
   * That was true when written (2026-08-12), but #106 (real xAI voice)
   * and #112 (real translate) mean the instant someone sets
   * VITE_AI_BACKEND_URL and rebuilds, that sentence goes FALSE with
   * ZERO source change to this file — invisible to code review and to
   * verify-honesty-sweep.mjs (which only greps for banned PHRASES, not
   * for "is this true given today's build config"). Gating the copy
   * itself on the same runtime flag that gates the actual behavior
   * means the two can never drift apart silently again. See
   * `_verify/proof-privacy-ai-claim-flips.mjs` for the build-time proof
   * this actually flips (run it — under a temporarily-configured
   * VITE_AI_BACKEND_URL build — BEFORE ever setting that var for real;
   * treat that script passing as the privacy sign-off the standing rule
   * below requires, not a formality).
   *
   * STANDING RULE: setting VITE_AI_BACKEND_URL for real is a PRIVACY
   * decision, not a deployment detail — the privacy copy must already
   * be correct (which, after this fix, it mechanically is) BEFORE that
   * var is ever set outside a local proof. Any FUTURE AI feature wired
   * to a real backend must extend `enReal`/`arReal` below in the same
   * commit that wires it, not after.
   */
  enReal?: { heading: string; body: string[] }
  arReal?: { heading: string; body: string[] }
}

export const PRIVACY_SUMMARY: { en: string[]; ar: string[] } = {
  en: [
    'No account needed. Start reading right away.',
    'Everything you save (settings, documents, bookmarks, notes) stays on your own device.',
    'Files you open are read on your device, never uploaded.',
    "No trackers, no analytics, no ads. We don't watch how you use the app.",
    'We never sell or share your data. We never have it in the first place.',
    "You're always in control. Clearing your browser data removes everything Nibras saved, instantly.",
  ],
  ar: [
    'لا حاجة لحساب. ابدأ القراءة فورًا.',
    'كل ما تحفظه (الإعدادات، المستندات، الإشارات المرجعية، الملاحظات) يبقى على جهازك فقط.',
    'الملفات التي تفتحها تُقرأ على جهازك، ولا تُرفع أبدًا.',
    'لا أدوات تتبّع، ولا تحليلات، ولا إعلانات. لا نراقب كيف تستخدم التطبيق.',
    'لا نبيع بياناتك ولا نشاركها أبدًا، لأننا أصلًا لا نملكها.',
    'التحكّم دائمًا بيدك. مسح بيانات متصفحك يُزيل كل ما حفظه نبراس فورًا.',
  ],
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'no-account',
    en: {
      heading: 'No account, no sign-up',
      body: [
        "Nibras doesn't ask you to create an account, and doesn't ask who you are. There's no sign-up required to use any feature available today. You can start reading immediately, as a guest, with nothing to register and nothing personally identifying to hand over.",
      ],
    },
    ar: {
      heading: 'بلا حساب وبلا تسجيل',
      body: [
        'لا يطلب منك نبراس إنشاء حساب، ولا يسألك عن هويتك. لا حاجة للتسجيل لاستخدام أي من الميزات المتاحة حاليًا. يمكنك بدء القراءة فورًا كزائر، دون أي تسجيل ودون تقديم أي معلومة تكشف هويتك.',
      ],
    },
  },
  {
    id: 'what-we-store',
    en: {
      heading: 'What Nibras saves, and where',
      body: [
        "To make the app work the way you like every time you return, Nibras saves a few things directly in your browser's local storage on your device: your reading preferences (font, size, spacing, background), the documents you've opened (so you can resume where you left off) and any folders you organize them into, any bookmarks or notes you add, and any notes or edits you make to a mind map.",
        "None of this is sent to a server. Nibras doesn't have one. If you use a different device or browser, these won't follow you there automatically, because nothing is stored centrally.",
      ],
    },
    ar: {
      heading: 'ما يحفظه نبراس، وأين',
      body: [
        'لكي يعمل التطبيق بالطريقة التي تفضّلها في كل مرة تعود فيها، يحفظ نبراس بعض الأشياء مباشرة في التخزين المحلي لمتصفحك على جهازك: تفضيلات القراءة (الخط، الحجم، التباعد، لون الخلفية)، والمستندات التي فتحتها (لتتمكن من متابعة القراءة من حيث توقفت) وأي مجلدات ترتّبها فيها، وأي إشارات مرجعية أو ملاحظات تضيفها، وأي ملاحظات أو تعديلات تجريها على خريطة ذهنية.',
        'لا يُرسَل أي من ذلك إلى خادم؛ فنبراس لا يملك خادمًا أصلًا. وإذا استخدمت جهازًا أو متصفحًا مختلفًا، فلن تنتقل هذه البيانات معك تلقائيًا، لأنه لا يوجد تخزين مركزي لها.',
      ],
    },
  },
  {
    id: 'files',
    en: {
      heading: 'Files you open (PDF, EPUB, .txt)',
      body: [
        'When you open a PDF, EPUB, or plain-text file to read in Nibras, it is read and processed entirely inside your browser, on your own device. The file itself is never uploaded, never leaves your device, and Nibras has no way to see its contents.',
      ],
    },
    ar: {
      heading: 'الملفات التي تفتحها (PDF أو EPUB أو ملف نصي)',
      body: [
        'عند فتح ملف PDF أو EPUB أو نص عادي للقراءة في نبراس، تتم معالجته وقراءته بالكامل داخل متصفحك، على جهازك أنت. لا يُرفَع الملف أبدًا، ولا يغادر جهازك، ولا توجد لدى نبراس أي وسيلة للاطلاع على محتواه.',
      ],
    },
  },
  {
    id: 'read-aloud',
    en: {
      // 'Techniques' -> 'Reading Techniques' (task #190, 2026-08-15,
      // Amal's feature rename, folded into Privacy for consistency —
      // team-lead's own call, since this section literally names the
      // feature). Kept "library" (not dropped, unlike the AR twin's own
      // «مكتبة» removal) — flagged to team-lead per their own explicit
      // ask, since nibras-english hadn't independently reviewed this
      // exact sentence; may still get realigned.
      heading: 'Read-aloud: Reading Techniques and Reading Buddy',
      body: [
        "The Reading Techniques listen feature and the Reader's Reading Buddy player both use your device's own built-in text-to-speech, provided by your browser or operating system. Nibras does not record, store, or transmit this audio or the text being read.",
        "Exactly how your particular browser's voices work is outside Nibras's control. Most browsers speak entirely on your device, though some may use an online voice provided by the browser or device maker itself, separate from Nibras.",
      ],
    },
    ar: {
      // «التقنيات» -> «تقنيات القراءة» (task #190) — nibras-ar's own
      // final strings (2026-08-15), applied verbatim; «مكتبة» dropped
      // deliberately to avoid a «مكتبة تقنيات القراءة» double-iḍāfa.
      // Only the feature-name sentence changed; the second sentence
      // («الطريقة الدقيقة...») is untouched.
      heading: 'الاستماع: تقنيات القراءة ورفيق القراءة',
      body: [
        'تستخدم ميزة «استماع» في تقنيات القراءة، وكذلك مشغّل «رفيق القراءة» في القارئ، خاصية تحويل النص إلى صوت المدمجة في جهازك، والتي يوفّرها متصفحك أو نظام التشغيل. لا يسجّل نبراس هذا الصوت أو النص المقروء، ولا يُرسله إلى أي مكان.',
        'الطريقة الدقيقة التي يعمل بها متصفحك تحديدًا خارجة عن تحكّم نبراس؛ فمعظم المتصفحات تنطق النص بالكامل على جهازك، وقد يستخدم بعضها صوتًا عبر الإنترنت توفّره الشركة المصنّعة للمتصفح أو الجهاز نفسها، بمعزل عن نبراس.',
      ],
    },
    // REAL-AI variant (golive-sec P1, 2026-09-03): the demo claim above
    // ("your device's own built-in text-to-speech... does not transmit
    // this audio or the text") goes FALSE the instant a real AI backend
    // is configured — `aiService.synthesizeVoice()` (confirmed directly,
    // src/lib/aiService.ts:266-284) POSTs the text to `/voice` and plays
    // back a server-rendered file whenever `isAiBackendConfigured()` is
    // true, for BOTH the Reading Techniques listen feature and Reading
    // Buddy (same shared function, every caller: ReadingBuddyPlayer.tsx,
    // CalmSpace.tsx, useSpeakingController.ts). Same
    // ephemeral/never-store/never-train framing the 'ai-features' REAL
    // variant already uses for text, since this is the same kind of
    // request (your reading text, sent to generate one response).
    enReal: {
      heading: 'Read-aloud: Reading Techniques and Reading Buddy, now with a real AI voice',
      body: [
        "The Reading Techniques listen feature and the Reader's Reading Buddy player are now connected to a real AI voice, called through our own server. When you use either one, the text being read aloud is sent to that AI service in order to generate the spoken audio.",
        'That text is handled ephemerally: used only to generate the audio you asked for, then discarded, and never used to train AI models. This only happens the moment you actively start read-aloud, and only for the text you asked to have read.',
      ],
    },
    arReal: {
      heading: 'الاستماع: تقنيات القراءة ورفيق القراءة، بصوت ذكاء اصطناعي حقيقي الآن',
      body: [
        'تتصل الآن ميزة «استماع» في تقنيات القراءة، وكذلك مشغّل «رفيق القراءة» في القارئ، بصوت ذكاء اصطناعي حقيقي يُستدعى عبر خادمنا الخاص. وعند استخدام أي منهما، يُرسَل النص المطلوب قراءته بصوت عالٍ إلى تلك الخدمة لتوليد المقطع الصوتي.',
        'يُعالَج ذلك النص بشكل مؤقت فقط: يُستخدم لتوليد الصوت الذي طلبته ثم يُحذف، ولا يُستخدم أبدًا لتدريب نماذج الذكاء الاصطناعي. ولا يحدث ذلك إلا لحظة بدئك الفعلي للاستماع، وفقط للنص الذي طلبت قراءته بصوت عالٍ.',
      ],
    },
  },
  {
    // #150 (2026-08-14) — Reading Buddy's LISTENING direction is privacy-
    // material (a microphone), so it gets its own section rather than
    // folding into 'read-aloud' above (that section is output/TTS only;
    // this one is input/STT). English-only for the pilot per Amal's
    // defer decision (src/config/features.ts) — the Arabic body below
    // explicitly says so, not silently omits it. AR body is nibras-ar's
    // final, Skywalker-blessed copy (teamlead/reading-buddy-150-ar-final-
    // copy.md, 2026-08-14) — copied verbatim, diacritics included; EN
    // body is a fresh mirror of that SAME blessed AR framing (not a
    // reuse of an earlier, now-superseded EN draft), pending a language-
    // specialist parity pass before this is fully final. Both grounded
    // in what src/lib/speechRecognition.ts actually guarantees:
    // `processLocally: true` on every call, native browser
    // SpeechRecognition, nothing ever leaves the device.
    id: 'reading-buddy-listening',
    en: {
      heading: "Reading Buddy's listening coach (English only, for now)",
      body: [
        "Reading Buddy's listening coach, available for English today, follows along and gives gentle feedback as you read aloud. It uses your browser's own on-device speech recognition, and processes your voice entirely on your device. Nibras does not record, store, or transmit this audio anywhere.",
        "Your browser asks for microphone permission the first time you use it, and only because you actively started a listening session by tapping the microphone button. It is never active in the background. If on-device recognition isn't available on your browser or device, Nibras simply won't offer the listening coach there. It never falls back to sending your voice to an outside service.",
        "Arabic doesn't use the microphone yet. Today, Arabic Reading Buddy reads the passage aloud to you and lets you tap any word to hear it clearly, with no listening session involved. Live listening for Arabic is planned for a future update and is expected to work the same way, entirely on your device. We'll update this policy when that begins.",
      ],
    },
    ar: {
      heading: 'الميكروفون في رفيق القراءة (بالإنجليزية فقط حاليًا)',
      body: [
        'يرافقك مساعد الاستماع في رفيق القراءة أثناء قراءتك بصوت عالٍ، ويقدّم لك توجيهًا لطيفًا، باللغة الإنجليزية حاليًا. تعتمد هذه الخاصية على تقنية التعرّف على الكلام المدمجة في متصفحك على جهازك، وتعالج صوتك بالكامل على جهازك أنت. لا يسجّل نبراس هذا الصوت، ولا يخزّنه، ولا يُرسله إلى أي مكان.',
        'يطلب منك متصفحك الإذن باستخدام الميكروفون أول مرة تستخدم فيها هذه الميزة، ولا يحدث ذلك إلا حين تبدأ جلسة الاستماع بنفسك بالضغط على زر الميكروفون؛ فالميكروفون لا يعمل في الخلفية أبدًا. وإذا لم تكن هذه الخاصية متاحة في متصفحك أو جهازك، فلن يوفّر نبراس مساعد الاستماع هناك، ولن يلجأ أبدًا إلى إرسال صوتك إلى خدمة خارجية بديلة.',
        'أما القراءة بالعربية فلا تستخدم الميكروفون بعد. حاليًا، يقرأ لك نبراس النص بالعربية بصوت عالٍ، ويتيح لك الضغط على أي كلمة لسماعها بوضوح، دون أي جلسة استماع. والاستماع المباشر بالعربية مخطَّط له في تحديث قادم، ومن المتوقع أن يعمل بالطريقة نفسها، أي بالكامل على جهازك. وسنحدّث هذه السياسة عند بدء ذلك.',
      ],
    },
    // REAL-AI variant (golive-sec P1, 2026-09-03): the demo claim above
    // ("Arabic doesn't use the microphone yet... planned for a future
    // update") goes FALSE the instant a real AI backend is configured —
    // `useReadingCoachSession.ts`'s own `listeningAvailable` (confirmed
    // directly, ~line 192) is `isAiBackendConfigured()` for Arabic
    // specifically, and its mic flow calls `transcribe()`
    // (src/lib/aiService.ts), which POSTs the recorded clip to `/stt`
    // (real xAI STT) whenever that flag is true. English is UNCHANGED by
    // this flag either way (`listeningAvailable` for English depends only
    // on on-device browser support, never on the AI backend) — paragraphs
    // 1-2 below stay true in both demo and real, only the Arabic
    // paragraph (and the heading's "for now") needed correcting.
    //
    // Numbers below (third-party, US servers, never trains, 30-day
    // provider-side deletion, Nibras itself never stores it, shown +
    // agreed to before the first session) are copied from the ALREADY
    // reviewed, user-facing point-of-use consent dialog itself
    // (i18n `readingBuddy.consentBody`, en.json/ar.json — task #238,
    // "Apply final blessed AR-listening consent strings") rather than the
    // looser "handled ephemerally... discarded" phrasing the sibling
    // 'ai-features' REAL variant uses for plain text — that dialog
    // discloses a specific 30-day deletion window for the voice
    // recording, not near-immediate discarding, and this policy must not
    // understate that by reusing the text-only framing for a recording of
    // the reader's own voice. Deliberately still says "AI service"/an
    // unnamed "third-party" here rather than naming xAI, matching this
    // file's own established convention (see 'ai-features' REAL
    // variant) — only the consent dialog itself names the vendor.
    enReal: {
      heading: "Reading Buddy's listening coach (English and Arabic)",
      body: [
        "In English, Reading Buddy's listening coach follows along and gives gentle feedback as you read aloud. It uses your browser's own on-device speech recognition, and processes your voice entirely on your device. Nibras does not record, store, or transmit this audio anywhere.",
        "Your browser asks for microphone permission the first time you use it, and only because you actively started a listening session by tapping the microphone button. It is never active in the background. If on-device recognition isn't available on your browser or device, Nibras simply won't offer the listening coach there. It never falls back to sending your voice to an outside service.",
        "Arabic Reading Buddy's listening coach is now available too. When you use it, your recorded voice clip is sent to a third-party transcription service (on servers in the United States), called through our own server, in order to turn your speech into text. It is used only for that purpose, is never used to train AI models, and the service deletes it within 30 days. Nibras itself never stores your voice recording. Before your first Arabic listening session, you're shown these details and asked to agree.",
      ],
    },
    arReal: {
      heading: 'الميكروفون في رفيق القراءة (بالإنجليزية والعربية)',
      body: [
        'يرافقك مساعد الاستماع في رفيق القراءة أثناء قراءتك بصوت عالٍ، ويقدّم لك توجيهًا لطيفًا. بالإنجليزية، تعتمد هذه الخاصية على تقنية التعرّف على الكلام المدمجة في متصفحك على جهازك، وتعالج صوتك بالكامل على جهازك أنت؛ لا يسجّل نبراس هذا الصوت، ولا يخزّنه، ولا يُرسله إلى أي مكان.',
        'يطلب منك متصفحك الإذن باستخدام الميكروفون أول مرة تستخدم فيها هذه الميزة، ولا يحدث ذلك إلا حين تبدأ جلسة الاستماع بنفسك بالضغط على زر الميكروفون؛ فالميكروفون لا يعمل في الخلفية أبدًا. وإذا لم تكن هذه الخاصية متاحة في متصفحك أو جهازك، فلن يوفّر نبراس مساعد الاستماع هناك، ولن يلجأ أبدًا إلى إرسال صوتك إلى خدمة خارجية بديلة.',
        'أصبح مساعد الاستماع في رفيق القراءة متاحًا الآن للعربية أيضًا، عبر خادمنا الخاص. وعند استخدامه، يُرسَل مقطع صوتك المسجَّل إلى خدمة خارجية لتحويل الكلام إلى نص، تعمل على خوادم في الولايات المتحدة، ويُستخدم هذا المقطع لهذا الغرض فقط. لا يُستخدم أبدًا لتدريب أي نموذج ذكاء اصطناعي، وتحذفه تلك الخدمة خلال ثلاثين يومًا، ولا يخزّن نبراس نفسه تسجيل صوتك مطلقًا. وقبل أول جلسة استماع بالعربية، تُعرض عليك هذه التفاصيل ويُطلب منك الموافقة.',
      ],
    },
  },
  {
    id: 'no-tracking',
    en: {
      heading: 'No trackers, no analytics, no ads',
      body: [
        "Nibras does not use third-party analytics, advertising networks, or tracking scripts of any kind. We don't know how many people use the app, what they read, or how they use it, because nothing is sent anywhere to tell us.",
        'We never sell or share your data, because we never have it to begin with.',
      ],
    },
    ar: {
      heading: 'بلا أدوات تتبّع أو تحليلات أو إعلانات',
      body: [
        'لا يستخدم نبراس أي أدوات تحليلات من طرف ثالث، ولا شبكات إعلانية، ولا سكربتات تتبّع من أي نوع. لا نعرف كم عدد مستخدمي التطبيق، ولا ماذا يقرؤون، ولا كيف يستخدمونه، لأنه لا يُرسَل أي شيء إلينا يخبرنا بذلك.',
        'لا نبيع بياناتك ولا نشاركها أبدًا، لأننا أصلًا لا نملكها.',
      ],
    },
  },
  {
    id: 'sensitive-category',
    en: {
      heading: 'A sensitive category, handled carefully',
      body: [
        'Dyslexia-related information can reveal something personal about you. We take that seriously: Nibras is built around collecting as little as possible, keeping what little exists on your own device, and never asking who you are.',
        "This approach is intentionally aligned with the principles behind major privacy regulations, including the EU's GDPR, the UK GDPR, and Saudi Arabia's Personal Data Protection Law (PDPL).",
        "Even so, because we don't operate servers that process your personal data, many of their formal mechanisms (like submitting a data-access request) simply don't apply to how Nibras works today.",
      ],
    },
    ar: {
      heading: 'فئة حسّاسة، نتعامل معها بعناية',
      body: [
        'قد تكشف المعلومات المتعلقة بعُسر القراءة جانبًا شخصيًا عنك. نأخذ هذا الأمر على محمل الجد: بُني نبراس على مبدأ جمع أقل قدر ممكن من البيانات، والاحتفاظ بما يتبقى منها على جهازك فقط، وعدم سؤالك عن هويتك إطلاقًا.',
        'هذا النهج متوافق عمدًا مع المبادئ التي تقوم عليها أبرز أنظمة حماية البيانات، مثل اللائحة الأوروبية العامة لحماية البيانات (GDPR) ونظيرتها البريطانية، ونظام حماية البيانات الشخصية السعودي (PDPL). ومع ذلك، فإن كثيرًا من آلياتها الرسمية (كتقديم طلب للوصول إلى البيانات) لا تنطبق عمليًا على طريقة عمل نبراس حاليًا، لأننا لا نُشغّل خوادم تعالج بياناتك الشخصية.',
      ],
    },
  },
  {
    id: 'ai-features',
    en: {
      heading: 'AI-powered features, demo today, real AI later',
      body: [
        'Nibras includes early versions of three AI-powered tools: an AI assistant (summarize/explain), AI-generated mind maps, and the Reading Buddy voice player.',
        'Today, the assistant and mind maps run in a demo mode. They only work on two built-in example texts, using ready-written responses, not a live AI analyzing your input. Reading Buddy already works on any text, but with your browser\'s own built-in voice rather than a more advanced AI reading voice.',
        'In every case today, nothing about your own reading material is sent to an outside AI service.',
        'When these features are extended to generate real results from your own text, and when a more advanced AI reading voice is added, any text you choose to send for that processing will be handled ephemerally: used only to generate a response, then discarded, never stored, and never used to train AI models. We will update this policy, and disclose it clearly inside the app, before that begins.',
      ],
    },
    ar: {
      heading: 'ميزات الذكاء الاصطناعي: تجريبية الآن، وذكاء حقيقي لاحقًا',
      body: [
        'يضمّ نبراس اليوم نسخًا أولية من ثلاث أدوات مدعومة بالذكاء الاصطناعي: مساعد ذكي (تلخيص وشرح)، وخرائط ذهنية يُنشئها الذكاء الاصطناعي، ومشغّل صوتي لميزة رفيق القراءة. يعمل المساعد والخرائط الذهنية حاليًا في وضع تجريبي فقط: يقتصران على نصّين توضيحيين مدمجين في التطبيق، بردود جاهزة مكتوبة مسبقًا، لا بتحليل فعلي لنصك عبر الذكاء الاصطناعي. أما رفيق القراءة فيعمل فعليًا على أي نص، لكن بصوت متصفحك المدمج لا بصوت ذكاء اصطناعي أكثر تطوّرًا بعد. وفي كل هذه الحالات اليوم، لا يُرسَل أي جزء من نصوصك الخاصة إلى أي خدمة ذكاء اصطناعي خارجية.',
        'وعندما تُطوَّر هذه الميزات لتعمل فعليًا على نصك الخاص، ويُضاف صوت ذكاء اصطناعي أكثر تطوّرًا لرفيق القراءة، سيُعالَج أي نص تختار إرساله لتلك المعالجة بشكل مؤقت فقط: يُستخدم لتوليد الرد ثم يُحذف فورًا دون تخزينه، ولن يُستخدم أبدًا لتدريب نماذج الذكاء الاصطناعي. وسنحرص على تحديث هذه السياسة وتوضيح ذلك بجلاء داخل التطبيق قبل بدء أي معالجة من هذا النوع.',
      ],
    },
    // REAL-AI variant (task #120) — active the instant
    // isAiBackendConfigured() is true. Reactivates, in present tense,
    // the EXACT ephemeral-handling/no-training promise the demo variant
    // above already made as a future commitment — not a new privacy
    // promise invented here. Confirmed against xAI's own Terms of Use
    // (checked 2026-08-14): "We do not use Your Prompts and/or Your
    // Outputs to train our model(s)" by default, with a 30-day
    // server-side operational retention window before deletion unless a
    // customer explicitly opts into a separate data-sharing program —
    // supports "never used to train," though note for whoever reviews
    // this before ever setting VITE_AI_BACKEND_URL for real: that 30-day
    // window is a real retention period, not literal zero-retention: if
    // stricter wording than "discarded" is wanted, that's a content
    // decision for Amal/team-lead, not something changed unilaterally
    // here.
    enReal: {
      heading: 'AI-powered features, now using a real AI service',
      body: [
        'Nibras includes AI-powered tools: an AI assistant (summarize/explain), AI-generated mind maps, automatic translation, and the Reading Buddy voice player. These are now connected to a real AI service, called through our own server. Individual features may still be limited or still under active development even so.',
        'When you use one of these features, the specific text involved (for example, the passage you asked to be translated, summarized, explained, turned into a mind map, or read aloud) is sent to that AI service in order to generate the response.',
        'That text is handled ephemerally: used only to generate the response you asked for, then discarded, and never used to train AI models. Nibras itself still has no account system and no database of its own. This only happens at the moment you actively use one of these features, and only for the text involved in that one request.',
      ],
    },
    arReal: {
      heading: 'ميزات الذكاء الاصطناعي: تعمل الآن بذكاء اصطناعي حقيقي',
      body: [
        'يضمّ نبراس أدوات مدعومة بالذكاء الاصطناعي: مساعد ذكي (تلخيص وشرح)، وخرائط ذهنية يُنشئها الذكاء الاصطناعي، وترجمة تلقائية، ومشغّل صوتي لميزة رفيق القراءة. أصبحت هذه الميزات الآن متصلة بخدمة ذكاء اصطناعي حقيقية، تُستدعى عبر خادمنا الخاص. وقد تبقى بعض الميزات محدودة أو قيد التطوير رغم ذلك. عند استخدامك لإحدى هذه الميزات، يُرسَل النص المحدَّد المعني (كالفقرة التي طلبت ترجمتها، أو تلخيصها، أو شرحها، أو تحويلها إلى خريطة ذهنية، أو قراءتها بصوت عالٍ) إلى تلك الخدمة لتوليد الرد.',
        'يُعالَج ذلك النص بشكل مؤقت فقط: يُستخدم لتوليد الرد الذي طلبته ثم يُحذف، ولا يُستخدم أبدًا لتدريب نماذج الذكاء الاصطناعي. لا يملك نبراس نفسه أي نظام حسابات أو قاعدة بيانات خاصة به. تحدث هذه المعالجة فقط لحظة استخدامك الفعلي لإحدى هذه الميزات، وفقط للنص المعني بذلك الطلب تحديدًا.',
      ],
    },
  },
  {
    id: 'your-control',
    en: {
      heading: 'Your control over your data',
      body: [
        "Because everything is stored only on this device, you're always in control. To remove everything Nibras has saved, clear this site's data from your browser, usually under your browser's Settings → Privacy → Site data (or Clear browsing data).",
        "There's no account to delete and no request to submit. Clearing your browser storage removes it immediately and completely.",
      ],
    },
    ar: {
      heading: 'تحكّمك في بياناتك',
      body: [
        'بما أن كل شيء يُحفظ على جهازك فقط، فالتحكّم الكامل بيدك دائمًا. لحذف كل ما حفظه نبراس، امسح بيانات هذا الموقع من متصفحك، عادةً من إعدادات المتصفح ← الخصوصية ← بيانات المواقع (أو مسح بيانات التصفح).',
        'لا يوجد حساب لحذفه ولا طلب لتقديمه؛ فمسح بيانات المتصفح يزيل كل شيء فورًا وبالكامل.',
      ],
    },
  },
  {
    id: 'changes',
    en: {
      heading: 'Changes to this policy',
      body: [
        "If Nibras's features or data practices change in a way that affects this policy, we'll update this page and its \"last updated\" date so it stays accurate.",
      ],
    },
    ar: {
      heading: 'التغييرات على هذه السياسة',
      body: [
        'إذا تغيّرت ميزات نبراس أو طريقة تعامله مع البيانات بما يؤثر على هذه السياسة، فسنحدّث هذه الصفحة وتاريخ «آخر تحديث» فيها لتبقى دقيقة.',
      ],
    },
  },
]

/**
 * Text to actually speak aloud for the whole page (task #86, 2026-08-14
 * — Amal, «تخليها فيها قارئ»): the summary points, then every section
 * in reading order, heading first (a natural pause point) then its own
 * body paragraphs. Mirrors `techniques.ts`'s own `buildTtsText` shape
 * (an array joined with '. ' for a natural TTS pause at each seam) and
 * `isAiBackendConfigured`-gated section-copy selection (`realCopy`),
 * matching Privacy.tsx's OWN render logic exactly — the read-ALOUD
 * text and the text actually ON SCREEN can never drift apart, since
 * both read from the exact same `PRIVACY_SECTIONS` + the exact same
 * real/demo switch. Deliberately excludes the "last updated" date and
 * the contact section's own label/placeholder — a spoken date reads
 * awkwardly, and reading a "coming soon" contact line aloud mid-policy
 * adds little; both stay fully visible on screen for anyone reading
 * normally, this is the LISTENING path specifically, same "skip what's
 * awkward or unhelpful to hear" precedent as `techniques.ts` already
 * set by excluding its own source citations. */
export function buildPrivacyTtsText(lang: 'en' | 'ar', isAiBackendConfigured: boolean): string {
  const parts: string[] = [PRIVACY_SUMMARY[lang].join('. ')]
  for (const section of PRIVACY_SECTIONS) {
    const realCopy = lang === 'ar' ? section.arReal : section.enReal
    const copy = realCopy && isAiBackendConfigured ? realCopy : section[lang]
    parts.push(copy.heading, ...copy.body)
  }
  return parts.join('. ')
}
