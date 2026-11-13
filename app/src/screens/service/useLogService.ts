import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resizeToJpeg } from '../../lib/image'
import { requireSupabase } from '../../lib/supabase'
import { invoiceFileName } from './service'

/**
 * Log service & cost. A visit is logged from an Ops ticket (the ticket and its unit
 * filled in), from a unit (a ticket optional) or from a contractor (a restaurant first,
 * then a unit and a ticket, both optional). log_service decides what is allowed: log_cost
 * at the restaurant, the ticket's restaurant and unit when there is one, a unit at the
 * restaurant otherwise, no archived contractor and no invoice number the contractor
 * already has. The record is written first, since its invoice lives under its id
 * (invoices/<id>/), then the file goes up and attach_invoice names it; if the file fails
 * the visit still stands, under Missing, and the screen says so, as equipment files do.
 */

export type Origin =
  { from: 'ticket'; id: string } | { from: 'equipment'; id: string } | { from: 'contractor'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What the screen was opened on; null when it isn't there or out of reach. */
export function useLogServiceOrigin(origin: Origin) {
  return useQuery({
    queryKey: ['log-service', origin.from, origin.id],
    queryFn: async () => {
      if (!UUID.test(origin.id)) return null
      const sb = requireSupabase()
      if (origin.from === 'ticket') {
        const { data, error } = await sb
          .from('tickets')
          .select('id, display_id, title, restaurant_id, equipment (id, name)')
          .eq('id', origin.id)
          .maybeSingle()
        if (error) throw error
        return data && { from: 'ticket' as const, ticket: data }
      }
      if (origin.from === 'equipment') {
        const { data, error } = await sb
          .from('equipment')
          .select('id, name, restaurant_id, retired_at')
          .eq('id', origin.id)
          .maybeSingle()
        if (error) throw error
        return data && { from: 'equipment' as const, unit: data }
      }
      const { data, error } = await sb
        .from('contractors')
        .select('id, name, archived_at')
        .eq('id', origin.id)
        .maybeSingle()
      if (error) throw error
      return data && { from: 'contractor' as const, contractor: data }
    },
  })
}

export type LogServiceOrigin = NonNullable<ReturnType<typeof useLogServiceOrigin>['data']>

export type ContractorChoice = { id: string; name: string; preferred: boolean }

/** The picker: contractors not archived, preferred first, then by name. */
export function useContractorChoices() {
  return useQuery({
    queryKey: ['contractors', 'choices'],
    queryFn: async (): Promise<ContractorChoice[]> => {
      const { data, error } = await requireSupabase()
        .from('contractors')
        .select('id, name, preferred')
        .is('archived_at', null)
        .order('preferred', { ascending: false })
        .order('name')
      if (error) throw error
      return data
    },
  })
}

/** Units in service at a restaurant, for a visit logged from a contractor. */
export function useUnitChoices(restaurantId: string | null) {
  return useQuery({
    queryKey: ['tickets', 'log-service-units', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('equipment')
        .select('id, name')
        .eq('restaurant_id', restaurantId!)
        .is('retired_at', null)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export type TicketChoice = { id: string; display_id: string | null; title: string; status: string }

/**
 * Tickets a visit may be put on: a unit's, or a restaurant's when no unit is picked. Open
 * ones first, newest first, then closed ones, since the bill often comes after closing.
 */
export function useTicketChoices(restaurantId: string | null, unitId: string | null) {
  return useQuery({
    queryKey: ['tickets', 'log-service-tickets', restaurantId, unitId],
    enabled: !!restaurantId || !!unitId,
    queryFn: async () => {
      let q = requireSupabase()
        .from('tickets')
        .select('id, display_id, title, status')
        .order('created_at', { ascending: false })
        .limit(60)
      q = unitId ? q.eq('equipment_id', unitId) : q.eq('restaurant_id', restaurantId!)
      const { data, error } = await q
      if (error) throw error
      return {
        open: data.filter((t) => t.status !== 'closed') as TicketChoice[],
        closed: data.filter((t) => t.status === 'closed') as TicketChoice[],
      }
    },
  })
}

export type LogServiceValues = {
  kind: 'in_house' | 'contractor'
  ticketId: string | null
  restaurantId: string | null
  equipmentId: string | null
  contractorId: string | null
  technician: string
  date: string
  invoiceNumber: string
  notes: string
  laborCents: number
  partsCents: number
  tripCents: number
}

/** An invoice number the contractor already has, and where. */
export type DuplicateInvoice = { number: string; ticket: string | null; unit: string | null; date: string | null }

export class DuplicateInvoiceError extends Error {
  readonly code = '23505'
  readonly duplicate: DuplicateInvoice
  constructor(duplicate: DuplicateInvoice) {
    super('duplicate invoice number')
    this.duplicate = duplicate
  }
}

const blank = (v: string) => v.trim() || undefined

/**
 * A save the database refused because the contractor already has this invoice number:
 * its detail names the visit that has it, so look that up (with see_costs there) to say
 * where. Any other error is passed through as it came.
 */
export async function asDuplicate(error: { code?: string; details?: string | null }, number: string) {
  if (error.code !== '23505') return error
  const other = error.details
    ? await requireSupabase()
        .from('service_records')
        .select('service_date, ticket:tickets (display_id), equipment (name)')
        .eq('id', error.details)
        .maybeSingle()
    : null
  return new DuplicateInvoiceError({
    number: number.trim(),
    ticket: other?.data?.ticket?.display_id ?? null,
    unit: other?.data?.equipment?.name ?? null,
    date: other?.data?.service_date ?? null,
  })
}

/**
 * Uploads an invoice to its record's folder and names it on the record (attach_invoice
 * checks it is there). A photo is shrunk to 2000 px, which keeps a paper invoice
 * readable. Each upload gets a folder of its own under the record's, so a replacement
 * with the same name (a phone calls every photo image.jpg) sits beside the old file and
 * never on top of it: Storage lets an invoice be added, not changed or removed (OT-97).
 */
export async function attachInvoice(id: string, file: File) {
  const sb = requireSupabase()
  const image = file.type.startsWith('image/')
  const blob = image ? await resizeToJpeg(file, 2000) : file
  const name = image ? `${invoiceFileName(file.name).replace(/\.[^.]*$/, '')}.jpg` : invoiceFileName(file.name)
  const path = `${id}/${crypto.randomUUID()}/${name}`
  const up = await sb.storage.from('invoices').upload(path, blob, { contentType: blob.type })
  if (up.error) throw up.error
  const attached = await sb.rpc('attach_invoice', { p_id: id, p_path: path })
  if (attached.error) throw attached.error
}

export function useLogService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ values: v, file }: { values: LogServiceValues; file: File | null }) => {
      const sb = requireSupabase()
      const logged = await sb.rpc('log_service', {
        p_kind: v.kind,
        p_service_date: v.date,
        p_ticket_id: v.ticketId ?? undefined,
        p_restaurant_id: v.restaurantId ?? undefined,
        p_equipment_id: v.equipmentId ?? undefined,
        p_contractor_id: v.kind === 'contractor' ? (v.contractorId ?? undefined) : undefined,
        p_technician: blank(v.technician),
        p_invoice_number: v.kind === 'contractor' ? blank(v.invoiceNumber) : undefined,
        p_notes: blank(v.notes),
        p_labor_cents: v.laborCents,
        p_parts_cents: v.partsCents,
        p_trip_cents: v.tripCents,
      })
      if (logged.error) throw await asDuplicate(logged.error, v.invoiceNumber)
      const id = logged.data

      let fileFailed = false
      if (file) {
        try {
          await attachInvoice(id, file)
        } catch {
          fileFailed = true
        }
      }
      return { id, fileFailed }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops-ticket'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['equipment-service'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-closed'] }),
        // The contractor's page and the directory's spend.
        queryClient.invalidateQueries({ queryKey: ['contractors'] }),
      ]),
  })
}

