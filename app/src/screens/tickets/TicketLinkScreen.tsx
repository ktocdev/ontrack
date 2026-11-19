import { Navigate, useParams } from 'react-router'
import { ticketPath } from '../../app/roles'
import { useAuth } from '../../auth/context'
import { useTicketLink } from './useTicketLink'

/**
 * A ticket's lasting link, /t/OT-1042, for sharing, notifications and typing in; a link
 * sent before OT-62 carries the ticket's id instead, and still opens. It opens the right
 * screen for whoever taps it and grants nothing: that screen still asks the database, so
 * a ticket someone can't see is the same refusal as any other. RequireAuth above it takes
 * a signed-out person through sign-in and back. Leadership's (OT-145) and the plain
 * admin's (OT-148) tickets are read-only.
 */
export function TicketLinkScreen() {
  const { id = '' } = useParams()
  const auth = useAuth()
  const ticket = useTicketLink(id, auth.status === 'signed-in')
  if (auth.status !== 'signed-in' || ticket.loading) return null
  return <Navigate to={ticketPath(auth.user.role, ticket.id)} replace />
}
