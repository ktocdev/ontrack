import { AREAS } from '../../app/areas'
/** How the Ops dashboard orders and groups its tickets. */

const AREA_ORDER: string[] = AREAS
/** Front, Back, IT, and a ticket with no category after them all. */
const areaRank = (t: Sortable) => {
  const i = AREA_ORDER.indexOf(t.category?.area ?? '')
  return i < 0 ? AREA_ORDER.length : i
}

type Sortable = { urgency: string; created_at: string; category: { area: string } | null }

/** Urgent always on top, then Front of House, Back of House and IT, then whatever has waited longest. */
export function byPriority(a: Sortable, b: Sortable) {
  const urgent = Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent')
  const area = areaRank(a) - areaRank(b)
  return urgent || area || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

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
