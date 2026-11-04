import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Input, PasswordField } from '../../components/Field'
import { Screen } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { IconLockSmall } from '../../components/icons'
import { useAuth } from '../../auth/context'
import { firstName } from '../../auth/session'
import { MIN_PASSWORD, signInErrorMessage } from '../../auth/validation'
import { supabase } from '../../lib/supabase'

/**
 * Error · Signed out (design/screens/Error-Session). A white sheet over the
 * screen the person was on: lock badge, 22px title, the email read-only, a
 * password field and "Sign in and continue". It cannot be swiped away; "Not
 * Maya?" goes to the full Sign in screen instead.
 */
type Props = {
  open: boolean
  email: string
  name?: string
  /** Resolves to an error sentence, or null when signed in. */
  onSignIn: (password: string) => Promise<string | null>
  onNotMe: () => void
}

export function SignedOutSheet({ open, email, name, onSignIn, onNotMe }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const first = firstName(name)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await onSignIn(password)
    setBusy(false)
    if (err) setError(err)
    else setPassword('')
  }

  return (
    <Sheet
      open={open}
      onOpenChange={() => undefined}
      modal
      surface
      title="You've been signed out"
      description="For security, OnTrack signs you out after 12 hours. Sign in to pick up where you left off."
      icon={
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-status-waiting-bg text-status-waiting-text"
        >
          <IconLockSmall />
        </span>
      }
    >
      <form onSubmit={submit} onChange={() => setError(null)} className="flex flex-col gap-3.5">
        <Input label="Work email" type="email" value={email} readOnly autoComplete="username" />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          autoFocus
        />
        <Button type="submit" loading={busy} disabled={password.length < MIN_PASSWORD}>
          Sign in and continue
        </Button>
      </form>
      <div className="-my-1 flex justify-between">
        <Link
          to="/reset"
          state={{ email }}
          onClick={onNotMe}
          className="flex min-h-tap items-center px-1 text-14 font-semibold no-underline"
        >
          Forgot password?
        </Link>
        <button
          type="button"
          onClick={onNotMe}
          className="flex min-h-tap items-center px-1 text-14 font-semibold text-brand hover:text-brand-strong"
        >
          {first ? `Not ${first}?` : 'Not you?'}
        </button>
      </div>
    </Sheet>
  )
}

/** What RequireAuth shows for an expired session: the sheet over an empty screen. */
export function SignedOutScreen() {
  const auth = useAuth()
  if (auth.status !== 'expired') return null
  const signIn = async (password: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email: auth.email, password })
    return error ? signInErrorMessage(error) : null
  }
  return (
    <Screen>
      <SignedOutSheet open email={auth.email} name={auth.name} onSignIn={signIn} onNotMe={auth.dismiss} />
    </Screen>
  )
}
