import type { VoiceGender } from '../lib/textToSpeech'
import { focusRingInset } from '../lib/focus'

/**
 * Shared voice-choice + speed pills (task #127, 2026-08-14) — extracted
 * from `ReadingBuddyPlayer.tsx`'s own markup (which pioneered this
 * exact pattern) so Letter Sounds, Mind Maps, and Techniques can offer
 * the SAME "الصوت الأول/الثاني" (Voice 1=rex / Voice 2=eve) + speed
 * picker Reading Buddy and «سُكون» already have, instead of each
 * hand-rolling its own copy. Reading Buddy's own markup is deliberately
 * LEFT AS-IS (not migrated to import these) — it wasn't asked to
 * change, and leaving already-shipped, already-tested code untouched
 * is zero risk; these two components exist for every OTHER caller.
 *
 * Purely presentational/controlled — callers own the `gender`/`rate`
 * state (typically local for gender, the shared persisted
 * `useReadingSettings().voiceRate` for rate) and decide when to render
 * these at all (gate `VoiceGenderField` on `hasGenderChoiceFor(lang)`,
 * `SpeedField` on `hasVoiceFor(lang)` — speed is meaningful even with
 * only ONE voice available, gender choice obviously isn't).
 */
export function VoiceGenderField({
  legend,
  value,
  onChange,
  voice1Label,
  voice2Label,
}: {
  legend: string
  value: VoiceGender
  onChange: (gender: VoiceGender) => void
  voice1Label: string
  voice2Label: string
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      className="inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
    >
      <button
        type="button"
        aria-pressed={value === 'male'}
        onClick={() => onChange('male')}
        className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
      >
        {voice1Label}
      </button>
      <button
        type="button"
        aria-pressed={value === 'female'}
        onClick={() => onChange('female')}
        className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
      >
        {voice2Label}
      </button>
    </div>
  )
}

export function SpeedField({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string
  value: number
  options: readonly number[]
  onChange: (rate: number) => void
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      className="inline-flex flex-none overflow-hidden rounded-full border-[1.5px] border-line-strong"
    >
      {options.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
        >
          {r}×
        </button>
      ))}
    </div>
  )
}
