/**
 * Tiny module store for whether «مرشد نبراس»'s chat popup is open (task
 * #369, refined spec 2026-09-14). The LAUNCHER (docked in AppShellSidebar
 * on app pages, floating on the Landing page) and the POPUP (the chat
 * panel) live in DIFFERENT parts of the tree and, crucially, the popup
 * must NOT render inside the sidebar: the sidebar `<nav>` uses a CSS
 * `transform` (its slide-in), which would make a `position: fixed` popup
 * anchor to the sidebar (and slide off-canvas with it on mobile). So the
 * popup renders at a non-transformed root and coordinates with the
 * launcher through this store rather than shared props/context.
 *
 * Deliberately minimal (open/close/toggle + a hook) — the chat's own
 * state (question, answer, recording) stays local to the popup; this only
 * tracks the one cross-tree bit: is it open.
 */
import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function openMascotChat(): void {
  if (!open) {
    open = true
    emit()
  }
}

export function closeMascotChat(): void {
  if (open) {
    open = false
    emit()
  }
}

export function toggleMascotChat(): void {
  open = !open
  emit()
}

export function useMascotChatOpen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => open,
    () => false,
  )
}
