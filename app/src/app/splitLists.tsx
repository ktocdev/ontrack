import { lazy } from 'react'
import type { SplitList } from './SplitView'

/**
 * The lists that keep their place beside an open item on a laptop (OT-159, OT-160), loaded only
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

const Equipment = lazy(async () => ({
  default: (await import('../screens/equipment/EquipmentScreen')).EquipmentScreen,
}))
const OpsEquipment = lazy(async () => ({
  default: (await import('../screens/equipment/OpsEquipmentScreen')).OpsEquipmentScreen,
}))
const Contractors = lazy(async () => {
  const { ContractorsScreen } = await import('../screens/contractors/ContractorsScreen')
  return { default: ({ base }: { base?: '/lead' }) => <ContractorsScreen base={base} /> }
})
const Invoices = lazy(async () => {
  const { InvoicesScreen } = await import('../screens/contractors/InvoicesScreen')
  return { default: ({ base }: { base?: '/lead' }) => <InvoicesScreen base={base} /> }
})
const Users = lazy(async () => ({ default: (await import('../screens/admin/UsersScreen')).UsersScreen }))

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

export const MANAGER_EQUIPMENT_LISTS: SplitList[] = [{ path: '/equipment', element: <Equipment /> }]
export const OPS_EQUIPMENT_LISTS: SplitList[] = [{ path: '/ops/equipment', element: <OpsEquipment /> }]

export const OPS_CONTRACTOR_LISTS: SplitList[] = [
  { path: '/ops/contractors', element: <Contractors /> },
  { path: '/ops/contractors/invoices', element: <Invoices /> },
]
export const LEAD_CONTRACTOR_LISTS: SplitList[] = [
  { path: '/lead/contractors', element: <Contractors base="/lead" /> },
  { path: '/lead/contractors/invoices', element: <Invoices base="/lead" /> },
]

export const ADMIN_USER_LISTS: SplitList[] = [{ path: '/admin/users', element: <Users /> }]
