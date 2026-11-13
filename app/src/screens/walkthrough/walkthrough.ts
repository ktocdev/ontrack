/**
 * The walkthrough home's arithmetic, apart from the screen so it can be tested: the
 * sections' totals, the checklist's title, the dates, and how a past month reads.
 */

/** One row of v_walkthrough_progress: a section, or the quarter's tasks. */
export type ProgressRow = {
  walkthrough_id: string | null
  kind: string | null
  section_id: string | null
  name: string | null
  short_name: string | null
  sort_order: number | null
  total: number | null
  done: number | null
  tickets: number | null
  fixes: number | null
  good_items: number | null
  inhouse_items: number | null
  ticket_items: number | null
}

export type Part = {
  /** A section's id, or 'quarterly' for the quarter's tasks. */
  key: string
  name: string
  shortName: string
  total: number
  done: number
  tickets: number
  fixes: number
}

export type Progress = {
  parts: Part[]
  total: number
  done: number
  good: number
  inhouse: number
  ticketItems: number
  tickets: number
  fixes: number
}

const n = (v: number | null) => v ?? 0

/** A walkthrough's sections in checklist order, the quarter's tasks last, and the sums. */
export function progressOf(rows: ProgressRow[], period: string): Progress {
  const parts = [...rows]
    .sort((a, b) => n(a.sort_order) - n(b.sort_order))
    .map<Part>((r) =>
      r.kind === 'quarterly'
        ? {
            key: 'quarterly',
            name: `${quarterOf(period)} location tasks`,
            shortName: quarterOf(period),
            total: n(r.total),
            done: n(r.done),
            tickets: n(r.tickets),
            fixes: n(r.fixes),
          }
        : {
            key: r.section_id ?? '',
            name: r.name ?? '',
            shortName: r.short_name || r.name || '',
            total: n(r.total),
            done: n(r.done),
            tickets: n(r.tickets),
            fixes: n(r.fixes),
          },
    )
  const sum = (pick: (r: ProgressRow) => number | null) => rows.reduce((s, r) => s + n(pick(r)), 0)
  return {
    parts,
    total: sum((r) => r.total),
    done: sum((r) => r.done),
    good: sum((r) => r.good_items),
    inhouse: sum((r) => r.inhouse_items),
    ticketItems: sum((r) => r.ticket_items),
    tickets: sum((r) => r.tickets),
    fixes: sum((r) => r.fixes),
  }
}

/** "Back of House + Front of House", from the checklist's sections (not the quarter's tasks). */
export function checklistTitle(parts: Part[], short = false) {
  return parts
    .filter((p) => p.key !== 'quarterly')
    .map((p) => (short ? p.shortName : p.name))
    .join(' + ')
}

/** Dates in the database are days, not moments: read them at noon UTC so no time zone moves them. */
const day = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })

/** "October" */
export const monthName = (period: string) => day(period, { month: 'long' })
/** "Sep" */
export const monthShort = (period: string) => day(period, { month: 'short' })
/** "Fri, Oct 31" */
export const dueDate = (date: string) => day(date, { weekday: 'short', month: 'short', day: 'numeric' })
/** A moment ("2026-10-24T22:30:00Z") as the day it was here: "Sat, Oct 24". */
export const onDay = (moment: string) =>
  new Date(moment).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
/** "Q4" */
export const quarterOf = (period: string) => `Q${Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1}`

/** How a past walkthrough reads: what it flagged, all good, or not done at all. */
export function pastFlag(
  status: 'open' | 'submitted',
  progress: Pick<Progress, 'tickets' | 'fixes'>,
): { tone: 'ticket' | 'inhouse' | 'good' | 'missed'; label: string } {
  if (status !== 'submitted') return { tone: 'missed', label: 'Not done' }
  if (progress.tickets > 0)
    return { tone: 'ticket', label: progress.tickets === 1 ? '1 ticket' : `${progress.tickets} tickets` }
  if (progress.fixes > 0) return { tone: 'inhouse', label: `${progress.fixes} in-house` }
  return { tone: 'good', label: 'All good' }
}

type WalkthroughLike = { id: string; restaurant_id: string; period: string }

/**
 * For each restaurant, its newest walkthrough is the one the card shows, and the rest are
 * past. Newest, not this month's: one still open after its month shows until the next
 * opens, so a late one can still be finished.
 */
export function splitByRestaurant<W extends WalkthroughLike>(walkthroughs: W[], restaurantIds: string[]) {
  const newestFirst = [...walkthroughs].sort((a, b) => b.period.localeCompare(a.period))
  const current = restaurantIds.map((id) => newestFirst.find((w) => w.restaurant_id === id)).filter((w): w is W => !!w)
  const shown = new Set(current.map((w) => w.id))
  const past = newestFirst.filter((w) => !shown.has(w.id))
  return { current, past }
}
