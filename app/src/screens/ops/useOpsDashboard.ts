import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { byUrgency, reopenReasons } from './dashboard'

/**
 * Ops · Dashboard. Everything not closed at the restaurants passed in, with why each
 * reopened ticket came back. The caller passes them from the picker, over useUser(),
 * so View as shows the person viewed. Until push arrives in this phase, it rereads
 * every 30 seconds, as a ticket's thread does, so a new ticket turns up on its own.
 */
export function useOpsDashboard(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'ops-open', restaurantIds],
    refetchInterval: 30_000,
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('tickets')
        .select(
          'id, display_id, title, status, urgency, source, restaurant_id, assignee_id, updated_at, reopened_at, scheduled_for, category:categories (name, area), assignee:profiles!tickets_assignee_id_fkey (full_name, role)',
        )
        .in('restaurant_id', restaurantIds)
        .neq('status', 'closed')
      if (error) throw error

      const tickets = data.map((t) => ({ ...t, activity: t.reopened_at ?? t.updated_at }))
      const reopened = tickets.filter((t) => t.status === 'reopened')
      const thread = reopened.length
        ? await sb
            .from('ticket_updates')
            .select('ticket_id, kind, body, created_at')
            .in(
              'ticket_id',
              reopened.map((t) => t.id),
            )
            .in('kind', ['reopened', 'message'])
            .eq('internal', false)
        : { data: [], error: null }
      if (thread.error) throw thread.error

      return {
        open: tickets.filter((t) => t.status !== 'reopened').sort(byUrgency),
        reopened: reopened.sort(byUrgency),
        reasons: reopenReasons(reopened, thread.data),
      }
    },
  })
}
