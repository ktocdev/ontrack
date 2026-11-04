import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Button } from '../../components/Button'
import { Input, PasswordField, PasswordRules } from '../../components/Field'
import { Screen } from '../../components/Screen'
import { BrandMark } from '../../components/icons'
import { MAX_PASSWORD, passwordReady } from '../../auth/validation'
import { FunctionError } from '../../lib/functions'
import { ServerErrorScreen } from '../errors/ServerErrorScreen'
import { CheckingInvite } from '../loading/CenteredLoading'
import { LinkExpiredScreen } from './LinkExpiredScreen'
import { useAcceptInvite, useInviteLink, useRequestNewInvite } from './useInviteLink'

/**
 * /invite#<token>, where the invite email lands: checks the link, then Set up
 * account (design/screens/Account-Setup) or Link expired. Creating the account
 * signs the person in and takes them to their role's home. The board's rule is 10
 * characters; the project's minimum is 12.
 */
export function SetUpAccountScreen() {
  const token = useLocation().hash.slice(1)
  const link = useInviteLink(token)
  const request = useRequestNewInvite(token)

  if (token === '') return <UnusableLink />
  if (link.isPending) return <CheckingInvite />
  if (link.isError) return <ServerErrorScreen error={link.error} onRetry={() => void link.refetch()} />

  switch (link.data.state) {
    case 'valid':
      return (
        <AccountForm token={token} email={link.data.email} name={link.data.full_name} summary={link.data.summary} />
      )
    case 'expired':
      return (
        <LinkExpiredScreen
          onRequest={() => request.mutate()}
          requesting={request.isPending}
          requested={request.isSuccess}
          failed={request.isError}
        />
      )
    case 'used':
      return (
        <LinkExpiredScreen
          title="This invite was already used"
          body="Your account is set up. Sign in with your email and password."
        />
      )
    case 'invalid':
      return <UnusableLink />
  }
}

function UnusableLink() {
  return (
    <LinkExpiredScreen
      title="This invite link isn't valid"
      body="It may have been replaced by a newer invite or revoked. Ask your IT admin to send you a new one."
    />
  )
}

function AccountForm({
  token,
  email,
  name: invitedName,
  summary,
}: {
  token: string
  email: string
  name: string
  summary: string
}) {
  const [name, setName] = useState(invitedName)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const accept = useAcceptInvite(token)

  const mismatch = confirm.length > 0 && confirm !== password
  const ready = name.trim() !== '' && passwordReady(password) && confirm === password
  const code = accept.error instanceof FunctionError ? accept.error.code : accept.error ? 'sign_in' : null

  // Accepted, or someone else finished it in another tab: either way this link is spent.
  if (accept.isSuccess) return <Navigate to="/" replace />
  if (code === 'link_used') {
    return (
      <LinkExpiredScreen
        title="This invite was already used"
        body="Your account is set up. Sign in with your email and password."
      />
    )
  }
  if (code === 'link_expired') return <LinkExpiredScreen />
  if (code === 'link_invalid') return <UnusableLink />
  // The account exists but signing in failed; the sign-in screen can do the rest.
  if (code === 'sign_in') return <Navigate to="/sign-in" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) accept.mutate({ fullName: name.trim(), password })
  }

  return (
    <Screen>
      <form
        onSubmit={submit}
        onChange={() => {
          if (accept.isError) accept.reset()
        }}
        className="flex min-h-0 flex-1 flex-col"
        noValidate
      >
        <div className="relative flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-4 pt-[calc(32px+var(--safe-top))]">
          <BrandMark />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-28 font-bold tracking-[-0.02em]">Set up your account</h1>
            <p className="text-14 leading-[1.45] text-text-secondary">{summary}</p>
          </div>
          <Input label="Email" type="email" value={email} readOnly autoComplete="username" />
          <Input
            label="Your name"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-2.5">
            <PasswordField
              label="Create password"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordRules password={password} />
          </div>
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            maxLength={MAX_PASSWORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? "Doesn't match the password above." : undefined}
          />
        </div>
        <div className="flex flex-none flex-col gap-2.5 px-6 pb-[max(28px,var(--safe-bottom))] pt-4">
          {code && (
            <span role="alert" className="text-13 font-semibold text-danger">
              {code === 'weak_password'
                ? 'Pick a longer or less common password.'
                : "Couldn't create your account. Check your connection and try again."}
            </span>
          )}
          <Button type="submit" loading={accept.isPending} disabled={!ready}>
            Create account
          </Button>
        </div>
      </form>
    </Screen>
  )
}
