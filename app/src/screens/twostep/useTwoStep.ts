import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * 2-step verification through Supabase Auth, which holds the authenticator and
 * raises the session to aal2, plus the database functions for what it doesn't have:
 * backup codes and remembering a phone (see the two_step migration).
 */

export class TwoStepError extends Error {}

const WRONG_CODE = "That code isn't right. Use the newest one in your app."

function codeError(error: { code?: string; status?: number }) {
  if (error.code === 'mfa_verification_failed' || error.code === 'mfa_challenge_expired') return WRONG_CODE
  if (error.status === 429) return 'Too many tries. Wait a few minutes and try again.'
  return "Couldn't check that. Check your connection and try again."
}

/** Everything AuthProvider knows came from before the step just done, so ask again. */
export function useRefreshMe() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['me'] })
}

/** Whether Auth still wants a code from this session, which it does before any password change. */
export function useNeedsCode(enabled = true) {
  return useQuery({
    queryKey: ['two-step', 'needs-code'],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel()
      if (error) throw error
      return data.currentLevel !== 'aal2' && data.nextLevel === 'aal2'
    },
  })
}

/** Raise this session to aal2 with a code from the person's authenticator. */
export async function verifyAuthenticatorCode(code: string) {
  const sb = requireSupabase()
  const { data, error } = await sb.auth.mfa.listFactors()
  if (error) throw new TwoStepError(codeError(error))
  const factor = data.totp[0]
  if (!factor) throw new TwoStepError(WRONG_CODE)
  const result = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (result.error) throw new TwoStepError(codeError(result.error))
}

/** Start again from a new secret; a half-finished one would block the new one. */
export function useEnroll() {
  return useMutation({
    mutationFn: async () => {
      const sb = requireSupabase()
      const { data: factors, error: listError } = await sb.auth.mfa.listFactors()
      if (listError) throw listError
      for (const factor of factors.all.filter((f) => f.status === 'unverified')) {
        const { error } = await sb.auth.mfa.unenroll({ factorId: factor.id })
        if (error) throw error
      }
      const { data, error } = await sb.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'OnTrack',
        friendlyName: 'OnTrack',
      })
      if (error) throw error
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
    },
  })
}

export function useVerifyEnrollment() {
  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { error } = await requireSupabase().auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw new TwoStepError(codeError(error))
    },
  })
}

/**
 * Eight new codes, once per `round`. A query rather than a mutation so a re-render
 * can't replace codes the person is already reading; they are held only in memory.
 */
export function useNewBackupCodes(round: string) {
  return useQuery({
    queryKey: ['two-step', 'new-codes', round],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('new_backup_codes')
      if (error) throw error
      return data
    },
  })
}

/** Past a backup code, for this session only. */
export async function spendBackupCode(code: string) {
  const { data, error } = await requireSupabase().rpc('use_backup_code', { p_code: code })
  if (error) throw new TwoStepError("Couldn't check that. Check your connection and try again.")
  if (data === 'locked') throw new TwoStepError('Too many wrong codes. Wait 15 minutes and try again.')
  if (data !== 'ok') throw new TwoStepError("That code isn't right, or it has been used.")
}

/** A token for this phone; null if it couldn't be made, and they just get asked next time. */
export async function rememberThisPhone() {
  const { data, error } = await requireSupabase().rpc('remember_device')
  return error ? null : data
}
