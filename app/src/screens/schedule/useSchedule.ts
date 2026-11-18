import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

export type Rotation = {
  id: string
  name: string
  is_group: boolean
  starts_on: string
  due_day: number | null
  reminder_days: number[]
  /** The cycle's checklists, in order. */
  months: string[]
}

export type Checklist = {
  id: string
  name: string
  short_name: string | null
  description: string | null
  active: boolean
  sections: number
  items: number
}

const KEY = ['schedule']

/**
 * The walkthrough schedule (WT-Ops-Schedule, OT-133): every rotation with its months, which
 * restaurants are on one other than the group's, and the checklists with their size. All of
 * it is the group's, read by anyone signed in; which restaurants show comes from useUser().
 */
export function useSchedule() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const sb = requireSupabase()
      const [rotations, months, assigned, templates, sections] = await Promise.all([
        sb.from('walkthrough_rotations').select('id, name, is_group, starts_on, due_day, reminder_days').order('name'),
        sb.from('walkthrough_rotation_months').select('rotation_id, position, template_id').order('position'),
        sb.from('restaurant_rotations').select('restaurant_id, rotation_id'),
        sb.from('walkthrough_templates').select('id, name, short_name, description, active').order('name'),
        sb.from('walkthrough_sections').select('template_id, walkthrough_items (id, active)'),
      ])
      for (const r of [rotations, months, assigned, templates, sections]) if (r.error) throw r.error

      const size = new Map<string, { sections: number; items: number }>()
      for (const s of sections.data!) {
        const now = size.get(s.template_id) ?? { sections: 0, items: 0 }
        const items = (s.walkthrough_items as unknown as { active: boolean }[]).filter((i) => i.active).length
        size.set(s.template_id, { sections: now.sections + 1, items: now.items + items })
      }
      const list: Rotation[] = rotations.data!.map((r) => ({
        ...r,
        months: months.data!.filter((m) => m.rotation_id === r.id).map((m) => m.template_id),
      }))
      return {
        rotations: list,
        group: list.find((r) => r.is_group) ?? null,
        /** A restaurant on a rotation other than the group's; none means the group's. */
        own: new Map(assigned.data!.map((a) => [a.restaurant_id, a.rotation_id])),
        checklists: new Map<string, Checklist>(
          templates.data!.map((t) => [t.id, { ...t, ...(size.get(t.id) ?? { sections: 0, items: 0 }) }]),
        ),
      }
    },
  })
}

function useRefresh() {
  const queryClient = useQueryClient()
  // The overview and a restaurant's page show the month's checklist, which this changes.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: KEY }),
      queryClient.invalidateQueries({ queryKey: ['ops-walkthroughs'] }),
    ])
}

/** Save a rotation whole (save_rotation, logged): its name, months, start, due day and reminders. */
export function useSaveRotation() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (r: Omit<Rotation, 'is_group' | 'id'> & { id: string | null }) => {
      const { data, error } = await requireSupabase().rpc('save_rotation', {
        p_id: r.id as string,
        p_name: r.name,
        p_templates: r.months,
        p_starts_on: r.starts_on,
        p_due_day: r.due_day as number,
        p_reminder_days: r.reminder_days,
      })
      if (error) throw error
      return data
    },
    onSuccess: refresh,
  })
}

/** Put a restaurant on a rotation; null puts it back on the group's (set_restaurant_rotation, logged). */
export function useSetRestaurantRotation() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ restaurantId, rotationId }: { restaurantId: string; rotationId: string | null }) => {
      const { error } = await requireSupabase().rpc('set_restaurant_rotation', {
        p_restaurant: restaurantId,
        p_rotation: rotationId as string,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}
