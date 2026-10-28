import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Logo } from '../../components/icons'
import { Screen, ScreenBody } from '../../components/Screen'
import { useAuth } from '../../auth/context'
import { MOCK_USERS, writeMockRole } from '../../auth/mock'
import { env } from '../../lib/env'
import { supabase, type AppRole } from '../../lib/supabase'
import { ROLE_HOME, ROLE_LABEL } from '../../app/roles'

/**
 * Provisional sign-in. Phase 1 (OT-4) replaces this with the Sign-In board,
 * password reset and 2-step verification. Until then: email and password
 * against Supabase Auth, or, in the e2e build, a role picker.
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
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (err) setError(err.message)
  }

  return (
    <Screen>
      <ScreenBody className="pt-safe">
        <div className="mt-7 flex items-center gap-2">
          <Logo size={28} />
          <span className="font-display text-[18px] font-bold tracking-[-0.01em]">OnTrack</span>
        </div>
        <h1 className="mt-8 font-display text-30 font-bold tracking-[-0.02em]">Sign in</h1>

        {env.e2eMock ? (
          <div className="mt-6 flex flex-col gap-2.5" data-testid="mock-roles">
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
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <Button type="submit" loading={busy} disabled={!supabase}>
              Sign in
            </Button>
            <p className="text-13 leading-normal text-text-secondary">
              Invite-only. Password reset and 2-step verification arrive in Phase 1.
            </p>
          </form>
        )}
      </ScreenBody>
    </Screen>
  )
}
