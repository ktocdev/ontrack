/** How the Ops dashboard orders and groups its tickets. */

type Sortable = { urgency: string; created_at: string; category: { area: string } | null }

/** Urgent always on top, then Front of House before Back, then whatever has waited longest. */
export function byPriority(a: Sortable, b: Sortable) {
  const urgent = Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent')
  const front = Number(b.category?.area === 'foh') - Number(a.category?.area === 'foh')
  return urgent || front || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
