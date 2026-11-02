/** How Ops · Closed tickets splits its list into months, in the person's own time zone. */

export type ClosedMonth = { month: string; closed_count: number; total_cents: number | null }

/** First of the month, as the database writes it. */
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function parts(key: string) {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return { y, m }
}

/** The month's start and the next month's, as instants, to ask the database for its tickets. */
export function monthRange(key: string) {
  const { y, m } = parts(key)
  return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 1).toISOString() }
}

/** "October", with the year only when it isn't this one. */
export function monthName(key: string, now = new Date()) {
  const { y, m } = parts(key)
  const name = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  return y === now.getFullYear() ? name : `${name} ${y}`
}

/**
 * The months to draw: this month, even with nothing closed, then as many earlier ones as
 * have been asked for, and the next one to offer. An empty month makes way once an
 * earlier one is open. It shows $0.00 only if another month says this person sees costs.
 */
export function shownMonths(months: ClosedMonth[], extra: number, now = new Date()) {
  const current = monthKey(now)
  const seesCosts = months.some((m) => m.total_cents !== null)
  const thisMonth = months.find((m) => m.month === current) ?? {
    month: current,
    closed_count: 0,
    total_cents: seesCosts ? 0 : null,
  }
  const earlier = months.filter((m) => m.month < current)
  const opened = earlier.slice(0, extra)
  const shown = thisMonth.closed_count === 0 && opened.length ? opened : [thisMonth, ...opened]
  return { shown, next: earlier[extra] ?? null }
}

/** Anything reopened first, since it needs Ops again, then the newest. */
export function byReopenedThenNewest(
  a: { status: string; last_closed_at: string | null },
  b: { status: string; last_closed_at: string | null },
) {
  const reopened = Number(b.status !== 'closed') - Number(a.status !== 'closed')
  return reopened || (b.last_closed_at ?? '').localeCompare(a.last_closed_at ?? '')
}
