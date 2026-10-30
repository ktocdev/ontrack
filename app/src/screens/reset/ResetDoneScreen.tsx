import { Navigate, useLocation } from 'react-router'
import { ButtonLink } from '../../components/Button'
import { Screen } from '../../components/Screen'
import { BrandMark, IconCheck } from '../../components/icons'

/** Password reset · 5 Done (design/screens/Reset-Done). Says what happened to the other devices, as chosen. */
export function ResetDoneScreen() {
  const done = useLocation().state as { signOutOthers?: boolean } | null
  if (!done) return <Navigate to="/sign-in" replace />

  return (
    <Screen>
      <div className="px-6 pt-[calc(32px+var(--safe-top))]">
        <BrandMark />
      </div>
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-20 text-center">
        <span className="mb-1.5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand">
          <IconCheck size={30} strokeWidth={2.4} />
        </span>
        <h1 className="font-display text-26 font-bold tracking-[-0.02em]">Password updated</h1>
        <p className="max-w-[300px] text-15 leading-normal text-text-secondary">
          {done.signOutOthers
            ? "You're signed out on your other phones and computers."
            : 'Your other phones and computers stay signed in.'}{' '}
          We also emailed you a note that your password changed.
        </p>
      </div>
      <div className="flex-none px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
        <ButtonLink to="/sign-in" replace>
          Sign in
        </ButtonLink>
      </div>
    </Screen>
  )
}
