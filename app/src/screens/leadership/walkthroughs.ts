import { lastSixMonths, type SummaryRow } from '../ops/walkthroughOverview'

/**
 * Leadership · Walkthroughs' working-out (WT-Exec, OT-147), from the same summary rows as
 * the Ops overview (v_walkthrough_summary). A month is on time or not once it is finished:
 * submitted (on time or late) or missed. A month still open counts toward neither.
 */

type Restaurant = { id: string; name: string; color: string }

const submitted = (r: SummaryRow) => r.standing === 'on_time' || r.standing === 'late'
const finished = (r: SummaryRow) => submitted(r) || r.standing === 'missed'
const share = (r: SummaryRow) => (r.total > 0 ? Math.min(r.done / r.total, 1) : 0)

/** A restaurant's (or the group's) record over the six months ending with this one. */
export function record(rows: SummaryRow[], month: string) {
  const months = new Set(lastSixMonths(month))
  const inWindow = rows.filter((r) => months.has(r.period.slice(0, 10)) && finished(r))
  return {
    onTime: inWindow.filter((r) => r.standing === 'on_time').length,
    finished: inWindow.length,
    missed: inWindow.filter((r) => r.standing === 'missed').length,
  }
}

/** "62%", or "—" before any month has finished. */
export function onTimeShare(rows: SummaryRow[], month: string) {
  const r = record(rows, month)
  return r.finished > 0 ? `${Math.round((r.onTime / r.finished) * 100)}%` : '—'
}

/** How far along a walkthrough is, as the board's pill: "40%". */
export const percentDone = (r: SummaryRow) => `${Math.round(share(r) * 100)}%`

/**
 * The month's rows, one per restaurant with a walkthrough, as the board orders them:
 * submitted first, then most done first, then the restaurants' own order.
 */
export function leadRows<R extends Restaurant>(rows: SummaryRow[], month: string, restaurants: R[]) {
  return restaurants
    .map((restaurant, order) => ({
      restaurant,
      order,
      row: rows.find((r) => r.period.slice(0, 10) === month && r.restaurant_id === restaurant.id),
    }))
    .filter((x): x is { restaurant: R; order: number; row: SummaryRow } => !!x.row)
    .sort((a, b) => {
      if (submitted(a.row) !== submitted(b.row)) return submitted(a.row) ? -1 : 1
      return share(b.row) - share(a.row) || a.order - b.order
    })
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/**
 * The line under a restaurant's bar: what it flagged, then its record.
 * "2 tickets · on time 6 of 6 months", "No issues so far · on time 4 of 5 months",
 * "On time 0 of 5 months · 2 missed".
 */
export function rowLine(row: SummaryRow, history: SummaryRow[], month: string) {
  const r = record(
    history.filter((h) => h.restaurant_id === row.restaurant_id),
    month,
  )
  const open = row.standing === 'in_progress'
  const untouched = row.done === 0 && row.tickets === 0 && row.fixes === 0
  const flagged =
    row.standing === 'not_started' || (row.standing === 'missed' && untouched)
      ? null
      : row.tickets > 0
        ? `${plural(row.tickets, 'ticket')}${open ? ' so far' : ''}`
        : row.fixes > 0
          ? `No tickets${open ? ' so far' : ''}`
          : `No issues${open ? ' so far' : ''}`
  const onTime = r.finished > 0 ? `on time ${r.onTime} of ${plural(r.finished, 'month')}` : null
  const parts = [flagged, onTime, r.missed > 0 ? `${r.missed} missed` : null].filter((p): p is string => !!p)
  const line = parts.join(' · ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/** The month's count: "1 of 4". */
export const submittedCount = (rows: SummaryRow[]) => `${rows.filter(submitted).length} of ${rows.length}`
