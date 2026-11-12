import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { InvoiceRow } from './invoices'
import { visitAmounts } from './useContractor'

/**
 * Every contractor visit RLS lets through (see_costs at its restaurant), with the
 * contractor, restaurant, unit and ticket, its total and its invoice; the screen picks
 * the month, the restaurants and the rest. In-house work is not an invoice, as
 * v_invoices_by_month counts them. The key sits under 'contractors', which logging and
 * editing service reread.
 */
export function useInvoices(enabled: boolean) {
  return useQuery({
    queryKey: ['contractors', 'invoices'],
    enabled,
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data, error } = await requireSupabase()
        .from('service_records')
        .select(
          'id, service_date, title, restaurant_id, ticket:tickets (display_id), equipment (name), restaurant:restaurants (name, color), contractor:contractors (name)',
        )
        .eq('kind', 'contractor')
        .order('service_date', { ascending: false })
      if (error) throw error
      const { totalOf, missingIds, numberOf } = await visitAmounts(null)
      return data.map((r) => ({
        ...r,
        totalCents: totalOf.get(r.id) ?? 0,
        invoiceMissing: missingIds.has(r.id),
        invoiceNumber: missingIds.has(r.id) ? null : (numberOf.get(r.id) ?? null),
      }))
    },
  })
}
