import { useEffect, useState } from 'react'
import { getAccessToken, onInvalidToken, setAccessToken } from '../lib/accessToken'

/**
 * Reactive state for the globally-mounted <AccessGate> (task #219).
 * Deliberately REACTIVE, not proactive: the gate never appears on its
 * own just because a real backend is configured — Nibras's whole
 * design keeps AI strictly additive (every AI feature already has its
 * own honest "not available"/demo fallback when nothing is wrong), so
 * gating the WHOLE app behind a code on load would be a step backward.
 * Instead this only opens the instant `aiService.ts`'s postJson()
 * actually needs a code and doesn't have a valid one — which covers
 * BOTH "never entered one" and "entered a wrong one" identically,
 * since the server returns the same 401 either way.
 */
export function useAccessGate() {
  const [isOpen, setIsOpen] = useState(false)
  const [showInvalidError, setShowInvalidError] = useState(false)

  useEffect(() => {
    return onInvalidToken((hadToken) => {
      // Only claim "that code isn't valid" when a real, previously-
      // entered code was actually checked and rejected — a first-time
      // "you don't have one yet" open (hadToken === false) must NOT
      // show the same rejection copy (found live, task #219: this
      // exact bug — see accessToken.ts's own comment on reportInvalidToken).
      setShowInvalidError(hadToken)
      setIsOpen(true)
    })
  }, [])

  function submit(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return
    setAccessToken(trimmed)
    setShowInvalidError(false)
    setIsOpen(false)
  }

  function dismiss() {
    // "Not now" — the rest of Nibras works fine without a code; the
    // gate will simply reopen itself the next time an AI call actually
    // needs one (same reactive trigger as above).
    setIsOpen(false)
  }

  return {
    isOpen,
    showInvalidError,
    hasStoredToken: getAccessToken() !== null,
    submit,
    dismiss,
  }
}
