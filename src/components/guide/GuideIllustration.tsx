import type { ComponentType, CSSProperties, SVGProps } from 'react'
import { AddIcon } from '../icons'

export type GuideFlourish = 'reveal' | 'pulse' | 'sweep'

/**
 * A calm, small entrance-animated illustration for one guide step: the
 * chapter's own icon in a large tinted badge, plus a small secondary
 * flourish suggesting that step's action. Purely decorative
 * (aria-hidden — the step's real content is the text next to it, see
 * Guide.tsx). The caller keys this component on (chapterId, stepIndex)
 * so React remounts it — not just updates props — on every step
 * change, which is what makes the CSS entrance animation replay each
 * time rather than only firing once on first mount.
 *
 * All motion is gated behind Tailwind's `motion-safe:` variant (see
 * index.css's own comment on the shared keyframes) — a
 * prefers-reduced-motion visitor sees every element already at its
 * settled, fully-visible position with no animation at all, never a
 * stuck-partway or invisible state.
 *
 * transform-origin/translateX have no CSS "logical" equivalent (unlike
 * layout properties), so the sweep bars' growth direction and the
 * reveal badge's slide-in direction are set explicitly from `rtl`,
 * same reasoning as Mind Maps' own SVG coordinate math.
 */
export function GuideIllustration({
  icon: Icon,
  flourish,
  rtl,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  flourish: GuideFlourish
  rtl: boolean
}) {
  return (
    <div aria-hidden="true" className="relative flex h-40 items-center justify-center overflow-hidden rounded-control bg-accent-tint">
      {flourish === 'pulse' && (
        <span className="motion-safe:animate-guide-pulse-ring absolute size-20 rounded-full bg-accent/40" />
      )}

      <span className="motion-safe:animate-guide-fade-scale relative flex size-20 flex-none items-center justify-center rounded-card bg-accent text-accent-ink">
        <Icon className="size-9" />
      </span>

      {flourish === 'reveal' && (
        <span
          className="motion-safe:animate-guide-reveal absolute end-[24%] top-[26%] flex size-9 items-center justify-center rounded-full bg-card text-accent shadow-warm"
          style={{ '--guide-reveal-x': rtl ? '10px' : '-10px', animationDelay: '200ms' } as CSSProperties}
        >
          <AddIcon className="size-4" />
        </span>
      )}

      {flourish === 'sweep' && (
        <div className="absolute inset-x-[20%] bottom-[24%] flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="motion-safe:animate-guide-sweep h-1.5 rounded-full bg-accent/50"
              style={{ transformOrigin: rtl ? 'right' : 'left', animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
