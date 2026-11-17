import type { Standing } from '../../components/Walkthrough'
import { monthName } from '../walkthrough/walkthrough'

/**
 * The Ops walkthroughs overview's working-out (WT-Ops-Overview, OT-129): which months there
 * are, each restaurant's row for the month in the order that needs looking at first, the
 * line above them, and the last six months.
 */

/** One row of v_walkthrough_summary, as the overview reads it. */
export type SummaryRow = {
  walkthrough_id: string
  restaurant_id: string
  period: string
  due_on: string
  standing: Standing
  template_name: string | null
  template_short_name: string | null
  template_description: string | null
  total: number
  done: number
  tickets: number
  fixes: number
  submitted_at: string | null
}

type Restaurant = { id: string; name: string; color: string }

/** The months that have walkthroughs, newest first. */
export function monthsOf(periods: string[]) {
  return [...new Set(periods.map((p) => p.slice(0, 10)))].sort((a, b) => b.localeCompare(a))
}

/** The six months ending with this one, oldest first: the history table's columns. */
export function lastSixMonths(month: string) {
  const year = Number(month.slice(0, 4))
  const index = Number(month.slice(5, 7)) - 1
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, index - 5 + i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
  })
}

const submitted = (r: SummaryRow) => r.standing === 'on_time' || r.standing === 'late'

/**
 * The month's rows, one per restaurant that has a walkthrough, in the restaurants' order to
 * begin with, then: what isn't submitted first, least done first; submitted last.
 */
export function monthRows<R extends Restaurant>(rows: SummaryRow[], month: string, restaurants: R[]) {
  return restaurants
    .map((restaurant, order) => ({
      restaurant,
      order,
      row: rows.find((r) => r.period === month && r.restaurant_id === restaurant.id),
    }))
    .filter((x): x is { restaurant: R; order: number; row: SummaryRow } => !!x.row)
    .sort((a, b) => {
      if (submitted(a.row) !== submitted(b.row)) return submitted(a.row) ? 1 : -1
      const share = (r: SummaryRow) => (r.total > 0 ? r.done / r.total : 0)
      return share(a.row) - share(b.row) || a.order - b.order
    })
}

/** "Oct 31" */
const shortDay = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** When a walkthrough was submitted, as the day it was here: "Oct 18". */
export const submittedDay = (moment: string) =>
  new Date(moment).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * Under the month's name in the stepper: the checklist and the due date, as far as the
 * restaurants share them ("Full walkthrough · BOH + FOH · due Oct 31").
 */
export function monthLine(rows: SummaryRow[]) {
  const names = new Set(rows.map((r) => r.template_short_name ?? r.template_name))
  const dues = new Set(rows.map((r) => r.due_on))
  const parts: string[] = []
  if (names.size === 1) {
    const [row] = rows
    if (row?.template_description) parts.push(row.template_description)
    if (row?.template_short_name ?? row?.template_name) parts.push((row.template_short_name ?? row.template_name)!)
  } else if (names.size > 1) {
    parts.push(`${names.size} checklists`)
  }
  if (dues.size === 1) parts.push(`due ${shortDay(rows[0]!.due_on)}`)
  return parts.join(' · ')
}

/** The line over the rows: "1 of 4" and, while the month is open, how long is left. */
export function summaryLine(rows: SummaryRow[], today: string) {
  const count = `${rows.filter(submitted).length} of ${rows.length}`
  const dues = [...new Set(rows.map((r) => r.due_on))]
  if (dues.length !== 1 || rows.every(submitted)) return { count, left: null }
  const days = Math.round((Date.parse(`${dues[0]}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const left = days > 1 ? `${days} days left` : days === 1 ? '1 day left' : days === 0 ? 'Due today' : null
  return { count, left }
}

/** How a history square reads to a screen reader: "Porter, July: Late". */
export function historyLabel(restaurant: string, period: string, standing: Standing | undefined) {
  const what = standing
    ? { on_time: 'On time', late: 'Late', missed: 'Missed', in_progress: 'In progress', not_started: 'Not started' }[
        standing
      ]
    : 'No walkthrough'
  return `${restaurant}, ${monthName(period)}: ${what}`
}
