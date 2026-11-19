import type { Area } from '../../app/areas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'
import { addTicketPhotos } from '../tickets/useCreateTicket'
import type { PickedPhoto } from '../tickets/usePhotos'
import type { CheckTarget } from './useChecklist'

/**
 * A ticket's units to pick from (the quick ticket sheet, Edit ticket): the restaurant's units
 * in its category, or for a walkthrough ticket with none (OT-141) in its area.
 */
export function useTicketUnits(restaurantId: string, categoryId: string | null, area: Area | null) {
  return useQuery({
    queryKey: ['quick-ticket', 'equipment', restaurantId, categoryId, area],
    enabled: Boolean(categoryId || area),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = categoryId
        ? await sb
            .from('equipment')
            .select('id, name, serial')
            .eq('restaurant_id', restaurantId)
            .eq('category_id', categoryId)
            .is('retired_at', null)
            .order('name')
        : await sb
            .from('equipment')
            .select('id, name, serial, category:categories!inner (area)')
            .eq('restaurant_id', restaurantId)
            .eq('category.area', area!)
            .is('retired_at', null)
            .order('name')
      if (error) throw error
      return data.map((u) => ({ id: u.id, name: u.name, serial: u.serial }))
    },
  })
}

export type QuickTicket = {
  target: CheckTarget
  title: string
  urgency: Enums<'ticket_urgency'>
  /** Only where nothing on the checklist gives one: a quarterly task, or a section without one. */
  area: Area | null
  equipmentId: string | null
  photos: PickedPhoto[]
  createdBy: string
}

/**
 * Creates the ticket through create_walkthrough_ticket, which gives it the Walkthrough tag,
 * the item's category if it has an active one (else none, and the area), and links it to
 * the item; Ops is told as for any new ticket. Photos follow, as on
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
        ...(t.area ? { p_area: t.area } : {}),
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
