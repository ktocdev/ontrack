/**
 * Quarterly tasks (WT-Ops-Tasks, OT-135): what the screen lists for the group or for one
 * restaurant in a quarter, worked out from the task rows as the database does in
 * quarter_tasks_for(). A group task has no restaurant; a restaurant's own has its restaurant
 * and no overrides_task_id; a restaurant's version of a group task has both, changed or
 * removed, and counts only while active.
 */

export type TaskRow = {
  id: string
  restaurant_id: string | null
  overrides_task_id: string | null
  title: string
  directions: string | null
  video_url: string | null
  months: number[]
  removed: boolean
  active: boolean
  sort_order: number
}

export type Quarter = 1 | 2 | 3 | 4

/** Whether a task's months fall in the quarter. */
export function inQuarter(months: number[], q: Quarter) {
  return months.some((m) => Math.floor((m - 1) / 3) + 1 === q)
}

export function quarterOfDate(d: Date): Quarter {
  return (Math.floor(d.getMonth() / 3) + 1) as Quarter
}

export type ListedTask = {
  /** What Edit changes: a group task for the group, else the restaurant's row or the group task to version. */
  task: TaskRow
  /** The group task behind a restaurant's version or its inherited task. */
  group: TaskRow | null
  kind: 'group' | 'inherited' | 'changed' | 'own'
}

const byOrder = (a: TaskRow, b: TaskRow) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)

/**
 * The quarter's list for the group (restaurant null) or a restaurant: its tasks, the group
 * tasks it removed (for Restore), and what is turned off (for Turn on).
 */
export function listFor(rows: TaskRow[], restaurant: string | null, q: Quarter) {
  const groupTasks = rows.filter((t) => !t.restaurant_id).sort(byOrder)
  if (!restaurant) {
    return {
      tasks: groupTasks
        .filter((t) => t.active && inQuarter(t.months, q))
        .map((t) => ({ task: t, group: null, kind: 'group' as const })),
      removed: [] as TaskRow[],
      off: groupTasks.filter((t) => !t.active && inQuarter(t.months, q)),
    }
  }
  const versionOf = new Map(
    rows
      .filter((t) => t.restaurant_id === restaurant && t.overrides_task_id && t.active)
      .map((t) => [t.overrides_task_id!, t]),
  )
  const tasks: ListedTask[] = []
  const removed: TaskRow[] = []
  for (const g of groupTasks.filter((t) => t.active)) {
    const v = versionOf.get(g.id)
    if (v?.removed) {
      if (inQuarter(g.months, q)) removed.push(g)
    } else if (v) {
      if (inQuarter(v.months, q)) tasks.push({ task: v, group: g, kind: 'changed' })
    } else if (inQuarter(g.months, q)) {
      tasks.push({ task: g, group: g, kind: 'inherited' })
    }
  }
  const own = rows.filter((t) => t.restaurant_id === restaurant && !t.overrides_task_id).sort(byOrder)
  for (const t of own) if (t.active && inQuarter(t.months, q)) tasks.push({ task: t, group: null, kind: 'own' })
  return { tasks, removed, off: own.filter((t) => !t.active && inQuarter(t.months, q)) }
}

/** A restaurant's line on the group view: "1 added · 1 changed", or that it uses the group's list. */
export function summaryFor(rows: TaskRow[], restaurant: string) {
  const activeGroup = new Set(rows.filter((t) => !t.restaurant_id && t.active).map((t) => t.id))
  const mine = rows.filter((t) => t.restaurant_id === restaurant && t.active)
  const added = mine.filter((t) => !t.overrides_task_id).length
  const versions = mine.filter((t) => t.overrides_task_id && activeGroup.has(t.overrides_task_id))
  const changed = versions.filter((t) => !t.removed).length
  const removed = versions.filter((t) => t.removed).length
  const bits = [added && `${added} added`, changed && `${changed} changed`, removed && `${removed} removed`].filter(
    Boolean,
  )
  return bits.length ? bits.join(' · ') : 'Uses the all-restaurants list'
}

/** A task's line under its name, as the board writes it. */
export function taskMeta(t: Pick<TaskRow, 'video_url'>) {
  return t.video_url ? 'Directions · video' : 'Directions'
}

/** What the app shows as a how-to link: a web address and nothing more, as the database holds. */
export function isVideoUrl(url: string) {
  return /^https?:\/\/\S+$/i.test(url) && url.length <= 500
}
