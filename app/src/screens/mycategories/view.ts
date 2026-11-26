import { AREA_LABEL, AREAS, type Area } from '../../app/areas'
import { DEFAULT_VIEW, type NotifyLevel, type ViewSetting } from '../../components/ViewSetting'

/**
 * What a person's My categories settings come to (OT-116, OT-118). Only what differs from
 * the default is stored: an area row with both settings, and a category row whose empty
 * setting follows its area, one setting at a time. The database reads the same rules in
 * notification_recipients; this is the app's side, for the screen and for the lists.
 */
export type AreaRow = { area: Area; notify: NotifyLevel; shown: boolean }
export type CategoryRow = { category_id: string; notify: NotifyLevel | null; shown: boolean | null }

export type Prefs = {
  areas: Record<Area, ViewSetting>
  /** A category's own settings, null where it follows its area. */
  categories: Map<string, { notify: NotifyLevel | null; shown: boolean | null }>
}

export function toPrefs(areaRows: AreaRow[], categoryRows: CategoryRow[]): Prefs {
  const areas = Object.fromEntries(AREAS.map((a) => [a, DEFAULT_VIEW])) as Record<Area, ViewSetting>
  for (const r of areaRows) areas[r.area] = { notify: r.notify, shown: r.shown }
  return {
    areas,
    categories: new Map(categoryRows.map((r) => [r.category_id, { notify: r.notify, shown: r.shown }])),
  }
}

export const NO_PREFS: Prefs = toPrefs([], [])

/** A category's settings as they apply: its own where it has one, else its area's. */
export function categoryView(prefs: Prefs, categoryId: string, area: Area): ViewSetting {
  const own = prefs.categories.get(categoryId)
  const fromArea = prefs.areas[area]
  return { notify: own?.notify ?? fromArea.notify, shown: own?.shown ?? fromArea.shown }
}

/** Whether the category has a setting of its own, so the screen can say it doesn't follow. */
export function hasOwn(prefs: Prefs, categoryId: string) {
  return prefs.categories.has(categoryId)
}

/**
 * What to store for a category chosen on the sheet: a setting the same as its area's is
 * left empty, so it follows the area from then on; null when nothing differs, which
 * deletes the row.
 */
export function categoryRow(prefs: Prefs, area: Area, chosen: ViewSetting) {
  const fromArea = prefs.areas[area]
  const notify = chosen.notify === fromArea.notify ? null : chosen.notify
  const shown = chosen.shown === fromArea.shown ? null : chosen.shown
  return notify === null && shown === null ? null : { notify, shown }
}

/** An area's row is kept only off the defaults (`area_prefs_not_default`). */
export function isDefault(v: ViewSetting) {
  return v.notify === DEFAULT_VIEW.notify && v.shown === DEFAULT_VIEW.shown
}

/** Something on a list: a ticket, which has a category, or an in-house task, which has an area. */
export type Listed = {
  category_id?: string | null
  area?: Area | null
  created_by?: string | null
  assignee_id?: string | null
}

/**
 * Whether a list shows this, for this person. Never hidden when they filed it or are on
 * it, as its news always reaches them. A ticket goes by its category, a task by its area,
 * and anything with neither shows.
 */
export function isShown(prefs: Prefs, userId: string, item: Listed) {
  if (item.created_by === userId || item.assignee_id === userId) return true
  if (item.category_id && item.area) return categoryView(prefs, item.category_id, item.area).shown
  if (item.area) return prefs.areas[item.area].shown
  return true
}

/** A category as the lists' line reads it: only the active ones count. */
type Named = { id: string; name: string; area: Area; active: boolean }

/**
 * What this person hides, for the lists' line: how many of the group's categories, and
 * their names in the group's order, an area hidden whole named once by the area.
 */
export function hiddenCategories(prefs: Prefs, categories: Named[]) {
  const hidden = categories.filter((c) => c.active && !categoryView(prefs, c.id, c.area).shown)
  const names: string[] = []
  for (const area of AREAS) {
    const inArea = categories.filter((c) => c.active && c.area === area)
    const off = hidden.filter((c) => c.area === area)
    if (off.length === 0) continue
    if (off.length === inArea.length && !prefs.areas[area].shown) names.push(AREA_LABEL[area])
    else names.push(...off.map((c) => c.name))
  }
  return { count: hidden.length, names }
}

/**
 * The switch on a My categories row (OT-119). On means it's on your radar: shown, or for
 * the Support Team, shown or notifying. Anything in between, like shown with Notify off,
 * reads as on, and the row's subtitle says which.
 */
export function isOn(v: ViewSetting, withNotify: boolean) {
  return v.shown || (withNotify && v.notify !== 'off')
}

/**
 * What the switch sets. With Notify, on is everything and off is nothing, as a job title's
 * starting view puts it. Without it, only Show changes, and Notify stays as it was.
 */
export function switched(v: ViewSetting, on: boolean, withNotify: boolean): ViewSetting {
  if (!withNotify) return { ...v, shown: on }
  return on ? DEFAULT_VIEW : { notify: 'off', shown: false }
}
