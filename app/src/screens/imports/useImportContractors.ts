import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '../../lib/database.types'
import { requireSupabase } from '../../lib/supabase'

/** The contractors in the directory, to find the rows already in OnTrack. Under 'contractors', so an import rereads it. */
export function useContractorNames() {
  return useQuery({
    queryKey: ['contractors', 'names'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('contractors')
        .select('id, name')
        .is('archived_at', null)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export type ImportResult = { import_id: string; added: number; updated: number; skipped: number; new_trades?: number }

/**
 * Import contractors in one checked, logged step (import_contractors, OT-149). A row the
 * database refuses stops it with "row N: why", which the review shows. Afterwards the
 * directory, the pickers and the trades reread.
 */
export function useImportContractors() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { rows: unknown[]; columns: string[]; newTrades: string[]; fileName: string }) => {
      const { data, error } = await requireSupabase().rpc('import_contractors', {
        p_rows: args.rows as Json,
        p_columns: args.columns,
        p_new_trades: args.newTrades,
        p_file_name: args.fileName,
      })
      if (error) throw error
      return data as unknown as ImportResult
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contractors'] }),
  })
}
