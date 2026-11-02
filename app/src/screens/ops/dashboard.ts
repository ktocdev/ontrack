/** How the Ops dashboard orders and groups its tickets. */

type Sortable = { status: string; urgency: string; activity: string }

/** Reopened first, since they came back; then urgent; then the most recent activity. */
export function byAttention(a: Sortable, b: Sortable) {
  const reopened = Number(b.status === 'reopened') - Number(a.status === 'reopened')
  const urgent = Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent')
  return reopened || urgent || new Date(b.activity).getTime() - new Date(a.activity).getTime()
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
