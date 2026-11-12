import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { requireSupabase } from '../../lib/supabase'

export type Trade = { id: string; name: string; active: boolean }

export type ManagedTrade = Trade & {
  /** A contractor has it, so it can be turned off but not deleted. */
  inUse: boolean
}

/**
 * Whether this person looks after trades: Ops with Log cost, and admins, the same people
 * who change contractors, as can_edit_contractors() decides in the database (OT-99).
 * Under View as, nobody here does.
 */
export function useCanEditTrades() {
  const { user, viewingAs } = useUser()
  const logsCost = useRight('log_cost')
  return !viewingAs && (user.role === 'admin' || (user.role === 'ops' && logsCost === true))
}

/** The group's trades, on and off, in the list's order. The pickers offer the ones on. */
export function useTrades() {
  return useQuery({
    queryKey: ['contractors', 'trades'],
    queryFn: async (): Promise<Trade[]> => {
      const { data, error } = await requireSupabase().from('trades').select('id, name, active').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

/** Every trade with whether a contractor has it, for the Trades screen. */
export function useManagedTrades() {
  return useQuery({
    queryKey: ['contractors', 'trades', 'managed'],
    queryFn: async (): Promise<ManagedTrade[]> => {
      const sb = requireSupabase()
      const [trades, history] = await Promise.all([
        sb.from('trades').select('id, name, active').order('sort_order'),
        sb.from('v_trade_history').select('trade_id, in_use'),
      ])
      if (trades.error) throw trades.error
      if (history.error) throw history.error
      const used = new Map(history.data.map((h) => [h.trade_id, h.in_use === true]))
      return trades.data.map((t) => ({ ...t, inUse: used.get(t.id) ?? true }))
    },
  })
}

/** After any change: the pickers, the directory and its chips reread. All sit under 'contractors'. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['contractors'] })
}

export function useAddTrade() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await requireSupabase().rpc('add_trade', { p_name: name.trim() })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useRenameTrade() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await requireSupabase().rpc('rename_trade', { p_id: id, p_name: name.trim() })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSetTradeActive() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await requireSupabase().rpc('set_trade_active', { p_id: id, p_active: active })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useDeleteTrade() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_trade', { p_id: id })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

/** "That trade already exists" from the database's 23505, else a general retry. */
export function tradeError(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505'
    ? 'There is already a trade with that name.'
    : 'That didn’t go through. Check your connection and try again.'
}
