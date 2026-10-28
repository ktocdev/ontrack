import { createContext, useContext } from 'react'
import type { AuthState, SignedIn } from './types'

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For screens that only render inside RequireAuth; throws otherwise. */
export function useUser(): SignedIn {
  const auth = useAuth()
  if (auth.status !== 'signed-in') throw new Error('useUser called while not signed in')
  return auth
}

/** Like useAuth, but tolerates rendering outside the provider (error boundaries). */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext)
}
