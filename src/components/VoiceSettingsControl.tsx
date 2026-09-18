import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SpeakerIcon } from './icons'
import { SpeedField, VoiceGenderField } from './VoiceControls'
import { useSpeechVoices } from '../hooks/useSpeechVoices'
import { useVoicePreference } from '../hooks/useVoicePreference'
import { VOICE_RATES } from '../lib/readingSettings'
import { focusRingInset } from '../lib/focus'

/**
 * The header's global voice-settings control (task #145, 2026-08-14 —
 * Amal's own design, relayed by team-lead: "a speaker icon... right
 * next to the language-toggle group"). A speaker-icon button opens a
 * small popover with the SAME voice-choice + speed pills every other
 * read-aloud surface already has (VoiceControls.tsx) — but wired here
 * to the GLOBAL `useVoicePreference` store, so a change made from the
 * header is instantly reflected on every mounted surface that reads
 * that same store (ReadingBuddyPlayer, MindMapView, CalmSpace,
 * LetterSounds, ReadingBuddy, TechniqueDetail) — this is the one
 * missing control for wiring that already exists everywhere else.
 *
 * Hidden entirely when this browser has no voice at all for the
 * CURRENT UI language — same honesty gate every one of those other
 * surfaces already applies (`hasVoiceFor(lang)`), not a new rule
 * invented for this control. A dead "voice settings" button with
 * nothing it could actually change would be worse than no button.
 *
 * Accessibility: matches AppShellSidebar.tsx's own established
 * Esc-to-close + Tab-trap pattern (same shape, smaller surface) rather
 * than inventing a new one, plus outside-click-to-close (expected for
 * a popover, not just a modal) and focus-return to the trigger button
 * on close. `role="dialog"` (non-modal — page content behind it stays
 * reachable, unlike CalmSpace's own true modal) with a single
 * `aria-label` shared by both the trigger and the panel, matching the
 * language-toggle group right next to it (`aria-label`, no separate
 * visible heading — this is a quick global toggle, not a full settings
 * page).
 */
export function VoiceSettingsControl() {
  const { t, i18n } = useTranslation()
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'
  const { gender, rate, setGender, setRate } = useVoicePreference()
  const { hasVoiceFor, hasGenderChoiceFor } = useSpeechVoices()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const voiceAvailable = hasVoiceFor(lang)
  const genderChoiceAvailable = hasGenderChoiceFor(lang)

  function close() {
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  // Focus the panel's own first control on open — mirrors
  // AppShellSidebar's "focus the drawer's own dismiss control on
  // open," adapted to "focus the first REAL control" since this
  // popover has no dedicated close button of its own (Esc + outside
  // click + the trigger button itself all close it).
  useEffect(() => {
    if (!isOpen) return
    const first = panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]')
    first?.focus()
  }, [isOpen])

  // Esc closes + returns focus; Tab/Shift+Tab traps focus inside the
  // panel while open — byte-for-byte the same shape as
  // AppShellSidebar.tsx's own established drawer pattern.
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Click/tap outside the button+panel closes it too — a popover
  // (unlike CalmSpace's true modal) is expected to dismiss this way;
  // no focus-return here (the user deliberately clicked elsewhere).
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  if (!voiceAvailable) return null

  return (
    <div className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="voice-settings-panel"
        aria-label={t('header.voiceSettingsLabel')}
        title={t('header.voiceSettingsLabel')}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex size-9 items-center justify-center rounded-control text-ink-muted hover:bg-accent-tint hover:text-accent ${isOpen ? 'bg-accent-tint text-accent' : ''} ${focusRingInset}`}
      >
        <SpeakerIcon className="size-5" />
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          id="voice-settings-panel"
          role="dialog"
          aria-label={t('header.voiceSettingsLabel')}
          className="absolute end-0 top-full z-20 mt-2 flex w-max flex-col gap-3 rounded-card border-[1.5px] border-line-strong bg-card p-4 shadow-lg"
        >
          {genderChoiceAvailable && (
            <VoiceGenderField
              legend={t('readingBuddy.voiceLabel')}
              value={gender}
              onChange={setGender}
              voice1Label={t('readingBuddy.voice1')}
              voice2Label={t('readingBuddy.voice2')}
            />
          )}
          <SpeedField legend={t('readingBuddy.speedLabel')} value={rate} options={VOICE_RATES} onChange={setRate} />
        </div>
      )}
    </div>
  )
}
