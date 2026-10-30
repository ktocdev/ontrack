import { useMutation, useQuery } from '@tanstack/react-query'
import { callFunction } from '../../lib/functions'
import { requireSupabase } from '../../lib/supabase'

/**
 * The invite link, for someone with no account yet. Its token is the only
 * credential and it stays in the URL fragment, which never reaches a server; the
 * invite-user function takes it from the request body and compares its hash.
 */

export type InviteLink =
  { state: 'valid'; email: string; full_name: string; summary: string } | { state: 'expired' | 'used' | 'invalid' }

export function useInviteLink(token: string) {
  return useQuery({
    queryKey: ['invite-link', token],
    enabled: token !== '',
    retry: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: () => callFunction<InviteLink>('invite-user', { action: 'check', token }),
  })
}

/** Create the account, then sign in with it. */
export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: async ({ fullName, password }: { fullName: string; password: string }) => {
      const { email } = await callFunction<{ email: string }>('invite-user', {
        action: 'accept',
        token,
        full_name: fullName,
        password,
      })
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
    },
  })
}

export function useRequestNewInvite(token: string) {
  return useMutation({
    mutationFn: () => callFunction('invite-user', { action: 'request_new', token }),
  })
}
