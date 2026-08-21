import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

/**
 * Lets a routed page inject content (e.g. a page-specific action
 * button) into the persistent global Header's end slot, so a control
 * that's logically "part of the page" can still render in the same
 * header row as the brand/language toggle — matching the approved
 * mockups, where the Reader's "Reading settings" button sits in that
 * top bar.
 *
 * Split into two contexts deliberately: a page calling useHeaderSlot()
 * must only ever subscribe to the *setter*, never the current value.
 * useState's setter has a stable identity across renders (a documented
 * React guarantee) — subscribing only to it means calling it does not
 * re-render the calling page. Putting both in one context (or one
 * [value, setter] tuple) means the page would also re-render on every
 * content change, re-run its effect, call the setter again with a new
 * element reference, and loop forever — confirmed the hard way (React
 * error #185, "Maximum update depth exceeded") before this fix.
 */

const HeaderSlotValueContext = createContext<ReactNode>(null)
const HeaderSlotSetterContext = createContext<(node: ReactNode) => void>(() => {})

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null)
  return (
    <HeaderSlotSetterContext.Provider value={setContent}>
      <HeaderSlotValueContext.Provider value={content}>{children}</HeaderSlotValueContext.Provider>
    </HeaderSlotSetterContext.Provider>
  )
}

/** Header calls this — re-renders only when the slot content itself
 * changes. */
export function useHeaderSlotContent() {
  return useContext(HeaderSlotValueContext)
}

/** A page calls this with the content it wants shown in the shared
 * header; cleared automatically on unmount/navigation. Runs as a
 * layout effect (not a regular effect) so there's no visible flash of
 * an empty slot. */
export function useHeaderSlot(node: ReactNode) {
  const setContent = useContext(HeaderSlotSetterContext)
  useLayoutEffect(() => {
    setContent(node)
    return () => setContent(null)
  })
}
