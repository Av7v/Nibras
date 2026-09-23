import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { RATE_NIBRAS_ENABLED } from '../config/features'
import { focusRing, focusRingInset } from '../lib/focus'
import { submitFeedback } from '../lib/feedbackService'
import { closeRateNibrasModal, useRateNibrasModalOpen } from '../lib/rateNibrasModal'
import { CloseIcon } from './icons'

/**
 * "Rate Nibras" — the on-brand feedback dialog (a faces rating + an
 * optional free-text suggestion box). Amal approved BUILDING the
 * feature on 2026-09-21 (via team-lead), and — same day — decided WHERE
 * its trigger should live: not this component's own floating pill (the
 * original build), but a menu item in AppShellSidebar — briefly docked
 * at the bottom of its main nav list, directly below «مرشد نبراس» /
 * "Nibras guide", then moved again the same day into its quiet footer
 * group instead, directly below «كيف تستخدم نبراس» / "How to use
 * Nibras" (see that file's own footer group for the row). The save
 * destination still isn't wired up, so the whole feature stays OFF by
 * default: see config/features.ts's RATE_NIBRAS_ENABLED for the full
 * reasoning, and lib/feedbackService.ts's own header for the exact
 * "how to activate" steps. That flag is checked LAST below, after
 * every hook in this component, never before it — an early return
 * ahead of a hook call would violate react/rules-of-hooks (this
 * component's hooks must run in the same order on every render
 * regardless of the flag) — same shape as AccessGate.tsx's own
 * `shouldRender` gate. The SAME flag also gates AppShellSidebar's own
 * nav-item render, so with it off neither the trigger nor this dialog
 * exist anywhere in the DOM.
 *
 * This component now renders ONLY the dialog — the trigger lives in
 * AppShellSidebar instead. Its open/closed state comes from
 * lib/rateNibrasModal.ts, a tiny cross-tree store — the exact same
 * "launcher in one part of the tree, content mounted at a
 * non-transformed shell root" shape lib/mascotChat.ts already
 * established for «مرشد نبراس» itself, reused here rather than
 * reinvented (AppShellSidebar's slide-in nav uses a CSS `transform` for
 * its mobile drawer, which a `position:fixed` dialog must never inherit
 * — same reasoning mascotChat.ts's own header spells out).
 *
 * Still mounted twice — once in AppShell.tsx (every route under the app
 * shell) and once in Landing.tsx (the pre-app welcome screen, which
 * deliberately sits outside AppShell, so it has no sidebar and
 * therefore no way to open this today) — the same "mount at each
 * shell's own root" pattern AccessGate/NibrasGuideMascot/
 * BackgroundSettingsControl already use. Landing's own mount is
 * currently inert (nothing there ever calls `openRateNibrasModal()`)
 * but harmless to leave in place — it renders nothing while closed, and
 * saves a future Landing-side entry point from having to re-plumb this
 * component in.
 *
 * Modal shape — backdrop, focus trap, Esc-to-close, body-scroll-lock,
 * `role="dialog"`/`aria-modal` — is byte-for-byte AccessGate.tsx's own
 * established dialog, not reinvented. Focus-RETURN is the one piece
 * that had to change shape: the old self-contained floating trigger
 * could just keep its own `triggerRef` and focus it directly on close;
 * now that the opener lives in a different component, this dialog
 * instead captures `document.activeElement` the moment it opens and
 * restores focus there on close — the same activeElement-capture idiom
 * NibrasGuideMascot.tsx's own popup already uses for the identical
 * cross-tree reason (see that file's own comment). One deliberate
 * addition on top of AccessGate's shape: the Tab-trap's focusable query
 * excludes `:disabled` elements, since (unlike AccessGate) this
 * dialog briefly disables its own fields while `step === 'submitting'`
 * — without that exclusion the trap could treat a disabled, therefore
 * genuinely unreachable, button as a valid wrap-around boundary.
 *
 * Faces: the global-standard 5-point scale Amal specified (bad/poor/
 * okay/good/great, 😞/🙁/😐/🙂/😀 — okay is the deliberate neutral
 * middle; grown from an initial 4-point bad/okay/good/great build the
 * same day, with "poor" added between okay and bad). Each is a native
 * radio — the same sr-only-input + styled-sibling-span
 * `peer`/`peer-checked` idiom TypefaceField/ChoiceField/
 * BackgroundSettingsControl (reader/SettingsFields.tsx,
 * BackgroundSettingsControl.tsx) already established — wrapped in a
 * real `<label>`, so the VISIBLE short label text, not the emoji, is
 * what becomes each radio's accessible name: the emoji span is
 * `aria-hidden`, purely decorative, exactly per Amal's brief ("do not
 * rely on emoji alone for meaning"). Native radios also mean arrow-key
 * selection and correct "N of 5" screen-reader announcements come
 * free, no custom ARIA needed.
 */

