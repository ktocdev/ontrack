import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { BrandBackBar, Screen } from '../../components/Screen'
import { looksLikeEmail } from '../../auth/validation'
import { ResetError, useRequestReset } from './useReset'

/**
 * Password reset · 1 Enter email (design/screens/Reset-Request). Comes with the
 * address filled in from wherever the person already typed or showed it.
 */
export function ResetRequestScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const request = useRequestReset()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!looksLikeEmail(email)) return
    request.mutate(email, { onSuccess: () => navigate('/reset/sent', { state: { email: email.trim() } }) })
  }

  const error =
    request.error instanceof ResetError
      ? request.error.message
      : request.error
        ? 'Something went wrong. Try again in a moment.'
        : undefined

  return (
    <Screen>
      <BrandBackBar to="/sign-in" label="Back to sign in" />
      <form
        onSubmit={submit}
        className="relative flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pt-7 pb-[max(28px,var(--safe-bottom))]"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-28 font-bold tracking-[-0.02em]">Reset your password</h1>
          <p className="text-15 leading-normal text-text-secondary">
            Enter your work email. We&apos;ll send you a link to choose a new password.
          </p>
        </div>
        <Input
          label="Work email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" loading={request.isPending} disabled={!looksLikeEmail(email)}>
          Send reset link
        </Button>
        <div className="flex-1" />
        <p className="text-center text-13 leading-normal text-text-secondary">
          No longer have access to that email? Ask your IT admin to update it.
        </p>
      </form>
    </Screen>
  )
}
