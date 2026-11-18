import { firstName, shortDay } from '../../lib/words'
import { submittedDay, type SummaryRow } from './walkthroughOverview'

/**
 * Ops' view of one restaurant's walkthrough (WT-Ops-Restaurant, OT-130): when the last
 * reminder went, how a past month reads, and whom Send reminder names.
 */

/** "today at 3:10 PM", or the day it went ("Oct 15"), or nothing sent yet. */
export function lastReminderLabel(at: string | null, now = new Date()) {
  if (!at) return 'None sent yet'
  const then = new Date(at)
  if (then.toDateString() === now.toDateString()) {
    return `today at ${then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  return shortDay(then)
}

/** A past month on the right of its row: "Sep 28 · 5 tickets", "Aug 30 · all good", "Not done". */
export function pastLine(row: Pick<SummaryRow, 'standing' | 'submitted_at' | 'tickets' | 'fixes'>) {
  if (!row.submitted_at || (row.standing !== 'on_time' && row.standing !== 'late')) return 'Not done'
  const flagged =
    row.tickets > 0
      ? row.tickets === 1
        ? '1 ticket'
        : `${row.tickets} tickets`
      : row.fixes > 0
        ? `${row.fixes} in-house`
        : 'all good'
  return `${submittedDay(row.submitted_at)} · ${flagged}`
}

/**
 * Whom Send reminder names: whoever started the walkthrough, else the restaurant's manager.
 * It goes to all the restaurant's Reporters either way; the name is who it's mostly for.
 */
export function reminderFor(starter: string | null | undefined, manager: string | null | undefined) {
  return firstName(starter ?? manager ?? undefined) ?? null
}
