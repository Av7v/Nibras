import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { focusRing, focusRingInset } from '../../lib/focus'
import { CloseIcon } from '../icons'

/**
 * Opt-in consent dialog shown before the FIRST Arabic listening
 * attempt (Reading Buddy's server-STT path) — the honest tradeoff
 * English's on-device path never needs: this recording genuinely
 * leaves the device, sent to xAI's transcription service. Modal shape
 * (focus trap, Esc-to-close, body-scroll-lock, backdrop-click-to-close)
 * copied from CalmSpace.tsx/AccessGate.tsx's own established pattern.
 *
 * Declining ("Not now") just closes the dialog without granting
 * consent or starting anything — the reader can still use everything
 * else on this page (read-aloud, tap-word), and tapping the mic again
 * later simply re-asks. Never a one-time-only, can't-reconsider gate.
 */
export function ArabicSttConsent({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const agreeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    agreeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDecline()
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
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/45 p-4" onClick={onDecline}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arabic-stt-consent-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[26rem] rounded-card border border-line bg-card p-6 shadow-lg"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="arabic-stt-consent-title" className="m-0 flex-1 text-[1.125rem] font-bold text-ink">
            {t('readingCoach.consentTitle')}
          </h2>
          <button
            type="button"
            aria-label={t('readingCoach.consentDismissAria')}
            onClick={onDecline}
            className={`flex size-8 flex-none items-center justify-center rounded-control text-ink-muted hover:text-ink ${focusRingInset}`}
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <p className="mb-5 text-[0.8125rem] text-ink-muted">{t('readingCoach.consentBody')}</p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDecline}
            className={`min-h-11 rounded-control px-3.5 py-2 text-sm font-semibold text-ink-muted hover:text-ink ${focusRing}`}
          >
            {t('readingCoach.consentDeclineButton')}
          </button>
          <button
            ref={agreeButtonRef}
            type="button"
            onClick={onAgree}
            className={`min-h-11 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover ${focusRing}`}
          >
            {t('readingCoach.consentAgreeButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
