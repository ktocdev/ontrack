import type { TicketStatus } from '../../lib/supabase'

/** What the ticket lists say about a ticket's time and how they find and order it. */

export const AREA_LABEL = { foh: 'Front of House', boh: 'Back of House' }

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function ago(then: Date, now: Date) {
  const ms = now.getTime() - then.getTime()
  if (ms < MINUTE) return 'just now'
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`
  const days = Math.floor(ms / DAY)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

type Times = { status: TicketStatus; created_at: string; updated_at: string; reopened_at: string | null }

/** "Reopened 2h ago", "Updated 1h ago", or "Created 3h ago" for one nobody has touched. */
export function activityLine(t: Times, now = new Date()) {
  if (t.status === 'reopened' && t.reopened_at) return `Reopened ${ago(new Date(t.reopened_at), now)}`
  const touched = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime() >= MINUTE
  return touched ? `Updated ${ago(new Date(t.updated_at), now)}` : `Created ${ago(new Date(t.created_at), now)}`
}

/** A day this week by its name ("Scheduled Thu"), anything else by its date ("Scheduled Nov 12"). */
export function scheduledLabel(date: string, now = new Date()) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const day = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const away = Math.round((day.getTime() - today.getTime()) / DAY)
  const format: Intl.DateTimeFormatOptions =
    away >= 0 && away < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }
  return `Scheduled ${day.toLocaleDateString('en-US', format)}`
}

/** The most recent activity first. A reopened ticket gets no special place. */
export function byActivity(a: { updated_at: string }, b: { updated_at: string }) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
}
