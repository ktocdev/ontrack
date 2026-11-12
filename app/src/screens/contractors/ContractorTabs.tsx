import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { UnderlineTabs } from '../../components/Screen'

/**
 * Directory and Invoices under the Contractors title (design/screens/Ops-Contractors,
 * Ops-Invoices). Invoices are amounts, so the tab needs see_costs; without it there are
 * no tabs. Under View as the tabs show and lead nowhere.
 */
export function ContractorTabs() {
  const { viewingAs } = useUser()
  const seeCosts = useRight('see_costs')
  if (!seeCosts) return null
  return (
    <UnderlineTabs
      label="Contractors"
      size="lg"
      inert={viewingAs}
      items={[
        { to: '/ops/contractors', label: 'Directory', end: true },
        { to: '/ops/contractors/invoices', label: 'Invoices' },
      ]}
    />
  )
}
