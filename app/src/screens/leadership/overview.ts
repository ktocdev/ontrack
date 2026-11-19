/**
 * Leadership's Overview (Exec-Overview, OT-143), from v_overview_by_month and the open
 * counts: the month's figures for the restaurants in scope, and a row per restaurant.
 */

export type MonthRow = {
  restaurant_id: string
  month: string
  opened: number
  closed: number
  close_seconds: number
  spend_cents: number
  visits: number
  sees_costs: boolean
}

export type OpenRow = { restaurant_id: string; open_count: number; urgent_count: number }

export type Restaurant = { id: string; name: string; color: string }

export type OverviewRow = Restaurant & { spendCents: number; open: number; urgent: number }

export type Overview = {
  open: number
  urgent: number
  /** Null when the reader may see spend at none of these restaurants. */
  spendCents: number | null
  /** Null with nothing closed in the month. */
  closeSeconds: number | null
  /** Nothing opened, closed or spent in the month. */
  quiet: boolean
  rows: OverviewRow[]
}

export function overviewFor(months: MonthRow[], open: OpenRow[], restaurants: Restaurant[], month: string): Overview {
  const inMonth = months.filter((m) => m.month === month)
  const of = (id: string) => inMonth.find((m) => m.restaurant_id === id)
  const openOf = (id: string) => open.find((o) => o.restaurant_id === id)
  const seen = inMonth.filter((m) => m.sees_costs)
  const closed = inMonth.reduce((n, m) => n + m.closed, 0)
  const seesCosts = seen.length > 0 || months.some((m) => m.sees_costs)
  const rows = restaurants
    .map((r) => {
      const m = of(r.id)
      return {
        ...r,
        spendCents: m?.sees_costs ? m.spend_cents : 0,
        open: openOf(r.id)?.open_count ?? 0,
        urgent: openOf(r.id)?.urgent_count ?? 0,
      }
    })
    .sort((a, b) => b.spendCents - a.spendCents || b.open - a.open || a.name.localeCompare(b.name))
  return {
    open: rows.reduce((n, r) => n + r.open, 0),
    urgent: rows.reduce((n, r) => n + r.urgent, 0),
    spendCents: seesCosts ? seen.reduce((n, m) => n + m.spend_cents, 0) : null,
    closeSeconds: closed ? inMonth.reduce((n, m) => n + m.close_seconds, 0) / closed : null,
    quiet: inMonth.every((m) => m.opened === 0 && m.closed === 0 && m.visits === 0),
    rows,
  }
}

/** "2.6 days", "5 hours", "Under an hour"; "No data" with nothing closed. */
export function closeTime(seconds: number | null) {
  if (seconds === null) return 'No data'
  const hours = seconds / 3600
  if (hours < 1) return 'Under an hour'
  if (hours < 24) {
    const h = Math.round(hours)
    return `${h} ${h === 1 ? 'hour' : 'hours'}`
  }
  const days = Math.round((hours / 24) * 10) / 10
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** "2026-10-01" a number of months from another. */
export function addMonths(month: string, n: number) {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * The months the stepper reaches: from the earliest with anything recorded up to this one,
 * which is always there, even before anything happens in it.
 */
export function monthBounds(months: MonthRow[], current: string) {
  const earliest = months.reduce((min, m) => (m.month < min ? m.month : min), current)
  return { earliest, latest: current }
}
