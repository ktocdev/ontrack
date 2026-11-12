import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { Visit } from './contractor'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One contractor, archived or not, with their trades in the list's order and whether
 * any visit names them (the Delete button). With see_costs, every visit RLS lets through
 * (see_costs at its restaurant), each with its total and invoice; the screen keeps the
 * restaurants the picker shows. A contractor out of reach, or an id that isn't one, is
 * none. The key sits under 'contractors', which saving one and logging service reread.
 */
export function useContractor(id: string, seeCosts: boolean) {
  return useQuery({
    queryKey: ['contractors', 'one', id, seeCosts],
    queryFn: async () => {
      if (!UUID.test(id)) return null
      const sb = requireSupabase()
      const [contractor, history, records] = await Promise.all([
        sb
          .from('contractors')
          .select(
            'id, name, contact_name, phone, email, preferred, insurance_until, notes, archived_at, trades (id, name, active, sort_order)',
          )
          .eq('id', id)
          .maybeSingle(),
        sb.from('v_contractor_history').select('in_use').eq('contractor_id', id).maybeSingle(),
        seeCosts
          ? sb
              .from('service_records')
              .select(
                'id, service_date, title, restaurant_id, ticket:tickets (display_id), equipment (name), restaurant:restaurants (name, color)',
              )
              .eq('contractor_id', id)
              .order('service_date', { ascending: false })
          : { data: [], error: null },
      ])
      for (const r of [contractor, history, records]) if (r.error) throw r.error
      if (!contractor.data) return null

      const ids = (records.data ?? []).map((r) => r.id)
      const [totals, missing, invoices] = ids.length
        ? await Promise.all([
            sb.from('v_service_record_totals').select('service_record_id, total_cents').in('service_record_id', ids),
            sb.from('v_missing_invoices').select('service_record_id').in('service_record_id', ids),
            sb.from('invoices').select('service_record_id, number').in('service_record_id', ids),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ]
      for (const r of [totals, missing, invoices]) if (r.error) throw r.error
      const totalOf = new Map((totals.data ?? []).map((t) => [t.service_record_id, t.total_cents ?? 0]))
      const missingIds = new Set((missing.data ?? []).map((m) => m.service_record_id))
      const numberOf = new Map((invoices.data ?? []).map((i) => [i.service_record_id, i.number]))

      const { trades, ...c } = contractor.data
      return {
        contractor: {
          ...c,
          trades: [...trades].sort((a, b) => a.sort_order - b.sort_order),
        },
        // Unknown counts as used, so Delete stays off rather than failing.
        inUse: history.data?.in_use ?? true,
        visits: (records.data ?? []).map((r): Visit => ({
          ...r,
          totalCents: totalOf.get(r.id) ?? 0,
          invoiceMissing: missingIds.has(r.id),
          invoiceNumber: missingIds.has(r.id) ? null : (numberOf.get(r.id) ?? null),
        })),
      }
    },
  })
}

export type ContractorData = NonNullable<ReturnType<typeof useContractor>['data']>
export type ContractorRow = ContractorData['contractor']

export type ContractorValues = {
  name: string
  tradeIds: string[]
  contactName: string
  phone: string
  email: string
  preferred: boolean
  /** The insurance date, the last day of the month picked; null for none. */
  insuranceUntil: string | null
  notes: string
}

const blank = (s: string) => (s.trim() ? s.trim() : undefined)

/** Add (no id) or Edit (an id), through save_contractor. Returns the id. */
export function useSaveContractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values: v }: { id: string | null; values: ContractorValues }) => {
      const { data, error } = await requireSupabase().rpc('save_contractor', {
        // A new contractor has no id yet; the generated type can't say the argument takes null.
        p_id: id as string,
        p_name: v.name.trim(),
        p_trade_ids: v.tradeIds,
        p_contact_name: blank(v.contactName),
        p_phone: blank(v.phone),
        p_email: blank(v.email),
        p_preferred: v.preferred,
        p_insurance_until: v.insuranceUntil ?? undefined,
        p_notes: blank(v.notes),
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contractors'] }),
  })
}

export function useSetContractorArchived() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await requireSupabase().rpc('set_contractor_archived', { p_id: id, p_archived: archived })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contractors'] }),
  })
}

export function useDeleteContractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_contractor', { p_id: id })
      if (error) throw error
    },
    // Not invalidated: the page it was on is gone, and rereading it would flash Not found.
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['contractors', 'one', id] })
      return queryClient.invalidateQueries({ queryKey: ['contractors', 'directory'] })
    },
  })
}
