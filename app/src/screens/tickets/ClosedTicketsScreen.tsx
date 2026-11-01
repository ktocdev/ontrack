import { Link } from 'react-router'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Screen, ScreenBody } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TicketCard } from '../../components/TicketCard'
import { IconCheckCircle, IconChevronLeft, IconWarning } from '../../components/icons'
import { longDate } from './closed'
import { AREA_LABEL } from './tickets'
import { CLOSED_LIST_LIMIT, useClosedTickets } from './useClosedTickets'

/**
 * Manager · Closed tickets, opened from the menu on Open tickets. A simple list with
 * the newest first, and no board: the boards only reach a closed ticket through
 * Equipment Tickets in Phase 4, which misses any ticket with no equipment.
 */
export function ClosedTicketsScreen() {
  const { restaurants } = useUser()
  const { data, isPending, isError, refetch } = useClosedTickets(restaurants.map((r) => r.id))
  const only = restaurants.length === 1
  const placeOf = new Map(restaurants.map((r) => [r.id, r]))

  return (
    <Screen>
      <div className="flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-5 pt-[calc(12px+var(--safe-top))]">
        <Link
          to="/tickets"
          aria-label="Back to open tickets"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <h1 className="font-display text-20 font-bold">Closed tickets</h1>
      </div>

      {isError ? (
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load your closed tickets"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      ) : data?.length === 0 ? (
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconCheckCircle size={30} />}
          title="No closed tickets yet"
          body="Tickets show up here once they're closed."
        />
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-4">
          {isPending ? (
            <CardFeedSkeleton label="Loading closed tickets" />
          ) : (
            <>
              {data.map((t) => (
                <TicketCard
                  key={t.id}
                  to={`/tickets/${t.id}?from=closed`}
                  displayId={t.display_id ?? ''}
                  title={t.title}
                  status="closed"
                  walkthrough={t.source === 'walkthrough'}
                  place={[t.category && AREA_LABEL[t.category.area], t.category?.name, t.equipment?.name]
                    .filter(Boolean)
                    .join(' · ')}
                  restaurant={only ? undefined : placeOf.get(t.restaurant_id)}
                  who={t.closer ? `Closed by ${t.closer.full_name}` : 'Closed'}
                  when={t.closed_at ? longDate(new Date(t.closed_at)) : ''}
                />
              ))}
              {data.length === CLOSED_LIST_LIMIT && (
                <p className="text-center text-12 text-text-muted">Showing the latest {CLOSED_LIST_LIMIT}.</p>
              )}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}