const FACES = [
  { value: 1 as const, emoji: '😞', labelKey: 'feedback.faces.bad' },
  { value: 2 as const, emoji: '🙁', labelKey: 'feedback.faces.poor' },
  { value: 3 as const, emoji: '😐', labelKey: 'feedback.faces.okay' },
  { value: 4 as const, emoji: '🙂', labelKey: 'feedback.faces.good' },
  { value: 5 as const, emoji: '😀', labelKey: 'feedback.faces.great' },
]

type Rating = 1 | 2 | 3 | 4 | 5
type Step = 'form' | 'submitting' | 'thanks'

export function RateNibras() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en'

  const isOpen = useRateNibrasModalOpen()
  const [step, setStep] = useState<Step>('form')
  const [rating, setRating] = useState<Rating | null>(null)
  const [note, setNote] = useState('')
  const [submitError, setSubmitError] = useState(false)

  const openerRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstFaceRef = useRef<HTMLInputElement | null>(null)
  const doneButtonRef = useRef<HTMLButtonElement | null>(null)

  function close() {
    closeRateNibrasModal()
    setStep('form')
    setRating(null)
    setNote('')
    setSubmitError(false)
  }

  // Cross-tree open/close (Amal's decision, 2026-09-21): the trigger now
  // lives in AppShellSidebar's nav list, not in this component, so a
  // plain local triggerRef can no longer reach it. Capture whatever had
  // focus the moment this opened (the sidebar row just clicked) and
  // restore focus there on close instead — the same activeElement-
  // capture idiom NibrasGuideMascot.tsx's own popup already uses for the
  // identical cross-tree reason. Declared BEFORE the "focus the first
  // face" effect below so it captures the sidebar button, not this
  // dialog's own first face, at the moment of opening.
  useEffect(() => {
    if (isOpen) {
      openerRef.current = (document.activeElement as HTMLElement) ?? null
    } else {
      openerRef.current?.focus?.()
      openerRef.current = null
    }
  }, [isOpen])

  // Focus the first face on open — the rating is this dialog's own
  // primary field, same "focus the primary control" convention
  // AccessGate.tsx uses for its access-code input.
  useEffect(() => {
    if (isOpen) firstFaceRef.current?.focus()
  }, [isOpen])

  // Move focus to the thank-you screen's own action once it appears,
  // so a keyboard/screen-reader user isn't left on a control (the
  // just-disabled Submit button) that no longer exists in this step.
  useEffect(() => {
    if (step === 'thanks') doneButtonRef.current?.focus()
  }, [step])

  // Esc-to-close + Tab-trap — copied from AccessGate.tsx's own dialog,
  // with one addition: `:not(:disabled)` on every selector branch that
  // can match a form control, since this dialog (unlike AccessGate)
  // briefly disables its own fields while `step === 'submitting'` —
  // without the exclusion, a disabled (so genuinely unreachable)
  // button could be mistaken for the trap's own wrap-around boundary.
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (rating === null) return
    setStep('submitting')
    setSubmitError(false)
    try {
      await submitFeedback({ rating, note: note.trim(), lang, page: pathname })
      setStep('thanks')
    } catch {
      setStep('form')
      setSubmitError(true)
    }
  }

  // See this component's own header: the flag is checked LAST, after
  // every hook above has already run unconditionally.
  if (!RATE_NIBRAS_ENABLED) return null

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/45 p-4" onClick={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rate-nibras-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[28rem] rounded-card border border-line bg-card p-6 shadow-lg motion-safe:animate-guide-fade-scale"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 id="rate-nibras-title" className="m-0 flex-1 text-[1.125rem] font-bold text-ink">
                {step === 'thanks' ? t('feedback.thankYouTitle') : t('feedback.modalTitle')}
              </h2>
              <button
                type="button"
                aria-label={t('feedback.closeAria')}
                onClick={close}
                className={`flex size-8 flex-none items-center justify-center rounded-control text-ink-muted hover:text-ink ${focusRingInset}`}
              >
                <CloseIcon className="size-4" />
              </button>
            </div>

            {step === 'thanks' ? (
              <div>
                <p role="status" className="mb-4 text-[0.9375rem] text-ink-muted">
                  {t('feedback.thankYouBody')}
                </p>
                <div className="flex justify-end">
                  <button
                    ref={doneButtonRef}
                    type="button"
                    onClick={close}
                    className={`min-h-11 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover ${focusRing}`}
                  >
                    {t('feedback.thankYouClose')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <fieldset disabled={step === 'submitting'} className="m-0 border-0 p-0">
                  <fieldset className="mb-4 border-0 p-0">
                    <legend className="mb-2 w-full text-[0.9375rem] font-semibold text-ink">{t('feedback.ratingQuestion')}</legend>
                    <div className="flex flex-wrap gap-2">
                      {FACES.map((face, index) => (
                        <label key={face.value} className="inline-flex min-w-[4.5rem] flex-1 cursor-pointer">
                          <input
                            ref={index === 0 ? firstFaceRef : undefined}
                            type="radio"
                            name="feedback-rating"
                            className="peer sr-only"
                            checked={rating === face.value}
                            onChange={() => setRating(face.value)}
                          />
                          <span className="flex w-full flex-col items-center gap-1 rounded-control border-[1.5px] border-line-strong bg-cream/50 px-2 py-2.5 text-center text-ink peer-checked:border-accent peer-checked:bg-accent-tint peer-checked:text-accent peer-focus-visible:outline-[3px] peer-focus-visible:outline-accent peer-focus-visible:outline-offset-[3px]">
                            <span aria-hidden="true" className="text-[1.75rem] leading-none">
                              {face.emoji}
                            </span>
                            <span className="text-[0.75rem] font-semibold">{t(face.labelKey)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="mb-4">
                    <label htmlFor="rate-nibras-note" className="mb-1 block text-[0.8125rem] font-bold text-ink">
                      {t('feedback.noteLabel')}
                    </label>
                    <textarea
                      id="rate-nibras-note"
                      rows={4}
                      value={note}
                      maxLength={1000}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t('feedback.notePlaceholder')}
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      className={`w-full resize-y rounded-control border-[1.5px] border-line-strong px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-muted ${focusRing}`}
                    />
                  </div>

                  {submitError && (
                    // No red/alarm colour — matches this app's own established
                    // "never red ink" error tone (e.g. AccessGate.tsx's own
                    // invalidError); role="alert" alone conveys "this is a
                    // problem" to assistive tech.
                    <p role="alert" className="mb-3 text-[0.8125rem] text-ink-muted">
                      {t('feedback.error')}
                    </p>
                  )}
                  {step === 'submitting' && (
                    <p role="status" className="mb-3 text-[0.8125rem] text-ink-muted">
                      {t('feedback.submitting')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="submit"
                      disabled={rating === null}
                      aria-busy={step === 'submitting'}
                      className={`min-h-11 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                    >
                      {t('feedback.submit')}
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
