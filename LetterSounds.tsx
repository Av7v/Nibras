import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ARABIC_LETTER_GROUPS,
  ENGLISH_LETTER_GROUPS,
  type DotPosition,
  type LetterSound,
} from '../content/letterSounds'
import { useSpeakingController } from '../hooks/useSpeakingController'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { isAiBackendConfigured } from '../lib/aiService'
import { VOICE_RATES } from '../lib/readingSettings'
import type { VoiceGender } from '../lib/textToSpeech'
import { ChevronIcon, SpeakerIcon, StopIcon } from '../components/icons'
import { SpeedField, VoiceGenderField } from '../components/VoiceControls'
import { focusRing, focusRingInset } from '../lib/focus'

const FONT_NASKH = "'Noto Naskh Arabic', serif"
const FONT_LATIN = "'Lexend', system-ui, sans-serif"

type KeywordMode = 'standard' | 'adult'
type OrderMode = 'alphabetical' | 'ssp'

// SSP (Letters and Sounds Phase 2-3) teaching sequence, per the #118
// build spec's own "Orderings" section. The spec's own list has 32
// entries, not 33 — bare "q" is deliberately absorbed into "qu" there
// ("q is taught as 'qu'"); rather than make one card DISAPPEAR in SSP
// mode only (a confusing "why did q vanish" inconsistency), this
// inserts 'q' immediately before 'qu' — the two are taught adjacently
// either way, so nothing here contradicts the source sequence, it just
// keeps all 33 cards present in both orderings. Flagged to team-lead
// as a scope interpretation, not silently assumed.
const SSP_ORDER: string[] = [
  's', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'ck', 'e', 'u', 'r', 'h', 'b', 'f', 'l', 'j', 'v', 'w', 'x', 'y', 'z',
  'q', 'qu', 'ch', 'sh', 'th-unvoiced', 'th-voiced', 'ng',
]

function effectiveKeyword(letter: LetterSound, mode: KeywordMode) {
  if (mode === 'adult' && letter.keywordAdult) {
    return { keyword: letter.keywordAdult, keywordTts: letter.keywordTtsAdult ?? letter.keywordAdult }
  }
  return { keyword: letter.keyword, keywordTts: letter.keywordTts }
}

/** Maps a (count, position) pair to one of a small, fully-written set
 * of i18n keys, rather than fighting pluralization machinery for a
 * fixed set of only 5 real non-zero combinations across the whole
 * alphabet (1/2/3 dots × above/below). */
function dotsDescriptionKey(count: number, position: DotPosition | undefined): string {
  if (count === 1 && position === 'below') return 'letterSounds.dotsOneBelow'
  if (count === 1) return 'letterSounds.dotsOneAbove'
  if (count === 2 && position === 'below') return 'letterSounds.dotsTwoBelow'
  if (count === 2) return 'letterSounds.dotsTwoAbove'
  return 'letterSounds.dotsThreeAbove' // the only remaining real case (ث/ش, both 3-above)
}

/**
 * «أصوات الحروف» / "Letter Sounds" — the FULL alphabet build (task
 * #118, 2026-08-14). Extends #110's proven grid + detail-panel-below
 * shape (same one Mind Maps established) to all 28 Arabic letters (in
 * their rasm-family groups) and all 33 English graphemes (Tier A
 * single letters + Tier B letter-teams), with a standard/adult keyword
 * toggle and an alphabetical/SSP ordering toggle for English.
 *
 * Same voice mechanism every other feature this session shares
 * (useSpeakingController + useSpeechVoices + lib/textToSpeech via
 * aiService's demo/real seam) — no parallel system. Non-clinical,
 * adult-appropriate copy throughout (Amal's standing app-wide rule).
 */
