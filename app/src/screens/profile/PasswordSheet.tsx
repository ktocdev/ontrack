import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Sheet } from '../../components/Sheet'
import { MIN_PASSWORD } from '../../auth/validation'
import { PasswordError, useChangePassword } from './useProfile'

/**
 * Change password (Profile, passwordSheetOpen): current, new with the
 * 12-character hint, confirm, Update password, Cancel. Mismatches are caught
 * here; a wrong current password comes back from Supabase. "Forgot your
 * current password?" arrives with the reset flow (OT-10).
 */
export function PasswordSheet({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const change = useChangePassword()

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setTouched(false)
    change.reset()
  }
  const close = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const same = next.length > 0 && next === current
  const mismatch = confirm.length > 0 && confirm !== next
  const ready = current.length > 0 && next.length >= MIN_PASSWORD && confirm === next && !same

  const serverError = change.error instanceof PasswordError ? change.error : null
  const newError =
    touched && tooShort
      ? `At least ${MIN_PASSWORD} characters.`
      : same
        ? 'Use a different password from your current one.'
        : serverError?.field === 'new'
          ? serverError.message
          : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!ready) return
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          close(false)
          onDone()
        },
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={close} title="Change password">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={
            serverError?.field === 'current'
              ? serverError.message
              : change.isError && !serverError
                ? 'Something went wrong. Try again.'
                : undefined
          }
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          onBlur={() => setTouched(true)}
          hint={`At least ${MIN_PASSWORD} characters.`}
          error={newError}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Doesn't match the new password." : undefined}
        />
        <Button type="submit" loading={change.isPending} disabled={!ready}>
          Update password
        </Button>
        <Button variant="secondary" onClick={() => close(false)}>
          Cancel
        </Button>
      </form>
    </Sheet>
  )
}