/** "+ Add new contractor" from the picker: saved through save_contractor, then picked. */
export function useAddContractor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: { name: string; tradeIds: string[]; phone: string }) => {
      const { data, error } = await requireSupabase().rpc('save_contractor', {
        // A new contractor has no id yet; the generated type can't say the argument takes null.
        p_id: null as unknown as string,
        p_name: c.name.trim(),
        p_trade_ids: c.tradeIds,
        p_phone: blank(c.phone),
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contractors'] }),
  })
}

/** A ticket's Service & cost: each visit with its total, newest first. Only with see_costs. */
export function useTicketService(ticketId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ops-ticket', ticketId, 'service'],
    enabled,
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('service_records')
        .select('id, title, kind, service_date, contractor:contractors (name)')
        .eq('ticket_id', ticketId)
        .order('service_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const totals = data.length
        ? await sb
            .from('v_service_record_totals')
            .select('service_record_id, total_cents')
            .in(
              'service_record_id',
              data.map((r) => r.id),
            )
        : { data: [], error: null }
      if (totals.error) throw totals.error
      const totalOf = new Map((totals.data ?? []).map((t) => [t.service_record_id, t.total_cents]))
      const records = data.map((r) => ({ ...r, totalCents: totalOf.get(r.id) ?? 0 }))
      return { records, totalCents: records.reduce((sum, r) => sum + r.totalCents, 0) }
    },
  })
}
