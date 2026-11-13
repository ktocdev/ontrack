import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { OverflowMenu } from '../../components/Menu'
import { CountBadge } from '../../components/Pill'
import { AllRestaurantsSquare, RestaurantName } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader, UnderlineTabs } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TicketCard } from '../../components/TicketCard'
import { IconCheckCircle, IconPlus, IconWarning } from '../../components/icons'
import { activityLine, AREA_LABEL, scheduledLabel } from './tickets'
import { expectNothingOpen, useOpenTickets } from './useOpenTickets'

/**
 * Manager · Open tickets (design/screens/Main, Empty-Manager-Tickets). The tickets
 * at the person's restaurants in one list. The boards' search and Front / Back are
 * left out (from feedback, OT-63): a manager has few tickets, and they pushed the
 * list down. With nothing open at all it is only the title and the empty state; the
 * In-house tab stays if tasks are waiting there. It loads in whichever of those
 * layouts it found last time on this device. A manager with more than one
 * restaurant sees which one each card is for. The boards' QR buttons wait for
 * Phase 4, when a scan has something to open. The menu beside the title, which no
 * board draws, leads to closed tickets. Under View as, nothing here leads anywhere
 * or changes anything.
 */
export function OpenTicketsScreen() {
  const { restaurants, viewingAs } = useUser()
  const { data, isPending, isError, refetch } = useOpenTickets(restaurants.map((r) => r.id))

  const only = restaurants.length === 1 ? restaurants[0] : undefined
  const colorOf = new Map(restaurants.map((r) => [r.id, r]))
  const all = data?.tickets ?? []
  const noneAtAll = data !== undefined && all.length === 0
  // Loads in the layout it expects, so an empty list doesn't jump when it arrives.
  const [expectEmpty] = useState(() => expectNothingOpen(restaurants.map((r) => r.id)))
  const waitingForEmpty = isPending && expectEmpty
  const inHouseCount = data?.inHouseCount ?? 0
  const menu = viewingAs ? null : (
    <OverflowMenu label="More ticket options" items={[{ to: '/tickets/closed', label: 'View Closed Tickets' }]} />
  )

  return (
    <Screen>
      <ScreenHeader
        title="Open tickets"
        topLeft={
          only ? (
            <RestaurantName name={only.name} color={only.color} />
          ) : (
            <span className="flex items-center gap-1.5 text-14 font-semibold">
              <AllRestaurantsSquare colors={restaurants.map((r) => r.color)} />
              {restaurants.length} restaurants
            </span>
          )
        }
        topRight={<ProfileLink />}
        action={menu}
      >
        {!isError && !waitingForEmpty && (!noneAtAll || inHouseCount > 0) && (
          <UnderlineTabs
            size="lg"
            label="Ticket or in-house view"
            className="-mt-1"
            inert={viewingAs}
            items={[
              {
                to: '/tickets',
                end: true,
                label: (
                  <>
                    Tickets <CountBadge count={all.length} active />
                  </>
                ),
              },
              {
                to: '/tickets/in-house',
                label: (
                  <>
                    In-house <CountBadge count={inHouseCount} />
                  </>
                ),
              },
            ]}
          />
        )}
      </ScreenHeader>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load your tickets"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : noneAtAll ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={20}
            icon={<IconCheckCircle size={30} />}
            title="No open tickets"
            body={`Everything at ${only?.name ?? 'your restaurants'} is working. When something breaks, create a ticket.`}
          >
            {!viewingAs && (
              <ButtonLink to="/tickets/new" variant="medium" className="w-full" icon={<IconPlus size={18} />}>
                Create ticket
              </ButtonLink>
            )}
          </EmptyState>
        </ScreenEmpty>
      ) : waitingForEmpty ? (
        <div className="flex-1" />
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton />
          ) : (
            all.map((t) => {
              const place = only ? undefined : colorOf.get(t.restaurant_id)
              return (
                <TicketCard
                  key={t.id}
                  to={viewingAs ? undefined : `/tickets/${t.id}`}
                  displayId={t.display_id ?? ''}
                  title={t.title}
                  status={t.status}
                  statusLabel={
                    t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                  }
                  walkthrough={t.source === 'walkthrough'}
                  place={[t.category && AREA_LABEL[t.category.area], t.category?.name, t.equipment?.name]
                    .filter(Boolean)
                    .join(' · ')}
                  restaurant={place}
                  who={t.assignee ? `${t.assignee.full_name} is on it` : 'Not picked up yet'}
                  when={activityLine(t)}
                  createdAt={t.created_at}
                />
              )
            })
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}
