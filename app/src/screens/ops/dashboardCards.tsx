import { ticketPlace } from '../../app/areas'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import type { GroupItem } from '../../components/RestaurantGroup'
import { ago, scheduledLabel } from '../tickets/tickets'
import type { useOpsDashboard } from './useOpsDashboard'

type DashboardTicket = NonNullable<ReturnType<typeof useOpsDashboard>['data']>[number]

/**
 * A restaurant panel's cards, as the Ops dashboard and leadership's Open tickets both draw
 * them (OT-179): urgent ones, and the one open beside the list, stay while the panel is
 * closed. `to` is where a card opens (none under View as) and `worker` names who is on it.
 */
export function ticketItems(
  tickets: DashboardTicket[],
  {
    to,
    worker,
    openInPane,
  }: {
    to: (t: DashboardTicket) => string | undefined
    worker: (t: DashboardTicket) => string | null
    openInPane: (to: string | undefined) => boolean
  },
): GroupItem[] {
  return tickets.map((t) => {
    const path = to(t)
    return {
      key: t.id,
      pinned: t.urgency === 'urgent' || openInPane(path),
      node: (
        <OpsTicketCard
          to={path}
          displayId={t.display_id ?? ''}
          title={t.title}
          status={t.status}
          statusLabel={t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined}
          urgent={t.urgency === 'urgent'}
          walkthrough={t.source === 'walkthrough'}
          createdAt={t.created_at}
          meta={[...ticketPlace(t), ago(new Date(t.created_at), new Date())].filter(Boolean).join(' · ')}
          worker={worker(t)}
        />
      ),
    }
  })
}
