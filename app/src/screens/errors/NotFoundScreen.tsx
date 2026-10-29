import { Link } from 'react-router'
import { ButtonLink } from '../../components/Button'
import { Avatar } from '../../components/Avatar'
import { IconMapLost, Logo } from '../../components/icons'
import { Screen } from '../../components/Screen'
import { TabBar } from '../../components/TabBar'
import { ROLE_EQUIPMENT, ROLE_HOME, ROLE_TABS } from '../../app/roles'
import { useOptionalAuth } from '../../auth/context'
import { ErrorBlock } from './ErrorBlock'

/** Error · Page not found (404). Keeps the role's tab bar when signed in. */
export function NotFoundScreen() {
  const auth = useOptionalAuth()
  const user = auth?.status === 'signed-in' ? auth.user : null
  const home = user ? ROLE_HOME[user.role] : '/'
  const equipment = user ? ROLE_EQUIPMENT[user.role] : '/sign-in'

  return (
    <Screen>
      <div className="flex items-center justify-between px-screen pt-safe">
        <span className="mt-5 flex items-center gap-2">
          <Logo />
          <span className="font-display text-17 font-bold">OnTrack</span>
        </span>
        {user && (
          <Link to="/profile" aria-label="Your profile" className="mt-5">
            <Avatar name={user.full_name} role={user.role} />
          </Link>
        )}
      </div>
      <ErrorBlock
        code="Error 404"
        icon={<IconMapLost />}
        title="We can't find that page"
        body="The link may be old, or the ticket or equipment it pointed to was removed."
      >
        <div className="mt-2.5 flex w-full max-w-[260px] flex-col gap-2.5">
          <ButtonLink to={home} variant="primary" className="min-h-[48px] text-15">
            {user ? 'Go to open tickets' : 'Go to sign in'}
          </ButtonLink>
          {user && (
            <ButtonLink to={equipment} variant="small">
              Search equipment
            </ButtonLink>
          )}
        </div>
      </ErrorBlock>
      {user && <TabBar label={ROLE_TABS[user.role].label} items={ROLE_TABS[user.role].items} />}
    </Screen>
  )
}
