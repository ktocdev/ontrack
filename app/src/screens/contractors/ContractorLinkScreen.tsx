import { Navigate, useParams } from 'react-router'
import { contractorPath, ROLE_HOME, ROLE_LABEL } from '../../app/roles'
import { useAuth } from '../../auth/context'
import { NoAccessScreen } from '../errors/NoAccessScreen'

/**
 * A contractor's lasting link, /c/<id>, from Share link (OT-95). It opens the contractor's
 * page for whoever taps it and grants nothing: that page still asks the database, and
 * refuses anyone without See contractors. RequireAuth above it takes a signed-out person
 * through sign-in and back. Only Ops has a contractor page until leadership's (Phase 7).
 */
export function ContractorLinkScreen() {
  const { id = '' } = useParams()
  const auth = useAuth()
  if (auth.status !== 'signed-in') return null

  const path = contractorPath(auth.user.role, id)
  if (path) return <Navigate to={path} replace />
  return (
    <NoAccessScreen
      title="Contractors don't open here"
      body={
        <>
          This link opens for <b className="text-text">Ops Manager</b> accounts. You are signed in as{' '}
          {ROLE_LABEL[auth.user.role]}.
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
