import { AREA_SHORT } from '../../app/areas'
import { lazy, Suspense, useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { HiddenCategories } from '../../components/HiddenCategories'
import { OverflowMenu } from '../../components/Menu'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { RestaurantSquare } from '../../components/RestaurantName'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TaskListEmpty } from '../../components/TaskRow'
import { IconCheckCircle, IconWarning } from '../../components/icons'
import { ago, scheduledLabel } from '../tickets/tickets'
import { useJobTitleName } from '../jobtitles/useJobTitles'
import { listed, useListView } from '../mycategories/useMyCategories'
import { groupByRestaurant } from './dashboard'
import { useOpsDashboard } from './useOpsDashboard'
import { useRestaurantOrder } from './useRestaurantOrder'
import { useRestaurantScope } from './useRestaurantScope'

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
 */

const RestaurantOrderSheet = lazy(() => import('./RestaurantOrderSheet'))

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
  const [reordering, setReordering] = useState(false)
  const { data, isPending, isError, refetch } = useOpsDashboard(scope.ids)

  const view = useListView()
  const inScope = scope.selected ? [scope.selected] : ordered
  const groups = groupByRestaurant(
    (data ?? []).filter((t) => view.shows(listed(t))),
    inScope,
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
                ...(restaurants.length > 1
                  ? [{ onSelect: () => setReordering(true), label: 'Reorder restaurants' }]
                  : []),
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
        <ScreenBody className="gap-5 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton />
          ) : (
            <>
              <HiddenCategories
                count={view.hidden}
                showAll={view.showAll}
                onShowAll={view.setShowAll}
                className="-mb-3"
              />
              {groups.length === 0 && (
                <TaskListEmpty>Nothing open in the categories you show. Show all lists the rest.</TaskListEmpty>
              )}
              {groups.map(({ restaurant, tickets }) => (
                <section key={restaurant.id} aria-label={restaurant.name} className="flex flex-none flex-col gap-2.5">
                  <h2 className="eyebrow flex items-center gap-1.5">
                    <RestaurantSquare color={restaurant.color} />
                    <span className="min-w-0 truncate">
                      {restaurant.name} · {tickets.length}
                    </span>
                  </h2>
                  {tickets.map((t) => (
                    <OpsTicketCard
                      key={t.id}
                      to={viewingAs ? undefined : `/ops/tickets/${t.id}`}
                      displayId={t.display_id ?? ''}
                      title={t.title}
                      status={t.status}
                      statusLabel={
                        t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined
                      }
                      urgent={t.urgency === 'urgent'}
                      walkthrough={t.source === 'walkthrough'}
                      createdAt={t.created_at}
                      meta={[
                        t.category && AREA_SHORT[t.category.area],
                        t.category?.name,
                        ago(new Date(t.created_at), new Date()),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      worker={t.assignee_id === user.id || !t.assignee ? null : workerName(t.assignee)}
                    />
                  ))}
                </section>
              ))}
            </>
          )}
        </ScreenBody>
      )}
      {reordering && (
        <Suspense fallback={null}>
          <RestaurantOrderSheet open onOpenChange={setReordering} restaurants={ordered} onChange={reorder} />
        </Suspense>
      )}
    </Screen>
  )
}
