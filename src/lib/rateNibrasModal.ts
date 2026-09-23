/**
 * Tiny module store for whether "Rate Nibras"'s dialog (RateNibras.tsx)
 * is open. Amal's decision, 2026-09-21 (via team-lead): move the
 * feature's trigger OUT of RateNibras.tsx's own floating pill and INTO
 * AppShellSidebar instead (a new row — briefly in its main nav list,
 * directly below «مرشد نبراس» / "Nibras guide"; moved again the same
 * day into its quiet footer group, directly below «كيف تستخدم نبراس» /
 * "How to use Nibras"). That split means the trigger (in
 * AppShellSidebar) and the dialog (mounted once at each shell's own
 * root — AppShell.tsx, Landing.tsx) now live in DIFFERENT parts of the
 * tree — the exact same shape lib/mascotChat.ts already established for
 * «مرشد نبراس» itself, reused here rather than reinvented: the sidebar
 * `<nav>` uses a CSS `transform` for its mobile slide-in, so a
 * `position:fixed` dialog must never render inside it (it would inherit
 * that transform and slide off-canvas with it) — it has to coordinate
 * with its trigger through a store like this one instead of shared
 * props/context.
 *
 * Deliberately minimal — open/close + a hook, no toggle: unlike
 * mascotChat.ts's non-modal popup (whose own launcher button also
 * dismisses it on a second click), RateNibras.tsx's dialog is a real
 * modal with its own close controls (X button, Esc, backdrop click), so
 * nothing ever needs its OPENER to also be able to close it.
 */
import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function openRateNibrasModal(): void {
  if (!open) {
    open = true
    emit()
  }
}

export function closeRateNibrasModal(): void {
  if (open) {
    open = false
    emit()
  }
}

export function useRateNibrasModalOpen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => open,
    () => false,
  )
}
