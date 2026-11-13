import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'
import { addTicketPhotos } from '../tickets/useCreateTicket'
import type { PickedPhoto } from '../tickets/usePhotos'
import type { CheckTarget } from './useChecklist'

/**
 * Quick ticket from a checklist item: the categories for the section's area, for an item
 * that names none, and the restaurant's units in the category, for the optional equipment.
 */
export function useQuickTicketOptions(restaurantId: string, area: 'foh' | 'boh' | null, categoryId: string) {
  const categories = useQuery({
    queryKey: ['quick-ticket', 'categories', area],
    queryFn: async () => {
      let q = requireSupabase().from('categories').select('id, name, area').eq('active', true).order('sort_order')
      if (area) q = q.eq('area', area)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
  const equipment = useQuery({
    queryKey: ['quick-ticket', 'equipment', restaurantId, categoryId],
    enabled: Boolean(categoryId),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('equipment')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .eq('category_id', categoryId)
        .is('retired_at', null)
        .order('name')
      if (error) throw error
      return data
    },
  })
  return { categories, equipment }
}

export type QuickTicket = {
  target: CheckTarget
  title: string
  urgency: Enums<'ticket_urgency'>
  categoryId: string | null
  equipmentId: string | null
  photos: PickedPhoto[]
  createdBy: string
}

/**
 * Creates the ticket through create_walkthrough_ticket, which gives it the Walkthrough tag
 * and links it to the item; Ops is told as for any new ticket. Photos follow, as on
 * Create ticket, since their folder needs the ticket: if they fail the ticket stands.
 */
export function useCreateWalkthroughTicket(walkthroughId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (t: QuickTicket) => {
      const sb = requireSupabase()
      const { data: id, error } = await sb.rpc('create_walkthrough_ticket', {
        p_walkthrough_id: walkthroughId,
        ...(t.target.itemId ? { p_item_id: t.target.itemId } : { p_task_id: t.target.taskId! }),
        p_title: t.title,
        p_urgency: t.urgency,
        ...(t.categoryId ? { p_category_id: t.categoryId } : {}),
        ...(t.equipmentId ? { p_equipment_id: t.equipmentId } : {}),
      })
      if (error) throw error
      const photosFailed = !(await addTicketPhotos(id, t.photos, t.createdBy))
      const { data } = await sb.from('tickets').select('display_id').eq('id', id).maybeSingle()
      return { id, displayId: data?.display_id ?? 'The ticket', photosFailed }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['walkthrough', walkthroughId] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  })
}
