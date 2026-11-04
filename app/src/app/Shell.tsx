import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { TabBar } from '../components/TabBar'
import { useUser } from '../auth/context'
import { syncPush } from '../pwa/push'
import { ROLE_TABS } from './roles'

/**
 * The frame every signed-in screen renders inside: the screen fills the
 * viewport column and the role's tab bar stays at the bottom. Detail screens
 * that hide the tab bar render outside this layout.
 */
export function Shell() {
  const { user, viewingAs } = useUser()
  const queryClient = useQueryClient()
  const tabs = ROLE_TABS[user.role]
  // Nothing depends on this working: a device that misses it just tries again next time.
  // It may turn push back on, so Profile's switch reads the device again after.
  useEffect(() => {
    if (viewingAs) return
    void syncPush(user.id)
      .catch(() => undefined)
      .then(() => queryClient.invalidateQueries({ queryKey: ['push-device'] }))
  }, [user.id, viewingAs, queryClient])
  return (
    <div className="flex h-dvh flex-col bg-bg text-text">
      <Outlet />
      <TabBar label={tabs.label} items={tabs.items} />
    </div>
  )
}

/** Full-height frame with no tab bar (detail screens, auth, errors). */
export function BareShell({ children }: { children?: ReactNode }) {
  return <div className="flex h-dvh flex-col bg-bg text-text">{children ?? <Outlet />}</div>
}
