import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Task #360 (2026-09-10, Amal) — lets a routed page (the Reader) ask
 * the persistent app-shell to hide its own site-navigation chrome
 * (the sidebar + the header's own brand/language/colour/voice
 * controls) for a distraction-free "focus mode". The mirror image of
 * HeaderSlot.tsx's own mechanism: that one lets a page INJECT content
 * INTO the shared header; this one lets a page ask the shell to REMOVE
 * itself around the page instead. Same split value/setter-context
 * shape as HeaderSlot.tsx, for the identical reason its own header
 * comment gives: a page calling the setter should never itself
 * re-render just because it changed the value.
 *
 * Deliberately NOT the same thing as the browser's own Fullscreen API
 * (which the Reader also requests, best-effort, alongside this) —
 * this in-app flag is what ACTUALLY hides the sidebar/header and needs
 * no browser permission/gesture rules to work, so focus mode is always
 * available even where real fullscreen is blocked (e.g. inside an
 * iframe without `allow="fullscreen"`).
 */
const FocusModeValueContext = createContext(false)
const FocusModeSetterContext = createContext<(active: boolean) => void>(() => {})

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  return (
    <FocusModeSetterContext.Provider value={setActive}>
      <FocusModeValueContext.Provider value={active}>{children}</FocusModeValueContext.Provider>
    </FocusModeSetterContext.Provider>
  )
}

/** AppShell/AppShellHeader call this to know whether to hide their own
 * chrome — read-only, so a component that only NEEDS the value (and
 * never toggles it) can subscribe without also pulling in the setter. */
export function useFocusModeActive() {
  return useContext(FocusModeValueContext)
}

/** A page calls this to read + control focus mode. Automatically turns
 * focus mode back OFF on unmount (a plain `useEffect` cleanup) — so
 * navigating away from the Reader always restores the shell, even if a
 * reader somehow left focus mode on; no other page needs to remember
 * to clean this up itself. */
export function useFocusMode() {
  const active = useContext(FocusModeValueContext)
  const setActive = useContext(FocusModeSetterContext)
  useEffect(() => {
    return () => setActive(false)
  }, [setActive])
  return { active, setActive }
}
