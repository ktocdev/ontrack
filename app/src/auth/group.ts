import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MOCK_GROUP_LABEL } from './mock'

/** "4C | Four Corners", or the name alone when the group has no short name. */
export function groupLabel(group: { name: string; short_name: string | null }) {
  return group.short_name ? `${group.short_name} | ${group.name}` : group.name
}

/**
 * The restaurant group's name as the boards show it. It is data, so another
 * group's deployment needs no code change, and it can be read before sign-in.
 * Empty until it has loaded; the app works without it if it fails.
 */
export function useGroupLabel() {
  const { data } = useQuery({
    queryKey: ['group'],
    enabled: !__E2E_MOCK__ && Boolean(supabase),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase!.from('group_settings').select('name, short_name').single()
      if (error) throw error
      return groupLabel(data)
    },
  })
  return __E2E_MOCK__ ? MOCK_GROUP_LABEL : (data ?? '')
}
