import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { PasswordField, PasswordRules } from '../../components/Field'
import { Screen } from '../../components/Screen'
import { BrandMark, IconCheck } from '../../components/icons'
import { clearStamp } from '../../auth/session'
import { MAX_PASSWORD, passwordReady } from '../../auth/validation'
import { requireSupabase } from '../../lib/supabase'
import { ServerErrorScreen } from '../errors/ServerErrorScreen'
import { LinkExpiredScreen } from '../invite/LinkExpiredScreen'
import { CenteredLoading } from '../loading/CenteredLoading'
import { TwoStepChallengeScreen } from '../twostep/TwoStepChallengeScreen'
import { useNeedsCode } from '../twostep/useTwoStep'
import {
  hasSessionTokens,
  readResetLink,
  ResetError,
  useRequestReset,
  useResetLink,
  useSaveNewPassword,
} from './useReset'

/**
 * /reset/new#token_hash=…&email=…, where the reset email lands: spends the link,
 * then Password reset · 4 New password (design/screens/Reset-New) or Link expired.
 * Only a link opens the form, so a signed-in person cannot come here to change a
 * password without their current one. The board's rule is 10 characters; the
 * project's minimum is 12. Its "different from your last password" can only be
 * known by Auth, so it comes back as an error on save.
 */
export function ResetNewScreen() {
  const { hash } = useLocation()
  const { tokenHash, email: linkEmail } = readResetLink(hash)
  const link = useResetLink(tokenHash)
  const request = useRequestReset()
  const navigate = useNavigate()

  // Supabase's stock email links here with live tokens in the fragment, which this
  // app never uses. Take them out of the address bar and say what is wrong.
  const stockLink = hasSessionTokens(hash)
  useEffect(() => {
    if (stockLink) window.history.replaceState(null, '', window.location.pathname)
  }, [stockLink])
  if (stockLink) {
    return (
      <LinkExpiredScreen
        title="This reset link isn't set up right"
        body="Your password hasn't changed. The reset email needs updating, so please tell your IT admin."
      />
    )
  }

  if (tokenHash !== '' && link.isPending) return <CenteredLoading title="Checking your link…" />
  if (link.isError) return <ServerErrorScreen error={link.error} onRetry={() => void link.refetch()} />
  if (tokenHash !== '' && link.data) return <AfterLink email={link.data} />

  return (
    <LinkExpiredScreen
      title="This reset link has expired"
      body="Reset links work for 30 minutes and only once. Your password hasn't changed. Get a fresh link below."
      requestLabel="Email me a new link"
      requestedLabel="New link sent"
      requestedText={`Check ${linkEmail}. The new link works for 30 minutes.`}
      // A link with no address in it can't be answered here, so ask for one.
      onRequest={() => (linkEmail ? request.mutate(linkEmail) : navigate('/reset'))}
      requesting={request.isPending}
      requested={request.isSuccess}
      failed={request.isError}
    />
  )
}

/** With 2-step on, Auth changes a password only after a code, so a stolen inbox isn't enough. */
function AfterLink({ email }: { email: string }) {
  const needsCode = useNeedsCode()
  const navigate = useNavigate()
  if (needsCode.isPending) return <CenteredLoading title="Checking your link…" />
  if (needsCode.isError) return <ServerErrorScreen error={needsCode.error} onRetry={() => void needsCode.refetch()} />
  if (needsCode.data) {
    return (
      <TwoStepChallengeScreen
        onBack={async () => {
          clearStamp()
          await requireSupabase().auth.signOut({ scope: 'local' })
          navigate('/sign-in', { replace: true })
        }}
        onPassed={() => void needsCode.refetch()}
      />
    )
  }
  return <NewPasswordForm email={email} />
}

function NewPasswordForm({ email }: { email: string }) {
  const navigate = useNavigate()
  const save = useSaveNewPassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [signOutOthers, setSignOutOthers] = useState(true)

  const matches = confirm === password
  const ready = passwordReady(password) && matches

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    save.mutate(
      { password, signOutOthers },
      { onSuccess: () => navigate('/reset/done', { replace: true, state: { signOutOthers } }) },
    )
  }

  return (
    <Screen>
      <form
        onSubmit={submit}
        onChange={() => {
          if (save.isError) save.reset()
        }}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="relative flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-4 pt-[calc(32px+var(--safe-top))]">
          <BrandMark />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-28 font-bold tracking-[-0.02em]">Choose a new password</h1>
            <p className="text-14 leading-[1.45] text-text-secondary [overflow-wrap:anywhere]">For {email}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <PasswordField
              label="New password"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordRules password={password} />
          </div>
          <div className="flex flex-col gap-1.5">
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && (
              <span
                aria-live="polite"
                className={`flex items-center gap-2 text-13 font-semibold ${matches ? 'text-brand' : 'text-danger'}`}
              >
                <span aria-hidden="true" className="flex w-3.5 flex-none justify-center">
                  {matches ? <IconCheck size={14} /> : '!'}
                </span>
                {matches ? 'Passwords match' : "Passwords don't match yet"}
              </span>
            )}
          </div>
          <label className="flex min-h-tap cursor-pointer items-start gap-2.5 text-14 leading-[1.4] text-text-body">
            <input
              type="checkbox"
              checked={signOutOthers}
              onChange={(e) => setSignOutOthers(e.target.checked)}
              className="m-0 h-5 w-5 flex-none accent-brand-fill"
            />
            Sign me out on other phones and computers
          </label>
        </div>
        <div className="flex flex-none flex-col gap-2.5 px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
          {save.isError && (
            <span role="alert" className="text-13 font-semibold text-danger">
              {save.error instanceof ResetError ? save.error.message : 'Something went wrong. Try again.'}
            </span>
          )}
          <Button type="submit" loading={save.isPending} disabled={!ready}>
            Save new password
          </Button>
        </div>
      </form>
    </Screen>
  )
}
