/** How the In-house lists sort their checked-off tasks and say where a task came from. */

/** Checked off longer ago than this sits behind Show older (from feedback, OT-85). */
export const RECENT_DAYS = 30

/**
 * Checked-off tasks, latest first, split at RECENT_DAYS before now: the recent ones show
 * under Closed, the older ones wait behind Show older. Nothing is hidden for good.
 */
export function splitClosed<T extends { done_at: string | null }>(tasks: T[], now = new Date()) {
  const cutoff = now.getTime() - RECENT_DAYS * 86_400_000
  const closed = tasks.filter((t) => t.done_at).sort((a, b) => Date.parse(b.done_at!) - Date.parse(a.done_at!))
  return {
    recent: closed.filter((t) => Date.parse(t.done_at!) >= cutoff),
    older: closed.filter((t) => Date.parse(t.done_at!) < cutoff),
  }
}

const dayOf = (at: string) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const firstOf = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

/**
 * The line under a task that didn't come from a walkthrough (whose line is its origin):
 * "From Bert · Nov 18 · Walk-in cooler" for one the Support Team sent (OT-131), naming its
 * unit, or "Added by Maya · Nov 6" for one added by hand.
 */
export function addedBy(t: {
  created_at: string
  from_ops: boolean
  adder: { full_name: string } | null
  unit: { name: string } | null
}) {
  const who = firstOf(t.adder?.full_name)
  const day = dayOf(t.created_at)
  if (t.from_ops) return [who ? `From ${who}` : 'From the Support Team', day, t.unit?.name].filter(Boolean).join(' · ')
  return who ? `Added by ${who} · ${day}` : `Added ${day}`
}
