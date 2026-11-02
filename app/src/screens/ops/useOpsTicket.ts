import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type TicketStatus } from '../../lib/supabase'
import { loadThread } from '../tickets/useTicket'

/**
 * Ops · Ticket. RLS decides what comes back: a ticket outside the person's scope is no
 * row. It rereads every 30 seconds and on coming back to the app, so a colleague picking
 * it up shows without a reload. Who is on a ticket follows from its status in the database.
 */
export function useOpsTicket(id: string) {
  return useQuery({
    queryKey: ['ops-ticket', id],
    throwOnError: true,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [ticket, thread] = await Promise.all([
        requireSupabase()
          .from('tickets')
          .select(
            'id, display_id, title, description, status, urgency, source, scheduled_for, created_at, assignee_id, restaurant:restaurants (name, color), category:categories (name, area), equipment (name, brand, serial), walkthrough:walkthroughs (period), opener:profiles!tickets_created_by_fkey (full_name), assignee:profiles!tickets_assignee_id_fkey (full_name)',
          )
          .eq('id', id)
          .maybeSingle(),
        loadThread(id),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (ticket.error?.code === '22P02') return { ...thread, ticket: null }
      if (ticket.error) throw ticket.error
      return { ...thread, ticket: ticket.data }
    },
  })
}

function useRefresh(id: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ops-ticket', id] }),
      queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    ])
}

export function useSetTicketStatus(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: async ({ status, scheduledFor }: { status: TicketStatus; scheduledFor?: string }) => {
      const { error } = await requireSupabase().rpc('set_ticket_status', {
        p_id: id,
        p_status: status,
        p_scheduled_for: scheduledFor,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** From reopened or closed to In progress, with a note the restaurant can read. */
export function useStartWork(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: async (note: string) => {
      const { error } = await requireSupabase().rpc('start_ticket_work', { p_id: id, p_note: note })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** Back to Closed, with a reply the restaurant can read. */
export function useCloseAgain(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: async (reply: string) => {
      const { error } = await requireSupabase()
        .from('tickets')
        .update({ status: 'closed', resolution: reply })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useTakeTicket(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: async () => {
      const { error } = await requireSupabase().rpc('take_ticket', { p_id: id })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}
