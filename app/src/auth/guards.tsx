import { useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { AppRole } from '../lib/supabase'
import { ROLE_HOME, ROLE_LABEL } from '../app/roles'
import { NoAccessScreen } from '../screens/errors/NoAccessScreen'
import { NotConfiguredScreen } from '../screens/errors/NotConfiguredScreen'
import { ServerErrorScreen } from '../screens/errors/ServerErrorScreen'
import { SignedOutScreen } from '../screens/auth/SignedOutSheet'
import { CenteredLoading } from '../screens/loading/CenteredLoading'
import { TwoStepChallengeScreen } from '../screens/twostep/TwoStepChallengeScreen'
import { TwoStepSetupScreen } from '../screens/twostep/TwoStepSetupScreen'
import { useAuth } from './context'

/**
 * Route guards. RequireAuth sits above every signed-in route: it shows the
 * centered spinner while the session and profile load, sends signed-out
 * people to /sign-in with a return path (none if they just signed out on
 * purpose), keeps an expired session on its
 * route behind the signed-out sheet, shows the 500 board with Try again when
 * the profile fails to load, and shows the no-access screen to a session
 * with no visible profile (deactivated or uninvited). A session that owes its
 * second step sees that screen on the route it asked for, and carries on from there.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  // Setup turns 2-step on at its third step, and the person still has to save their
  // codes on the fourth, so it holds the screen until they say Done.
  const [settingUp, setSettingUp] = useState(false)
  if (auth.status === 'two-step' && auth.gate === 'setup' && !settingUp) setSettingUp(true)
  if (settingUp && (auth.status === 'two-step' || auth.status === 'signed-in')) {
    return <TwoStepSetupScreen required signOut={auth.signOut} onDone={() => setSettingUp(false)} />
  }

  switch (auth.status) {
    case 'two-step':
      return <TwoStepChallengeScreen onBack={auth.signOut} />
    case 'unconfigured':
      return <NotConfiguredScreen />
    case 'loading':
      return <CenteredLoading title="Loading…" body="This only takes a moment." />
    case 'expired':
      return <SignedOutScreen />
    case 'error':
      return <ServerErrorScreen error={auth.error} onRetry={auth.retry} />
    case 'signed-out':
      return auth.deliberate ? (
        <Navigate to="/sign-in" replace />
      ) : (
        <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />
      )
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
