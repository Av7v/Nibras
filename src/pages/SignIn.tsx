import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AppleGlyphIcon, ChevronIcon, GoogleGlyphIcon, InfoIcon } from '../components/icons'
import { focusRing } from '../lib/focus'

/** Sign in / sign up — DESIGN ONLY this pass, per Amal: no auth backend
 * exists yet, so nothing here may claim to succeed. Every path
 * (email/password submit, Apple, Google) shows the same honest inline
 * notice instead of faking a login or silently doing nothing — a
 * non-functional button that gives no feedback would look broken; a
 * button that pretends to work would be worse.
 *
 * Email + password fields are DISABLED, and the notice now shows
 * unconditionally from the first render, not just after submitting
 * (nibras-qa P1-10, 2026-08-13). Originally these were live, typeable
 * fields that only revealed the "coming soon" notice reactively, on
 * submit — QA's actual finding: a volunteer could type + SUBMIT a REAL
 * password into a form this app can never use (no backend, ever), and
 * the browser would offer to save it, since autocomplete="off" is
 * DOCUMENTED to be ignored by major browsers specifically on password
 * fields (see the field's own comment below) — so that attribute alone
 * can't make the promise QA needed: "a volunteer can't submit real
 * credentials into a dead form." Disabling the fields (+ the submit
 * button) makes that a hard guarantee, not a hope — a disabled input
 * cannot be typed into, cannot be submitted, and (as a genuine side
 * benefit) is also excluded from a password manager's autofill/save
 * consideration entirely, in every browser, regardless of the
 * `autocomplete` value.
 *
 * Apple/Google are ALSO disabled (nibras-qa interim review, 2026-08-13
 * — a regression from the P1-10 fix above, caught by QA not by me):
 * making the notice unconditional orphaned these two buttons — their
 * only effect was `setShowNotice(true)`, which is now permanently a
 * no-op, so a click changed nothing while they still sat at full
 * opacity next to three visibly-dimmed disabled controls, reading as
 * "these still work" when they never did anything real to begin with.
 * Disabled + the same `disabled:opacity-40` treatment now makes all
 * FIVE controls read as one consistent, calm, honestly-inert preview.
 * Lesson worth keeping in mind generally: changing what a shared piece
 * of state means (here, `showNotice` going from "toggled by an action"
 * to "always true") can silently orphan OTHER code that only existed
 * to toggle it — worth a deliberate check of every other reference to
 * a state setter whenever its own semantics change, not just the call
 * site being edited. */
export function SignIn() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Always true from first render (was reactive-on-submit-only) — see
  // the file's own header comment above for why "lead with the honest
  // notice" is now the whole point, not just a fallback.
  const [showNotice, setShowNotice] = useState(true)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setShowNotice(true)
  }

  return (
    <main className="mx-auto w-full max-w-[30rem] flex-1 px-6 py-10 sm:px-10">
      <Link
        to="/profile"
        className={`mb-6 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-ink-muted hover:text-accent ${focusRing}`}
      >
        <ChevronIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
        {t('signin.backToProfile')}
      </Link>

      {/* nibras-qa interim review P2 (2026-08-13): signin.subtitle used
          to sit here AND state the same "accounts aren't live" fact the
          notice below also states — two sentences saying one thing,
          extra reading load for no extra information. Removed the
          subtitle entirely; the notice alone (which also carries the
          on-device-privacy reassurance the subtitle never did) now
          does this page's one job of explaining itself. H1 takes the
          subtitle's old mb-6 so the spacing above the notice reads the
          same as before, not cramped. */}
      <h1 className="mb-6 text-[1.75rem] font-bold text-ink">{t('signin.title')}</h1>

      {showNotice && (
        <div
          role="status"
          className="mb-6 flex gap-2.5 rounded-control border border-line bg-accent-tint px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink"
        >
          <InfoIcon className="mt-0.5 size-4 flex-none text-accent" />
          <p className="m-0">{t('signin.comingSoonMessage')}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-card border border-line bg-card p-5">
        <div className="mb-4">
          <label htmlFor="signin-email" className="mb-1.5 block text-sm font-semibold text-ink">
            {t('signin.emailLabel')}
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            disabled
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('signin.emailPlaceholder')}
            className={`w-full rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="signin-password" className="mb-1.5 block text-sm font-semibold text-ink">
            {t('signin.passwordLabel')}
          </label>
          <input
            id="signin-password"
            type="password"
            // NOT "current-password" (nibras-qa P1-10) — that token
            // tells the browser this is a real credential worth
            // remembering for a real account, which is false; this form
            // has no backend and never submits anywhere (confirmed:
            // handleSubmit only sets local UI state). Note this doesn't
            // fully suppress a browser's own save-password prompt —
            // major browsers deliberately ignore autocomplete="off" on
            // login-shaped forms as a user-security choice (verified
            // against MDN's "Turning off form autocompletion" guide,
            // 2026) — but declaring "off" is still the honest value to
            // ship regardless of whether every browser honors it.
            autoComplete="off"
            disabled
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-control border-[1.5px] border-line-strong bg-cream px-3.5 py-2.5 text-[0.9375rem] text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          />
        </div>

        <button
          type="submit"
          disabled
          className={`mb-5 w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent ${focusRing}`}
        >
          {t('signin.submitButton')}
        </button>

        <div className="mb-5 flex items-center gap-3" role="separator">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[0.8125rem] text-ink-muted">{t('signin.orDivider')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled
            className={`inline-flex items-center justify-center gap-2.5 rounded-control border-[1.5px] border-line-strong bg-cream px-4 py-2.5 text-sm font-semibold text-ink hover:border-line-strong hover:bg-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cream ${focusRing}`}
          >
            <AppleGlyphIcon className="size-[18px]" />
            {t('signin.continueWithApple')}
          </button>
          <button
            type="button"
            disabled
            className={`inline-flex items-center justify-center gap-2.5 rounded-control border-[1.5px] border-line-strong bg-cream px-4 py-2.5 text-sm font-semibold text-ink hover:border-line-strong hover:bg-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cream ${focusRing}`}
          >
            <GoogleGlyphIcon className="size-[18px]" />
            {t('signin.continueWithGoogle')}
          </button>
        </div>
      </form>
    </main>
  )
}
