import { Navigate, useParams } from 'react-router'
import { ROLE_HOME, ROLE_LABEL, ticketPath } from '../../app/roles'
import { useAuth } from '../../auth/context'
import { NoAccessScreen } from '../errors/NoAccessScreen'

/**
 * A ticket's lasting link, /t/<id>, for sharing and for notifications. It opens the right
 * screen for whoever taps it and grants nothing: that screen still asks the database, so
 * a ticket someone can't see is the same refusal as any other. RequireAuth above it takes
 * a signed-out person through sign-in and back. Admin and leadership have no ticket screen
 * until Phase 7.
 */
export function TicketLinkScreen() {
  const { id = '' } = useParams()
  const auth = useAuth()
  if (auth.status !== 'signed-in') return null

  const path = ticketPath(auth.user.role, id)
  if (path) return <Navigate to={path} replace />
  return (
    <NoAccessScreen
      title="Tickets don't open here yet"
      body={
        <>
          This link opens for <b className="text-text">Manager</b> and <b className="text-text">Ops Manager</b>{' '}
          accounts. You are signed in as {ROLE_LABEL[auth.user.role]}.
        </>
      }
      backTo={ROLE_HOME[auth.user.role]}
      backLabel="Go to my home screen"
      email={auth.user.email}
      onSwitchAccount={auth.signOut}
      hideAsk
    />
  )
}
