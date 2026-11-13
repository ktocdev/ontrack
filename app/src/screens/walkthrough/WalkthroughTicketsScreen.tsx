import { useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { BackBar, Screen, ScreenBody } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { WalkthroughTicketRow } from '../../components/Walkthrough'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useChecklist } from './useChecklist'
import { ticketPath, useWalkthroughTickets } from './useReview'
import { monthName, quarterOf } from './walkthrough'

const SECTION = 'text-12 font-bold uppercase tracking-[.06em] text-text-secondary'

/**
 * Walkthrough · Tickets (design/screens/WT-Tickets-All), opened from Review's Tickets
 * count: every ticket made on the walkthrough, its number and URGENT, its title, its status,
 * and the item or task it came from. One still open opens the walkthrough's Edit ticket.
 */
export function WalkthroughTicketsScreen() {
  const { id = '' } = useParams()
  const { viewingAs } = useUser()
  const checklist = useChecklist(id)
  const tickets = useWalkthroughTickets(id)
  const back = `/walkthrough/${id}/review`

  if (checklist.isPending || tickets.isPending) {
    return (
      <Screen>
        <BackBar to={back} label="Back to review" />
        <ScreenBody className="pb-4 pt-1">
          <CardFeedSkeleton label="Loading tickets" />
        </ScreenBody>
      </Screen>
    )
  }
  if (checklist.isError || !checklist.data) return <NotFoundScreen />
  const w = checklist.data.walkthrough
  const all = tickets.data ?? []

  return (
    <Screen>
      <BackBar to={back} label="Back to review" roomy>
        <span className="block text-12 text-text-secondary">
          {monthName(w.period)} walkthrough · {w.restaurantName}
        </span>
        <h1 className="font-display text-20 font-bold text-text">Tickets</h1>
      </BackBar>
      <ScreenBody className="gap-2.5 pb-4 pt-2">
        <div className="flex flex-none items-baseline justify-between">
          <span className={SECTION}>Tickets created · {all.length}</span>
          {all.length > 0 && !viewingAs && <span className="text-12 text-text-secondary">Tap to edit or close</span>}
        </div>
        {all.length > 0 ? (
          <div className="flex-none overflow-hidden rounded-card border border-border bg-surface">
            {all.map((t) => (
              <WalkthroughTicketRow
                key={t.id}
                to={viewingAs ? undefined : ticketPath(w.id, t)}
                displayId={t.displayId}
                title={t.title}
                urgent={t.urgent}
                status={t.status}
                where={
                  t.section && t.item
                    ? `${t.section.short} › ${t.item.group} › ${t.item.title}`
                    : t.task
                      ? `${quarterOf(w.period)} · ${t.task}`
                      : 'From this walkthrough'
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex-none rounded-input border border-border bg-surface px-4 py-[18px] text-14 leading-[1.45] text-text-secondary">
            No tickets from this walkthrough yet.
          </div>
        )}
      </ScreenBody>
    </Screen>
  )
}
