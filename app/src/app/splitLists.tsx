import { lazy } from 'react'
import type { SplitList } from './SplitView'

/**
 * The lists that keep their place beside an open ticket on a laptop (OT-159), loaded only
 * when shown. Each path is the list's own route; SplitView renders it at the address the
 * person last had it.
 */
const OpenTickets = lazy(async () => ({
  default: (await import('../screens/tickets/OpenTicketsScreen')).OpenTicketsScreen,
}))
const ClosedTickets = lazy(async () => ({
  default: (await import('../screens/tickets/ClosedTicketsScreen')).ClosedTicketsScreen,
}))
const OpsDashboard = lazy(async () => ({
  default: (await import('../screens/ops/OpsDashboardScreen')).OpsDashboardScreen,
}))
const OpsClosed = lazy(async () => ({ default: (await import('../screens/ops/OpsClosedScreen')).OpsClosedScreen }))
const AdminTickets = lazy(async () => ({
  default: (await import('../screens/admin/AdminTicketsScreen')).AdminTicketsScreen,
}))
const LeadRestaurant = lazy(async () => {
  const { LeadRestaurantScreen } = await import('../screens/leadership/LeadRestaurantScreen')
  return { default: () => <LeadRestaurantScreen tab="tickets" /> }
})
const LeadRestaurantsIndex = lazy(async () => ({
  default: (await import('../screens/leadership/LeadRestaurantScreen')).LeadRestaurantsIndex,
}))

export const MANAGER_TICKET_LISTS: SplitList[] = [
  { path: '/tickets', element: <OpenTickets /> },
  { path: '/tickets/closed', element: <ClosedTickets /> },
]

export const OPS_TICKET_LISTS: SplitList[] = [
  { path: '/ops', element: <OpsDashboard /> },
  { path: '/ops/closed', element: <OpsClosed /> },
]

export const ADMIN_TICKET_LISTS: SplitList[] = [{ path: '/admin/tickets', element: <AdminTickets /> }]

export const LEAD_TICKET_LISTS: SplitList[] = [
  { path: '/lead/restaurants', element: <LeadRestaurantsIndex /> },
  { path: '/lead/restaurants/:id', element: <LeadRestaurant /> },
]

/** What the empty pane says beside a list of tickets. */
export const TICKET_PANE = { title: 'No ticket open', body: 'Pick a ticket on the left to see it here.' }
