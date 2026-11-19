import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { MonthRow, OpenRow } from './overview'

/**
 * Leadership's Overview: every month of v_overview_by_month for the restaurants in scope,
 * and what is open at each now (v_restaurant_open_counts, as the Ops dashboard counts it).
 * Scoped by the ids from useUser(), so View as shows the person viewed. The key sits under
 * 'tickets', so LiveTickets rereads it as tickets change.
 */
export function useOverview(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'lead-overview', restaurantIds],
    enabled: restaurantIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const sb = requireSupabase()
      const [months, open] = await Promise.all([
        sb
          .from('v_overview_by_month')
          .select('restaurant_id, month, opened, closed, close_seconds, spend_cents, visits, sees_costs')
          .in('restaurant_id', restaurantIds),
        sb
          .from('v_restaurant_open_counts')
          .select('restaurant_id, open_count, urgent_count')
          .in('restaurant_id', restaurantIds),
      ])
      if (months.error) throw months.error
      if (open.error) throw open.error
      return {
        months: months.data.map((m): MonthRow => ({
          restaurant_id: m.restaurant_id!,
          month: m.month!,
          opened: m.opened ?? 0,
          closed: m.closed ?? 0,
          close_seconds: m.close_seconds ?? 0,
          spend_cents: m.spend_cents ?? 0,
          visits: m.visits ?? 0,
          sees_costs: m.sees_costs ?? false,
        })),
        open: open.data.map((o): OpenRow => ({
          restaurant_id: o.restaurant_id!,
          open_count: o.open_count ?? 0,
          urgent_count: o.urgent_count ?? 0,
        })),
      }
    },
  })
}
