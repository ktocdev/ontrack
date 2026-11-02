import { statusLabel } from '../../components/Pill'
import type { TicketStatus } from '../../lib/supabase'
import type { Update } from './thread'

/** What the Closed ticket screen says about time, money and how the ticket went. */

const DAY = 24 * 60 * 60 * 1000
export const REOPEN_DAYS = 30

export function longDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dateTime(d: Date) {
  return `${longDate(d)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** How long is left to reopen; 0 or less means it has passed. tickets_guard has the last word. */
export function reopenDaysLeft(closedAt: string, now = new Date()) {
  return Math.ceil((new Date(closedAt).getTime() + REOPEN_DAYS * DAY - now.getTime()) / DAY)
}

export function timeToClose(createdAt: string, closedAt: string) {
  const days = Math.round((new Date(closedAt).getTime() - new Date(createdAt).getTime()) / DAY)
  if (days < 1) return 'Under a day'
  return days === 1 ? '1 day' : `${days} days`
}

export function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** The latest of a kind of update. */
function latest(updates: Update[], kind: Update['kind']) {
  return updates.filter((u) => u.kind === kind).at(-1) ?? null
}

/**
 * What a reopened ticket says about itself. The reason is the reopen's own words or the
 * message posted in the same step, whose photos are the reopen's. They share a timestamp,
 * so the message can sort either side of the event. Closing clears the ticket's resolution,
 * so the closing comment comes from the thread.
 */
export function reopenStory(updates: Update[]) {
  const reopen = latest(updates, 'reopened')
  const closed = latest(updates, 'closed')
  const written =
    reopen && !reopen.body
      ? updates.find(
          (u) => u.kind === 'message' && u.author?.id === reopen.author?.id && u.created_at >= reopen.created_at,
        )
      : reopen
  return {
    reason: written?.body ?? null,
    reasonUpdateId: written?.id ?? null,
    reopenedBy: reopen?.author?.full_name ?? null,
    reopenedAt: reopen?.created_at ?? null,
    closedAt: closed?.created_at ?? null,
    closingComment: closed?.body ?? null,
    closer: closed?.author ?? null,
    daysAfterClosing:
      reopen && closed
        ? Math.round((new Date(reopen.created_at).getTime() - new Date(closed.created_at).getTime()) / DAY)
        : null,
  }
}

export type TimelineStep = {
  key: string
  title: string
  note: string | null
  when: string
  /** The closing step gets the brand dot. */
  end: boolean
}

/** The ticket's life without the chat: what changed, who did it and when. */
export function timeline(updates: Update[]): TimelineStep[] {
  const steps: TimelineStep[] = []
  for (const u of updates) {
    const title =
      u.kind === 'created'
        ? 'Opened'
        : u.kind === 'closed'
          ? 'Closed'
          : u.kind === 'reopened'
            ? 'Reopened'
            : u.kind === 'status_changed'
              ? statusLabel(((u.meta ?? {}) as { to?: TicketStatus }).to ?? 'open')
              : null
    if (!title) continue
    steps.push({
      key: u.id,
      title,
      // The closing comment already has its own card.
      note: u.kind === 'closed' ? null : u.body,
      when: `${u.author?.full_name ?? 'Someone'} · ${dateTime(new Date(u.created_at))}`,
      end: u.kind === 'closed',
    })
  }
  return steps
}
