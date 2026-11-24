import { ticketPlace } from '../../app/areas'
import { lazy, Suspense, useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useIsOpenInPane } from '../../app/SplitView'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { HiddenCategories } from '../../components/HiddenCategories'
import { OverflowMenu } from '../../components/Menu'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { RestaurantGroup } from '../../components/RestaurantGroup'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TaskListEmpty } from '../../components/TaskRow'
import { IconCheckCircle, IconWarning } from '../../components/icons'
import { ago, scheduledLabel } from '../tickets/tickets'
import { useJobTitleName } from '../jobtitles/useJobTitles'
import { listed, useListView } from '../mycategories/useMyCategories'
import { groupByRestaurant, sortGroups } from './dashboard'
import { useDashboardOpen } from './useDashboardOpen'
import { useOpsDashboard } from './useOpsDashboard'
import { useRestaurantOrder } from './useRestaurantOrder'
import { useRestaurantScope } from './useRestaurantScope'
import { useRestaurantSort } from './useRestaurantSort'

/**
 * Ops · Dashboard (from design/screens/Ops-Dashboard, Empty-Ops-Dashboard, simplified
 * from feedback). The open work under each restaurant's label, since an Ops manager
 * goes from one restaurant to the next through the day. Under each label, urgent is
 * always on top, then Front of House before Back, then the oldest, and the time on a
 * card is how long ago it was opened, so the order can be read. Nobody assigns a ticket: it is picked up by
 * marking it In progress, and a badge says who else is on it. Closed tickets are in the menu
 * by the title, as on a manager's Open tickets. The categories someone hides in My
 * categories are left off, apart from tickets they are on, with the line that says so and
 * Show all (OT-118). Under View as, nothing leads anywhere, and the viewed person's
 * settings apply.
 *
 * From feedback (Nov 23, 2026), to read at a glance in the morning: each restaurant is a
 * row with its name, how many are open and how many urgent. It starts closed each day,
 * still showing its urgent tickets (and the one open beside the list on a laptop); one
 * opened stays open on this device until the next day (useDashboardOpen). With one
 * restaurant picked, its row is simply open.
 *
 * From feedback (Nov 24, 2026): the restaurants come in the order picked on Sort
 * restaurants (Most urgent, Ticket count, or the person's own), counting what each lists.
 */

const RestaurantSortSheet = lazy(() => import('./RestaurantSortSheet'))

export function OpsDashboardScreen() {
  const { user, restaurants, viewingAs } = useUser()
  const titleName = useJobTitleName()
  // The badge names who is on a ticket, with their job title when they have one (OT-117).
  const workerName = (p: { full_name: string; job_title_id: string | null }) => {
    const title = titleName(p.job_title_id)
    return title ? `${p.full_name} · ${title}` : p.full_name
  }
  const scope = useRestaurantScope()
  const { ordered, reorder } = useRestaurantOrder()
  const { sort, choose } = useRestaurantSort()
  const [sorting, setSorting] = useState(false)
  const rows = useDashboardOpen(!viewingAs)
  const openInPane = useIsOpenInPane()
  const { data, isPending, isError, refetch } = useOpsDashboard(scope.ids)

  const view = useListView()
  const inScope = scope.selected ? [scope.selected] : ordered
  const groups = sortGroups(
    groupByRestaurant(
      (data ?? []).filter((t) => view.shows(listed(t))),
      inScope,
    ),
    sort,
  )

  return (
    <Screen>
      <ScreenHeader
        title="Dashboard"
        topLeft={
          <RestaurantPicker restaurants={ordered} selectedId={scope.selected?.id ?? null} onSelect={scope.select} />
        }
        topRight={<ProfileLink />}
        action={
          viewingAs ? undefined : (
            <OverflowMenu
              label="More ticket options"
              items={[
                { to: '/ops/closed', label: 'View Closed Tickets' },
                { to: '/ops/in-house', label: 'In-house tasks' },
                ...(restaurants.length > 1 ? [{ onSelect: () => setSorting(true), label: 'Sort restaurants' }] : []),
              ]}
            />
          )
        }
      />

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the dashboard"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : data?.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={22}
            icon={<IconCheckCircle size={30} />}
            title="All caught up"
            body={
              <>
                No open tickets{' '}
                {scope.selected ? `at ${scope.selected.name}` : `across your ${restaurants.length} restaurants`}.
                <br />
                New tickets show up here, most urgent first.
              </>
            }
          >
            {!viewingAs && (
              <ButtonLink to="/ops/closed" variant="secondary" className="w-full">
                View closed tickets
              </ButtonLink>
            )}
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-3 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton />
          ) : (
            <>
              <HiddenCategories count={view.hidden} showAll={view.showAll} onShowAll={view.setShowAll} />
              {groups.length === 0 && (
                <TaskListEmpty>Nothing open in the categories you show. Show all lists the rest.</TaskListEmpty>
              )}
              {groups.map(({ restaurant, tickets }) => (
                <RestaurantGroup
                  key={restaurant.id}
                  name={restaurant.name}
                  color={restaurant.color}
                  open={rows.isOpen(restaurant.id)}
                  onToggle={scope.selected ? undefined : () => rows.toggle(restaurant.id)}
                  openCount={tickets.length}
                  urgentCount={tickets.filter((t) => t.urgency === 'urgent').length}
                  items={tickets.map((t) => {
                    const to = viewingAs ? undefined : `/ops/tickets/${t.id}`
                    return {
                      key: t.id,
                      pinned: t.urgency === 'urgent' || openInPane(to),
                      node: (
                        <OpsTicketCard
                          to={to}
                          displayId={t.display_id ?? ''}
                          title={t.title}
                          status={t.status}
                          statusLabel={
                            t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                          }
                          urgent={t.urgency === 'urgent'}
                          walkthrough={t.source === 'walkthrough'}
                          createdAt={t.created_at}
                          meta={[...ticketPlace(t), ago(new Date(t.created_at), new Date())]
                            .filter(Boolean)
                            .join(' · ')}
                          worker={t.assignee_id === user.id || !t.assignee ? null : workerName(t.assignee)}
                        />
                      ),
                    }
                  })}
                />
              ))}
            </>
          )}
        </ScreenBody>
      )}
      {sorting && (
        <Suspense fallback={null}>
          <RestaurantSortSheet
            open
            onOpenChange={setSorting}
            sort={sort}
            onSort={choose}
            restaurants={ordered}
            onReorder={reorder}
          />
        </Suspense>
      )}
    </Screen>
  )
}
