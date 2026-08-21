import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAiBackendConfigured } from '../lib/aiService'
import { useAccessGate } from '../hooks/useAccessGate'
import { focusRing, focusRingInset } from '../lib/focus'
import { CloseIcon } from './icons'

/**
 * "Enter your access code" gate — the client half of task #219/#148's
 * P0 deploy-blocker (server/README.md's "Client access-token
 * contract"). Mounted once in AppShell.tsx, so it's available above
 * whichever page is open. Demo-inert by construction: `useAccessGate`
 * only ever opens reactively, in response to a REAL AI call hitting a
 * missing/invalid-code 401 — which can only happen once
 * `VITE_AI_BACKEND_URL` is actually set, so this renders nothing at
 * all in today's demo build (confirmed by the same `isAiBackendConfigured()`
 * check every other AI surface already uses).
 *
 * Modal shape (focus trap, Esc-to-close, body-scroll-lock,
 * backdrop-click-to-dismiss) copied from CalmSpace.tsx's own
 * established, WAI-ARIA-APG-shaped dialog — not reinvented.
 *
 * Deliberately DISMISSIBLE ("Not now"), not a hard block on the whole
 * app: Nibras's core reading tools (formatting, the Reader, Techniques,
 * Letter Sounds, Calmness, TTS's own browser-voice fallback) never
 * depend on an AI backend at all, so forcing a code before any of that
 * works would contradict this app's entire "AI is additive" design.
 * Dismissing just means the NEXT AI action a volunteer takes will hit
 * the same 401 and reopen this automatically — not a bypass, just a
 * "not right now."
 */
export function AccessGate() {
  const { t } = useTranslation()
  const { isOpen, showInvalidError, submit, dismiss } = useAccessGate()
  const [draft, setDraft] = useState('')
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Demo-inert: even if some future caller misuses useAccessGate and
  // flips isOpen without a real backend configured, never render — an
  // access-code prompt with nothing behind it to authenticate against
  // would be pure, confusing dead weight in the demo build.
  const shouldRender = isOpen && isAiBackendConfigured()

  useEffect(() => {
    if (shouldRender) inputRef.current?.focus()
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dismiss()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
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
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [shouldRender])

  if (!shouldRender) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(draft)
    setDraft('')
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/45 p-4" onClick={dismiss}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-gate-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[26rem] rounded-card border border-line bg-card p-6 shadow-lg"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="access-gate-title" className="m-0 flex-1 text-[1.125rem] font-bold text-ink">
            {t('accessGate.title')}
          </h2>
          <button
            type="button"
            aria-label={t('accessGate.dismissAria')}
            onClick={dismiss}
            className={`flex size-8 flex-none items-center justify-center rounded-control text-ink-muted hover:text-ink ${focusRingInset}`}
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <p className="mb-4 text-[0.8125rem] text-ink-muted">{t('accessGate.body')}</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="access-gate-input" className="mb-1 block text-[0.8125rem] font-bold text-ink">
            {t('accessGate.inputLabel')}
          </label>
          <input
            ref={inputRef}
            id="access-gate-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('accessGate.placeholder')}
            aria-describedby={showInvalidError ? 'access-gate-error' : undefined}
            aria-invalid={showInvalidError || undefined}
            className={`w-full rounded-control border-[1.5px] px-3 py-2 text-[0.9375rem] text-ink ${showInvalidError ? 'border-accent' : 'border-line-strong'} ${focusRing}`}
          />
          {showInvalidError && (
            // No red/alarm color — matches this app's own established
            // "never red ink" tone (every other error state in Nibras,
            // e.g. aiAssistant.errorMessage, is plain ink-muted text;
            // `role="alert"` alone is what conveys "this is a problem"
            // to assistive tech, a color signal is neither needed nor
            // in keeping with the rest of the app).
            <p id="access-gate-error" role="alert" className="mt-1.5 text-[0.8125rem] text-ink-muted">
              {t('accessGate.invalidError')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className={`min-h-11 rounded-control px-3.5 py-2 text-sm font-semibold text-ink-muted hover:text-ink ${focusRing}`}
            >
              {t('accessGate.dismissButton')}
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              className={`min-h-11 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {t('accessGate.submitButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
