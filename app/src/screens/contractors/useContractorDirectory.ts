import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { Contractor, SpendRow } from './contractors'

/**
 * The directory: every contractor not archived, which is the group's whole list
 * (see_contractors), with their trades in the list's order, and what was spent with each, per restaurant and year
 * (v_contractor_spend, which returns rows only with see_costs). The screen adds up the
 * restaurants the picker shows. The key sits under 'contractors', which "+ Add new
 * contractor" refreshes.
 */
export function useContractorDirectory(seeCosts: boolean) {
  return useQuery({
    queryKey: ['contractors', 'directory', seeCosts],
    queryFn: async () => {
      const sb = requireSupabase()
      const [contractors, spend] = await Promise.all([
        sb
          .from('contractors')
          .select('id, name, contact_name, phone, preferred, insurance_until, trades (name, sort_order)')
          .is('archived_at', null)
          .order('name'),
        seeCosts
          ? sb
              .from('v_contractor_spend')
              .select('contractor_id, restaurant_id, year, total_cents, visits, last_visit_on')
          : { data: [], error: null },
      ])
      if (contractors.error) throw contractors.error
      if (spend.error) throw spend.error
      return {
        contractors: contractors.data.map(({ trades, ...c }): Contractor => ({
          ...c,
          trades: [...trades].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.name),
        })),
        spend: (spend.data ?? []) as SpendRow[],
      }
    },
  })
}
