import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'

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
        sb.from('categories').select('id, name, area').order('sort_order'),
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
        sb.from('categories').select('id, name, area').eq('id', categoryId).maybeSingle(),
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
          // Assigned by tickets_guard; the type wants one anyway.
          number: 0,
        })
        .select('display_id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
      ]),
  })
}
