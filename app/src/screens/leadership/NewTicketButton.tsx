import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { ButtonLink } from '../../components/Button'
import { IconPlus } from '../../components/icons'

/**
 * New ticket on leadership's Overview and a restaurant's page (OT-170), in the header beside
 * the title as Add is on the equipment lists. It opens the same Create ticket screens a
 * Reporter has, under /lead, with the restaurant already picked when there is one, and comes
 * back to `back` once filed. Only with Create tickets, and never under View as.
 */
export function NewTicketButton({ restaurantId, back }: { restaurantId?: string; back: string }) {
  const { viewingAs } = useUser()
  const files = useRight('create_tickets') === true
  if (viewingAs || !files) return null
  const params = new URLSearchParams({ ...(restaurantId ? { restaurant: restaurantId } : {}), back })
  return (
    <ButtonLink
      to={`/lead/tickets/new?${params.toString()}`}
      variant="compact"
      icon={<IconPlus size={18} strokeWidth={2.4} />}
      className="flex-none gap-1.5 px-3.5 text-14"
    >
      New ticket
    </ButtonLink>
  )
}
