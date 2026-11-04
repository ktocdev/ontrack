import { Navigate, useParams } from 'react-router'
import { ROLE_HOME, ROLE_LABEL, ticketPath } from '../../app/roles'
import { useAuth } from '../../auth/context'
import { NoAccessScreen } from '../errors/NoAccessScreen'
import { useTicketLink } from './useTicketLink'

/**
 * A ticket's lasting link, /t/OT-1042, for sharing, notifications and typing in; a link
 * sent before OT-62 carries the ticket's id instead, and still opens. It opens the right
 * screen for whoever taps it and grants nothing: that screen still asks the database, so
 * a ticket someone can't see is the same refusal as any other. RequireAuth above it takes
 * a signed-out person through sign-in and back. Admin and leadership have no ticket screen
 * until Phase 7.
 */
export function TicketLinkScreen() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const role = auth.status === 'signed-in' ? auth.user.role : null
  const ticket = useTicketLink(id, role !== null && ticketPath(role, id) !== null)
  if (auth.status !== 'signed-in' || ticket.loading) return null

  const path = ticketPath(auth.user.role, ticket.id)
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
