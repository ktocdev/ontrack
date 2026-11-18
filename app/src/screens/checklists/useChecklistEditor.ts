import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Enums } from '../../lib/supabase'
import { requireSupabase } from '../../lib/supabase'

export type Area = Enums<'area'>

export type EditorSection = {
  id: string
  name: string
  short_name: string | null
  area: Area | null
  sort_order: number
  active: boolean
  copied_from: string | null
}

export type EditorItem = {
  id: string
  section_id: string
  group_name: string
  title: string
  directions: string | null
  video_url: string | null
  category_id: string | null
  sort_order: number
  active: boolean
  copied_from: string | null
}

/**
 * The checklist editor (OT-136): one checklist with its sections and items, the rotations
 * that use it, and whether a walkthrough has had it (then the next change makes a new
 * version). A checklist an edit has replaced says so through replaced_by, and the screen
 * moves to the newer one.
 */
export function useChecklistEditor(id: string) {
  return useQuery({
    queryKey: ['checklist-editor', id],
    queryFn: async () => {
      const sb = requireSupabase()
      const [template, sections, used, rotations] = await Promise.all([
        sb
          .from('walkthrough_templates')
          .select('id, name, description, short_name, active, replaced_by')
          .eq('id', id)
          .maybeSingle(),
        sb
          .from('walkthrough_sections')
          .select(
            'id, name, short_name, area, sort_order, active, copied_from, walkthrough_items (id, section_id, group_name, title, directions, video_url, category_id, sort_order, active, copied_from)',
          )
          .eq('template_id', id)
          .order('sort_order'),
        sb.from('walkthroughs').select('id').eq('template_id', id).limit(1),
        sb
          .from('walkthrough_rotation_months')
          .select('rotation:walkthrough_rotations (id, name, is_group)')
          .eq('template_id', id),
      ])
      // A malformed id in the address is a page that doesn't exist, not a failure.
      if (template.error?.code === '22P02') return null
      for (const r of [template, sections, used, rotations]) if (r.error) throw r.error
      if (!template.data) return null
      const items = sections.data!.flatMap((s) => s.walkthrough_items as unknown as EditorItem[])
      const onRotations = new Map<string, { name: string; is_group: boolean }>()
      for (const m of rotations.data!) {
        const r = m.rotation as unknown as { id: string; name: string; is_group: boolean } | null
        if (r) onRotations.set(r.id, r)
      }
      return {
        checklist: template.data,
        sections: sections.data!.map(({ walkthrough_items: _, ...s }) => s as EditorSection),
        items: items.sort((a, b) => a.sort_order - b.sort_order),
        used: used.data!.length > 0,
        rotations: [...onRotations.values()],
      }
    },
  })
}

/**
 * A change through one of the checklist functions. Each returns the checklist's id after
 * it, a new version's the first time one a walkthrough has had is changed.
 */
export function useChecklistChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ fn, args }: { fn: ChecklistFn; args: Record<string, unknown> }) => {
      const { data, error } = await requireSupabase().rpc(fn as 'save_checklist', args as never)
      if (error) throw error
      return (data as unknown as string | null) ?? null
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['checklist-editor'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule'] }),
      ]),
  })
}

export type ChecklistFn =
  | 'add_checklist'
  | 'save_checklist'
  | 'set_checklist_active'
  | 'delete_checklist'
  | 'save_checklist_section'
  | 'save_checklist_item'
  | 'rename_checklist_group'
  | 'set_checklist_part_active'
  | 'delete_checklist_part'
  | 'order_checklist'
  | 'import_checklist'
