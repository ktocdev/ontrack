import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { MOCK_GROUP_LABEL } from './mock'

/** "4C | Four Corners", or the name alone when the group has no short name. */
export function groupLabel(group: { name: string; short_name: string | null }) {
  return group.short_name ? `${group.short_name} | ${group.name}` : group.name
}

export const GROUP_KEY = ['group']

/**
 * The restaurant group's settings. They are data, so another group's deployment needs
 * no code change, and they can be read before sign-in. Five minutes, so a change an
 * admin makes reaches everyone soon. Undefined until loaded; the app works without them.
 */
export function useGroup() {
  const { data } = useQuery({
    queryKey: GROUP_KEY,
    enabled: !__E2E_MOCK__ && Boolean(supabase),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase!.from('group_settings').select('name, short_name, profile_photos').single()
      if (error) throw error
      return data
    },
  })
  return data
}

/** The group's name as the boards show it; empty until it has loaded. */
export function useGroupLabel() {
  const group = useGroup()
  if (__E2E_MOCK__) return MOCK_GROUP_LABEL
  return group ? groupLabel(group) : ''
}

/**
 * Whether profile photos are on for the group. On until it is known otherwise: this
 * only decides what to show, and the database refuses them when off.
 */
export function useProfilePhotosOn() {
  return useGroup()?.profile_photos ?? true
}
