import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { SummaryRow } from './walkthroughOverview'

const PAST = 6
const SUMMARY =
  'walkthrough_id, restaurant_id, period, due_on, standing, status, template_name, template_short_name, template_description, total, done, tickets, fixes, submitted_at, last_reminded_at'

type Summary = SummaryRow & { status: 'open' | 'submitted'; last_reminded_at: string | null }

/**
 * Ops · one restaurant's walkthrough (WT-Ops-Restaurant, OT-130): how it stands, who is on
 * it, each section's progress, the in-house fixes still in-house (one made a ticket shows
 * as its ticket, which useWalkthroughTickets lists), and the restaurant's months before it.
 * Null for a walkthrough that doesn't exist or isn't in the caller's scope. It rereads every
 * 30 seconds, as the overview does.
 */
export function useOpsWalkthrough(id: string) {
  return useQuery({
    queryKey: ['ops-walkthroughs', 'one', id],
    queryFn: async () => {
      const sb = requireSupabase()
      const [summary, walkthrough, progress, fixes] = await Promise.all([
        sb.from('v_walkthrough_summary').select(SUMMARY).eq('walkthrough_id', id).maybeSingle(),
        sb
          .from('walkthroughs')
          .select(
            'id, starter:profiles!walkthroughs_started_by_fkey (full_name), restaurant:restaurants (id, name, color, manager:profiles!restaurants_manager_fk (full_name))',
          )
          .eq('id', id)
          .maybeSingle(),
        sb
          .from('v_walkthrough_progress')
          .select('kind, section_id, name, short_name, sort_order, total, done')
          .eq('walkthrough_id', id)
          .order('sort_order'),
        sb
          .from('inhouse_fixes')
          .select('id, title, origin_label, done_at, check:walkthrough_checks (item_id, quarterly_task_id)')
          .eq('walkthrough_id', id)
          .is('converted_ticket_id', null)
          .order('created_at'),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (summary.error?.code === '22P02') return null
      for (const r of [summary, walkthrough, progress, fixes]) if (r.error) throw r.error
      if (!summary.data || !walkthrough.data) return null
      const s = summary.data as Summary

      const past = await sb
        .from('v_walkthrough_summary')
        .select(SUMMARY)
        .eq('restaurant_id', s.restaurant_id)
        .lt('period', s.period)
        .order('period', { ascending: false })
        .limit(PAST)
      if (past.error) throw past.error

      const restaurant = walkthrough.data.restaurant as unknown as {
        id: string
        name: string
        color: string
        manager: { full_name: string } | null
      }
      return {
        summary: s,
        restaurant,
        starter: (walkthrough.data.starter as unknown as { full_name: string } | null)?.full_name ?? null,
        sections: progress.data!,
        fixes: fixes.data!.map((f) => {
          const check = f.check as unknown as { item_id: string | null; quarterly_task_id: string | null } | null
          return { ...f, itemId: check?.item_id ?? null, taskId: check?.quarterly_task_id ?? null }
        }),
        past: past.data as Summary[],
      }
    },
    refetchInterval: 30_000,
  })
}

/** Send reminder: the restaurant's Reporters hear, once an hour at most (OT-127). */
export function useSendReminder(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await requireSupabase().rpc('send_walkthrough_reminder', { p_walkthrough: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops-walkthroughs'] }),
  })
}
