import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaletteIcon } from './icons'
import { usePageBackgroundPreference } from '../hooks/usePageBackgroundPreference'
import { TINTS, type Tint } from '../lib/readingSettings'
import { focusRingInset } from '../lib/focus'

/**
 * The header's global background-colour control (task #350, 2026-09-08
 * — Amal via team-lead: make the Reader's own "change background
 * colour" swatches reachable, and actually applied, on EVERY page, not
 * just the Reader). A palette-icon button opens a small popover with
 * the SAME `TintField` swatch picker the Reader's own Settings panel
 * already uses (components/reader/SettingsFields.tsx, reused verbatim
 * per team-lead's decision — 5 pre-vetted swatches, not a free colour
 * wheel: see lib/pageBackgroundPreference.ts's own header comment for
 * why) — but wired here to the GLOBAL `usePageBackgroundPreference`
 * store, so a change made from this control repaints the page CANVAS
 * (index.css's `--color-page-bg`, applied by the App-root effect in
 * App.tsx) on every mounted route. Deliberately independent of the
 * Reader's own `latin.tint`/`arabic.tint` (its `<article>` reading
 * surface) — that control is untouched by this one.
 *
 * Mounted TWICE — once in AppShellHeader.tsx (covers every route under
 * AppShell) and once in Landing.tsx's own separate header (Landing
 * deliberately lives outside AppShell, see AppShell.tsx's own header
 * comment for why) — both instances read/write the SAME live store via
 * `usePageBackgroundPreference`, so a change from either one is
 * instantly reflected in the other's next render too.
 *
 * No availability gate (unlike VoiceSettingsControl's `hasVoiceFor`
 * check) — a background-colour swatch has no browser-capability
 * precondition, so this always renders.
 *
 * Accessibility: byte-for-byte the same popover shape
 * VoiceSettingsControl.tsx already established (Esc-to-close + Tab-trap
 * + outside-click-to-close + focus-return to the trigger + a single
 * `aria-label` shared by the trigger and the non-modal `role="dialog"`
 * panel) — reused rather than re-invented for this second header
 * control that needs the exact same behaviour.
 */
export function BackgroundSettingsControl() {
  const { t } = useTranslation()
  const { value, setValue } = usePageBackgroundPreference()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const tintLabels: Record<Tint, string> = {
    cream: t('settings.tintCream'),
    blue: t('settings.tintBlue'),
    green: t('settings.tintGreen'),
    rose: t('settings.tintRose'),
    white: t('settings.tintWhite'),
  }

  function close() {
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  // Focus the panel's own first control on open — same as
  // VoiceSettingsControl.tsx (no dedicated close button of its own;
  // Esc + outside click + the trigger button itself all close it).
  useEffect(() => {
    if (!isOpen) return
    const first = panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]')
    first?.focus()
  }, [isOpen])

  // Esc closes + returns focus; Tab/Shift+Tab traps focus inside the
  // panel while open — byte-for-byte the same shape as
  // VoiceSettingsControl.tsx's own established popover pattern.
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

  return (
    <div className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="background-settings-panel"
        aria-label={t('header.backgroundSettingsLabel')}
        title={t('header.backgroundSettingsLabel')}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex size-9 items-center justify-center rounded-control text-ink-muted hover:bg-accent-tint hover:text-accent ${isOpen ? 'bg-accent-tint text-accent' : ''} ${focusRingInset}`}
      >
        <PaletteIcon className="size-5" />
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          id="background-settings-panel"
          role="dialog"
          aria-label={t('header.backgroundSettingsLabel')}
          className="absolute end-0 top-full z-20 mt-2 w-max rounded-card border-[1.5px] border-line-strong bg-card p-4 shadow-lg"
        >
          {/* Task #350 whole-screen follow-up (Amal, 2026-09-13): a purpose-built
              6-option picker — "No colour" FIRST + distinct, then the 5 pre-vetted
              tints. Deliberately NOT the shared reader TintField (which is Tint-only
              and reused by the Reader's own surface tints): this one also carries the
              `'none'` choice, so it's kept local to the #350 control. Same swatch
              idiom (sr-only radio + styled span) the Reader's TintField established. */}
          <fieldset className="mb-1">
            <legend className="mb-2 text-sm font-semibold text-ink">{t('settings.tint')}</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer">
                <input
                  type="radio"
                  name="page-background"
                  className="peer sr-only"
                  checked={value === 'none'}
                  onChange={() => setValue('none')}
                />
                <span
                  aria-hidden="true"
                  className="inline-flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card [background-image:linear-gradient(to_top_left,transparent_45%,var(--color-line-strong)_45%,var(--color-line-strong)_55%,transparent_55%)] peer-checked:shadow-[0_0_0_3px_var(--color-card),0_0_0_5px_var(--color-accent)] peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]"
                />
                <span className="sr-only">{t('header.backgroundNone')}</span>
              </label>
              {(['cream', 'blue', 'green', 'rose', 'white'] as const).map((key) => (
                <label key={key} className="inline-flex cursor-pointer">
                  <input
                    type="radio"
                    name="page-background"
                    className="peer sr-only"
                    checked={value === key}
                    onChange={() => setValue(key)}
                  />
                  <span
                    aria-hidden="true"
                    style={{ background: TINTS[key] }}
                    className="inline-flex size-[30px] items-center justify-center rounded-full border-[1.5px] border-line-strong text-xs font-bold text-ink peer-checked:shadow-[0_0_0_3px_var(--color-card),0_0_0_5px_var(--color-accent)] peer-checked:after:content-['✓'] peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]"
                  />
                  <span className="sr-only">{tintLabels[key]}</span>
                </label>
              ))}
            </div>
            <p className="mt-2.5 text-[0.8125rem] text-ink-muted">{t('settings.tintCaption')}</p>
          </fieldset>
        </div>
      )}
    </div>
  )
}
