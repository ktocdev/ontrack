import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase, type Enums } from '../../lib/supabase'

type Area = Enums<'area'>

/**
 * In-house tasks at the restaurants passed in: the manager's In-house tab, and the Support
 * Team's In-house list (OT-131). The caller passes them from useUser(), so View as shows
 * the person viewed and not what the admin may read. The key sits under 'tickets' so a
 * change also refreshes the count on Open tickets. A fix made into a ticket comes too, with
 * its ticket, for the Support Team's list; the manager's leaves it off (`stillInHouse`).
 */
const inHouseKey = (restaurantIds: string[]) => ['tickets', 'in-house', restaurantIds]

async function loadTasks(restaurantIds: string[]) {
  const { data, error } = await requireSupabase()
    .from('inhouse_fixes')
    .select(
      'id, title, note, origin_label, area, category_id, created_by, done_at, first_done_at, restaurant_id, created_at, walkthrough_id, from_ops, from_ticket_id, converted_ticket_id, adder:profiles!inhouse_fixes_created_by_fkey (full_name), doner:profiles!inhouse_fixes_done_by_fkey (full_name), unit:equipment!inhouse_fixes_equipment_id_fkey (name), converted:tickets!inhouse_fixes_converted_ticket_id_fkey (id, display_id, created_at, created_by, creator:profiles!tickets_created_by_fkey (full_name)), check:walkthrough_checks (item:walkthrough_items (category_id))',
    )
    .in('restaurant_id', restaurantIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export type Task = Awaited<ReturnType<typeof loadTasks>>[number]

/** Still on the restaurant's list: not made into a ticket (OT-128), which is the ticket's record now. */
export function stillInHouse(t: { converted_ticket_id: string | null }) {
  return !t.converted_ticket_id
}

/** A task changed: the lists under 'tickets', and a walkthrough's checklist and home, which show its fixes. */
function refreshTasks(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    queryClient.invalidateQueries({ queryKey: ['walkthrough'] }),
    queryClient.invalidateQueries({ queryKey: ['walkthrough-home'] }),
    queryClient.invalidateQueries({ queryKey: ['ops-walkthroughs'] }),
  ])
}

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
    onSettled: () => refreshTasks(queryClient),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_inhouse_fix', { p_id: id })
      if (error) throw error
    },
    onSuccess: () => refreshTasks(queryClient),
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

/**
 * Convert to ticket (WT-Ops-Fix, OT-131): an open fix becomes a ticket with nobody on it,
 * with the Walkthrough tag when it came from one; the fix leaves the restaurant's list.
 * The category is the fix's or its item's, else the one picked on the sheet. Returns the
 * new ticket's number for the line that confirms it.
 */
export function useConvertFix() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId?: string | null }) => {
      const sb = requireSupabase()
      const { data: ticketId, error } = await sb.rpc('convert_inhouse_fix', {
        p_id: id,
        ...(categoryId ? { p_category_id: categoryId } : {}),
      })
      if (error) throw error
      const { data } = await sb.from('tickets').select('display_id').eq('id', ticketId).maybeSingle()
      return { ticketId, displayId: data?.display_id ?? null }
    },
    onSuccess: () =>
      Promise.all([refreshTasks(queryClient), queryClient.invalidateQueries({ queryKey: ['ops-ticket'] })]),
  })
}

/**
 * Add task from the Support Team (OT-131): a title, a note, and a unit, which brings its
 * category and area, or else an area. The restaurant's Reporters hear about it.
 */
export function useAddOpsTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: {
      restaurantId: string
      title: string
      note: string
      equipmentId: string | null
      area: Area
    }) => {
      const { error } = await requireSupabase().rpc('add_inhouse_task', {
        p_restaurant: task.restaurantId,
        p_title: task.title.trim(),
        p_note: task.note.trim(),
        ...(task.equipmentId ? { p_equipment_id: task.equipmentId } : { p_area: task.area }),
      })
      if (error) throw error
    },
    onSuccess: () => refreshTasks(queryClient),
  })
}

/** A restaurant's units in service, for Add task's unit picker. */
export function useUnitsAt(restaurantId: string | null) {
  return useQuery({
    queryKey: ['equipment', 'units-at', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('equipment')
        .select('id, name, category:categories (name, area)')
        .eq('restaurant_id', restaurantId!)
        .is('retired_at', null)
        .order('name')
      if (error) throw error
      return data
    },
  })
}
