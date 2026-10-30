import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callFunction } from '../../lib/functions'
import { requireSupabase, type AppRole } from '../../lib/supabase'
import { USERS_KEY } from './useUsers'

/**
 * Admin · Roles & rights and User profile. The database decides what any of this
 * means (can(), rights_guard); these read the grid and call the one function per
 * action that checks the caller and logs the change.
 */

/** The grid's rows, in the board's order. See tickets reads as Own or All. */
export const RIGHTS = [
  { key: 'create_tickets', name: 'Create tickets' },
  { key: 'see_all_tickets', name: 'See tickets' },
  { key: 'update_status', name: 'Update status' },
  { key: 'log_cost', name: 'Log cost & contractor' },
  { key: 'see_costs', name: 'See costs' },
  { key: 'edit_equipment', name: 'Add / edit equipment' },
  { key: 'see_contractors', name: 'See contractors & invoices' },
  { key: 'set_walkthrough_schedule', name: 'Set walkthrough schedules' },
  { key: 'invite_users', name: 'Invite users' },
  { key: 'manage_rights', name: 'Manage rights' },
] as const

export type RightKey = (typeof RIGHTS)[number]['key']

/** What can be overridden for one person: scope stays with their role, and rights management with admins. */
export const PERSON_RIGHTS = RIGHTS.filter((r) => r.key !== 'see_all_tickets' && r.key !== 'manage_rights')

export const GRID_ROLES: AppRole[] = ['manager', 'ops', 'leadership', 'admin']

export type Grid = Record<AppRole, Record<RightKey, boolean>>

export const defaultKey = (role: AppRole, key: RightKey) => `${role}:${key}`

export const ROLES_KEY = ['admin', 'roles'] as const
export const personKey = (id: string) => ['admin', 'person', id] as const

export function useRoleDefaults() {
  return useQuery({
    queryKey: ROLES_KEY,
    throwOnError: true,
    // The mock build has no backend; the tab bar and header still render around the skeleton.
    enabled: !__E2E_MOCK__,
    queryFn: async () => {
      const sb = requireSupabase()
      const [rights, profiles] = await Promise.all([
        sb.from('rights').select('role, key, allowed').is('user_id', null),
        sb.from('profiles').select('role').is('deactivated_at', null),
      ])
      for (const r of [rights, profiles]) if (r.error) throw r.error
      const defaults = new Map((rights.data ?? []).map((r) => [`${r.role}:${r.key}`, r.allowed]))
      const people = new Map<AppRole, number>()
      for (const p of profiles.data ?? []) people.set(p.role, (people.get(p.role) ?? 0) + 1)
      return { defaults, people }
    },
  })
}

export type DefaultChange = { role: AppRole; key: RightKey; allowed: boolean }

export function useSaveDefaults() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: DefaultChange[]) => {
      const { error } = await requireSupabase().rpc('save_role_defaults', { p_changes: changes })
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'person'] }),
      ]),
  })
}

/** One person: their row, scope, role defaults, own overrides, and whether anything points to them. */
export function usePerson(id: string) {
  return useQuery({
    queryKey: personKey(id),
    throwOnError: true,
    enabled: !__E2E_MOCK__,
    queryFn: async () => {
      const sb = requireSupabase()
      const [profile, memberships, overrides, history] = await Promise.all([
        sb.from('profiles').select('*').eq('id', id).maybeSingle(),
        sb.from('memberships').select('restaurant_id').eq('user_id', id),
        sb.from('rights').select('key, allowed').eq('user_id', id),
        sb.from('v_person_history').select('records').eq('user_id', id).maybeSingle(),
      ])
      for (const r of [profile, memberships, overrides, history]) if (r.error) throw r.error
      if (!profile.data) return null
      const rows = memberships.data ?? []
      return {
        profile: profile.data,
        allRestaurants: rows.some((m) => m.restaurant_id === null),
        restaurantIds: rows.flatMap((m) => (m.restaurant_id ? [m.restaurant_id] : [])),
        overrides: new Map((overrides.data ?? []).map((o) => [o.key, o.allowed])),
        hasHistory: (history.data?.records ?? 0) > 0,
      }
    },
  })
}

function useRefreshPerson(id: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: personKey(id) }),
      queryClient.invalidateQueries({ queryKey: USERS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
      queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
    ])
}

/** allowed: null goes back to the role's default. */
export type RightChange = { key: RightKey; allowed: boolean | null }

export function useSavePersonRights(id: string) {
  const refresh = useRefreshPerson(id)
  return useMutation({
    mutationFn: async (rights: RightChange[]) => {
      const { error } = await requireSupabase().rpc('set_person_rights', { p_user: id, p_rights: rights })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSetPersonAccess(id: string) {
  const refresh = useRefreshPerson(id)
  return useMutation({
    mutationFn: async ({ role, restaurantIds }: { role: AppRole; restaurantIds: string[] }) => {
      const { error } = await requireSupabase().rpc('set_person_access', {
        p_user: id,
        p_role: role,
        p_restaurants: restaurantIds,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSetDeactivated(id: string) {
  const refresh = useRefreshPerson(id)
  return useMutation({
    mutationFn: (off: boolean) =>
      callFunction('revoke-user', { action: off ? 'deactivate' : 'reactivate', user_id: id }),
    onSuccess: refresh,
  })
}

export function useDeletePerson(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => callFunction('revoke-user', { action: 'delete', user_id: id }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: USERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
        queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
      ]),
  })
}

export function useLogViewAs(id: string) {
  return useQuery({
    queryKey: ['admin', 'view-as', id],
    enabled: !__E2E_MOCK__,
    // Once per visit, however many times the screen renders.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { error } = await requireSupabase().rpc('log_view_as', { p_user: id })
      if (error) throw error
      return true
    },
  })
}
