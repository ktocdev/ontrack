import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

/**
 * Filed by you on leadership's Overview (OT-170): the open tickets this person filed, at any
 * restaurant, urgent first and then the newest, as a restaurant's list orders them. The id
 * comes from useUser(), so View as shows the person viewed. Under 'tickets', so LiveTickets
 * rereads it as tickets change.
 */
export function useFiledByYou(userId: string) {
  return useQuery({
    queryKey: ['tickets', 'lead-filed', userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .select(
          'id, display_id, title, status, urgency, source, scheduled_for, created_at, category_id, area, checklist_place, category:categories (name, area), restaurant:restaurants (name, color)',
        )
        .eq('created_by', userId)
        .neq('status', 'closed')
      if (error) throw error
      return data.sort(
        (a, b) =>
          Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent') || b.created_at.localeCompare(a.created_at),
      )
    },
  })
}
