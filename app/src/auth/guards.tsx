import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { AppRole } from '../lib/supabase'
import { ROLE_HOME, ROLE_LABEL } from '../app/roles'
import { NoAccessScreen } from '../screens/errors/NoAccessScreen'
import { NotConfiguredScreen } from '../screens/errors/NotConfiguredScreen'
import { CenteredLoading } from '../screens/loading/CenteredLoading'
import { useAuth } from './context'

/**
 * Route guards. RequireAuth sits above every signed-in route: it shows the
 * centered spinner while the session and profile load, sends signed-out
 * people to /sign-in with a return path, and shows the no-access screen to a
 * session with no visible profile (deactivated or uninvited).
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  switch (auth.status) {
    case 'unconfigured':
      return <NotConfiguredScreen />
    case 'loading':
      return <CenteredLoading title="Signing you in…" body="This only takes a moment." />
    case 'signed-out':
      return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />
    case 'no-profile':
      return (
        <NoAccessScreen
          title="Your account is not set up for OnTrack"
          body="This sign-in is not linked to a restaurant group, or it has been deactivated. Ask your admin for an invite."
          email={auth.email ?? undefined}
          onSwitchAccount={auth.signOut}
          hideAsk
        />
      )
    case 'signed-in':
      return children ?? <Outlet />
  }
}

/** Only these roles may enter; everyone else sees the no-access screen. */
export function RequireRole({ roles, area, children }: { roles: AppRole[]; area: string; children?: ReactNode }) {
  const auth = useAuth()
  if (auth.status !== 'signed-in') return null
  if (!roles.includes(auth.user.role)) {
    return (
      <NoAccessScreen
        title={`You don't have access to ${area}`}
        body={
          <>
            This area is for <b className="text-text">{roles.map((r) => ROLE_LABEL[r]).join(' and ')}</b> accounts. You
            are signed in as {ROLE_LABEL[auth.user.role]}.
          </>
        }
        backTo={ROLE_HOME[auth.user.role]}
        email={auth.user.email}
        onSwitchAccount={auth.signOut}
      />
    )
  }
  return children ?? <Outlet />
}

/** "/" sends each role to its home tab. */
export function RoleHome() {
  const auth = useAuth()
  if (auth.status !== 'signed-in') return null
  return <Navigate to={ROLE_HOME[auth.user.role]} replace />
}
