/**
 * The contractor directory with no screen in it, so Vitest can check it: each
 * contractor's spend and visits for the restaurants picked, the insurance warning,
 * search, the trade chips and the two sorts.
 */

export type Contractor = {
  id: string
  name: string
  /** One or more, in the trade list's order (OT-99). */
  trades: string[]
  contact_name: string | null
  phone: string | null
  preferred: boolean
  insurance_until: string | null
  archived_at?: string | null
}

/** One row of v_contractor_spend: a contractor at a restaurant in a year. */
export type SpendRow = {
  contractor_id: string | null
  restaurant_id: string | null
  year: number | null
  total_cents: number | null
  visits: number | null
  last_visit_on: string | null
}

export type DirectoryRow = Contractor & {
  yearCents: number
  yearVisits: number
  lastVisit: string | null
  insurance: string | null
}

export type Sort = 'used' | 'spend'

/** "Insurance expires Nov 1", 30 days out or less, or "Insurance expired Sep 30"; else null. */
export function insuranceWarning(until: string | null, now = new Date()): string | null {
  if (!until) return null
  const [y, m, d] = until.split('-').map(Number) as [number, number, number]
  const end = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((end.getTime() - today.getTime()) / 86_400_000)
  if (days > 30) return null
  const when = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: y === now.getFullYear() ? undefined : 'numeric',
  })
  return days < 0 ? `Insurance expired ${when}` : `Insurance expires ${when}`
}

/** Adds this year's spend and visits, and the last visit ever, at the restaurants picked. */
export function summarize(
  contractors: Contractor[],
  spend: SpendRow[],
  restaurantIds: string[],
  year: number,
  now = new Date(),
): DirectoryRow[] {
  const here = new Set(restaurantIds)
  const by = new Map<string, { yearCents: number; yearVisits: number; lastVisit: string | null }>()
  for (const s of spend) {
    if (!s.contractor_id || !s.restaurant_id || !here.has(s.restaurant_id)) continue
    const t = by.get(s.contractor_id) ?? { yearCents: 0, yearVisits: 0, lastVisit: null }
    if (s.year === year) {
      t.yearCents += s.total_cents ?? 0
      t.yearVisits += s.visits ?? 0
    }
    if (s.last_visit_on && (!t.lastVisit || s.last_visit_on > t.lastVisit)) t.lastVisit = s.last_visit_on
    by.set(s.contractor_id, t)
  }
  return contractors.map((c) => ({
    ...c,
    ...(by.get(c.id) ?? { yearCents: 0, yearVisits: 0, lastVisit: null }),
    insurance: insuranceWarning(c.insurance_until, now),
  }))
}

/** Company, contact or any of their trades, ignoring case. */
export function matchesSearch(c: Contractor, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [c.name, c.contact_name, ...c.trades].some((v) => v?.toLowerCase().includes(q))
}

/**
 * Most used first: this year's visits, then the last visit, then preferred, then the name.
 * By spend: this year's spend, then the same.
 */
export function sortRows(rows: DirectoryRow[], sort: Sort) {
  return [...rows].sort(
    (a, b) =>
      (sort === 'spend' ? b.yearCents - a.yearCents : 0) ||
      b.yearVisits - a.yearVisits ||
      (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') ||
      Number(b.preferred) - Number(a.preferred) ||
      a.name.localeCompare(b.name),
  )
}

/**
 * The trades in the directory, most contractors first, as the chips after All. A
 * contractor with several trades counts toward each.
 */
export function tradeChips(contractors: Contractor[]) {
  const count = new Map<string, number>()
  for (const c of contractors) for (const t of c.trades) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
}

/** "$4,812": the board's whole dollars for spend in a list. */
export function wholeDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** "3 refrigeration contractors", for a trade chip that is on; HVAC stays HVAC. */
export function tradeCount(n: number, trade: string) {
  const word = trade === trade.toUpperCase() ? trade : trade.toLowerCase()
  return `${n} ${word} contractor${n === 1 ? '' : 's'}`
}
