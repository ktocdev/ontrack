import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import { asDuplicate, attachInvoice, type LogServiceValues } from './useLogService'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One service record: what was done, its amounts, its invoice and who logged it. RLS
 * decides what comes back, which takes see_costs at the record's restaurant; a record
 * out of reach is no record. The invoice's View and Download links are signed here, an
 * hour at a time, so tapping them opens the file at once (a phone blocks a new tab
 * opened after waiting on the network). The key sits under 'tickets' so LiveTickets
 * rereads it as tickets change.
 */
export function useServiceRecord(id: string) {
  return useQuery({
    queryKey: ['tickets', 'service-record', id],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      if (!UUID.test(id)) return null
      const sb = requireSupabase()
      const [record, items, invoice] = await Promise.all([
        sb
          .from('service_records')
          .select(
            'id, title, notes, kind, service_date, technician, created_at, restaurant_id, ticket_id, equipment_id, contractor_id, ticket:tickets (id, display_id, title), equipment (id, name, retired_at), contractor:contractors (id, name, archived_at), restaurant:restaurants (name, color), logger:profiles!service_records_logged_by_fkey (full_name)',
          )
          .eq('id', id)
          .maybeSingle(),
        sb
          .from('service_line_items')
          .select('id, kind, description, amount_cents')
          .eq('service_record_id', id)
          .order('sort_order'),
        sb
          .from('invoices')
          .select('number, status, path, attached_at, attacher:profiles!invoices_attached_by_fkey (full_name)')
          .eq('service_record_id', id)
          .maybeSingle(),
      ])
      for (const r of [record, items, invoice]) if (r.error) throw r.error
      if (!record.data) return null

      const path = invoice.data?.status === 'attached' ? invoice.data.path : null
      const name = path?.split('/').pop() ?? null
      const [view, download, listing] = path
        ? await Promise.all([
            sb.storage.from('invoices').createSignedUrl(path, 3600),
            sb.storage.from('invoices').createSignedUrl(path, 3600, { download: name ?? true }),
            sb.storage.from('invoices').list(id, { search: name ?? undefined }),
          ])
        : [null, null, null]
      const size = listing?.data?.find((f) => f.name === name)?.metadata?.size as number | undefined

      const lines = items.data ?? []
      const sum = (kind: string) => lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount_cents, 0)
      return {
        record: record.data,
        lines,
        amounts: { labor: sum('labor'), parts: sum('parts'), trip: sum('trip') },
        totalCents: lines.reduce((s, l) => s + l.amount_cents, 0),
        invoice: invoice.data
          ? {
              number: invoice.data.number,
              attached: !!path,
              name,
              size: size ?? null,
              attachedBy: invoice.data.attacher?.full_name ?? null,
              attachedAt: invoice.data.attached_at,
              viewUrl: view?.data?.signedUrl ?? null,
              downloadUrl: download?.data?.signedUrl ?? null,
            }
          : null,
      }
    },
  })
}

export type ServiceRecordData = NonNullable<ReturnType<typeof useServiceRecord>['data']>

function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['ops-ticket'] }),
      queryClient.invalidateQueries({ queryKey: ['equipment-service'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket-closed'] }),
      queryClient.invalidateQueries({ queryKey: ['contractors'] }),
    ])
}

/** Attach or replace the invoice file; the old file stays in storage, and the log keeps its name. */
export function useReplaceInvoice(id: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (file: File) => attachInvoice(id, file),
    onSuccess: refresh,
  })
}

/** Edit service record: every field as the form holds it, through update_service_record. */
export function useUpdateServiceRecord(id: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (v: LogServiceValues & { title: string }) => {
      const { error } = await requireSupabase().rpc('update_service_record', {
        p_id: id,
        p_kind: v.kind,
        p_service_date: v.date,
        p_ticket_id: v.ticketId ?? undefined,
        p_restaurant_id: v.restaurantId ?? undefined,
        p_equipment_id: v.equipmentId ?? undefined,
        p_contractor_id: v.kind === 'contractor' ? (v.contractorId ?? undefined) : undefined,
        p_technician: v.technician.trim() || undefined,
        p_title: v.title.trim() || undefined,
        p_notes: v.notes.trim() || undefined,
        p_invoice_number: v.kind === 'contractor' ? v.invoiceNumber.trim() || undefined : undefined,
        p_labor_cents: v.laborCents,
        p_parts_cents: v.partsCents,
        p_trip_cents: v.tripCents,
      })
      if (error) throw await asDuplicate(error, v.invoiceNumber)
    },
    onSuccess: refresh,
  })
}
