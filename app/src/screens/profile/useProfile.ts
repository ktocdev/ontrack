import { createClient } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { useProfilePhotosOn } from '../../auth/group'
import { signInErrorMessage } from '../../auth/validation'
import { env } from '../../lib/env'
import { callFunction } from '../../lib/functions'
import { resizeToJpeg } from '../../lib/image'
import { requireSupabase, supabase } from '../../lib/supabase'
import { TwoStepError, verifyAuthenticatorCode } from '../twostep/useTwoStep'

/**
 * Data for Profile and Help & support. Everything goes through the typed
 * client under RLS: people may change their own name, phone and photo
 * (protect_profile_columns refuses the rest) and file support reports as
 * themselves. Flows that write are tested against the seeded local stack
 * (e2e/stack), so there is no stand-in path here.
 */

const AVATAR_TTL = 60 * 60

/**
 * A signed URL for a profile photo, refreshed before it runs out. Every avatar comes
 * through here, so with profile photos off for the group they all fall back to initials.
 */
export function useAvatarUrl(path: string | null | undefined) {
  const photosOn = useProfilePhotosOn()
  const url = useQuery({
    queryKey: ['avatar', path],
    enabled: Boolean(path && supabase && photosOn),
    staleTime: (AVATAR_TTL - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().storage.from('avatars').createSignedUrl(path!, AVATAR_TTL)
      if (error) throw error
      return data.signedUrl
    },
  })
  return { data: photosOn ? url.data : undefined }
}

export function useSaveProfile() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields: { full_name: string; phone: string | null }) => {
      const { error } = await requireSupabase().from('profiles').update(fields).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

/** Upload a new photo (resized to 512px JPEG), point the profile at it, drop the old one. */
export function usePhoto() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const setPath = async (path: string | null) => {
    const sb = requireSupabase()
    const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', user.id)
    if (error) throw error
    if (user.avatar_path) await sb.storage.from('avatars').remove([user.avatar_path])
  }
  const done = () => queryClient.invalidateQueries({ queryKey: ['me'] })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const blob = await resizeToJpeg(file, 512)
      const path = `${user.id}/${crypto.randomUUID()}.jpg`
      const { error } = await requireSupabase()
        .storage.from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      await setPath(path)
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: () => setPath(null),
    onSuccess: done,
  })
  return { upload, remove }
}

export class PasswordError extends Error {
  readonly field: 'current' | 'new' | 'code'
  constructor(message: string, field: 'current' | 'new' | 'code') {
    super(message)
    this.field = field
  }
}

/**
 * Change password: prove the current one, take a code if Auth wants one (it
 * does for anyone with 2-step on whose session hasn't had one), set the new
 * one, then end every other session ("Other devices were signed out"). The
 * proof is a sign-in on a separate client, because signing in on the app's own
 * would swap this session for a new one with no second step behind it.
 */
export function useChangePassword() {
  const { user } = useUser()
  return useMutation({
    mutationFn: async ({ current, next, code }: { current: string; next: string; code?: string }) => {
      const sb = requireSupabase()
      const checker = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const check = await checker.auth.signInWithPassword({ email: user.email, password: current })
      if (check.error) {
        throw new PasswordError(
          check.error.code === 'invalid_credentials'
            ? "That's not your current password."
            : signInErrorMessage(check.error),
          'current',
        )
      }
      await checker.auth.signOut({ scope: 'local' })
      if (code) {
        try {
          await verifyAuthenticatorCode(code)
        } catch (e) {
          throw new PasswordError(e instanceof TwoStepError ? e.message : 'Could not check that code.', 'code')
        }
      }
      const { error } = await sb.auth.updateUser({ password: next })
      if (error) {
        throw new PasswordError(
          error.code === 'weak_password' ? 'Pick a longer or less common password.' : 'Could not update the password.',
          'new',
        )
      }
      await sb.auth.signOut({ scope: 'others' })
    },
  })
}

/**
 * File a report; resolves to its case number. The send-email function forwards it
 * to support; if that fails the report is still saved and goes out with the next.
 */
export function useSendReport() {
  return useMutation({
    onSuccess: () => void callFunction('send-email', {}).catch(() => undefined),
    mutationFn: async (body: string) => {
      const { data, error } = await requireSupabase()
        .from('support_reports')
        .insert({
          body: body.trim(),
          page: window.location.pathname.slice(0, 500),
          app_version: env.appVersion,
          user_agent: navigator.userAgent.slice(0, 500),
        })
        .select('case_no')
        .single()
      if (error) throw error
      return data.case_no
    },
  })
}
