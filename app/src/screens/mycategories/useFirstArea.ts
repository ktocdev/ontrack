import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import type { Area } from '../../app/areas'
import { requireSupabase } from '../../lib/supabase'
import { useJobTitles } from '../jobtitles/useJobTitles'

/**
 * Show first (OT-174): which area's tickets come first inside each restaurant, after the
 * urgent ones. It is the person's own and kept on their account, so it follows them from
 * phone to laptop. Until they pick one, it is their job title's first area, else Front of
 * House; a pick that matches the title's stores nothing, so they keep following it. Under
 * View as it is the viewed person's (admins read anyone's), and nothing is saved.
 */
export function useFirstArea() {
  const { user, viewingAs } = useUser()
  const titles = useJobTitles()
  const queryClient = useQueryClient()
  const key = ['first-area', user.id] as const

  const own = useQuery({
    queryKey: key,
    enabled: !__E2E_MOCK__,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('first_area_prefs')
        .select('area')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data?.area ?? null
    },
  })

  const fromTitle: Area = titles.data?.find((t) => t.id === user.job_title_id)?.firstArea ?? 'foh'
  const area: Area = own.data ?? fromTitle

  const save = useMutation({
    mutationFn: async (next: Area) => {
      const sb = requireSupabase()
      const { error } =
        next === fromTitle
          ? await sb.from('first_area_prefs').delete().eq('user_id', user.id)
          : await sb.from('first_area_prefs').upsert({ user_id: user.id, area: next })
      if (error) throw error
    },
    onMutate: (next) => {
      queryClient.setQueryData(key, next === fromTitle ? null : next)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  return {
    area,
    /** Changes it, shown at once and saved to the account; does nothing under View as. */
    choose: (next: Area) => {
      if (viewingAs || next === area) return
      save.mutate(next)
    },
    failed: save.isError,
  }
}
