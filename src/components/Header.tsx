import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BrandMarkIcon, PersonIcon } from './icons'
import { focusRing, focusRingInset } from '../lib/focus'
import { useHeaderSlotContent } from './HeaderSlot'

/** Shared app shell header: brand + a quiet "Techniques" quick-nav
 * link + the account/profile icon + the EN/ع language toggle, plus
 * whatever the current page injects into the end slot (e.g. the
 * Reader's "Reading settings" toggle) — see HeaderSlot.tsx. "EN" and
 * "ع" are language *names*, not translated UI copy — they stay literal
 * in both locales, matching the approved mockup.
 *
 * The Techniques link lives here (not just on Landing) so it's
 * reachable from the Reader too — otherwise there'd be no way back
 * to Techniques once you've opened a document except browser-back. */
export function Header() {
  const { t, i18n } = useTranslation()
  const slotContent = useHeaderSlotContent()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-10">
      <Link
        to="/"
        className={`flex items-center gap-2.5 text-xl font-bold text-ink ${focusRingInset}`}
      >
        <span className="flex size-[34px] flex-none items-center justify-center rounded-control bg-accent text-accent-ink">
          <BrandMarkIcon className="size-[18px]" />
        </span>
        {t('brand')}
      </Link>

      <div className="flex items-center gap-3">
        <Link
          to="/techniques"
          className={`hidden rounded-control px-1 text-sm font-semibold text-ink-muted hover:text-accent sm:inline-block ${focusRing}`}
        >
          {t('landing.techniques')}
        </Link>

        <Link
          to="/profile"
          aria-label={t('header.profileLabel')}
          className={`inline-flex size-9 flex-none items-center justify-center rounded-full text-ink-muted hover:bg-accent-tint hover:text-accent ${focusRing}`}
        >
          <PersonIcon className="size-5" />
        </Link>

        <div
          role="group"
          aria-label={t('header.languageLabel')}
          className="inline-flex overflow-hidden rounded-full border-[1.5px] border-line-strong"
        >
          <button
            type="button"
            aria-pressed={i18n.language === 'en'}
            onClick={() => i18n.changeLanguage('en')}
            className={`px-3.5 py-1.5 text-sm font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            EN
          </button>
          <button
            type="button"
            lang="ar"
            aria-pressed={i18n.language === 'ar'}
            onClick={() => i18n.changeLanguage('ar')}
            className={`px-3.5 py-1.5 text-sm font-semibold text-ink-muted aria-pressed:bg-accent aria-pressed:text-accent-ink ${focusRingInset}`}
          >
            ع
          </button>
        </div>

        {slotContent}
      </div>
    </header>
  )
}
