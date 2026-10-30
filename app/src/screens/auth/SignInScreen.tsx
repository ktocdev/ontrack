import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Logo } from '../../components/icons'
import { useAuth } from '../../auth/context'
import { MOCK_USERS, writeMockRole } from '../../auth/mock'
import { canSubmitSignIn, signInErrorMessage } from '../../auth/validation'
import { supabase, type AppRole } from '../../lib/supabase'
import { ROLE_HOME, ROLE_LABEL } from '../../app/roles'

/**
 * Sign in (design/screens/Sign-In): a brand cover with the mark, 40px
 * wordmark and tagline, then a panel with 24px top corners rising over it.
 * The button stays disabled until the email has a valid shape and the
 * password has 12 characters. In the e2e build the panel is a role picker.
 */
export function SignInScreen() {
  const auth = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (auth.status === 'signed-in') return <Navigate to={from ?? ROLE_HOME[auth.user.role]} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !canSubmitSignIn(email, password)) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) setError(signInErrorMessage(err))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-brand-fill">
      <div className="flex flex-none flex-col gap-3.5 px-7 pb-10 pt-[max(72px,calc(var(--safe-top)+28px))] text-on-brand">
        <Logo size={48} inverse />
        <h1 className="font-display text-40 font-bold leading-none tracking-[-0.03em]">OnTrack</h1>
        <p className="text-16 leading-[1.45] text-on-brand-muted">Keep every kitchen, dining room and bar running.</p>
      </div>

      <main className="flex flex-1 flex-col gap-[18px] rounded-t-cover bg-bg px-6 pt-8 pb-[calc(28px+var(--safe-bottom))] text-text lg:mx-auto lg:mb-10 lg:w-full lg:max-w-[440px] lg:flex-none lg:rounded-cover">
        <h2 className="font-display text-24 font-bold">Sign in</h2>

        {__E2E_MOCK__ ? (
          <div className="flex flex-col gap-2.5" data-testid="mock-roles">
            <span className="eyebrow">Test build · sign in as</span>
            {(Object.keys(MOCK_USERS) as AppRole[]).map((role) => (
              <Button
                key={role}
                variant="secondary"
                data-testid={`mock-${role}`}
                onClick={() => {
                  writeMockRole(role)
                  window.location.assign(from ?? ROLE_HOME[role])
                }}
              >
                {MOCK_USERS[role].full_name} · {ROLE_LABEL[role]}
              </Button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} onChange={() => setError(null)} className="flex flex-col gap-[18px]" noValidate>
            <Input
              label="Work email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <Link
              to="/reset"
              state={{ email: email.trim() }}
              className="relative flex min-h-8 items-center self-end text-14 font-semibold no-underline before:absolute before:inset-x-0 before:-inset-y-1.5"
            >
              Forgot password?
            </Link>
            <Button type="submit" loading={busy} disabled={!supabase || !canSubmitSignIn(email, password)}>
              Sign in
            </Button>
          </form>
        )}

        <div className="flex-1" />
        <p className="text-center text-13 leading-normal text-text-secondary">
          OnTrack is invite-only. Ask your IT admin for an invite.
        </p>
      </main>
    </div>
  )
}
