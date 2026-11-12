/**
 * The Invoices tab with no screen in it, so Vitest can check it: the months on offer,
 * and the rows for a month, the restaurants picked, the Missing filter and a search,
 * in one of three orders, with their count and total.
 */
import type { Visit } from './contractor'

/** A contractor's visit, as the Invoices tab lists it. */
export type InvoiceRow = Visit & { contractor: { name: string } | null }

export type InvoiceSort = 'new' | 'old' | 'amount'
export const SORT_LABEL: Record<InvoiceSort, string> = { new: 'Newest', old: 'Oldest', amount: 'Amount' }
export const NEXT_SORT: Record<InvoiceSort, InvoiceSort> = { new: 'old', old: 'amount', amount: 'new' }

/** "2026-10" for a date or a Date. */
export const monthKey = (d: string | Date) =>
  typeof d === 'string' ? d.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** "October 2026"; null is every month. */
export function monthLabel(month: string | null) {
  if (!month) return 'All months'
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** The months with visits at the restaurants picked, and this month, newest first. */
export function monthsOf(rows: InvoiceRow[], restaurantIds: string[], now = new Date()) {
  const here = new Set(restaurantIds)
  const months = new Set(rows.filter((r) => here.has(r.restaurant_id)).map((r) => monthKey(r.service_date)))
  months.add(monthKey(now))
  return [...months].sort().reverse()
}

/** The month the tab opens on: this one if it has visits, else the newest that does. */
export function startMonth(rows: InvoiceRow[], restaurantIds: string[], now = new Date()) {
  const here = new Set(restaurantIds)
  const withVisits = rows.filter((r) => here.has(r.restaurant_id)).map((r) => monthKey(r.service_date))
  const current = monthKey(now)
  if (withVisits.includes(current) || withVisits.length === 0) return current
  return withVisits.sort().reverse()[0]!
}

/** Contractor, equipment, restaurant, ticket or invoice number, ignoring case; "1042" finds OT-1042. */
export function matchesInvoice(r: InvoiceRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [r.contractor?.name, r.equipment?.name, r.restaurant?.name, r.ticket?.display_id, r.invoiceNumber].some((v) =>
    v?.toLowerCase().includes(q),
  )
}

export type InvoiceView = {
  rows: InvoiceRow[]
  totalCents: number
  /** Missing in the month and restaurants shown, whatever the search, as the chip counts them. */
  missing: number
}

export function invoiceView(
  all: InvoiceRow[],
  {
    restaurantIds,
    month,
    missingOnly,
    query,
    sort,
  }: { restaurantIds: string[]; month: string | null; missingOnly: boolean; query: string; sort: InvoiceSort },
): InvoiceView {
  const here = new Set(restaurantIds)
  const inMonth = all.filter((r) => here.has(r.restaurant_id) && (!month || monthKey(r.service_date) === month))
  const rows = inMonth
    .filter((r) => (!missingOnly || r.invoiceMissing) && matchesInvoice(r, query))
    .sort((a, b) =>
      sort === 'amount'
        ? b.totalCents - a.totalCents || b.service_date.localeCompare(a.service_date)
        : sort === 'old'
          ? a.service_date.localeCompare(b.service_date)
          : b.service_date.localeCompare(a.service_date),
    )
  return {
    rows,
    totalCents: rows.reduce((s, r) => s + r.totalCents, 0),
    missing: inMonth.filter((r) => r.invoiceMissing).length,
  }
}

/** "8 invoices", or "2 invoices match" while a search or Missing narrows them. */
export function countLabel(n: number, narrowed: boolean) {
  return `${n} invoice${n === 1 ? '' : 's'}${narrowed ? (n === 1 ? ' matches' : ' match') : ''}`
}
