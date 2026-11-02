import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { byPriority } from './dashboard'

/**
 * Ops · Dashboard. Everything not closed at the restaurants passed in. The caller
 * passes them from the picker, over useUser(), so View as shows the person viewed.
 * Until push arrives in this phase, it rereads every 30 seconds, as a ticket's thread
 * does, so a new ticket turns up on its own.
 */
export function useOpsDashboard(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'ops-open', restaurantIds],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .select(
          'id, display_id, title, status, urgency, source, restaurant_id, assignee_id, created_at, scheduled_for, category:categories (name, area), assignee:profiles!tickets_assignee_id_fkey (full_name)',
        )
        .in('restaurant_id', restaurantIds)
        .neq('status', 'closed')
      if (error) throw error
      return data.sort(byPriority)
    },
  })
}
