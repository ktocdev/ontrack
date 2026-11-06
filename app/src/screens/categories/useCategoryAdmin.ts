import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { requireSupabase, type Enums } from '../../lib/supabase'

export type Area = Enums<'area'>

export type ManagedCategory = {
  id: string
  name: string
  area: Area
  active: boolean
  /** A ticket or unit has used it, so it can be turned off but not deleted. */
  inUse: boolean
}

/**
 * Whether this person looks after categories: Ops with Add / edit equipment, and admins,
 * as can_edit_categories() decides in the database. Under View as, nobody here does.
 */
export function useCanEditCategories() {
  const { user, viewingAs } = useUser()
  const editsEquipment = useRight('edit_equipment')
  return !viewingAs && (user.role === 'admin' || (user.role === 'ops' && editsEquipment === true))
}

/** Every category, on or off, with whether anything has used it. The group's, so no restaurant scope. */
export function useManagedCategories() {
  return useQuery({
    queryKey: ['categories', 'managed'],
    queryFn: async (): Promise<ManagedCategory[]> => {
      const sb = requireSupabase()
      const [categories, history] = await Promise.all([
        sb.from('categories').select('id, name, area, active').order('sort_order'),
        sb.from('v_category_history').select('category_id, in_use'),
      ])
      if (categories.error) throw categories.error
      if (history.error) throw history.error
      const used = new Map(history.data.map((h) => [h.category_id, h.in_use === true]))
      return categories.data.map((c) => ({ ...c, inUse: used.get(c.id) ?? true }))
    },
  })
}

/** After any change: every picker and list that reads categories rereads them. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    ])
}

export function useAddCategory() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ name, area }: { name: string; area: Area }) => {
      const { error } = await requireSupabase().rpc('add_category', { p_name: name.trim(), p_area: area })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useRenameCategory() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await requireSupabase().rpc('rename_category', { p_id: id, p_name: name.trim() })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSetCategoryActive() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await requireSupabase().rpc('set_category_active', { p_id: id, p_active: active })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useDeleteCategory() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_category', { p_id: id })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** "That category already exists" from the database's 23505, else a general retry. */
export function categoryError(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505'
    ? 'There is already a category with that name here.'
    : 'That didn’t go through. Check your connection and try again.'
}
