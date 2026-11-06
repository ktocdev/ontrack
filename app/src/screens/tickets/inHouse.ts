/** How the In-house tab sorts its checked-off tasks. */

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
