import { useTranslation } from 'react-i18next'
import { toggleMascotChat, useMascotChatOpen } from '../lib/mascotChat'
import { focusRing } from '../lib/focus'
import { NibrasGuideFace } from './mascot/NibrasGuideFace'
import lanternStaticUrl from './mascot/nibras-guide-static.png'

/**
 * The clickable «مرشد نبراس» launcher (task #369, refined spec
 * 2026-09-14, Amal via team-lead). Just the LANTERN, with NO circular
 * backdrop behind it (Amal: «شيل الدائرة الي زي الخلفية وراه») — clicking
 * it opens the chat popup (NibrasGuideMascot.tsx, coordinated via
 * lib/mascotChat). Two placements, one per page type:
 *
 * - `variant="floating"` — the Landing page («ابدأ», route `/`, which had
 *   no mascot before): floats at the INLINE-START bottom corner
 *   (`start-4`), which mirrors correctly (bottom-right in Arabic,
 *   bottom-left in English — exactly Amal's «يمين بالعربي ويسار
 *   بالانجليزي»).
 * - `variant="sidebar"` — every app page: a docked item in AppShellSidebar
 *   (after Profile), showing the Nibras lantern BESIDE the «مرشد نبراس»
 *   label on one row (no lightbulb, no backdrop) — deliberately a bit
 *   larger than the plain NavItem icons above it (see the icon's own
 *   comment below), since this row is its own prominent helper, not
 *   another plain nav link. NOT floating there. (The popup itself still
 *   floats free of the sidebar's transform, see lib/mascotChat's own note.)
 */
