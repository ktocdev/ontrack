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
        .select('id, period, status, restaurant_id, template_id, restaurant:restaurants (name)')
        .eq('id', walkthroughId)
        .maybeSingle()
      if (error) throw error
      if (!w) return null

      const [sections, progress, checks, fixes, tickets] = await Promise.all([
        sb
          .from('walkthrough_sections')
          .select('id')
          .eq('template_id', w.template_id ?? ''),
        sb.from('v_walkthrough_progress').select('*').eq('walkthrough_id', w.id),
        sb.from('walkthrough_checks').select('id, item_id, result').eq('walkthrough_id', w.id),
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
      ])
      for (const r of [sections, progress, checks, fixes, tickets]) if (r.error) throw r.error
      const { data: items, error: itemsError } = await sb
        .from('walkthrough_items')
        .select('id, section_id, group_name, title, sort_order, active')
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
        items,
        checks: checks.data! as CheckRow[],
        fixes: fixes.data!,
        tickets: tickets.data!,
      }
    },
  })
}

type Checklist = NonNullable<ReturnType<typeof useChecklist>['data']>

/**
 * Mark an item Good or take Good off. The button lights at once and goes back if the
 * database says no (an open fix or ticket, or a submitted walkthrough).
 */
export function useSetGood(walkthroughId: string) {
  const queryClient = useQueryClient()
  const key = ['walkthrough', walkthroughId]
  return useMutation({
    mutationFn: async ({ itemId, good }: { itemId: string; good: boolean }) => {
      const { error } = await requireSupabase().rpc('set_walkthrough_good', {
        p_walkthrough_id: walkthroughId,
        p_item_id: itemId,
        p_good: good,
      })
      if (error) throw error
    },
    onMutate: async ({ itemId, good }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Checklist | null>(key)
      if (before) {
        const others = before.checks.filter((c) => c.item_id !== itemId)
        const mine = before.checks.find((c) => c.item_id === itemId)
        const hasRecord =
          !!mine &&
          (before.fixes.some((f) => f.check_id === mine.id) ||
            before.tickets.some((t) => t.walkthrough_check_id === mine.id))
        const next: CheckRow[] = good
          ? [...others, { id: mine?.id ?? `pending-${itemId}`, item_id: itemId, result: 'good' }]
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

/** An in-house fix on an item. It joins the restaurant's In-house list, with the Walkthrough tag. */
export function useAddFix(walkthroughId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, title }: { itemId: string; title: string }) => {
      const { error } = await requireSupabase().rpc('add_walkthrough_fix', {
        p_walkthrough_id: walkthroughId,
        p_item_id: itemId,
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
