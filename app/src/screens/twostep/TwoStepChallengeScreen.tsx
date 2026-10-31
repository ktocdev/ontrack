import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { CodeInput } from '../../components/CodeInput'
import { Screen } from '../../components/Screen'
import { IconChevronLeft, IconShieldTick, Logo } from '../../components/icons'
import { saveDeviceToken } from '../../auth/twoStep'
import { supabase } from '../../lib/supabase'
import { rememberThisPhone, spendBackupCode, TwoStepError, useRefreshMe, verifyAuthenticatorCode } from './useTwoStep'

/**
 * Sign in · 2-step code (design/screens/MFA-Challenge), with its backup-code state.
 * Back signs out, since the password has already been accepted. A password reset
 * uses it too (`onPassed`), but there Auth accepts only the authenticator, so it
 * drops the backup code and the 30 days. A backup code can't remember the phone
 * either, or one code plus the password would be 30 days without a second step.
 */
export function TwoStepChallengeScreen({
  onBack,
  onPassed,
}: {
  onBack: () => void | Promise<void>
  /** Set for the password reset; otherwise this is the sign-in step. */
  onPassed?: () => void
}) {
  const forReset = Boolean(onPassed)
  const refreshMe = useRefreshMe()
  const [backup, setBackup] = useState(false)
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)

  const verify = useMutation({
    mutationFn: async () => {
      if (backup) await spendBackupCode(code)
      else await verifyAuthenticatorCode(code)
      if (forReset) return
      if (remember && !backup) {
        const [token, session] = await Promise.all([rememberThisPhone(), supabase!.auth.getSession()])
        const userId = session.data.session?.user.id
        if (token && userId) saveDeviceToken(userId, token)
      }
      await refreshMe()
    },
    onSuccess: onPassed,
  })

  const ready = backup ? code.replace(/-/g, '').length === 8 : code.length === 6
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ready) verify.mutate()
  }
  const error = verify.error
    ? verify.error instanceof TwoStepError
      ? verify.error.message
      : "Couldn't check that. Check your connection and try again."
    : null

  return (
    <Screen>
      <div className="mb-2 flex flex-none items-center gap-1 border-b border-border pb-2 pl-3 pr-3 pt-[calc(12px+var(--safe-top))]">
        <button
          type="button"
          aria-label="Back to sign in"
          onClick={() => void onBack()}
          className="flex h-11 w-11 items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </button>
        <Logo size={24} />
        <span className="ml-1 font-display text-17 font-bold">OnTrack</span>
      </div>

      <form
        onSubmit={submit}
        className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-[max(28px,var(--safe-bottom))] pt-7"
        noValidate
      >
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-brand-tint text-brand">
          <IconShieldTick />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-26 font-bold tracking-[-0.02em]">
            {backup ? 'Use a backup code' : 'Enter your code'}
          </h1>
          <p className="text-15 leading-normal text-text-secondary">
            {backup
              ? 'Enter one of the 8 backup codes you saved when you set up 2-step verification. Each one works once.'
              : 'Open your authenticator app and enter the 6-digit code for OnTrack.'}
          </p>
        </div>
        <CodeInput
          key={backup ? 'backup' : 'totp'}
          id="two-step-code"
          label={backup ? 'Backup code' : 'Verification code'}
          mode={backup ? 'backup' : 'totp'}
          size={26}
          value={code}
          onChange={(next) => {
            setCode(next)
            if (verify.isError) verify.reset()
          }}
          error={error}
        />
        {!forReset && !backup && (
          <label className="flex min-h-tap cursor-pointer items-start gap-2.5 text-14 leading-[1.4] text-text-body">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="m-0 h-5 w-5 flex-none accent-brand-fill"
            />
            Don&apos;t ask again on this phone for 30 days
          </label>
        )}
        <Button type="submit" loading={verify.isPending} disabled={!ready}>
          Verify
        </Button>
        {!forReset && (
          <button
            type="button"
            onClick={() => {
              setBackup(!backup)
              setCode('')
              verify.reset()
            }}
            className="min-h-tap self-center px-2 text-14 font-semibold text-brand"
          >
            {backup ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>
        )}
        <div className="flex-1" />
        <p className="text-center text-13 leading-normal text-text-secondary">
          {forReset
            ? 'Lost your phone? Your IT admin can reset 2-step verification. Then ask for a new reset link.'
            : 'Lost your phone and your backup codes? Your IT admin can reset 2-step verification for you.'}
        </p>
      </form>
    </Screen>
  )
}