export function MascotLauncher({ variant, onActivate }: { variant: 'floating' | 'sidebar'; onActivate?: () => void }) {
  const { t } = useTranslation()
  const chatOpen = useMascotChatOpen()

  // Opening the chat also dismisses the mobile nav drawer (onActivate =
  // AppShellSidebar's onClose): the drawer sits at z-40 and the chat popup
  // at z-20 (deliberately below the z-30 AccessGate), so without this the
  // popup would open BEHIND an open drawer on a phone. No-op on desktop
  // (the drawer is never open there) and on Landing (no drawer, no prop).
  function handleClick() {
    onActivate?.()
    toggleMascotChat()
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={handleClick}
        // eng review (2026-09-15): with no aria-label of its own, this
        // button's accessible name fell back to content inside the
        // (aria-hidden) lantern span rather than the visible label text.
        // Dedicated string (Amal via team-lead, same day): «افتح مرشد
        // نبراس» names the ACTION ("open") against the label text itself,
        // distinct from the floating variant's mascot.openChat ("Ask the
        // Nibras guide") — that string still fits the Landing page's own
        // framing, this one matches the sidebar entry point instead of
        // borrowing an unrelated verb.
        aria-label={t('mascot.openAssistant')}
        className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-[0.9375rem] font-medium text-accent-ink/82 hover:bg-accent-ink/10 hover:text-accent-ink ${focusRing}`}
      >
        {/* Lantern icon BESIDE the «مرشد نبراس» label on one line, aligned
            as a sibling of the nav rows above (Amal, 2026-09-15: «خلي أيقونة
            الفانوس جنب العبارة ووازنها بحيث تكون مرتبة مع الصفة»). Renamed
            2026-09-15 (Amal's final call, reverting the earlier «مساعدك
            الذكي»): one name for the mascot everywhere — the popup, the
            produced videos, and here — and it no longer near-homographs the
            AI Assistant feature's «المساعد الذكي». Label now reads straight
            from `mascot.name` (already «مرشد نبراس» / "Nibras guide" — the
            popup's own heading uses the same key) instead of a separate
            `mascot.help` override, so the two can never drift apart.
            Size history, same day: 24 -> 32px (Amal, via team-lead: "a bit
            bigger, staying on the same row as the label") -> 28px in a
            RESTORED fixed 18px-wide slot (Amal, follow-up flag: the
            32px/no-slot version read as untidy against the rest of the
            menu, «مرتبة على الشريط حق القائمة»). Dropping the slot at 32px
            was correct for THIS row in isolation, but wrong once you read
            it as part of a LIST — it pushed this label's start noticeably
            off the column every other nav label shares, so the whole menu
            stopped reading as one aligned column. 28px still clearly reads
            bigger than NavItem's 18px icons (task #370's "prominent
            helper" intent) while the fixed 18px-wide flex-none slot keeps
            the label column aligned: the icon overflows that slot
            symmetrically (renders centred, 5px over each side) rather than
            shrinking to fit it.

            STATIC IMAGE, not <NibrasGuideFace> (task #539, Amal's 3rd
            report of this exact row visibly moving — «تكون ثابتة جنب
            الكلمة»). Root-caused exhaustively first: read the FULL
            nibras-guide.svg (every rule in its one <style> block, all 171
            lines) — its only motion is one keyframe gated behind a
            `.blink` class this app's driver NEVER adds, plus a static
            (non-animating) transform gated behind `.expr-talking`, which
            this row's hardcoded `stateClass="expr-idle mouth-rest"` never
            reaches either. Then ran real-browser proof against exactly
            THIS instance: 10 samples over 3.6s at rest produced
            byte-IDENTICAL screenshots and unchanged computed
            transform/animationName every time (both languages); a second
            pass sampling from the very first paint (every 100ms through
            4s) found no one-time settle/shift either. Could not detect
            ANY motion under these test conditions in either check.
            Implementing the fix regardless, and going further than a
            CSS "no animation" rule this time: a plain `animation:none`
            override only helps if the cause IS a CSS animation, and
            three code-level checks now say it isn't — whereas THIS row's
            complex vector artwork (multiple gradients, fine decorative
            curves) at a small size is exactly the kind of content that
            can show sub-pixel shimmer under GPU compositing or video
            re-encoding even with zero animating CSS, neither of which my
            headless/software-rendered test exercises. A pre-rendered
            RASTER PNG (nibras-guide-static.png, rendered from this SAME
            svg's own `expr-idle mouth-rest` resting state) has no vector
            content left for ANY rendering pipeline to redraw differently
            frame to frame — it closes every one of those possibilities
            at once, not just the one my testing could confirm or rule
            out. The live, breathing NibrasGuideFace stays exactly as-is
            everywhere else (floating launcher below, the chat popup in
            NibrasGuideMascot.tsx) — only this docked row's icon changed. */}
        <span className="flex w-[18px] flex-none items-center justify-center">
          {/* w-[28px] h-[28px] max-w-none: Tailwind Preflight ships
              `img,video{max-width:100%;height:auto}` — with NO override
              that clamps this img to 100% of its 18px-wide parent SPAN,
              silently shrinking a `width={28}` HTML attribute down to a
              rendered 18px (caught via a real getComputedStyle() read
              during the crispness re-check below, not assumed — the
              attribute is real, the CSS constraint just wins over it).
              `max-w-none` is Tailwind's own escape hatch for exactly
              this Preflight default. */}
          <img src={lanternStaticUrl} width={28} height={28} alt="" aria-hidden="true" className="w-[28px] h-[28px] max-w-none flex-none" />
        </span>
        <span>{t('mascot.name')}</span>
      </button>
    )
  }

  // Floating (Landing). Bottom inline-start corner, no circular backdrop —
  // just the lantern with a soft shadow so it reads clearly off the page.
  // z-10 matches the app's sticky-header tier and stays below every modal.
  // Hidden while the chat popup is open (which anchors the same start-4
  // corner) so there is never a second, redundant lantern on screen; the
  // popup carries its own close control and this reappears on close.
  if (chatOpen) return null
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('mascot.openChat')}
      className={`fixed bottom-4 start-4 z-10 flex flex-none items-center justify-center rounded-full drop-shadow-lg transition hover:brightness-105 ${focusRing}`}
    >
      <NibrasGuideFace stateClass="expr-idle mouth-rest" size={64} />
    </button>
  )
}
