import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useUser } from '../../auth/context'
import { TwoStepSetupScreen } from './TwoStepSetupScreen'

/** /profile/2-step, for anyone not required to have it. Checked on the way in only, since setup turns it on partway. */
export function TurnOnTwoStepScreen() {
  const { twoStep } = useUser()
  const navigate = useNavigate()
  const [alreadyOn] = useState(twoStep.on)
  if (alreadyOn) return <Navigate to="/profile" replace />
  return <TwoStepSetupScreen onDone={() => navigate('/profile')} />
}
