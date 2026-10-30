import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { CodeInput } from '../../components/CodeInput'
import { Screen, ScreenBody, TitleBar } from '../../components/Screen'
import { useUser } from '../../auth/context'
import { BackupCodes } from './BackupCodes'
import { TwoStepError, useNeedsCode, useRefreshMe, verifyAuthenticatorCode } from './useTwoStep'

/**
 * Profile · Backup codes. The saved codes can't be shown again, since only their
 * hashes are kept, so this is how many are left and a way to replace them. No board
 * draws it: the Profile board links straight to MFA-Backup, which would replace
 * working codes just for looking. New codes take a real authenticator code, so a
 * password with a remembered phone can't take over the account's recovery.
 */
export function NewBackupCodesScreen() {
  const { twoStep } = useUser()
  const navigate = useNavigate()
  const refreshMe = useRefreshMe()
  const needsCode = useNeedsCode()
  const [code, setCode] = useState('')
  const [round] = useState(() => crypto.randomUUID())
  const [showing, setShowing] = useState(false)

  const go = useMutation({
    mutationFn: async () => {
      if (needsCode.data) await verifyAuthenticatorCode(code)
    },
    onSuccess: () => setShowing(true),
  })

  if (!twoStep.on) return <Navigate to="/profile" replace />
  if (showing) {
    return (
      <Screen>
        <BackupCodes
          round={round}
          header={<TitleBar to="/profile" label="Back to profile" title="Backup codes" />}
          onDone={() => void refreshMe().then(() => navigate('/profile'))}
        />
      </Screen>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    go.mutate()
  }
  const error = go.error
    ? go.error instanceof TwoStepError
      ? go.error.message
      : "Couldn't check that. Check your connection and try again."
    : null

  return (
    <Screen>
      <TitleBar to="/profile" label="Back to profile" title="Backup codes" />
      <ScreenBody className="pb-6 pt-5">
        <form onSubmit={submit} className="flex flex-col gap-[18px]" noValidate>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-22 font-bold tracking-[-0.01em]">
              {twoStep.codesLeft} of 8 backup codes left
            </h2>
            <p className="text-15 leading-normal text-text-secondary">
              Each code gets you in once if you lose your phone. Getting new ones replaces any you have left, so the old
              ones stop working.
            </p>
          </div>
          {needsCode.data && (
            <CodeInput
              id="new-codes-code"
              label="Code from your authenticator app"
              size={26}
              value={code}
              onChange={(next) => {
                setCode(next)
                if (go.isError) go.reset()
              }}
              error={error}
            />
          )}
          <Button
            type="submit"
            loading={go.isPending}
            disabled={needsCode.isPending || (needsCode.data === true && code.length !== 6)}
          >
            Get new codes
          </Button>
        </form>
      </ScreenBody>
    </Screen>
  )
}
