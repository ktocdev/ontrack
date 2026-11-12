/**
 * One contractor's page with no screen in it, so Vitest can check it: the visits at the
 * restaurants picked and what they add up to, the insurance line, and the month field
 * the form uses for the insurance date.
 */

/** One service record by this contractor, as the page lists it. */
export type Visit = {
  id: string
  service_date: string
  title: string
  restaurant_id: string
  ticket: { display_id: string | null } | null
  equipment: { name: string } | null
  restaurant: { name: string; color: string } | null
  totalCents: number
  /** The invoice's number once the file is attached; null while it is missing. */
  invoiceNumber: string | null
  invoiceMissing: boolean
}

export type VisitSummary = {
  /** The visits at the restaurants picked, newest first. */
  visits: Visit[]
  yearCents: number
  yearVisits: number
  lastVisit: string | null
  missing: number
}

/** The visits at the restaurants picked, this year's spend and count, the last visit and the invoices missing. */
export function summarizeVisits(all: Visit[], restaurantIds: string[], year: number): VisitSummary {
  const here = new Set(restaurantIds)
  const visits = all
    .filter((v) => here.has(v.restaurant_id))
    .sort((a, b) => b.service_date.localeCompare(a.service_date))
  const thisYear = visits.filter((v) => v.service_date.startsWith(`${year}-`))
  return {
    visits,
    yearCents: thisYear.reduce((s, v) => s + v.totalCents, 0),
    yearVisits: thisYear.length,
    lastVisit: visits[0]?.service_date ?? null,
    missing: visits.filter((v) => v.invoiceMissing).length,
  }
}

const day = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}
const monthName = (date: string) => day(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

/** "Through Jun 2027", or "Expired Sep 2026" once the date has passed. */
export function insuranceLine(until: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return day(until) < today ? `Expired ${monthName(until)}` : `Through ${monthName(until)}`
}

/** "2027-06" from a month field becomes the month's last day, "2027-06-30"; blank stays null. */
export function monthEnd(month: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate()
  return `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`
}

/** The month field's value for a stored date: "2027-06-30" is "2027-06". */
export function monthOf(date: string | null) {
  return date ? date.slice(0, 7) : ''
}

/** "Visits · 11" for the tab, and "1 missing" for the Invoices tab's badge. */
export function visitsLabel(n: number) {
  return `${n} visit${n === 1 ? '' : 's'}`
}
