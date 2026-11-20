import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '../../lib/database.types'
import { requireSupabase } from '../../lib/supabase'
import type { ImportResult } from './useImportContractors'

/**
 * The units at the restaurants passed in, retired ones too (they are not duplicates), to
 * find the rows already in OnTrack. Under 'tickets', with the equipment lists, so an import
 * rereads it.
 */
export function useUnitsForImport(restaurantIds: string[]) {
  return useQuery({
    queryKey: ['tickets', 'equipment-for-import', restaurantIds],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('equipment')
        .select('id, name, serial, restaurant_id, retired_at')
        .in('restaurant_id', restaurantIds)
      if (error) throw error
      return data
    },
  })
}

/**
 * Import equipment in one checked, logged step (import_equipment, OT-149): one restaurant
 * for every row, or each row's own. A row the database refuses stops it with "row N: why".
 * Afterwards the equipment lists and the ticket form's pickers reread.
 */
export function useImportEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { restaurantId: string | null; rows: unknown[]; columns: string[]; fileName: string }) => {
      const { data, error } = await requireSupabase().rpc('import_equipment', {
        p_restaurant_id: args.restaurantId as string,
        p_rows: args.rows as Json,
        p_columns: args.columns,
        p_file_name: args.fileName,
      })
      if (error) throw error
      return data as unknown as ImportResult
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['equipment-edit'] }),
        queryClient.invalidateQueries({ queryKey: ['imports'] }),
      ]),
  })
}
