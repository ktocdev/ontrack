import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { AREAS, type Area } from '../../app/areas'
import { DEFAULT_VIEW, type ViewSetting } from '../../components/ViewSetting'
import { requireSupabase } from '../../lib/supabase'

/**
 * The group's job titles (OT-117): Chef, IT, Ops manager and the rest, read by anyone
 * signed in and changed only by an admin through checked, logged functions. A title
 * grants nothing; it names who someone is and starts them on a view in My categories.
 */
export type StartingView = Record<Area, ViewSetting>

export type JobTitle = {
  id: string
  name: string
  active: boolean
  view: StartingView
  /** The area its people see first inside each restaurant, until they pick their own (OT-174). */
  firstArea: Area
}

export type ManagedJobTitle = JobTitle & {
  /** Someone has it or a pending invite names it, so it can be turned off but not deleted. */
  inUse: boolean
}

export const JOB_TITLES_KEY = ['job-titles'] as const

/** Every title, on and off, in the list's order, with its starting view per area. */
export function useJobTitles() {
  return useQuery({
    queryKey: JOB_TITLES_KEY,
    enabled: !__E2E_MOCK__,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<JobTitle[]> => {
      const sb = requireSupabase()
      const [titles, areas] = await Promise.all([
        sb.from('job_titles').select('id, name, active, first_area').order('sort_order'),
        sb.from('job_title_areas').select('job_title_id, area, notify, shown'),
      ])
      if (titles.error) throw titles.error
      if (areas.error) throw areas.error
      return titles.data.map(({ first_area, ...t }) => {
        const view = Object.fromEntries(AREAS.map((a) => [a, DEFAULT_VIEW])) as StartingView
        for (const row of areas.data) {
          if (row.job_title_id === t.id) view[row.area] = { notify: row.notify, shown: row.shown }
        }
        return { ...t, view, firstArea: first_area }
      })
    },
  })
}

/** A title's name by id, or null: for the places that show someone's title. */
export function useJobTitleName() {
  const { data } = useJobTitles()
  return (id: string | null | undefined) => (id ? (data?.find((t) => t.id === id)?.name ?? null) : null)
}

/** "Bert Velilla · Ops manager", or the name alone for someone with no title (OT-117). */
export function useWorkerName() {
  const titleName = useJobTitleName()
  return (p: { full_name: string; job_title_id: string | null }) => {
    const title = titleName(p.job_title_id)
    return title ? `${p.full_name} · ${title}` : p.full_name
  }
}

/** Every title with whether it is in use, for the Job titles screen. */
export function useManagedJobTitles() {
  const titles = useJobTitles()
  const history = useQuery({
    queryKey: [...JOB_TITLES_KEY, 'history'],
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('v_job_title_history').select('job_title_id, in_use')
      if (error) throw error
      return new Map(data.map((h) => [h.job_title_id, h.in_use === true]))
    },
  })
  return {
    data:
      titles.data && history.data
        ? titles.data.map((t): ManagedJobTitle => ({ ...t, inUse: history.data.get(t.id) ?? true }))
        : undefined,
    isPending: titles.isPending || history.isPending,
    isError: titles.isError || history.isError,
    refetch: () => Promise.all([titles.refetch(), history.refetch()]),
  }
}

/** Only an admin looks after the list, and nobody under View as. */
export function useCanEditJobTitles() {
  const { user, viewingAs } = useUser()
  return !viewingAs && user.is_admin
}

/** What the database takes: only the areas off the defaults. */
export function viewPayload(view: StartingView) {
  return Object.fromEntries(AREAS.filter((a) => view[a].notify !== 'all' || !view[a].shown).map((a) => [a, view[a]]))
}

function useRefresh() {
  const queryClient = useQueryClient()
  // The Users list and User profile show titles too.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: JOB_TITLES_KEY }),
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
    ])
}

export function useAddJobTitle() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ name, view, firstArea }: { name: string; view: StartingView; firstArea: Area }) => {
      const { error } = await requireSupabase().rpc('add_job_title', {
        p_name: name.trim(),
        p_view: viewPayload(view),
        p_first_area: firstArea,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSaveJobTitle() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      view,
      firstArea,
    }: {
      id: string
      name: string
      view: StartingView
      firstArea: Area
    }) => {
      const { error } = await requireSupabase().rpc('save_job_title', {
        p_id: id,
        p_name: name.trim(),
        p_view: viewPayload(view),
        p_first_area: firstArea,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSetJobTitleActive() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await requireSupabase().rpc('set_job_title_active', { p_id: id, p_active: active })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useDeleteJobTitle() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_job_title', { p_id: id })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** "That title already exists" from the database's 23505, else a general retry. */
export function jobTitleError(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505'
    ? 'There is already a job title with that name.'
    : 'That didn’t go through. Check your connection and try again.'
}