export function LetterSounds() {
  const { t, i18n } = useTranslation()
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keywordMode, setKeywordMode] = useState<KeywordMode>('standard')
  const [orderMode, setOrderMode] = useState<OrderMode>('alphabetical')
  const { speakingId, preparingId, errorId, toggle, stop } = useSpeakingController()
  const { hasVoiceFor, hasGenderChoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  // Task #127 — lifted to THIS level (not inside LetterDetailCard) so
  // the choice survives across letter selections; LetterDetailCard is
  // remounted fresh every time (parent renders it with `key={selected.id}`),
  // which would otherwise reset gender/rate back to defaults every tap.
  // Task #145 — now backed by the GLOBAL voice preference (was local
  // gender state + useReadingSettings' own per-instance voiceRate),
  // so the choice also survives navigating away from this page entirely.
  const genderChoiceAvailable = hasGenderChoiceFor(lang)
  const { gender, setGender, rate: voiceRate, setRate: setVoiceRate } = useVoicePreference()

  const groups = lang === 'ar' ? ARABIC_LETTER_GROUPS : ENGLISH_LETTER_GROUPS
  const allLetters = useMemo(() => groups.flatMap((g) => g.letters), [groups])
  const sspLetters = useMemo(() => {
    const byId = new Map(allLetters.map((l) => [l.id, l]))
    return SSP_ORDER.map((id) => byId.get(id)).filter((l): l is LetterSound => l !== undefined)
  }, [allLetters])

  const selected: LetterSound | null = allLetters.find((l) => l.id === selectedId) ?? null

  function selectLetter(id: string) {
    stop()
    setSelectedId((current) => (current === id ? null : id))
  }

  return (
    <main id="letter-sounds-main" className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-8 sm:px-10">
      <h1 className="mb-2 text-[1.75rem] font-bold text-ink">{t('letterSounds.title')}</h1>
      <p className="mb-4 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-muted">{t('letterSounds.subtitle')}</p>

      {/* Honest about audio state — the full alphabet is real content
          now (task #118), but curated/hand-checked recordings for the
          hardest sounds are a separate, later step (team-lead: "don't
          block the UI on it"). Updated from #110's own "preview of the
          layout with a few letters" wording, which is no longer true. */}
      <p className="mb-6 max-w-[62ch] rounded-control border border-line bg-cream/50 px-3.5 py-2.5 text-[0.8125rem] text-ink-muted">
        {t('letterSounds.audioNotice')}
      </p>

      {lang === 'en' && (
        <div className="mb-6 flex flex-wrap gap-5">
          <ModeToggle
            legend={t('letterSounds.keywordModeLabel')}
            value={keywordMode}
            onChange={setKeywordMode}
            options={[
              { value: 'standard', label: t('letterSounds.keywordModeStandard') },
              { value: 'adult', label: t('letterSounds.keywordModeAdult') },
            ]}
          />
          <ModeToggle
            legend={t('letterSounds.orderModeLabel')}
            value={orderMode}
            onChange={setOrderMode}
            options={[
              { value: 'alphabetical', label: t('letterSounds.orderModeAlphabetical') },
              { value: 'ssp', label: t('letterSounds.orderModeSsp') },
            ]}
          />
        </div>
      )}

      {/* Voice + speed (task #127) — the same picker Reading Buddy has,
          applies to whichever letter is selected below. Both languages
          (unlike the two toggles above, which are English-only). */}
      {voiceAvailable && (
        <div className="mb-6 flex flex-wrap gap-5">
          {genderChoiceAvailable && (
            <VoiceGenderField
              legend={t('readingBuddy.voiceLabel')}
              value={gender}
              onChange={setGender}
              voice1Label={t('readingBuddy.voice1')}
              voice2Label={t('readingBuddy.voice2')}
            />
          )}
          <SpeedField legend={t('readingBuddy.speedLabel')} value={voiceRate} options={VOICE_RATES} onChange={setVoiceRate} />
        </div>
      )}

      {errorId !== null && (
        <p role="alert" className="mb-4 text-center text-[0.8125rem] text-ink-muted">
          {t('techniques.voiceUnavailable')}
        </p>
      )}

      {lang === 'ar' || orderMode === 'alphabetical' ? (
        // Arabic gets its own responsive multi-column grid (nibras-qa
        // P1-a, 2026-08-14): ARABIC_LETTER_GROUPS is ~17 small
        // rasm-family groups (1-3 letters each), so the OLD shared
        // "flex flex-col gap-6" — one full-width row per group,
        // correct for English's alphabetical view (just 2 big groups,
        // tier-a/tier-b, each already dense) — left every Arabic row
        // ~70% empty next to a 2-3-tile group. CSS Grid's row-flow
        // already mirrors correctly under dir="rtl" (set on <html> by
        // index.html's own blocking script) with no extra rtl:
        // variant needed — confirmed visually, not just assumed from
        // spec. English's alphabetical view keeps its original
        // wrapper untouched; only the className below is conditional,
        // the groups.map() below is shared so both paths render
        // identical <section> markup.
        <div
          className={
            lang === 'ar'
              ? 'grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-6'
          }
        >
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`letter-group-${group.id}`}>
              <h2 id={`letter-group-${group.id}`} className="mb-2.5 text-sm font-bold tracking-[0.02em] text-ink-muted">
                {t(group.labelKey)}
              </h2>
              <div className="flex flex-wrap gap-3">
                {group.letters.map((letter) => (
                  <LetterTile
                    key={letter.id}
                    letter={letter}
                    lang={lang}
                    keywordMode={keywordMode}
                    selected={selectedId === letter.id}
                    onSelect={() => selectLetter(letter.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section aria-labelledby="letter-group-ssp">
          <h2 id="letter-group-ssp" className="mb-2.5 text-sm font-bold tracking-[0.02em] text-ink-muted">
            {t('letterSounds.orderModeSsp')}
          </h2>
          <div className="flex flex-wrap gap-3">
            {sspLetters.map((letter) => (
              <LetterTile
                key={letter.id}
                letter={letter}
                lang={lang}
                keywordMode={keywordMode}
                selected={selectedId === letter.id}
                onSelect={() => selectLetter(letter.id)}
              />
            ))}
          </div>
        </section>
      )}

      {selected ? (
        <LetterDetailCard
          key={selected.id}
          letter={selected}
          lang={lang}
          keywordMode={keywordMode}
          speakingId={speakingId}
          preparingId={preparingId}
          onSpeak={toggle}
          voiceAvailable={voiceAvailable}
          gender={gender}
          rate={voiceRate}
        />
      ) : (
        <p className="mt-6 text-[0.8125rem] text-ink-muted">{t('letterSounds.selectHint')}</p>
      )}
    </main>
  )
}

function ModeToggle<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 text-[0.75rem] font-semibold text-ink-muted">{legend}</legend>
      <div className="inline-flex overflow-hidden rounded-full border-[1.5px] border-line-strong">
        {options.map((opt) => (
          <label key={opt.value} className="inline-flex cursor-pointer">
            <input
              type="radio"
              name={legend}
              className="peer sr-only"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className={`px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ink-muted peer-checked:bg-accent peer-checked:text-accent-ink ${focusRingInset}`}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function LetterTile({
  letter,
  lang,
  keywordMode,
  selected,
  onSelect,
}: {
  letter: LetterSound
  lang: 'en' | 'ar'
  keywordMode: KeywordMode
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const rtl = lang === 'ar'
  const { keyword } = rtl ? letter : effectiveKeyword(letter, keywordMode)
  const dotsDescId = rtl && letter.dotCount !== undefined ? `${letter.id}-dots-desc` : undefined

  const dotIndicator = rtl && letter.dotCount !== undefined && (
    <span aria-hidden="true" className="flex h-[6px] items-center gap-0.5">
      {letter.dotCount === 0
        ? <span className="text-[0.625rem] leading-none text-ink-muted">{t('letterSounds.noDots')}</span>
        : Array.from({ length: letter.dotCount }).map((_, i) => <span key={i} className="size-[5px] rounded-full bg-accent" />)}
    </span>
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={t('letterSounds.tileAria', { grapheme: letter.grapheme, keyword })}
      aria-describedby={dotsDescId}
      // min-h/min-w 88px — comfortably clears the WCAG 2.5.8 24px floor
      // with real room for the letter to read large and clear.
      className={`flex min-h-[88px] min-w-[88px] flex-col items-center justify-center gap-1.5 rounded-card border-[1.5px] px-4 py-3 transition-colors ${
        selected ? 'border-accent bg-accent-tint' : 'border-line-strong bg-card hover:border-accent'
      } ${focusRing}`}
    >
      {letter.dotPosition === 'above' && dotIndicator}
      <span
        aria-hidden="true"
        className="text-[2.25rem] font-bold leading-none text-ink"
        style={{ fontFamily: rtl ? FONT_NASKH : FONT_LATIN }}
      >
        {letter.grapheme}
      </span>
      {letter.dotPosition !== 'above' && dotIndicator}
      {dotsDescId && letter.dotCount !== undefined && letter.dotCount > 0 && (
        <span id={dotsDescId} className="sr-only">
          {t(dotsDescriptionKey(letter.dotCount, letter.dotPosition))}
        </span>
      )}
    </button>
  )
}

function LetterDetailCard({
  letter,
  lang,
  keywordMode,
  speakingId,
  preparingId,
  onSpeak,
  voiceAvailable,
  gender,
  rate,
}: {
  letter: LetterSound
  lang: 'en' | 'ar'
  keywordMode: KeywordMode
  speakingId: string | null
  preparingId: string | null
  onSpeak: (id: string, text: string, lang: 'en' | 'ar', opts?: { gender?: VoiceGender; rate?: number }) => void
  voiceAvailable: boolean
  gender: VoiceGender
  rate: number
}) {
  const { t } = useTranslation()
  const rtl = lang === 'ar'
  const [formsOpen, setFormsOpen] = useState(false)

  const primaryId = `${letter.id}-sound`
  const keywordId = `${letter.id}-keyword`
  const { keyword, keywordTts } = rtl ? letter : effectiveKeyword(letter, keywordMode)
  // soundClip -> soundTts -> keywordTts, per the shared seam's own
  // resolution order — no soundClip exists yet anywhere, so this
  // always lands on soundTts (Arabic) or keywordTts (English, which
  // has no soundTts at all).
  const primaryText = letter.soundClip ?? letter.soundTts ?? keywordTts

  return (
    <div className="mt-6 rounded-card border border-line bg-card p-6">
      <h2 className="sr-only">{t('letterSounds.detailsFor', { grapheme: letter.grapheme })}</h2>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <span
          aria-hidden="true"
          className="flex size-24 flex-none items-center justify-center rounded-card border-[1.5px] border-line-strong bg-cream text-[3.5rem] font-bold text-ink"
          style={{ fontFamily: rtl ? FONT_NASKH : FONT_LATIN }}
        >
          {letter.grapheme}
        </span>

        <div className="min-w-0 flex-1 text-center sm:text-start">
          {rtl && (
            <div role="group" aria-label={t('letterSounds.syllablesGroupLabel')} className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {letter.soundTts && (
                <SyllableChip
                  label={letter.soundTts}
                  active={speakingId === primaryId || preparingId === primaryId}
                  disabled={!voiceAvailable}
                  onClick={() => onSpeak(primaryId, letter.soundTts!, lang, { gender, rate })}
                />
              )}
              {letter.soundVariants?.map((variant, i) => {
                const variantId = `${letter.id}-variant-${i}`
                return (
                  <SyllableChip
                    key={variantId}
                    label={variant.label}
                    active={speakingId === variantId || preparingId === variantId}
                    disabled={!voiceAvailable}
                    onClick={() => onSpeak(variantId, variant.tts, lang, { gender, rate })}
                  />
                )
              })}
            </div>
          )}

          <div className="mb-4 flex items-center justify-center gap-3 sm:justify-start">
            {/* Picture placeholder REMOVED for the pilot (pre-pilot
                fix batch, 2026-08-14 — nibras-qa + nibras-ar + Amal's
                own decision, PRE_SHARE_GATE §Decisions #4): an
                honestly-labeled dashed placeholder box is still an
                empty box, and the Dashboard's own copy no longer
                promises a "picture" either (see dashboard.
                toolLetterSoundsDesc) — the two now agree instead of
                the box silently over-promising what the copy had
                already stopped claiming. Re-add once #130 (real
                articulation visuals) lands with actual images to show
                in this exact spot. `pictureLabel` i18n key kept (not
                deleted) since #130's own build will want it back. */}
            <span
              className="text-[1.25rem] font-bold text-ink"
              style={{ fontFamily: rtl ? "'Tajawal', sans-serif" : FONT_LATIN }}
            >
              {keyword}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {rtl ? (
              <>
                <ListenPill
                  idleLabel={t('letterSounds.hearSound')}
                  active={speakingId === primaryId}
                  preparing={preparingId === primaryId}
                  disabled={!voiceAvailable}
                  onClick={() => onSpeak(primaryId, primaryText, lang, { gender, rate })}
                />
                <ListenPill
                  idleLabel={t('letterSounds.hearWord')}
                  active={speakingId === keywordId}
                  preparing={preparingId === keywordId}
                  disabled={!voiceAvailable}
                  onClick={() => onSpeak(keywordId, keywordTts, lang, { gender, rate })}
                />
              </>
            ) : (
              <>
                {/* English has no isolated-phoneme audio path yet — a
                    single, real "Hear the word" action, PLUS an
                    honestly-disabled "pure sound" affordance instead of
                    a second button that would silently play the exact
                    same audio under a misleading different label (the
                    spec's own explicit interim rule). */}
                <ListenPill
                  idleLabel={t('letterSounds.hearWord')}
                  active={speakingId === keywordId}
                  preparing={preparingId === keywordId}
                  disabled={!voiceAvailable}
                  onClick={() => onSpeak(keywordId, keywordTts, lang, { gender, rate })}
                />
                <span
                  aria-label={t('letterSounds.pureSoundComingSoon')}
                  className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-control border-[1.5px] border-line px-3.5 py-2 text-sm font-semibold text-ink-muted opacity-60"
                >
                  <SpeakerIcon className="size-4" aria-hidden="true" />
                  {t('letterSounds.pureSoundComingSoon')}
                </span>
              </>
            )}
            {!isAiBackendConfigured() && voiceAvailable && (
              <span className="inline-flex items-center rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
                {t('readingBuddy.demoVoiceBadge')}
              </span>
            )}
          </div>
          {!voiceAvailable && <p className="mt-2 text-[0.75rem] text-ink-muted">{t('techniques.noVoice')}</p>}
        </div>
      </div>

      {rtl && letter.forms && (
        <div className="mt-5 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setFormsOpen((v) => !v)}
            aria-expanded={formsOpen}
            className={`inline-flex items-center gap-1.5 rounded-control text-[0.875rem] font-semibold text-accent ${focusRing}`}
          >
            <ChevronIcon aria-hidden="true" className="size-3.5" style={{ transform: `rotate(${formsOpen ? 90 : rtl ? 180 : 0}deg)` }} />
            {t('letterSounds.seeInWord')}
          </button>
          {formsOpen && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {letter.forms.map((form, i) => (
                <div key={i} className="rounded-control border border-line bg-cream/50 p-3 text-center">
                  <span aria-hidden="true" className="block text-[1.75rem] font-bold text-ink" style={{ fontFamily: FONT_NASKH }}>
                    {form.glyph}
                  </span>
                  <span className="mt-1 block text-[0.6875rem] text-ink-muted">{t(form.positionLabelKey)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SyllableChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  if (disabled) {
    return (
      <span
        aria-label={`${label}، ${t('techniques.noVoice')}`}
        className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center rounded-control border-[1.5px] border-line px-3 text-[1.125rem] font-bold text-ink-muted opacity-40"
      >
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border-[1.5px] px-3 text-[1.125rem] font-bold transition-colors ${
        active ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink hover:border-accent hover:text-accent'
      } ${focusRing}`}
    >
      {label}
    </button>
  )
}

function ListenPill({
  idleLabel,
  active,
  disabled,
  preparing = false,
  onClick,
}: {
  idleLabel: string
  active: boolean
  disabled: boolean
  preparing?: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || preparing}
      aria-pressed={active}
      aria-busy={preparing}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-control border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active || preparing ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'
      } ${focusRing}`}
    >
      {preparing ? (
        <SpeakerIcon className="size-4 motion-safe:animate-pulse" />
      ) : active ? (
        <StopIcon className="size-4" />
      ) : (
        <SpeakerIcon className="size-4" />
      )}
      {preparing ? t('techniques.preparing') : active ? t('techniques.stopListening') : idleLabel}
    </button>
  )
}
