import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { progressOf, splitByRestaurant, type Progress } from './walkthrough'

/** How many past months each restaurant lists, as the Ops overview's history (6b). */
const PAST_MONTHS = 6

export type HomeWalkthrough = {
  id: string
  restaurant_id: string
  period: string
  due_on: string
  status: 'open' | 'submitted'
  submitted_at: string | null
  started_by: string | null
  starter: { full_name: string } | null
  submitter: { full_name: string } | null
  progress: Progress
}

/**
 * Manager · Walkthrough home. Each restaurant's newest walkthrough with its progress per
 * section, and the months before it. The caller passes the restaurants from useUser(),
 * so View as shows the person viewed and not what the admin may read.
 */
export function useWalkthroughHome(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['walkthrough-home', restaurantIds],
    queryFn: async () => {
      const sb = requireSupabase()
      const { data: walkthroughs, error } = await sb
        .from('walkthroughs')
        .select(
          'id, restaurant_id, period, due_on, status, submitted_at, started_by, starter:profiles!walkthroughs_started_by_fkey (full_name), submitter:profiles!walkthroughs_submitted_by_fkey (full_name)',
        )
        .in('restaurant_id', restaurantIds)
        .order('period', { ascending: false })
        .limit((PAST_MONTHS + 1) * Math.max(restaurantIds.length, 1))
      if (error) throw error

      const ids = walkthroughs.map((w) => w.id)
      const { data: rows, error: progressError } = ids.length
        ? await sb.from('v_walkthrough_progress').select('*').in('walkthrough_id', ids)
        : { data: [], error: null }
      if (progressError) throw progressError

      const all: HomeWalkthrough[] = walkthroughs.map((w) => ({
        ...w,
        progress: progressOf(
          rows.filter((r) => r.walkthrough_id === w.id),
          w.period,
        ),
      }))
      return splitByRestaurant(all, restaurantIds)
    },
  })
}
