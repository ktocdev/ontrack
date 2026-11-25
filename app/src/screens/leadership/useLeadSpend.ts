import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { visitAmounts } from '../contractors/useContractor'
import { addMonths } from './overview'
import type { SpendVisit } from './spend'

/**
 * Leadership's Spend: the month's visits ("2026-10-01") that RLS lets through (see_costs at
 * their restaurant), contractor and in-house, with its restaurant, contractor, unit and its
 * category, ticket and its category, total and whether its invoice is missing. Only that
 * month is read (OT-179), so the screen doesn't load every visit ever logged; it picks the
 * restaurants from useUser(), so View as shows the person viewed. The key sits under
 * 'contractors', which logging and editing service reread.
 */
export function useLeadSpend(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['contractors', 'lead-spend', month],
    enabled,
    queryFn: async (): Promise<SpendVisit[]> => {
      const { data, error } = await requireSupabase()
        .from('service_records')
        .select(
          'id, service_date, title, kind, restaurant_id, restaurant:restaurants (name, color), contractor:contractors (id, name), equipment (name, category:categories (name)), ticket:tickets (display_id, category:categories (name))',
        )
        .gte('service_date', month)
        .lt('service_date', addMonths(month, 1))
        .order('service_date', { ascending: false })
      if (error) throw error
      const { totalOf, missingIds } = await visitAmounts(data.map((r) => r.id))
      return data.map((r) => ({
        ...r,
        totalCents: totalOf.get(r.id) ?? 0,
        invoiceMissing: missingIds.has(r.id),
      }))
    },
  })
}
