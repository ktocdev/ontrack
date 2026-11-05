import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { assigneeIds, type Update } from './thread'
import { uploadPhotos, type PickedPhoto } from './usePhotos'

/**
 * A ticket's thread and photos, for the manager and Ops screens. RLS decides what comes
 * back: an internal note and its photos are there only for Ops.
 */
export async function loadThread(id: string) {
  const sb = requireSupabase()
  const [updates, photos] = await Promise.all([
    sb
      .from('ticket_updates')
      .select(
        'id, kind, body, internal, meta, created_at, author:profiles!ticket_updates_author_id_fkey (id, full_name, role, avatar_path)',
      )
      .eq('ticket_id', id)
      .order('created_at'),
    sb.from('ticket_photos').select('path, update_id').eq('ticket_id', id).order('created_at'),
  ])
  // A malformed id in the address is a page that doesn't exist, not a failure.
  if (updates.error?.code === '22P02') return { updates: [], photos: [], names: new Map<string, string>() }
  if (updates.error) throw updates.error
  if (photos.error) throw photos.error

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
  return { updates: thread, photos: photos.data, names }
}

/**
 * Manager · Ticket: the ticket and its thread. A ticket outside the person's scope is no
 * row. It rereads every 30 seconds while on screen and on coming back to the app, so a
 * reply from Ops turns up without a reload.
 */
export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    throwOnError: true,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [ticket, thread] = await Promise.all([
        requireSupabase()
          .from('tickets')
          .select(
            'id, display_id, title, description, status, urgency, scheduled_for, created_at, closed_at, category_id, restaurant_id, equipment_id, restaurant:restaurants (name, color), category:categories (name, area), equipment (id, name, brand, serial), opener:profiles!tickets_created_by_fkey (full_name), assignee:profiles!tickets_assignee_id_fkey (full_name)',
          )
          .eq('id', id)
          .maybeSingle(),
        loadThread(id),
      ])
      if (ticket.error?.code === '22P02') return { ...thread, ticket: null }
      if (ticket.error) throw ticket.error
      return { ...thread, ticket: ticket.data }
    },
  })
}

export function usePostUpdate(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // The files go first: if one fails nothing has been posted, and it can be tried again.
    mutationFn: async ({
      body,
      photos,
      internal = false,
    }: {
      body: string
      photos: PickedPhoto[]
      internal?: boolean
    }) => {
      const paths = await uploadPhotos(ticketId, photos)
      const { error } = await requireSupabase().rpc('post_ticket_update', {
        p_ticket_id: ticketId,
        p_body: body,
        p_paths: paths,
        p_internal: internal,
      })
      if (error) throw error
    },
    // The list moves too: a message is activity.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['ops-ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  })
}
