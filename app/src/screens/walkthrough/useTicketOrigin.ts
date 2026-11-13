import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * Where a walkthrough ticket came from: the month, and the section, group and item it was
 * made from. Nothing for a ticket not made from a walkthrough's item.
 */
export function useTicketOrigin(walkthroughId: string | null, checkId: string | null) {
  return useQuery({
    queryKey: ['ticket-origin', walkthroughId, checkId],
    enabled: Boolean(walkthroughId),
    queryFn: async () => {
      const sb = requireSupabase()
      const [walkthrough, check] = await Promise.all([
        sb.from('walkthroughs').select('id, period').eq('id', walkthroughId!).maybeSingle(),
        checkId
          ? sb
              .from('walkthrough_checks')
              .select(
                'item:walkthrough_items (title, group_name, section:walkthrough_sections (id, name)), task:quarterly_tasks (title)',
              )
              .eq('id', checkId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
      if (walkthrough.error) throw walkthrough.error
      if (check.error) throw check.error
      if (!walkthrough.data) return null
      const item = check.data?.item as unknown as {
        title: string
        group_name: string
        section: { id: string; name: string } | null
      } | null
      const task = check.data?.task as unknown as { title: string } | null
      return {
        walkthroughId: walkthrough.data.id,
        period: walkthrough.data.period,
        sectionId: item?.section?.id ?? (task ? 'quarterly' : null),
        // Section › group › item, or the quarter's task.
        chips: item ? [item.section?.name ?? '', item.group_name, item.title] : task ? [task.title] : [],
      }
    },
  })
}
