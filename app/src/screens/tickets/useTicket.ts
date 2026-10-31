import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { assigneeIds, type Update } from './thread'

/**
 * Manager · Ticket: the ticket and its thread. RLS decides what comes back: a ticket
 * outside the person's scope is no row, and an internal note is not in the thread.
 * It rereads every 30 seconds while on screen and on coming back to the app, so a
 * reply from Ops turns up without a reload.
 */
export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    throwOnError: true,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const sb = requireSupabase()
      const [ticket, updates] = await Promise.all([
        sb
          .from('tickets')
          .select(
            'id, display_id, title, description, status, urgency, scheduled_for, restaurant:restaurants (name, color), category:categories (name, area), equipment (name, brand, serial)',
          )
          .eq('id', id)
          .maybeSingle(),
        sb
          .from('ticket_updates')
          .select(
            'id, kind, body, meta, created_at, author:profiles!ticket_updates_author_id_fkey (id, full_name, role, avatar_path)',
          )
          .eq('ticket_id', id)
          .order('created_at'),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (ticket.error?.code === '22P02') return { ticket: null, updates: [], names: new Map<string, string>() }
      if (ticket.error) throw ticket.error
      if (updates.error) throw updates.error

      const thread = updates.data as Update[]
      const ids = assigneeIds(thread)
      const people = ids.length
        ? await sb
            .from('profiles')
            .select('id, full_name')
            .in('id', ids as string[])
        : null
      if (people?.error) throw people.error
      const names = new Map((people?.data ?? []).map((p) => [p.id, p.full_name]))
      return { ticket: ticket.data, updates: thread, names }
    },
  })
}

export function usePostUpdate(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, authorId }: { body: string; authorId: string }) => {
      const { error } = await requireSupabase()
        .from('ticket_updates')
        .insert({ ticket_id: ticketId, author_id: authorId, body })
      if (error) throw error
    },
    // The list moves too: a message is activity.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  })
}
