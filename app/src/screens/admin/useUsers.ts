import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callFunction } from '../../lib/functions'
import { requireSupabase, type AppRole } from '../../lib/supabase'
import { inviteLine, scopeLine } from './people'
import { RESTAURANTS_KEY } from './useRestaurants'

/**
 * Admin · Users and Invite user. One read for the list: everyone with an account
 * and every invite still pending. Invites are written only by the invite-user and
 * revoke-user functions, which check the caller and log what they do.
 */

export type PersonRow = {
  kind: 'person'
  id: string
  name: string
  role: AppRole
  scope: string
  avatarPath: string | null
  deactivated: boolean
}

export type InviteRow = {
  kind: 'invite'
  id: string
  name: string
  email: string
  role: AppRole
  scope: string
  expired: boolean
  line: string
}

export const USERS_KEY = ['admin', 'users'] as const

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    throwOnError: true,
    // The mock build has no backend; the tab bar and header still render around the skeleton.
    enabled: !__E2E_MOCK__,
    queryFn: async () => {
      const sb = requireSupabase()
      const [profiles, memberships, restaurants, invites] = await Promise.all([
        sb.from('profiles').select('id, full_name, role, avatar_path, deactivated_at').order('full_name'),
        sb.from('memberships').select('user_id, restaurant_id'),
        sb.from('restaurants').select('id, name').order('sort_order'),
        sb
          .from('invites')
          .select('id, full_name, email, role, restaurant_ids, sent_at, expires_at')
          .eq('status', 'pending')
          .order('sent_at', { ascending: false }),
      ])
      for (const r of [profiles, memberships, restaurants, invites]) if (r.error) throw r.error

      const names = (ids: string[]) => (restaurants.data ?? []).filter((r) => ids.includes(r.id)).map((r) => r.name)
      const now = new Date()

      const people: PersonRow[] = (profiles.data ?? []).map((p) => {
        const mine = (memberships.data ?? []).filter((m) => m.user_id === p.id)
        const all = mine.some((m) => m.restaurant_id === null)
        return {
          kind: 'person',
          id: p.id,
          name: p.full_name,
          role: p.role,
          scope: scopeLine(p.role, all ? null : names(mine.map((m) => m.restaurant_id as string))),
          avatarPath: p.avatar_path,
          deactivated: p.deactivated_at !== null,
        }
      })
      const pending: InviteRow[] = (invites.data ?? []).map((i) => ({
        kind: 'invite',
        id: i.id,
        name: i.full_name,
        email: i.email,
        role: i.role,
        scope: scopeLine(i.role, i.restaurant_ids.length ? names(i.restaurant_ids) : null),
        expired: new Date(i.expires_at).getTime() <= now.getTime(),
        line: inviteLine(i, now),
      }))
      return {
        // Live invites first, then expired ones, then people, with the deactivated last.
        invites: [...pending.filter((i) => !i.expired), ...pending.filter((i) => i.expired)],
        people: [...people.filter((p) => !p.deactivated), ...people.filter((p) => p.deactivated)],
      }
    },
  })
}

function useRefreshUsers() {
  const queryClient = useQueryClient()
  // The Restaurants list shows pending manager invites too.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: USERS_KEY }),
      queryClient.invalidateQueries({ queryKey: RESTAURANTS_KEY }),
    ])
}

export type NewInvite = { fullName: string; email: string; role: AppRole; restaurantIds: string[] }

export function useSendInvite() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (i: NewInvite) =>
      callFunction('invite-user', {
        action: 'send',
        full_name: i.fullName,
        email: i.email,
        role: i.role,
        restaurant_ids: i.restaurantIds,
      }),
    onSuccess: refresh,
  })
}

export function useResendInvite() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (id: string) => callFunction('invite-user', { action: 'resend', invite_id: id }),
    onSuccess: refresh,
  })
}

export function useRevokeInvite() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (id: string) => callFunction('revoke-user', { action: 'revoke_invite', invite_id: id }),
    onSuccess: refresh,
  })
}
