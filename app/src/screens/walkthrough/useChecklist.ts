import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { progressOf } from './walkthrough'
import type { CheckRow } from './checklist'

/**
 * Manager · Walkthrough checklist. The walkthrough, its progress per section (for the tabs
 * and the header), the checklist it opened with, and every check, fix and ticket on it.
 * RLS decides what comes back; a walkthrough outside the person's restaurants is nothing.
 */
export function useChecklist(walkthroughId: string) {
  return useQuery({
    queryKey: ['walkthrough', walkthroughId],
    queryFn: async () => {
      const sb = requireSupabase()
      const { data: w, error } = await sb
        .from('walkthroughs')
        .select(
          'id, period, due_on, status, restaurant_id, template_id, submitted_at, submitted_note, restaurant:restaurants (name), submitter:profiles!walkthroughs_submitted_by_fkey (full_name)',
        )
        .eq('id', walkthroughId)
        .maybeSingle()
      if (error) throw error
      if (!w) return null

      const [sections, progress, checks, fixes, tickets, tasks] = await Promise.all([
        sb
          .from('walkthrough_sections')
          .select('id, name, area')
          .eq('template_id', w.template_id ?? ''),
        sb.from('v_walkthrough_progress').select('*').eq('walkthrough_id', w.id),
        sb.from('walkthrough_checks').select('id, item_id, quarterly_task_id, result').eq('walkthrough_id', w.id),
        sb
          .from('inhouse_fixes')
          .select('id, check_id, title, done_at, created_at')
          .eq('walkthrough_id', w.id)
          .not('check_id', 'is', null),
        sb
          .from('tickets')
          .select('id, display_id, title, urgency, status, walkthrough_check_id, created_at')
          .eq('walkthrough_id', w.id)
          .not('walkthrough_check_id', 'is', null),
        // The quarter's tasks, each with the check that did it this quarter, whichever month.
        sb.rpc('walkthrough_quarter_tasks', { p_walkthrough_id: w.id }),
      ])
      for (const r of [sections, progress, checks, fixes, tickets, tasks]) if (r.error) throw r.error
      const { data: items, error: itemsError } = await sb
        .from('walkthrough_items')
        .select('id, section_id, group_name, title, sort_order, active, category_id')
        .in(
          'section_id',
          sections.data!.map((s) => s.id),
        )
      if (itemsError) throw itemsError

      return {
        walkthrough: {
          ...w,
          restaurantName: (w.restaurant as unknown as { name: string } | null)?.name ?? '',
        },
        progress: progressOf(progress.data!, w.period),
        sections: sections.data!,
        items,
        checks: checks.data! as CheckRow[],
        fixes: fixes.data!,
        tickets: tickets.data!,
        tasks: tasks.data!,
      }
    },
  })
}

type Checklist = NonNullable<ReturnType<typeof useChecklist>['data']>

/** An item on the checklist, or one of the quarter's tasks. */
export type CheckTarget = { itemId: string; taskId?: undefined } | { taskId: string; itemId?: undefined }

const targetArgs = (t: CheckTarget) => (t.itemId ? { p_item_id: t.itemId } : { p_task_id: t.taskId! })
const isFor = (t: CheckTarget) => (c: CheckRow) =>
  t.itemId ? c.item_id === t.itemId : c.quarterly_task_id === t.taskId

/**
 * Mark an item or task Good or take Good off. The button lights at once and goes back if
 * the database says no (an open fix or ticket, or a submitted walkthrough).
 */
export function useSetGood(walkthroughId: string) {
  const queryClient = useQueryClient()
  const key = ['walkthrough', walkthroughId]
  return useMutation({
    mutationFn: async ({ target, good }: { target: CheckTarget; good: boolean }) => {
      const { error } = await requireSupabase().rpc('set_walkthrough_good', {
        p_walkthrough_id: walkthroughId,
        ...targetArgs(target),
        p_good: good,
      })
      if (error) throw error
    },
    onMutate: async ({ target, good }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Checklist | null>(key)
      if (before) {
        const mine = before.checks.find(isFor(target))
        const others = before.checks.filter((c) => c !== mine)
        const hasRecord =
          !!mine &&
          (before.fixes.some((f) => f.check_id === mine.id) ||
            before.tickets.some((t) => t.walkthrough_check_id === mine.id))
        const next: CheckRow[] = good
          ? [
              ...others,
              {
                id: mine?.id ?? `pending-${target.itemId ?? target.taskId}`,
                item_id: target.itemId ?? null,
                quarterly_task_id: target.taskId ?? null,
                result: 'good',
              },
            ]
          : hasRecord
            ? [...others, { ...mine!, result: 'in_house' }]
            : others
        queryClient.setQueryData(key, { ...before, checks: next })
      }
      return { before }
    },
    onError: (_e, _v, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] })
    },
  })
}

/** An in-house fix on an item or task. It joins the restaurant's In-house list, with the Walkthrough tag. */
export function useAddFix(walkthroughId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ target, title }: { target: CheckTarget; title: string }) => {
      const { error } = await requireSupabase().rpc('add_walkthrough_fix', {
        p_walkthrough_id: walkthroughId,
        ...targetArgs(target),
        p_title: title,
      })
      if (error) throw error
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['walkthrough', walkthroughId] }),
        queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ]),
  })
}

/** Why the database said no, in words for the toast. */
export function goodRefusal(error: unknown) {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  if (code === '23514') return 'Finish or delete this item’s in-house fixes and tickets first.'
  if (code === '42501' && message?.includes('submitted')) return 'This walkthrough was submitted, so it can’t change.'
  if (code === '42501') return 'You can’t change this walkthrough.'
  return 'Couldn’t save that. Check your connection and try again.'
}
