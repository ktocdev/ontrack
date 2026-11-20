import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { requireSupabase } from '../../lib/supabase'

export type ImportKind = 'contractors' | 'equipment'

/** The lists an import or its undo changes: the directory and pickers, or the equipment lists. */
export const IMPORT_LISTS: Record<ImportKind, string> = { contractors: 'contractors', equipment: 'tickets' }

/**
 * The person's latest import of this kind that can still be undone: theirs, not undone, and
 * less than 24 hours old (OT-153). The database decides again when they tap Undo. Under
 * 'imports', which an import and an undo reread.
 */
export function useUndoableImport(kind: ImportKind) {
  const { user, viewingAs } = useUser()
  return useQuery({
    queryKey: ['imports', kind, user.id],
    enabled: !viewingAs,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await requireSupabase()
        .from('imports')
        .select('id, file_name, added, updated, skipped, created_at')
        .eq('kind', kind)
        .eq('created_by', user.id)
        .is('undone_at', null)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return data[0] ?? null
    },
  })
}

export type UndoPreview = { remove: number; keep: string[]; restore: number; until: string }

/** What undo would take back and keep, for the confirm step (undo_import_preview). */
export function useUndoPreview(id: string | null) {
  return useQuery({
    queryKey: ['imports', 'preview', id],
    enabled: !!id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('undo_import_preview', { p_id: id! })
      if (error) throw error
      return data as unknown as UndoPreview
    },
  })
}

export type UndoResult = { removed: number; restored: number; kept: string[] }

/** Undo in one logged step (undo_import); the lists it touched reread. */
export function useUndoImport(kind: ImportKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await requireSupabase().rpc('undo_import', { p_id: id })
      if (error) throw error
      return data as unknown as UndoResult
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['imports'] }),
        queryClient.invalidateQueries({ queryKey: [IMPORT_LISTS[kind]] }),
        kind === 'equipment' && queryClient.invalidateQueries({ queryKey: ['equipment-edit'] }),
      ]),
  })
}
