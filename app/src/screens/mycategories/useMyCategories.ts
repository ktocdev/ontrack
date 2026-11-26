import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AREAS, type Area } from '../../app/areas'
import { useUser } from '../../auth/context'
import type { ViewSetting } from '../../components/ViewSetting'
import { requireSupabase } from '../../lib/supabase'
import { categoryRow, hiddenCategories, isDefault, isShown, NO_PREFS, toPrefs, type Listed, type Prefs } from './view'

/**
 * My categories (OT-118): the person's own settings per area and category, and the
 * group's categories they apply to. Read for the person in useUser(), so View as shows
 * the viewed person's (admins read anyone's rows); only the person themselves writes them,
 * and the screen hides its controls under View as.
 */
const prefsKey = (userId: string) => ['my-categories', userId] as const

export type MyCategory = { id: string; name: string; area: Area; active: boolean }

export function useMyPrefs() {
  const { user } = useUser()
  return useQuery({
    queryKey: prefsKey(user.id),
    enabled: !__E2E_MOCK__,
    queryFn: async (): Promise<Prefs> => {
      const sb = requireSupabase()
      const [areas, categories] = await Promise.all([
        sb.from('area_prefs').select('area, notify, shown').eq('user_id', user.id),
        sb.from('category_prefs').select('category_id, notify, shown').eq('user_id', user.id),
      ])
      if (areas.error) throw areas.error
      if (categories.error) throw categories.error
      return toPrefs(areas.data, categories.data)
    },
  })
}

/** The group's categories, in their order. Under 'categories', so a change on Categories rereads it. */
export function useAllCategories() {
  return useQuery({
    queryKey: ['categories', 'all'],
    enabled: !__E2E_MOCK__,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MyCategory[]> => {
      const { data, error } = await requireSupabase()
        .from('categories')
        .select('id, name, area, active')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

/**
 * What a list leaves off, and the "N hidden · Show all" line's state. Show all lasts while
 * the screen is open. Until the settings load, nothing is left off, so a slow read never
 * hides a ticket.
 */
export function useListView() {
  const { user } = useUser()
  const prefs = useMyPrefs().data ?? NO_PREFS
  const categories = useAllCategories().data ?? []
  const [showAll, setShowAll] = useState(false)
  const { count: hidden, names: hiddenNames } = hiddenCategories(prefs, categories)
  return {
    /** How many categories this person hides; the line shows while it is more than none. */
    hidden,
    /** What they hide, by name: the areas hidden whole, and the categories hidden elsewhere. */
    hiddenNames,
    /** Whether a whole area is hidden, which is all an in-house task, with no category, goes by. */
    areaHidden: AREAS.some((a) => !prefs.areas[a].shown),
    showAll,
    setShowAll,
    shows: (item: Listed) => showAll || isShown(prefs, user.id, item),
  }
}

/** A ticket's category as the lists select it, for `shows`. */
export function listed(t: {
  category_id?: string | null
  category?: { area: Area } | null
  area?: Area | null
  created_by?: string | null
  assignee_id?: string | null
}): Listed {
  // A walkthrough ticket with no category carries its own area (OT-141).
  const area = t.category?.area ?? t.area
  return { category_id: t.category_id, area, created_by: t.created_by, assignee_id: t.assignee_id }
}

/**
 * Saves change the screen at once and go back if the save fails, so a switch moves as it's
 * tapped; the settings are reread afterwards either way.
 */
function useOptimistic(userId: string) {
  const queryClient = useQueryClient()
  const key = prefsKey(userId)
  return {
    apply: async (change: (prefs: Prefs) => Prefs) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Prefs>(key)
      if (before) queryClient.setQueryData<Prefs>(key, change(before))
      return { before }
    },
    restore: (context: { before?: Prefs } | undefined) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
    },
    reread: () => queryClient.invalidateQueries({ queryKey: key }),
  }
}

export function useSaveArea() {
  const { user } = useUser()
  const cache = useOptimistic(user.id)
  return useMutation({
    mutationFn: async ({ area, view }: { area: Area; view: ViewSetting }) => {
      const table = requireSupabase().from('area_prefs')
      const { error } = isDefault(view)
        ? await table.delete().eq('user_id', user.id).eq('area', area)
        : await table.upsert({ user_id: user.id, area, notify: view.notify, shown: view.shown })
      if (error) throw error
    },
    onMutate: ({ area, view }) => cache.apply((prefs) => ({ ...prefs, areas: { ...prefs.areas, [area]: view } })),
    onError: (_error, _vars, context) => cache.restore(context),
    onSettled: cache.reread,
  })
}

export function useSaveCategory() {
  const { user } = useUser()
  const cache = useOptimistic(user.id)
  return useMutation({
    /** `view` null puts the category back to following its area. */
    mutationFn: async ({ prefs, category, view }: { prefs: Prefs; category: MyCategory; view: ViewSetting | null }) => {
      const row = view && categoryRow(prefs, category.area, view)
      const table = requireSupabase().from('category_prefs')
      const { error } = row
        ? await table.upsert({ user_id: user.id, category_id: category.id, ...row })
        : await table.delete().eq('user_id', user.id).eq('category_id', category.id)
      if (error) throw error
    },
    onMutate: ({ prefs, category, view }) =>
      cache.apply((current) => {
        const row = view && categoryRow(prefs, category.area, view)
        const categories = new Map(current.categories)
        if (row) categories.set(category.id, row)
        else categories.delete(category.id)
        return { ...current, categories }
      }),
    onError: (_error, _vars, context) => cache.restore(context),
    onSettled: cache.reread,
  })
}
