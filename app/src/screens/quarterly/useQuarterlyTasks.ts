import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { TaskRow } from './quarterly'

const KEY = ['quarterly-tasks']

/**
 * Quarterly tasks (WT-Ops-Tasks, OT-135): every task row, the group's and each restaurant's,
 * which anyone signed in reads, and which tasks a walkthrough has had, since only a task no
 * walkthrough has had can be deleted (delete_quarterly_task says the same). Which
 * restaurants show comes from useUser().
 */
export function useQuarterlyTasks() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const sb = requireSupabase()
      const [tasks, used] = await Promise.all([
        sb
          .from('quarterly_tasks')
          .select(
            'id, restaurant_id, overrides_task_id, title, directions, video_url, months, removed, active, sort_order',
          ),
        sb.from('walkthrough_tasks').select('root_id'),
      ])
      if (tasks.error) throw tasks.error
      if (used.error) throw used.error
      return { rows: tasks.data as TaskRow[], used: new Set(used.data.map((u) => u.root_id)) }
    },
  })
}

function useChange<T>(run: (v: T) => PromiseLike<{ error: unknown }>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: T) => {
      const { error } = await run(v)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Add or change a task (save_quarterly_task, logged): no id adds one, to the group or a
 * restaurant, in the quarter given; a group task's id with a restaurant changes it for that
 * restaurant; any other id edits that task.
 */
export function useSaveTask() {
  return useChange(
    (t: {
      id: string | null
      restaurantId: string | null
      title: string
      directions: string
      videoUrl: string
      quarter?: number
    }) =>
      requireSupabase().rpc('save_quarterly_task', {
        p_id: t.id as string,
        p_restaurant: t.restaurantId as string,
        p_title: t.title.trim(),
        p_directions: t.directions.trim(),
        p_video_url: t.videoUrl.trim(),
        ...(t.quarter ? { p_quarters: [t.quarter] } : {}),
      }),
  )
}

/** Remove a group task for one restaurant, or restore it. */
export function useSetRemoved() {
  return useChange((v: { taskId: string; restaurantId: string; removed: boolean }) =>
    requireSupabase().rpc('set_quarterly_task_removed', {
      p_task: v.taskId,
      p_restaurant: v.restaurantId,
      p_removed: v.removed,
    }),
  )
}

/** "Use the all-restaurants version instead". */
export function useResetTask() {
  return useChange((v: { taskId: string; restaurantId: string }) =>
    requireSupabase().rpc('reset_quarterly_task', { p_task: v.taskId, p_restaurant: v.restaurantId }),
  )
}

/** Turn a group task or a restaurant's own off or on. */
export function useSetActive() {
  return useChange((v: { id: string; active: boolean }) =>
    requireSupabase().rpc('set_quarterly_task_active', { p_id: v.id, p_active: v.active }),
  )
}

/** Delete a task no walkthrough has had. */
export function useDeleteTask() {
  return useChange((id: string) => requireSupabase().rpc('delete_quarterly_task', { p_id: id }))
}
