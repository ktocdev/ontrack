import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { TabBar } from '../components/TabBar'
import { AppSidebar } from './AppSidebar'
import { useUser } from '../auth/context'
import { syncPush } from '../pwa/push'
import { InstallOnce } from '../pwa/InstallOnce'
import { tabsFor } from './roles'

/**
 * The frame every signed-in tab screen renders inside: the screen fills the
 * viewport column and the role's tab bar stays at the bottom. From 768 px the
 * sidebar takes the tab bar's place (OT-157). Detail screens render in
 * SignedInShell, which has the sidebar but no tab bar. The first one opened on a phone that
 * can install the app offers it, once (OT-72). Someone who holds Admin on top of their role
 * gets the admin view's tab bar under /admin and their role's everywhere else (OT-123).
 */
export function Shell() {
  const { user, viewingAs } = useUser()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const tabs = tabsFor(user, pathname)
  // A detail screen kept in this shell so its list stays beside it on a laptop (OT-159)
  // has no tab bar on a phone, as in SignedInShell.
  const bare = useMatches().some((m) => (m.handle as { bare?: boolean } | undefined)?.bare)
  // Nothing depends on this working: a device that misses it just tries again next time.
  // It may turn push back on, so Profile's switch reads the device again after.
  useEffect(() => {
    if (viewingAs) return
    void syncPush(user.id)
      .catch(() => undefined)
      .then(() => queryClient.invalidateQueries({ queryKey: ['push-device'] }))
  }, [user.id, viewingAs, queryClient])
  return (
    <Frame>
      <Outlet />
      {!bare && <TabBar label={tabs.label} items={tabs.items} phoneOnly />}
      <InstallOnce skip={!!viewingAs} />
    </Frame>
  )
}

/**
 * A signed-in detail screen (a ticket, Profile, a form): no tab bar on a phone, and the
 * sidebar from 768 px so a computer never loses its way home (OT-157).
 */
export function SignedInShell() {
  return (
    <Frame>
      <Outlet />
    </Frame>
  )
}

/**
 * The tablet-and-up row: the sidebar beside the screen's column, the whole row capped at
 * 1440 px and centered past that. Below 768 px the sidebar is hidden and this is the
 * phone's full-height column, as before.
 */
export function Frame({ sidebar = <AppSidebar />, children }: { sidebar?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh justify-center bg-bg text-text">
      {/* Past the sidebar's links in one press, for the keyboard (OT-162). Seen only when focused. */}
      <button
        type="button"
        onClick={() => document.getElementById('content')?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2.5 focus:text-14 focus:font-semibold focus:text-brand focus:shadow-raised"
      >
        Skip to content
      </button>
      <div className="flex min-h-0 w-full max-w-desktop">
        {sidebar}
        <div id="content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Full-height frame with no tab bar (detail screens, auth, errors). */
export function BareShell({ children }: { children?: ReactNode }) {
  return <div className="flex h-dvh flex-col bg-bg text-text">{children ?? <Outlet />}</div>
}
