import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { uploadPhotos, type PickedPhoto } from './usePhotos'

/**
 * Manager · Edit ticket and Closed ticket. tickets_guard decides what a manager may
 * change, and when they may reopen. Saving, closing and reopening refresh the lists
 * but leave the ticket itself to the screen: those screens stay on what they showed
 * and add a message on top, as the boards draw it, then refresh as they go.
 */

export type TicketEdits = {
  title: string
  description: string
  urgency: 'low' | 'normal' | 'urgent'
  /** Only present when it changed. */
  equipmentId?: string | null
  photos: PickedPhoto[]
  createdBy: string
}

export function useSaveTicket(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: TicketEdits) => {
      const sb = requireSupabase()
      const { error } = await sb
        .from('tickets')
        .update({
          title: e.title,
          description: e.description || null,
          urgency: e.urgency,
          ...(e.equipmentId !== undefined ? { equipment_id: e.equipmentId } : {}),
        })
        .eq('id', ticketId)
      if (error) throw error
      if (e.photos.length) {
        const paths = await uploadPhotos(ticketId, e.photos)
        const { error: photoError } = await sb
          .from('ticket_photos')
          .insert(paths.map((path) => ({ ticket_id: ticketId, path, created_by: e.createdBy })))
        if (photoError) throw photoError
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        // A walkthrough's ticket is listed under its item.
        queryClient.invalidateQueries({ queryKey: ['walkthrough'] }),
      ]),
  })
}

export function useCloseTicket(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (comment: string) => {
      const { error } = await requireSupabase()
        .from('tickets')
        .update({ status: 'closed', resolution: comment || null })
        .eq('id', ticketId)
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-closed', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough'] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
      ]),
  })
}

export function useReopenTicket(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // The files go first: if one fails nothing has changed, and it can be tried again.
    mutationFn: async ({ note, photos }: { note: string; photos: PickedPhoto[] }) => {
      const paths = await uploadPhotos(ticketId, photos)
      const { error } = await requireSupabase().rpc('reopen_ticket', {
        p_id: ticketId,
        p_note: note,
        p_paths: paths,
      })
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough'] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
      ]),
  })
}

/**
 * Who closed a ticket, and what it cost. RLS answers the cost question: without
 * see_costs at that restaurant both come back empty, so the rows just aren't there.
 */
export function useClosedFacts(ticketId: string) {
  return useQuery({
    // Its own key, so refreshing the ticket after a reopen leaves what the screen still shows.
    queryKey: ['ticket-closed', ticketId],
    queryFn: async () => {
      const sb = requireSupabase()
      const [ticket, costs, service] = await Promise.all([
        sb
          .from('tickets')
          .select(
            'created_at, closed_at, resolution, opener:profiles!tickets_created_by_fkey (full_name), closer:profiles!tickets_closed_by_fkey (id, full_name, role)',
          )
          .eq('id', ticketId)
          .maybeSingle(),
        sb.from('v_ticket_costs').select('total_cents').eq('ticket_id', ticketId).maybeSingle(),
        sb
          .from('service_records')
          .select('service_date, contractor:contractors (name)')
          .eq('ticket_id', ticketId)
          .order('service_date', { ascending: false })
          .limit(1),
      ])
      if (ticket.error) throw ticket.error
      if (costs.error) throw costs.error
      if (service.error) throw service.error
      return {
        ...ticket.data,
        totalCents: costs.data?.total_cents ?? null,
        contractor: service.data[0]?.contractor?.name ?? null,
      }
    },
  })
}
