import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { monthRange } from './closedMonths'

/**
 * Ops · Closed tickets, at the restaurants passed in. The keys sit under 'tickets', so
 * closing or reopening a ticket refreshes them. RLS answers the cost question: without
 * see_costs there are no cost rows and no month total.
 */
export function useClosedMonths(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'ops-closed-months', restaurantIds],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('closed_by_month', {
        p_restaurant_ids: restaurantIds,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (error) throw error
      return data
    },
  })
}

/** One month's closed tickets with their costs, newest first. A reopened ticket is on the dashboard instead. */
export function useClosedMonth(restaurantIds: string[], month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tickets', 'ops-closed', restaurantIds, month],
    enabled,
    queryFn: async () => {
      const sb = requireSupabase()
      const { from, to } = monthRange(month)
      const { data, error } = await sb
        .from('tickets')
        .select('id, display_id, title, restaurant_id, closed_at')
        .in('restaurant_id', restaurantIds)
        .eq('status', 'closed')
        .gte('closed_at', from)
        .lt('closed_at', to)
        .order('closed_at', { ascending: false })
      if (error) throw error
      const costs = await sb
        .from('v_ticket_costs')
        .select('ticket_id, total_cents')
        .in(
          'ticket_id',
          data.map((t) => t.id),
        )
      if (costs.error) throw costs.error
      const costOf = new Map(costs.data.map((c) => [c.ticket_id, c.total_cents]))
      return data.map((t) => ({ ...t, totalCents: costOf.get(t.id) ?? null }))
    },
  })
}
