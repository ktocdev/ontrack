import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { byPriority } from '../ops/dashboard'

/** How many closed tickets the Closed chip lists, newest closed first. */
export const CLOSED_SHOWN = 200

const COLUMNS =
  'id, display_id, title, status, urgency, source, restaurant_id, category_id, assignee_id, created_at, closed_at, scheduled_for, area, checklist_place, category:categories (name, area), equipment:equipment (name), assignee:profiles!tickets_assignee_id_fkey (full_name)'

/**
 * Admin · Tickets (OT-148): the open tickets at the restaurants passed in, as the Ops
 * dashboard orders them, or the latest closed ones. The caller passes the restaurants from
 * useUser() and the picker. The key sits under 'tickets', so LiveTickets rereads it, and
 * it also rereads every 30 seconds in case that connection has dropped.
 */
export function useAdminTickets(restaurantIds: string[], closed: boolean) {
  return useQuery({
    queryKey: ['tickets', 'admin', restaurantIds, closed],
    refetchInterval: 30_000,
    queryFn: async () => {
      const q = requireSupabase().from('tickets').select(COLUMNS).in('restaurant_id', restaurantIds)
      if (!closed) {
        const { data, error } = await q.neq('status', 'closed')
        if (error) throw error
        return data.sort(byPriority)
      }
      const { data, error } = await q
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(CLOSED_SHOWN)
      if (error) throw error
      return data
    },
  })
}

export type AdminTicket = NonNullable<ReturnType<typeof useAdminTickets>['data']>[number]
