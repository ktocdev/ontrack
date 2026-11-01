import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

export const CLOSED_LIST_LIMIT = 100

/**
 * Manager · Closed tickets at the restaurants passed in, newest first. The key sits
 * under 'tickets', so closing or reopening a ticket refreshes it.
 */
export function useClosedTickets(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'closed', restaurantIds],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .select(
          'id, display_id, title, source, restaurant_id, closed_at, category:categories (name, area), equipment (name), closer:profiles!tickets_closed_by_fkey (full_name)',
        )
        .in('restaurant_id', restaurantIds)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false, nullsFirst: false })
        .limit(CLOSED_LIST_LIMIT)
      if (error) throw error
      return data
    },
  })
}
