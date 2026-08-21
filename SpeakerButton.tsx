import { useTranslation } from 'react-i18next'
import { useSpeechVoices } from '../../hooks/useSpeechVoices'
import type { SpeechLang } from '../../lib/textToSpeech'
import { SpeakerIcon, StopIcon } from '../icons'
import { focusRing } from '../../lib/focus'

/** Read-aloud toggle for one technique card. Disables itself (rather
 * than failing silently on click) when the device has no voice for
 * `lang` — a real, disclosed limitation of browser TTS, not hidden
 * from the reader. `isActive`/`onToggle` are controlled by the parent
 * page, which is what actually calls the Web Speech API and enforces
 * "only one card speaks at a time". */
export function SpeakerButton({
  lang,
  isActive,
  onToggle,
  size = 'md',
  isPreparing = false,
}: {
  lang: SpeechLang
  isActive: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
  /** True while the neural voice is being generated (a few seconds) —
   * shows an honest "preparing…" state and disables the button so an
   * impatient double-click can't fire a second paid render. */
  isPreparing?: boolean
}) {
  const { t } = useTranslation()
  const { hasVoiceFor } = useSpeechVoices()
  const available = hasVoiceFor(lang)

  const dims = size === 'sm' ? 'size-8' : 'size-10'
  const iconSize = size === 'sm' ? 'size-4' : 'size-[18px]'

  if (!available) {
    return (
      <span
        title={t('techniques.noVoice')}
        aria-label={t('techniques.noVoice')}
        className={`relative z-10 inline-flex ${dims} flex-none cursor-not-allowed items-center justify-center rounded-full border-[1.5px] border-line text-ink-muted opacity-40`}
      >
        <SpeakerIcon className={iconSize} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPreparing}
      aria-pressed={isActive}
      aria-busy={isPreparing}
      aria-label={isPreparing ? t('techniques.preparing') : isActive ? t('techniques.stopListening') : t('techniques.listen')}
      className={`relative z-10 inline-flex ${dims} flex-none items-center justify-center rounded-full border-[1.5px] ${
        isActive || isPreparing
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong text-ink-muted hover:bg-accent-tint hover:text-accent'
      } ${isPreparing ? 'cursor-progress opacity-80' : ''} ${focusRing}`}
    >
      {isPreparing ? (
        <SpeakerIcon className={`${iconSize} motion-safe:animate-pulse`} />
      ) : isActive ? (
        <StopIcon className={iconSize} />
      ) : (
        <SpeakerIcon className={iconSize} />
      )}
    </button>
  )
}
