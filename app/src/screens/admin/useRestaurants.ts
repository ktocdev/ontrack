import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * Admin · Restaurants and Add restaurant. One read for the list: restaurants,
 * their open ticket counts, the managers who could run one, and pending
 * manager invites (so a restaurant whose manager has not accepted yet still
 * shows a name). Adding goes through add_restaurant(), which also gives the
 * chosen manager access and logs the change.
 */

export type ManagerLine =
  { kind: 'manager'; name: string } | { kind: 'invite'; name: string; expired: boolean } | { kind: 'none' }

export type AdminRestaurant = {
  id: string
  name: string
  address: string | null
  color: string
  openCount: number
  manager: ManagerLine
}

export type ManagerOption = { id: string; name: string }

export const RESTAURANTS_KEY = ['admin', 'restaurants'] as const

export function useAdminRestaurants() {
  return useQuery({
    queryKey: RESTAURANTS_KEY,
    throwOnError: true,
    queryFn: async () => {
      const sb = requireSupabase()
      const [restaurants, counts, managers, invites] = await Promise.all([
        sb.from('restaurants').select('id, name, address, color, manager_id').order('sort_order'),
        sb.from('v_restaurant_open_counts').select('restaurant_id, open_count'),
        sb.from('profiles').select('id, full_name').eq('role', 'manager').is('deactivated_at', null).order('full_name'),
        sb
          .from('invites')
          .select('full_name, restaurant_ids, expires_at')
          .eq('role', 'manager')
          .eq('status', 'pending'),
      ])
      for (const r of [restaurants, counts, managers, invites]) if (r.error) throw r.error

      const openBy = new Map((counts.data ?? []).map((c) => [c.restaurant_id, c.open_count ?? 0]))
      const nameBy = new Map((managers.data ?? []).map((m) => [m.id, m.full_name]))
      const now = Date.now()

      const list: AdminRestaurant[] = (restaurants.data ?? []).map((r) => {
        const name = r.manager_id ? nameBy.get(r.manager_id) : undefined
        const invite = name ? undefined : (invites.data ?? []).find((i) => i.restaurant_ids.includes(r.id))
        const manager: ManagerLine = name
          ? { kind: 'manager', name }
          : invite
            ? { kind: 'invite', name: invite.full_name, expired: new Date(invite.expires_at).getTime() < now }
            : { kind: 'none' }
        return { id: r.id, name: r.name, address: r.address, color: r.color, openCount: openBy.get(r.id) ?? 0, manager }
      })
      const managerOptions: ManagerOption[] = (managers.data ?? []).map((m) => ({ id: m.id, name: m.full_name }))
      return { restaurants: list, managers: managerOptions }
    },
  })
}

export type NewRestaurant = {
  name: string
  address: string
  phone: string
  color: string
  managerId: string | null
}

/** Which field a refusal belongs to, from the constraint Postgres names. */
export class AddRestaurantError extends Error {
  readonly field: 'name' | 'color' | 'form'
  constructor(message: string, field: 'name' | 'color' | 'form') {
    super(message)
    this.field = field
  }
}

export function useAddRestaurant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (r: NewRestaurant) => {
      const { data, error } = await requireSupabase().rpc('add_restaurant', {
        p_name: r.name,
        p_address: r.address,
        p_phone: r.phone,
        p_color: r.color,
        ...(r.managerId ? { p_manager_id: r.managerId } : {}),
      })
      if (error) {
        const text = `${error.message} ${error.details ?? ''}`
        if (error.code === '23505' && /color/.test(text)) {
          throw new AddRestaurantError('Another restaurant already uses this color. Pick another.', 'color')
        }
        if (error.code === '23505') throw new AddRestaurantError('A restaurant with this name already exists.', 'name')
        throw new AddRestaurantError("Couldn't save the restaurant. Check your connection and try again.", 'form')
      }
      return data
    },
    // Restaurants appear in everyone's scope list too (useUser), so refresh both.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: RESTAURANTS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]),
  })
}
