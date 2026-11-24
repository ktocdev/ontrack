import { AREAS, type Area } from '../../app/areas'
/** How the Ops dashboard orders and groups its tickets. */

/** The areas in order with one first (Show first, OT-174), the others keeping theirs. */
export const areasFrom = (first: Area): Area[] => [first, ...AREAS.filter((a) => a !== first)]

// A walkthrough ticket with no category carries its own area (OT-141).
type Sortable = { urgency: string; created_at: string; category: { area: string } | null; area?: string | null }

/**
 * Urgent always on top, then the area shown first and the other areas in their usual order
 * (a ticket with no area after them all), then whatever has waited longest.
 */
export function byPriorityFrom(first: Area) {
  const order: string[] = areasFrom(first)
  const rank = (t: Sortable) => {
    const i = order.indexOf(t.category?.area ?? t.area ?? '')
    return i < 0 ? order.length : i
  }
  return (a: Sortable, b: Sortable) => {
    const urgent = Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent')
    return urgent || rank(a) - rank(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }
}

/** Front of House first: lists that have no Show first of their own (Admin tickets, a unit's). */
export const byPriority = byPriorityFrom('foh')

/**
 * The tickets under each restaurant, in the order the restaurants come in. Each list
 * keeps the order it was given, and a restaurant with no tickets is left out.
 */
export function groupByRestaurant<T extends { restaurant_id: string }, R extends { id: string }>(
  tickets: T[],
  restaurants: R[],
) {
  return restaurants
    .map((restaurant) => ({ restaurant, tickets: tickets.filter((t) => t.restaurant_id === restaurant.id) }))
    .filter((group) => group.tickets.length > 0)
}

/**
 * The restaurants in the order a person chose. Any they haven't placed, like one added
 * since, keep the group's order after the rest, and ids no longer in the list drop out.
 */
export function inChosenOrder<R extends { id: string }>(restaurants: R[], chosen: string[]) {
  const placed = chosen.flatMap((id) => restaurants.filter((r) => r.id === id))
  return [...placed, ...restaurants.filter((r) => !chosen.includes(r.id))]
}

/** How the dashboard orders its restaurants, chosen on Sort restaurants (from feedback, Nov 24, 2026). */
export type RestaurantSort = 'urgent' | 'count' | 'custom'

export const RESTAURANT_SORTS: { value: RestaurantSort; title: string; subtitle: string }[] = [
  { value: 'urgent', title: 'Most urgent', subtitle: 'Most urgent tickets first, then most open tickets' },
  { value: 'count', title: 'Ticket count', subtitle: 'Most open tickets first, urgent or not' },
  { value: 'custom', title: 'Custom order', subtitle: 'Drag restaurants into your own order' },
]

export const isRestaurantSort = (v: unknown): v is RestaurantSort => RESTAURANT_SORTS.some((s) => s.value === v)

/**
 * The restaurant groups in the chosen sort, counting the tickets each one lists. The groups
 * come in the person's own order, which settles a tie, so restaurants that are level stay put.
 */
export function sortGroups<G extends { tickets: { urgency: string }[] }>(groups: G[], sort: RestaurantSort): G[] {
  if (sort === 'custom') return groups
  const urgent = (g: G) => g.tickets.filter((t) => t.urgency === 'urgent').length
  return groups
    .map((g, i) => ({ g, i }))
    .sort(
      (a, b) =>
        (sort === 'urgent' ? urgent(b.g) - urgent(a.g) : 0) || b.g.tickets.length - a.g.tickets.length || a.i - b.i,
    )
    .map(({ g }) => g)
}
