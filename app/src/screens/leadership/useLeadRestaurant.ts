import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * Leadership's restaurant (Exec-Restaurant, OT-144): its open tickets with what has been
 * logged on each (v_ticket_costs, only with See costs), the Reporters whose home it is, and
 * when its last ticket closed, for the empty state. Under 'tickets', so LiveTickets rereads
 * it as tickets change.
 */
export function useLeadRestaurant(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['tickets', 'lead-restaurant', restaurantId],
    enabled: Boolean(restaurantId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const sb = requireSupabase()
      const [tickets, people, last] = await Promise.all([
        sb
          .from('tickets')
          .select(
            'id, display_id, title, status, urgency, source, scheduled_for, created_at, category_id, area, checklist_place, category:categories (name, area)',
          )
          .eq('restaurant_id', restaurantId!)
          .neq('status', 'closed'),
        sb
          .from('profiles')
          .select('full_name')
          .eq('home_restaurant_id', restaurantId!)
          .eq('role', 'manager')
          .is('deactivated_at', null)
          .order('full_name'),
        sb
          .from('tickets')
          .select('closed_at')
          .eq('restaurant_id', restaurantId!)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (tickets.error) throw tickets.error
      if (people.error) throw people.error
      if (last.error) throw last.error
      const ids = tickets.data.map((t) => t.id)
      const costs = ids.length
        ? await sb.from('v_ticket_costs').select('ticket_id, total_cents').in('ticket_id', ids)
        : { data: [], error: null }
      if (costs.error) throw costs.error
      const costOf = new Map(costs.data.map((c) => [c.ticket_id!, c.total_cents ?? 0]))
      return {
        tickets: tickets.data
          .map((t) => ({ ...t, costCents: costOf.get(t.id) ?? null }))
          // Urgent first, then the newest, as the board lists them.
          .sort(
            (a, b) =>
              Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent') ||
              b.created_at.localeCompare(a.created_at),
          ),
        reporters: people.data.map((p) => p.full_name),
        lastClosedAt: last.data?.closed_at ?? null,
      }
    },
  })
}
