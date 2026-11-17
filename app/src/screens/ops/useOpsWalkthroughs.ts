import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { lastSixMonths, monthsOf, type SummaryRow } from './walkthroughOverview'

/**
 * Ops · Walkthroughs (OT-129). The months the restaurants in scope have walkthroughs, and
 * the summary (v_walkthrough_summary, OT-127) for the six months ending with the one shown.
 * The caller passes the restaurants from useUser() and the picker, so View as shows the
 * person viewed. Checks don't touch tickets, so it rereads every 30 seconds rather than
 * waiting on LiveTickets. A new month or restaurant keeps the last one on screen until it
 * arrives, so nothing jumps and an open history stays open.
 */
export function useWalkthroughMonths(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['ops-walkthroughs', 'months', restaurantIds],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('walkthroughs')
        .select('period')
        .in('restaurant_id', restaurantIds)
      if (error) throw error
      return monthsOf(data.map((w) => w.period))
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}

export function useWalkthroughOverview(restaurantIds: string[], month: string | undefined) {
  return useQuery({
    queryKey: ['ops-walkthroughs', 'overview', restaurantIds, month],
    enabled: !!month,
    queryFn: async () => {
      const months = lastSixMonths(month!)
      const { data, error } = await requireSupabase()
        .from('v_walkthrough_summary')
        .select(
          'walkthrough_id, restaurant_id, period, due_on, standing, template_name, template_short_name, template_description, total, done, tickets, fixes, submitted_at',
        )
        .in('restaurant_id', restaurantIds)
        .gte('period', months[0]!)
        .lte('period', month!)
      if (error) throw error
      return data as SummaryRow[]
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}
