import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../lib/supabase'
import type { RightKey } from '../screens/admin/useRights'
import { useUser } from './context'

/**
 * Whether the person has a right, for hiding a control or a column: their own
 * override, else their role's default, as can() reads it. The database still decides
 * what any write or read returns; this only keeps the screen from offering what it
 * would refuse. It answers for useUser(), so under View as it is the person viewed.
 * Undefined until it has loaded.
 */
export function useRight(key: RightKey): boolean | undefined {
  const { user } = useUser()
  const { data } = useQuery({
    queryKey: ['rights', 'mine', user.id, user.role],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('rights')
        .select('key, allowed, user_id')
        .or(`user_id.eq.${user.id},and(user_id.is.null,role.eq.${user.role})`)
      if (error) throw error
      const own = new Map(data.filter((r) => r.user_id).map((r) => [r.key, r.allowed]))
      const role = new Map(data.filter((r) => !r.user_id).map((r) => [r.key, r.allowed]))
      return { own, role }
    },
  })
  return data && (data.own.get(key) ?? data.role.get(key) ?? false)
}
