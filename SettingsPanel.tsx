import { useTranslation } from 'react-i18next'
import {
  RULER_COLORS,
  RULER_COLOR_LABEL_KEY,
  TINTS,
  type ArabicSettings,
  type LatinSettings,
  type RulerColor,
  type Tint,
} from '../../lib/readingSettings'
import { CloseIcon, InfoIcon } from '../icons'
import { ColorWheelField, RulerColorField, SliderField, TintField, ToggleField, TypefaceField } from './SettingsFields'
import { focusRing, focusRingInset } from '../../lib/focus'

/**
 * Script-aware Reading Settings panel. Two completely separate branches
 * (Latin vs Arabic), not one shared control set with conditionals sprayed
 * through it — matching the audit's "two code paths, not one slider"
 * rule (F11). The Arabic branch has NO letter-spacing slider: the
 * control doesn't exist, replaced by an explanatory note, exactly as in
 * the approved reader-ar.png mockup.
 */
export function SettingsPanel({
  isArabic,
  latin,
  arabic,
  updateLatin,
  updateArabic,
  resetLatin,
  resetArabic,
  readingRuler,
  setReadingRuler,
  readingRulerColor,
  setReadingRulerColor,
  onClose,
}: {
  isArabic: boolean
  latin: LatinSettings
  arabic: ArabicSettings
  updateLatin: (patch: Partial<LatinSettings>) => void
  updateArabic: (patch: Partial<ArabicSettings>) => void
  resetLatin: () => void
  resetArabic: () => void
  readingRuler: boolean
  setReadingRuler: (value: boolean) => void
  readingRulerColor: RulerColor
  setReadingRulerColor: (value: RulerColor) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const tintLabels: Record<Tint, string> = {
    cream: t('settings.tintCream'),
    blue: t('settings.tintBlue'),
    green: t('settings.tintGreen'),
    rose: t('settings.tintRose'),
    white: t('settings.tintWhite'),
  }
  const rulerColorLabels = Object.fromEntries(
    RULER_COLORS.map((color) => [color, t(RULER_COLOR_LABEL_KEY[color])]),
  ) as Record<RulerColor, string>

  return (
    <aside
      aria-label={t('settings.title')}
      className="rounded-card border border-line bg-card p-[22px] pb-6 shadow-warm"
    >
      <div className="mb-[18px] flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{t('settings.title')}</h2>
        <button
          type="button"
          aria-label={t('reader.closeSettings')}
          onClick={onClose}
          className={`rounded-control p-2 text-ink-muted hover:text-ink ${focusRing}`}
        >
          <CloseIcon className="size-[18px]" />
        </button>
      </div>

      {isArabic ? (
        <ArabicFields settings={arabic} update={updateArabic} tintLabels={tintLabels} t={t} />
      ) : (
        <LatinFields settings={latin} update={updateLatin} tintLabels={tintLabels} t={t} />
      )}

      {/* Reading Ruler — script-independent (a mechanism preference,
          not a typography choice), so it lives outside the Latin/
          Arabic branch above rather than being duplicated in both. */}
      <div className="mt-1.5 border-t border-line pt-4">
        <ToggleField
          id="reading-ruler"
          label={t('settings.readingRuler')}
          description={t('settings.readingRulerDescription')}
          checked={readingRuler}
          onChange={setReadingRuler}
        />
        {/* Color choice only shown once the ruler is actually on
            (Amal/team-lead: "make them available when the ruler is
            relevant") — no point choosing a color for a band that
            isn't currently drawn. */}
        {readingRuler && (
          <RulerColorField
            legend={t('settings.rulerColor')}
            name="reading-ruler-color"
            value={readingRulerColor}
            onChange={setReadingRulerColor}
            colorLabels={rulerColorLabels}
          />
        )}
      </div>

      <div className="mt-1.5 border-t border-line pt-4">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-ink-muted">
          {t('settings.privacyNote')}
        </p>
        <button
          type="button"
          onClick={isArabic ? resetArabic : resetLatin}
          className={`rounded-control px-3 py-1.5 text-sm font-semibold text-ink-muted hover:text-ink ${focusRingInset}`}
        >
          {t('settings.reset')}
        </button>
      </div>
    </aside>
  )
}

// t's inferred type from useTranslation is verbose; keep these two
// sibling components in this file and accept it as `any`-free via a
// minimal local alias instead of importing i18next's internal types.
type TFunc = ReturnType<typeof useTranslation>['t']

function LatinFields({
  settings,
  update,
  tintLabels,
  t,
}: {
  settings: LatinSettings
  update: (patch: Partial<LatinSettings>) => void
  tintLabels: Record<Tint, string>
  t: TFunc
}) {
  return (
    <>
      <TypefaceField
        legend={t('settings.typeface')}
        name="typeface-latin"
        value={settings.typeface}
        onChange={(typeface) => update({ typeface })}
        options={[
          {
            value: 'lexend',
            label: t('settings.typefaceLexend'),
            sampleText: 'Aa',
            fontFamily: "'Lexend', sans-serif",
          },
          {
            value: 'atkinson',
            label: t('settings.typefaceAtkinson'),
            sampleText: 'Aa',
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          },
          {
            value: 'openSans',
            label: t('settings.typefaceOpenSans'),
            sampleText: 'Aa',
            fontFamily: "'Open Sans', sans-serif",
          },
          {
            value: 'lora',
            label: t('settings.typefaceLora'),
            sampleText: 'Aa',
            fontFamily: "'Lora', serif",
          },
          {
            value: 'openDyslexic',
            label: t('settings.typefaceOpenDyslexic'),
            sampleText: 'Aa',
            fontFamily: "'OpenDyslexic', sans-serif",
          },
        ]}
      />

      <SliderField
        id="latin-size"
        label={t('settings.textSize')}
        min={14}
        max={24}
        value={settings.fontSize}
        onChange={(fontSize) => update({ fontSize })}
        formatValue={(v) => `${v}px`}
        startGlyph="A"
        endGlyph="A"
      />

      <SliderField
        id="latin-lh"
        label={t('settings.lineHeight')}
        min={1.4}
        max={2.2}
        step={0.1}
        value={settings.lineHeight}
        onChange={(lineHeight) => update({ lineHeight })}
        formatValue={(v) => v.toFixed(1)}
      />

      <SliderField
        id="latin-lw"
        label={t('settings.lineWidth')}
        min={45}
        max={75}
        value={settings.lineWidth}
        onChange={(lineWidth) => update({ lineWidth })}
        formatValue={(v) => `${v} ${t('settings.lineWidthUnit')}`}
      />

      <SliderField
        id="latin-ls"
        label={t('settings.letterSpacing')}
        min={0}
        max={0.12}
        step={0.01}
        value={settings.letterSpacing}
        onChange={(letterSpacing) => update({ letterSpacing })}
        formatValue={(v) => `${v.toFixed(2)}em`}
      />

      <SliderField
        id="latin-ws"
        label={t('settings.wordSpacing')}
        min={0}
        max={0.3}
        step={0.01}
        value={settings.wordSpacing}
        onChange={(wordSpacing) => update({ wordSpacing })}
        formatValue={(v) => `${v.toFixed(2)}em`}
      />

      <TintField
        legend={t('settings.tint')}
        name="tint-latin"
        value={settings.tint}
        onChange={(tint) => update({ tint })}
        caption={t('settings.tintCaption')}
        tintLabels={tintLabels}
      />

      <ColorWheelField
        idPrefix="text-color-latin"
        legend={t('settings.textColor')}
        caption={t('settings.textColorCaption')}
        value={settings.textColor}
        onChange={(textColor) => update({ textColor })}
        backgroundHex={TINTS[settings.tint]}
        lightnessLabel={t('settings.textColorLightness')}
        hexLabel={t('settings.textColorHexLabel')}
        previewLabel={t('settings.textColorPreviewLabel')}
        wheelAriaLabel={(hex) => t('settings.textColorWheelLabel', { hex })}
        formatContrastLabel={(ratio) => t('settings.contrastRatioLabel', { ratio })}
        contrastGoodLabel={t('settings.contrastGood')}
        contrastWarningLabel={t('settings.contrastWarningLow')}
        sampleText="Aa"
      />
    </>
  )
}

function ArabicFields({
  settings,
  update,
  tintLabels,
  t,
}: {
  settings: ArabicSettings
  update: (patch: Partial<ArabicSettings>) => void
  tintLabels: Record<Tint, string>
  t: TFunc
}) {
  return (
    <>
      {/* Three styles, per arabic-typefaces.md: Naskh + Modern sans are
          both "best for long reading"; Kufi is offered (great for
          headings/short text) but guided, not defaulted — offered as an
          option, not restricted (UDL). Amal removed the per-option
          descriptive sub-labels app-wide, 2026-08-13 («احذفهم بالعربي
          والانجليزي احس مالهم داعي») — the guidance above is now just
          this comment's own context for future maintainers, not
          user-facing copy; each option renders as name + sample only. */}
      <TypefaceField
        legend={t('settings.typeface')}
        name="typeface-arabic"
        value={settings.typeface}
        onChange={(typeface) => update({ typeface })}
        options={[
          {
            value: 'notoNaskh',
            label: t('settings.typefaceNotoNaskh'),
            sampleText: 'أب',
            fontFamily: "'Noto Naskh Arabic', serif",
          },
          {
            value: 'ibmPlexSansArabic',
            label: t('settings.typefaceIbmPlex'),
            sampleText: 'أب',
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          },
          {
            value: 'reemKufi',
            label: t('settings.typefaceReemKufi'),
            sampleText: 'أب',
            fontFamily: "'Reem Kufi', sans-serif",
          },
        ]}
      />

      <SliderField
        id="arabic-size"
        label={t('settings.textSize')}
        min={16}
        max={26}
        value={settings.fontSize}
        onChange={(fontSize) => update({ fontSize })}
        formatValue={(v) => `${v}px`}
        startGlyph="أ"
        endGlyph="أ"
      />

      <SliderField
        id="arabic-lh"
        label={t('settings.lineHeight')}
        min={1.5}
        max={2.3}
        step={0.1}
        value={settings.lineHeight}
        onChange={(lineHeight) => update({ lineHeight })}
        formatValue={(v) => v.toFixed(1)}
      />

      <SliderField
        id="arabic-lw"
        label={t('settings.lineWidth')}
        min={35}
        max={60}
        value={settings.lineWidth}
        onChange={(lineWidth) => update({ lineWidth })}
        formatValue={(v) => `${v} ${t('settings.lineWidthUnit')}`}
      />

      {/* No letter-spacing slider — intentional, not a missing control.
          Arabic letters are connected; spacing them out breaks the
          joins (F11). Explained in place instead of silently omitted. */}
      <div className="mb-5 flex gap-2.5 rounded-control border border-line bg-cream px-3.5 py-3 text-[0.8125rem] leading-relaxed text-ink-muted">
        <InfoIcon className="mt-0.5 size-4 flex-none text-accent" />
        <p className="m-0">
          <strong className="text-ink">{t('settings.letterSpacing')}</strong>:{' '}
          {t('settings.letterSpacingNote')}
        </p>
      </div>

      <SliderField
        id="arabic-ws"
        label={t('settings.wordSpacing')}
        min={0}
        max={0.3}
        step={0.01}
        value={settings.wordSpacing}
        onChange={(wordSpacing) => update({ wordSpacing })}
        formatValue={(v) => `${v.toFixed(2)}em`}
      />

      <TintField
        legend={t('settings.tint')}
        name="tint-arabic"
        value={settings.tint}
        onChange={(tint) => update({ tint })}
        caption={t('settings.tintCaption')}
        tintLabels={tintLabels}
      />

      <ColorWheelField
        idPrefix="text-color-arabic"
        legend={t('settings.textColor')}
        caption={t('settings.textColorCaption')}
        value={settings.textColor}
        onChange={(textColor) => update({ textColor })}
        backgroundHex={TINTS[settings.tint]}
        lightnessLabel={t('settings.textColorLightness')}
        hexLabel={t('settings.textColorHexLabel')}
        previewLabel={t('settings.textColorPreviewLabel')}
        wheelAriaLabel={(hex) => t('settings.textColorWheelLabel', { hex })}
        formatContrastLabel={(ratio) => t('settings.contrastRatioLabel', { ratio })}
        contrastGoodLabel={t('settings.contrastGood')}
        contrastWarningLabel={t('settings.contrastWarningLow')}
        sampleText="أب"
      />
    </>
  )
}
