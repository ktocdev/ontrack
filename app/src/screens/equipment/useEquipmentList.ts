import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { Unit } from './equipment'

/**
 * The equipment lists, Ops's and a manager's: the units in service at the restaurants
 * passed in, with their open tickets and, given a year, that year's spend. Callers pass
 * the restaurants from useUser() (Ops through the picker), so View as shows the person
 * viewed. The key sits under 'tickets' so LiveTickets rereads the open badges as tickets
 * change. RLS answers the cost question: without see_costs there are no spend rows. A
 * manager's list shows no spend, so it passes no year and skips that read. With retired,
 * retired units come too (OT-71), for the Retired card; a manager without Add / edit
 * equipment never sees them.
 */
export function useEquipmentList(restaurantIds: string[], year: number | null, retired = false) {
  return useQuery({
    queryKey: ['tickets', 'equipment-list', restaurantIds, year, retired],
    queryFn: async (): Promise<Unit[]> => {
      const sb = requireSupabase()
      const list = sb
        .from('equipment')
        .select('id, name, brand, serial, restaurant_id, retired_at, category:categories (name, area, sort_order)')
        .in('restaurant_id', restaurantIds)
      const [units, open, spend] = await Promise.all([
        retired ? list : list.is('retired_at', null),
        sb.from('v_equipment_open_counts').select('equipment_id, open_ticket_count'),
        year === null
          ? { data: [], error: null }
          : sb.from('v_equipment_spend').select('equipment_id, total_cents').eq('year', year),
      ])
      for (const r of [units, open, spend]) if (r.error) throw r.error
      const openOf = new Map((open.data ?? []).map((o) => [o.equipment_id, o.open_ticket_count ?? 0]))
      const spendOf = new Map((spend.data ?? []).map((s) => [s.equipment_id, s.total_cents]))
      return (units.data ?? []).map(({ retired_at, ...u }) => ({
        ...u,
        retired: retired_at !== null,
        openCount: openOf.get(u.id) ?? 0,
        spendCents: spendOf.get(u.id) || null,
      }))
    },
  })
}
