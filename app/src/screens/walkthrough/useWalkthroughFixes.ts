import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * Walkthrough · In-house fixes: every fix made on one walkthrough, with the item or task
 * it came from. The key sits under 'tickets' with the In-house tab's, so checking one off
 * or deleting it there or here refreshes both.
 */
export function useWalkthroughFixes(walkthroughId: string) {
  return useQuery({
    queryKey: ['tickets', 'walkthrough-fixes', walkthroughId],
    queryFn: async () => {
      const sb = requireSupabase()
      const [walkthrough, fixes] = await Promise.all([
        sb
          .from('walkthroughs')
          .select('id, period, restaurant_id, restaurant:restaurants (name)')
          .eq('id', walkthroughId)
          .maybeSingle(),
        sb
          .from('inhouse_fixes')
          .select(
            'id, title, origin_label, done_at, first_done_at, created_at, restaurant_id, adder:profiles!inhouse_fixes_created_by_fkey (full_name), check:walkthrough_checks (item_id, quarterly_task_id)',
          )
          .eq('walkthrough_id', walkthroughId)
          .order('created_at', { ascending: false }),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (walkthrough.error?.code === '22P02') return null
      if (walkthrough.error) throw walkthrough.error
      if (fixes.error) throw fixes.error
      if (!walkthrough.data) return null
      return {
        walkthrough: {
          ...walkthrough.data,
          restaurantName: (walkthrough.data.restaurant as unknown as { name: string } | null)?.name ?? '',
        },
        fixes: fixes.data.map((f) => {
          const check = f.check as unknown as { item_id: string | null; quarterly_task_id: string | null } | null
          return { ...f, itemId: check?.item_id ?? null, taskId: check?.quarterly_task_id ?? null }
        }),
      }
    },
  })
}

export type WalkthroughFix = NonNullable<ReturnType<typeof useWalkthroughFixes>['data']>['fixes'][number]
