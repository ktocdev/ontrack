/** How the equipment lists search, filter and group their units. */

export type Area = 'foh' | 'boh'

export type Unit = {
  id: string
  name: string
  brand: string | null
  serial: string | null
  restaurant_id: string
  category: { name: string; area: Area; sort_order: number } | null
  retired: boolean
  openCount: number
  /** This year's spend in cents, or null for none (and always null without see_costs). */
  spendCents: number | null
}

export type Filters = { area: Area | null; types: string[] }

export const NO_FILTERS: Filters = { area: null, types: [] }

export function filterCount(f: Filters) {
  return (f.area ? 1 : 0) + f.types.length
}

const fold = (s: string) => s.toLowerCase().replace(/[\s-]/g, '')

/** Name, brand or serial, ignoring case, spaces and dashes, so "kp7xw" finds KP-7XW-220418. */
export function matchesSearch(u: Pick<Unit, 'name' | 'brand' | 'serial'>, query: string) {
  const q = fold(query)
  return !q || [u.name, u.brand, u.serial].some((v) => v && fold(v).includes(q))
}

export function matchesFilters(u: Unit, f: Filters) {
  return (!f.area || u.category?.area === f.area) && (!f.types.length || f.types.includes(u.category?.name ?? ''))
}

/** Back of House first, as the board lists it, then each area's own order. */
function categoryRank(c: Unit['category']) {
  return c ? (c.area === 'boh' ? 0 : 100) + c.sort_order : 1000
}

/**
 * The type names in order, each once: Front and Back both have a Plumbing, and the
 * board groups and filters by the name, with Area narrowing it.
 */
export function typeNames(units: Unit[]) {
  const sorted = [...units].sort((a, b) => categoryRank(a.category) - categoryRank(b.category))
  return [...new Set(sorted.map((u) => u.category?.name ?? 'Other'))]
}

/** A card per type, units by name, with the open tickets on them added up. */
export function groupByType(units: Unit[]) {
  return typeNames(units).map((name) => {
    const inType = units
      .filter((u) => (u.category?.name ?? 'Other') === name)
      .sort((a, b) => a.name.localeCompare(b.name) || a.restaurant_id.localeCompare(b.restaurant_id))
    return { name, units: inType, openCount: inType.reduce((n, u) => n + u.openCount, 0) }
  })
}

/** The toggle key of the Retired card, which no type's name can match. */
export const RETIRED_CARD = '\u0000retired'

/** A date column ('2022-03-14') as a local day, so it never shifts a day across time zones. */
function day(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** "Mar 2022": when a unit was installed. */
export function monthYear(date: string) {
  return day(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** "Oct 19": a visit in the service log, under its year. */
export function monthDay(date: string) {
  return day(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function yearOf(date: string) {
  return day(date).getFullYear()
}
