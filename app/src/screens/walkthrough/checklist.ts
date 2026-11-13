/**
 * The checklist's arithmetic, apart from the screen so it can be tested: items in their
 * groups, what each has, what counts as done, and which group opens next.
 */

export type ItemRow = {
  id: string
  section_id: string
  group_name: string
  title: string
  sort_order: number
  active: boolean
}
export type CheckRow = {
  id: string
  item_id: string | null
  quarterly_task_id?: string | null
  result: 'good' | 'in_house' | 'ticket'
}
export type FixRow = { id: string; check_id: string | null; title: string; done_at: string | null; created_at: string }
export type TicketRow = {
  id: string
  display_id: string | null
  title: string
  urgency: string
  status: string
  walkthrough_check_id: string | null
  created_at: string
}

export type ChecklistItem = {
  id: string
  title: string
  good: boolean
  fixes: FixRow[]
  tickets: TicketRow[]
  /** A fix not checked off or a ticket not closed, which keeps Good away. */
  open: boolean
  done: boolean
}

export type ChecklistGroup = { name: string; items: ChecklistItem[]; done: number; total: number }

const byCreated = (a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at)

/**
 * A section's items in their groups, in checklist order. An item turned off since the
 * walkthrough opened still shows if it was checked, as the progress view counts it.
 */
export function groupsOf(
  sectionId: string,
  items: ItemRow[],
  checks: CheckRow[],
  fixes: FixRow[],
  tickets: TicketRow[],
): ChecklistGroup[] {
  const checkOf = new Map(checks.filter((c) => c.item_id).map((c) => [c.item_id!, c]))
  const groups: ChecklistGroup[] = []
  for (const row of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    if (row.section_id !== sectionId) continue
    const check = checkOf.get(row.id)
    if (!row.active && !check) continue
    const itemFixes = check ? fixes.filter((f) => f.check_id === check.id).sort(byCreated) : []
    const itemTickets = check ? tickets.filter((t) => t.walkthrough_check_id === check.id).sort(byCreated) : []
    const good = check?.result === 'good'
    const item: ChecklistItem = {
      id: row.id,
      title: row.title,
      good,
      fixes: itemFixes,
      tickets: itemTickets,
      open: stillOpen(itemFixes, itemTickets),
      done: good || itemFixes.length > 0 || itemTickets.length > 0,
    }
    let group = groups.find((g) => g.name === row.group_name)
    if (!group) {
      group = { name: row.group_name, items: [], done: 0, total: 0 }
      groups.push(group)
    }
    group.items.push(item)
    group.total++
    if (item.done) group.done++
  }
  return groups
}

const complete = (g: ChecklistGroup) => g.total > 0 && g.done === g.total

/** On first look, the first group with something still to do is open. */
export function firstOpen(groups: ChecklistGroup[]): Set<string> {
  const next = groups.find((g) => !complete(g))
  return new Set(next ? [next.name] : [])
}

/**
 * After a tap: a group that just became complete closes, and the next one with something
 * to do opens, so a manager walks down the list without reaching for the headers. Groups
 * opened or closed by hand otherwise stay as they were.
 */
export function openAfter(before: ChecklistGroup[], after: ChecklistGroup[], open: Set<string>): Set<string> {
  const wasComplete = new Set(before.filter(complete).map((g) => g.name))
  const finished = after.findIndex((g) => complete(g) && !wasComplete.has(g.name))
  if (finished < 0) return open
  const next = new Set(open)
  next.delete(after[finished]!.name)
  const following = after.slice(finished + 1).find((g) => !complete(g))
  if (following) next.add(following.name)
  return next
}

/**
 * Which of In-house and Ticket are lit: only while something is still to do. A fix checked
 * off or a ticket closed stays listed under the item, but no longer holds its button on
 * (from feedback, Nov 13, 2026).
 */
export function litChoices(fixes: Pick<FixRow, 'done_at'>[], tickets: Pick<TicketRow, 'status'>[]) {
  return {
    inhouse: fixes.some((f) => !f.done_at),
    ticket: tickets.some((t) => t.status !== 'closed'),
  }
}

/** A fix not checked off or a ticket not closed, which keeps Good away, on an item or a task. */
export function stillOpen(fixes: Pick<FixRow, 'done_at'>[], tickets: Pick<TicketRow, 'status'>[]) {
  const lit = litChoices(fixes, tickets)
  return lit.inhouse || lit.ticket
}
