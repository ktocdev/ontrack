import { Navigate, useParams } from 'react-router'
import { equipmentPath, ROLE_HOME, ROLE_LABEL } from '../../app/roles'
import { useAuth } from '../../auth/context'
import { NoAccessScreen } from '../errors/NoAccessScreen'

/**
 * A unit's lasting link, /e/<id>, from Share link and later its QR label (OT-74). It opens
 * the unit's page for whoever taps it and grants nothing: that page still asks the
 * database, so a unit someone can't see is the same not-found as any other. RequireAuth
 * above it takes a signed-out person through sign-in and back. Admin and leadership have
 * no equipment screen.
 */
export function EquipmentLinkScreen() {
  const { id = '' } = useParams()
  const auth = useAuth()
  if (auth.status !== 'signed-in') return null

  const path = equipmentPath(auth.user.role, id)
  if (path) return <Navigate to={path} replace />
  return (
    <NoAccessScreen
      title="Equipment doesn't open here"
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
