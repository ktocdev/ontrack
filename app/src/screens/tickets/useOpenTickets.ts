import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { byAttention } from './tickets'

/**
 * Manager · Open tickets. Everything not closed at the restaurants passed in, and
 * how many in-house tasks are still to do there. The caller passes them from
 * useUser(), so View as shows the person viewed and not what the admin may read.
 */
const nothingOpenKey = (restaurantIds: string[]) => `ontrack.nothingOpen.${restaurantIds.join(',')}`

/**
 * Whether these restaurants had nothing open last time, so the screen can load in
 * the empty layout and not collapse into it. Only a hint for this device.
 */
export function expectNothingOpen(restaurantIds: string[]) {
  try {
    return localStorage.getItem(nothingOpenKey(restaurantIds)) === '1'
  } catch {
    return false
  }
}

function rememberNothingOpen(restaurantIds: string[], nothingOpen: boolean) {
  try {
    if (nothingOpen) localStorage.setItem(nothingOpenKey(restaurantIds), '1')
    else localStorage.removeItem(nothingOpenKey(restaurantIds))
  } catch {
    // Without storage it just shows the list's skeleton while loading.
  }
}

export function useOpenTickets(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'open', restaurantIds],
    queryFn: async () => {
      const sb = requireSupabase()
      const [tickets, inHouse] = await Promise.all([
        sb
          .from('tickets')
          .select(
            'id, display_id, title, status, source, restaurant_id, created_at, updated_at, reopened_at, scheduled_for, category:categories (name, area), equipment (name), assignee:profiles!tickets_assignee_id_fkey (full_name)',
          )
          .in('restaurant_id', restaurantIds)
          .neq('status', 'closed'),
        sb
          .from('inhouse_fixes')
          .select('id', { count: 'exact', head: true })
          .in('restaurant_id', restaurantIds)
          .is('done_at', null)
          .is('deleted_at', null),
      ])
      if (tickets.error) throw tickets.error
      if (inHouse.error) throw inHouse.error
      rememberNothingOpen(restaurantIds, tickets.data.length === 0 && !inHouse.count)
      return { tickets: [...tickets.data].sort(byAttention), inHouseCount: inHouse.count ?? 0 }
    },
  })
}
