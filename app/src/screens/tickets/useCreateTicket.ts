import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'
import { uploadPhotos, type PickedPhoto } from './usePhotos'

/**
 * Create ticket: the categories with how many units each has at the restaurant,
 * then one category and that restaurant's units in it. Retired units are not offered.
 */

export type Urgency = Enums<'ticket_urgency'>

export function useCategories(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['categories', restaurantId],
    enabled: Boolean(restaurantId),
    throwOnError: true,
    queryFn: async () => {
      const sb = requireSupabase()
      const [categories, counts] = await Promise.all([
        sb.from('categories').select('id, name, area').eq('active', true).order('sort_order'),
        sb
          .from('v_category_equipment_counts')
          .select('category_id, equipment_count')
          .eq('restaurant_id', restaurantId!),
      ])
      if (categories.error) throw categories.error
      if (counts.error) throw counts.error
      const countBy = new Map(counts.data.map((c) => [c.category_id, c.equipment_count ?? 0]))
      return categories.data.map((c) => ({ ...c, count: countBy.get(c.id) ?? 0 }))
    },
  })
}

export function useTicketForm(categoryId: string, restaurantId: string | undefined) {
  return useQuery({
    queryKey: ['ticket-form', categoryId, restaurantId],
    enabled: Boolean(restaurantId),
    throwOnError: true,
    queryFn: async () => {
      const sb = requireSupabase()
      const [category, equipment] = await Promise.all([
        sb.from('categories').select('id, name, area').eq('id', categoryId).eq('active', true).maybeSingle(),
        sb
          .from('equipment')
          .select('id, name, serial')
          .eq('restaurant_id', restaurantId!)
          .eq('category_id', categoryId)
          .is('retired_at', null)
          .order('name'),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (category.error && category.error.code !== '22P02') throw category.error
      if (equipment.error && equipment.error.code !== '22P02') throw equipment.error
      return { category: category.data, equipment: equipment.data ?? [] }
    },
  })
}

export type NewTicket = {
  restaurantId: string
  categoryId: string
  equipmentId: string | null
  title: string
  description: string
  urgency: Urgency
  createdBy: string
  photos: PickedPhoto[]
  /** The old ticket this one follows from. */
  parentTicketId?: string | null
}

/**
 * Files need the ticket to exist first, since their folder and policies follow it. So
 * a failure here leaves a ticket without its photos: that report still matters, and
 * it is what the person gets told.
 */
export async function addTicketPhotos(ticketId: string, photos: PickedPhoto[], createdBy: string) {
  if (photos.length === 0) return true
  try {
    const paths = await uploadPhotos(ticketId, photos)
    const { error } = await requireSupabase()
      .from('ticket_photos')
      .insert(paths.map((path) => ({ ticket_id: ticketId, path, created_by: createdBy })))
    return !error
  } catch {
    return false
  }
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (t: NewTicket) => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .insert({
          restaurant_id: t.restaurantId,
          category_id: t.categoryId,
          equipment_id: t.equipmentId,
          title: t.title,
          description: t.description || null,
          urgency: t.urgency,
          created_by: t.createdBy,
          parent_ticket_id: t.parentTicketId ?? null,
          // Assigned by tickets_guard; the type wants one anyway.
          number: 0,
        })
        .select('id, display_id')
        .single()
      if (error) throw error
      return { displayId: data.display_id, photosFailed: !(await addTicketPhotos(data.id, t.photos, t.createdBy)) }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
      ]),
  })
}
