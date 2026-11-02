/** What the Ops dashboard says about a ticket and how it orders them. */

type Sortable = { urgency: string; activity: string }

/** Urgent first, then the most recent activity: the board's Most urgent. */
export function byUrgency(a: Sortable, b: Sortable) {
  const urgent = Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent')
  return urgent || new Date(b.activity).getTime() - new Date(a.activity).getTime()
}

type ThreadRow = { ticket_id: string; kind: string; body: string | null; created_at: string }

/**
 * Why each reopened ticket came back, by ticket. reopen_ticket posts the reason as a
 * message just after the Reopened event, in the same moment. The first words at or
 * after the reopen are the reason, so a later reply from Ops doesn't take its place.
 */
export function reopenReasons(tickets: { id: string; reopened_at: string | null }[], rows: ThreadRow[]) {
  const reasons = new Map<string, string>()
  for (const t of tickets) {
    if (!t.reopened_at) continue
    const since = new Date(t.reopened_at).getTime()
    const first = rows
      .filter((r) => r.ticket_id === t.id && r.body && new Date(r.created_at).getTime() >= since)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
    if (first?.body) reasons.set(t.id, first.body)
  }
  return reasons
}
