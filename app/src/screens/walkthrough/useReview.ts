import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { PillStatus } from '../../components/Pill'

type Origin = {
  item: {
    title: string
    group_name: string
    section: { id: string; short_name: string | null; name: string } | null
  } | null
  task: { title: string } | null
} | null

/**
 * Every ticket made on a walkthrough, oldest first, with the item or task it came from.
 * Tickets and checks point at each other both ways, so the link to follow is named.
 * The key sits under 'tickets', so Realtime and any ticket change refresh it.
 */
export function useWalkthroughTickets(walkthroughId: string) {
  return useQuery({
    queryKey: ['tickets', 'walkthrough-tickets', walkthroughId],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .select(
          'id, display_id, title, status, urgency, created_at, check:walkthrough_checks!tickets_walkthrough_check_id_fkey (item:walkthrough_items (title, group_name, section:walkthrough_sections (id, short_name, name)), task:quarterly_tasks (title))',
        )
        .eq('walkthrough_id', walkthroughId)
        .order('created_at')
      if (error) throw error
      return data.map((t) => {
        const origin = t.check as unknown as Origin
        const section = origin?.item?.section
        return {
          id: t.id,
          displayId: t.display_id ?? '',
          title: t.title,
          status: t.status as PillStatus,
          urgent: t.urgency === 'urgent',
          item: origin?.item ? { title: origin.item.title, group: origin.item.group_name } : null,
          task: origin?.task?.title ?? null,
          section: section ? { id: section.id, short: section.short_name || section.name } : null,
        }
      })
    },
  })
}

export type WalkthroughTicket = NonNullable<ReturnType<typeof useWalkthroughTickets>['data']>[number]

/** Where a walkthrough ticket opens: its Edit ticket while open, its own page once closed. */
export function ticketPath(walkthroughId: string, t: WalkthroughTicket) {
  const section = t.section?.id ?? (t.task ? 'quarterly' : null)
  return t.status === 'closed' || !section
    ? `/tickets/${t.id}`
    : `/walkthrough/${walkthroughId}/${section}/ticket/${t.id}`
}

/** Submits the walkthrough with an optional note for Ops; allowed with checks still to do. */
export function useSubmitWalkthrough(walkthroughId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (note: string) => {
      const { error } = await requireSupabase().rpc('submit_walkthrough', {
        p_walkthrough_id: walkthroughId,
        p_note: note.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['walkthrough', walkthroughId] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
      ]),
  })
}
