import { Outlet } from 'react-router'
import { Header } from './Header'
import { HeaderSlotProvider } from './HeaderSlot'

/** Persistent app shell for every route: shared Header + routed page
 * content. */
export function Layout() {
  return (
    <HeaderSlotProvider>
      <div className="flex min-h-svh flex-col">
        <Header />
        <Outlet />
      </div>
    </HeaderSlotProvider>
  )
}
