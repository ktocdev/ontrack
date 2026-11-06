import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'

type Area = Enums<'area'>

/**
 * Manager · In-house tasks at the restaurants passed in. The caller passes them from
 * useUser(), so View as shows the person viewed and not what the admin may read. The
 * key sits under 'tickets' so a change also refreshes the count on Open tickets.
 */
const inHouseKey = (restaurantIds: string[]) => ['tickets', 'in-house', restaurantIds]

async function loadTasks(restaurantIds: string[]) {
  const { data, error } = await requireSupabase()
    .from('inhouse_fixes')
    .select(
      'id, title, origin_label, area, done_at, first_done_at, restaurant_id, created_at, adder:profiles!inhouse_fixes_created_by_fkey (full_name)',
    )
    .in('restaurant_id', restaurantIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export type Task = Awaited<ReturnType<typeof loadTasks>>[number]

export function useInHouse(restaurantIds: string[]) {
  return useQuery({ queryKey: inHouseKey(restaurantIds), queryFn: () => loadTasks(restaurantIds) })
}

/** Moves the row straight away, and puts it back if the save fails. */
export function useSetTaskDone(restaurantIds: string[]) {
  const queryClient = useQueryClient()
  const key = inHouseKey(restaurantIds)
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await requireSupabase().rpc('set_inhouse_fix_done', { p_id: id, p_done: done })
      if (error) throw error
    },
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Task[]>(key)
      queryClient.setQueryData<Task[]>(key, (tasks) =>
        tasks?.map((t) => {
          if (t.id !== id) return t
          const at = done ? new Date().toISOString() : null
          return { ...t, done_at: at, first_done_at: t.first_done_at ?? at }
        }),
      )
      return { before }
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_inhouse_fix', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

/**
 * A task a manager adds by hand, beside the walkthrough's: no origin, so it shows who
 * added it. Nothing notifies anyone; tasks are the restaurant's own.
 */
export function useAddTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: { restaurantId: string; title: string; area: Area; userId: string }) => {
      const { error } = await requireSupabase().from('inhouse_fixes').insert({
        restaurant_id: task.restaurantId,
        title: task.title.trim(),
        area: task.area,
        created_by: task.userId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}
