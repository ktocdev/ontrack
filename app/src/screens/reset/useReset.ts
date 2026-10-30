import { useMutation, useQuery } from '@tanstack/react-query'
import { clearStamp } from '../../auth/session'
import { signInErrorMessage } from '../../auth/validation'
import { requireSupabase } from '../../lib/supabase'

/**
 * Password reset, through Supabase Auth. Whether an address has an account is
 * never shown: Auth answers the same for one with none and sends nothing. The
 * email's link carries a token hash in its fragment, which never reaches a
 * server, and the app spends it when the page opens, so a mail scanner fetching
 * the link cannot use it up. Spending it starts a session for that person.
 */

/** Reads "#token_hash=…&email=…". Not URLSearchParams, which turns the + in a plus address into a space. */
export function readResetLink(hash: string) {
  const fields = new Map(
    hash
      .replace(/^#/, '')
      .split('&')
      .map((pair) => {
        const at = pair.indexOf('=')
        return [pair.slice(0, at), pair.slice(at + 1)] as const
      }),
  )
  const decode = (value: string | undefined) => {
    if (!value) return ''
    try {
      return decodeURIComponent(value)
    } catch {
      return ''
    }
  }
  return { tokenHash: decode(fields.get('token_hash')), email: decode(fields.get('email')) }
}

export class ResetError extends Error {}

export function useRequestReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset/new`,
      })
      if (error) throw new ResetError(signInErrorMessage(error))
    },
  })
}

/** Spend the link once, however many times the page renders. Resolves to the person's email, or null if it is no good. */
export function useResetLink(tokenHash: string) {
  return useQuery({
    queryKey: ['reset-link', tokenHash],
    enabled: tokenHash !== '',
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await requireSupabase().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (error) {
        // Too old, already used or never real. Anything else is worth a retry.
        if (error.status && error.status < 500) return null
        throw error
      }
      return data.user?.email ?? null
    },
  })
}

export function useSaveNewPassword() {
  return useMutation({
    mutationFn: async ({ password, signOutOthers }: { password: string; signOutOthers: boolean }) => {
      const sb = requireSupabase()
      const { error } = await sb.auth.updateUser({ password })
      if (error) {
        if (error.code === 'same_password') throw new ResetError('Use a different password from your last one.')
        if (error.code === 'weak_password') throw new ResetError('Pick a longer or less common password.')
        throw new ResetError("Couldn't save your password. Check your connection and try again.")
      }
      // Done signs in fresh, as the board does. Clearing the stamp first tells
      // AuthProvider this is on purpose, so it doesn't offer the signed-out sheet.
      clearStamp()
      await sb.auth.signOut({ scope: signOutOthers ? 'global' : 'local' })
    },
  })
}
