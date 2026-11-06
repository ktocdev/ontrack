import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Equipment details, both roles: the unit, and every ticket on it with what the closed
 * ones cost. RLS decides what comes back: a unit outside the person's scope is no unit,
 * and without see_costs there are no costs. A retired unit still opens, from a ticket or
 * a link. The key sits under 'tickets' so LiveTickets rereads it as tickets change. A
 * malformed id is no unit, as a ticket's is.
 */
export function useEquipmentDetail(id: string) {
  return useQuery({
    queryKey: ['tickets', 'equipment', id],
    queryFn: async () => {
      if (!UUID.test(id)) return null
      const sb = requireSupabase()
      const [unit, tickets] = await Promise.all([
        sb
          .from('equipment')
          .select(
            'id, name, brand, model, serial, location_note, installed_on, warranty_note, warranty_until, manual_path, plate_photo_path, retired_at, restaurant_id, category_id, restaurant:restaurants (name, color), category:categories (name, area)',
          )
          .eq('id', id)
          .maybeSingle(),
        sb
          .from('tickets')
          .select(
            'id, display_id, title, status, urgency, source, created_at, updated_at, reopened_at, scheduled_for, closed_at, assignee_id, category:categories (name, area), assignee:profiles!tickets_assignee_id_fkey (full_name)',
          )
          .eq('equipment_id', id),
      ])
      if (unit.error) throw unit.error
      if (tickets.error) throw tickets.error
      if (!unit.data) return null

      const closedIds = tickets.data.filter((t) => t.status === 'closed').map((t) => t.id)
      const [costs, manual, plate] = await Promise.all([
        closedIds.length
          ? sb.from('v_ticket_costs').select('ticket_id, total_cents').in('ticket_id', closedIds)
          : { data: [], error: null },
        unit.data.manual_path
          ? sb.storage.from('manuals').createSignedUrl(unit.data.manual_path, 3600)
          : { data: null, error: null },
        unit.data.plate_photo_path
          ? sb.storage.from('equipment-photos').createSignedUrl(unit.data.plate_photo_path, 3600)
          : { data: null, error: null },
      ])
      if (costs.error) throw costs.error
      const costOf = new Map((costs.data ?? []).map((c) => [c.ticket_id, c.total_cents]))
      return {
        unit: unit.data,
        // A manual that won't sign still shows its name, as text.
        manualUrl: manual.data?.signedUrl ?? null,
        plateUrl: plate.data?.signedUrl ?? null,
        tickets: tickets.data.map((t) => ({ ...t, totalCents: costOf.get(t.id) ?? null })),
      }
    },
  })
}

/**
 * Service & cost: lifetime and this year's spend, the contractors on the unit, and the
 * service log, newest first. Only asked for with see_costs; without it RLS returns none.
 * Contractors are readable with see_costs, so their names come too. Each contractor's
 * amount is this year's on the unit, as the board's is; one who worked on it only in
 * earlier years has none.
 */
export function useEquipmentService(id: string, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ['equipment-service', id, year],
    enabled,
    queryFn: async () => {
      const sb = requireSupabase()
      const [lifetime, spend, contractors, records] = await Promise.all([
        sb.from('v_equipment_lifetime').select('total_cents, visits').eq('equipment_id', id).maybeSingle(),
        sb
          .from('v_equipment_spend')
          .select('total_cents, visits')
          .eq('equipment_id', id)
          .eq('year', year)
          .maybeSingle(),
        sb.from('v_equipment_contractors').select('contractor_id, total_cents').eq('equipment_id', id),
        sb
          .from('service_records')
          .select(
            'id, service_date, title, kind, contractor_id, ticket:tickets (display_id), contractor:contractors (name)',
          )
          .eq('equipment_id', id)
          .order('service_date', { ascending: false }),
      ])
      for (const r of [lifetime, spend, contractors, records]) if (r.error) throw r.error
      const recordIds = (records.data ?? []).map((r) => r.id)
      const contractorIds = (contractors.data ?? []).flatMap((c) => (c.contractor_id ? [c.contractor_id] : []))
      const [totals, missing, people] = await Promise.all([
        recordIds.length
          ? sb
              .from('v_service_record_totals')
              .select('service_record_id, total_cents')
              .in('service_record_id', recordIds)
          : { data: [], error: null },
        recordIds.length
          ? sb.from('v_missing_invoices').select('service_record_id').in('service_record_id', recordIds)
          : { data: [], error: null },
        contractorIds.length
          ? sb.from('contractors').select('id, name, phone').in('id', contractorIds)
          : { data: [], error: null },
      ])
      for (const r of [totals, missing, people]) if (r.error) throw r.error
      const totalOf = new Map((totals.data ?? []).map((t) => [t.service_record_id, t.total_cents]))
      const missingIds = new Set((missing.data ?? []).map((m) => m.service_record_id))
      const personOf = new Map((people.data ?? []).map((p) => [p.id, p]))
      const thisYear = new Map<string, number>()
      for (const r of records.data ?? [])
        if (r.contractor_id && r.service_date.startsWith(`${year}-`))
          thisYear.set(r.contractor_id, (thisYear.get(r.contractor_id) ?? 0) + (totalOf.get(r.id) ?? 0))
      return {
        lifetimeCents: lifetime.data?.total_cents ?? 0,
        yearCents: spend.data?.total_cents ?? 0,
        yearVisits: spend.data?.visits ?? 0,
        contractors: (contractors.data ?? [])
          .flatMap((c) => {
            const p = c.contractor_id ? personOf.get(c.contractor_id) : undefined
            return p ? [{ id: p.id, name: p.name, phone: p.phone, yearCents: thisYear.get(p.id) ?? null }] : []
          })
          .sort((a, b) => (b.yearCents ?? -1) - (a.yearCents ?? -1)),
        records: (records.data ?? []).map((r) => ({
          ...r,
          totalCents: totalOf.get(r.id) ?? 0,
          invoiceMissing: missingIds.has(r.id),
        })),
      }
    },
  })
}
