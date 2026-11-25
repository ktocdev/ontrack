import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { visitAmounts } from '../contractors/useContractor'
import type { SpendVisit } from './spend'

/**
 * Leadership's Spend: every visit RLS lets through (see_costs at its restaurant), contractor
 * and in-house, with its restaurant, contractor, unit and its category, ticket and its
 * category, total and whether its invoice is missing; the screen picks the month and the
 * restaurants from useUser(), so View as shows the person viewed. The key sits under
 * 'contractors', which logging and editing service reread.
 */
export function useLeadSpend(enabled: boolean) {
  return useQuery({
    queryKey: ['contractors', 'lead-spend'],
    enabled,
    queryFn: async (): Promise<SpendVisit[]> => {
      const { data, error } = await requireSupabase()
        .from('service_records')
        .select(
          'id, service_date, title, kind, restaurant_id, restaurant:restaurants (name, color), contractor:contractors (id, name), equipment (name, category:categories (name)), ticket:tickets (display_id, category:categories (name))',
        )
        .order('service_date', { ascending: false })
      if (error) throw error
      const { totalOf, missingIds } = await visitAmounts(null)
      return data.map((r) => ({
        ...r,
        totalCents: totalOf.get(r.id) ?? 0,
        invoiceMissing: missingIds.has(r.id),
      }))
    },
  })
}
