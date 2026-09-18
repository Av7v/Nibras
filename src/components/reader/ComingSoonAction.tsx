import { useId, useState, type ComponentType, type SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import { focusRing } from '../../lib/focus'

/**
 * Task #465 (2026-09-14, Amal via team-lead) — an honest placeholder
 * for a feature that's on the roadmap but not built yet (read-from-
 * image/OCR, read-from-a-link, download-as-MP3): a clearly SECONDARY
 * chip (muted border, no fill, smaller than the real working buttons
 * right next to it — e.g. FileOpenButton's `border-line-strong bg-card`
 * vs this one's plain `border-line`) carrying the SAME
 * `dashboard.comingSoonBadge` pill the AI Assistant already uses
 * (team-lead: "match it, don't invent a new style" — reused verbatim,
 * not a new badge style), so Nibras shows its full intended toolkit
 * without ever pretending any of these three already work.
 *
 * A REAL, focusable `<button>` (never a dead/decorative element) — per
 * team-lead's hard rule, clicking it must never look broken or silently
 * do nothing. Simplified 2026-09-15 (Amal via team-lead: «لا تنضغط عليها
 * فقط يكون كلمة قريب» — don't overthink it, a click should just show the
 * word «قريبًا») from an earlier version that revealed a full explanatory
 * sentence on click: the badge already says «قريبًا» at rest, so the
 * click now simply reaffirms that same `dashboard.comingSoonBadge` word
 * inline — no separate note string, no extra explanation. Still the
 * standard WAI-ARIA disclosure pattern (`aria-expanded` + `aria-controls`
 * on the trigger, a `role="status"` region it reveals) rather than a
 * native `title` tooltip, which is unreliable for touch/keyboard users.
 */
export function ComingSoonAction({
  icon: Icon,
  label,
  className = '',
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const noteId = useId()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={noteId}
        className={`inline-flex items-center gap-2 rounded-control border border-line bg-transparent px-3 py-1.5 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink ${focusRing}`}
      >
        <Icon className="size-4" />
        {label}
        <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
          {t('dashboard.comingSoonBadge')}
        </span>
      </button>
      {/* Always mounted (eng review P2-1, 2026-09-14): `hidden` toggles
          visibility rather than the element's presence, so `aria-controls`
          above always resolves to a real node, matching the WAI-ARIA APG
          disclosure pattern exactly — the toggle behaviour for sighted
          users is unchanged either way. */}
      <p id={noteId} role="status" hidden={!open} className="mt-1.5 text-[0.75rem] italic text-ink-muted">
        {t('dashboard.comingSoonBadge')}
      </p>
    </div>
  )
}
