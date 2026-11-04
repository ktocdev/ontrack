import { useQuery } from '@tanstack/react-query'
import { ticketNumber } from '../../lib/share'
import { requireSupabase } from '../../lib/supabase'

/**
 * Ticket link: turns a typed number (/t/OT-1042) into the ticket's id. RLS decides, so a
 * ticket outside the person's scope finds nothing, and the link falls through to the same
 * not-found screen as any other. An older link already carries the id and needs no read.
 */
export function useTicketLink(param: string, enabled: boolean) {
  const number = ticketNumber(param)
  const lookup = useQuery({
    queryKey: ['ticket', 'link', number],
    enabled: enabled && number !== null,
    throwOnError: true,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('tickets').select('id').eq('number', number!).maybeSingle()
      if (error) throw error
      return data?.id ?? null
    },
  })
  if (number === null) return { id: param, loading: false }
  return { id: lookup.data ?? param, loading: lookup.isLoading }
}
