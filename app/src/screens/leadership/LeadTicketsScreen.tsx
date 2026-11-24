import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ticketPlace } from '../../app/areas'
import { ticketPath } from '../../app/roles'
import { useIsOpenInPane } from '../../app/SplitView'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { OverflowMenu } from '../../components/Menu'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { RestaurantGroup } from '../../components/RestaurantGroup'
import { Screen, ScreenBody, ScreenEmpty, TitleBar } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { IconCheckCircle, IconWarning } from '../../components/icons'
import { useJobTitleName } from '../jobtitles/useJobTitles'
import { useFirstArea } from '../mycategories/useFirstArea'
import { byPriorityFrom, groupByRestaurant, sortGroups } from '../ops/dashboard'
import { useOpsDashboard } from '../ops/useOpsDashboard'
import { useRestaurantOrder } from '../ops/useRestaurantOrder'
import { useRestaurantSort } from '../ops/useRestaurantSort'
import { ago, scheduledLabel } from '../tickets/tickets'

const RestaurantSortSheet = lazy(() => import('../ops/RestaurantSortSheet'))

type Show = 'open' | 'urgent'

/**
 * Leadership · Tickets (from feedback, Nov 24, 2026; no board): what the Overview's Open
 * tickets and Urgent count, every restaurant's open tickets in its own panel as the Ops
 * dashboard shows them, with All open or Urgent only on top (`?show=urgent`). The same
 * Sort restaurants sheet orders the panels and picks Show first inside them. Every panel
 * starts open, since they came here to read the tickets; a tap on a row closes it for the
 * visit. Every ticket shows, whatever My categories hides, so the counts match the
 * Overview's. A ticket opens beside the list on a laptop. The Overview links here only when
 * not viewing as someone.
 */
export function LeadTicketsScreen() {
  const { restaurants } = useUser()
  const [params, setParams] = useSearchParams()
  const show: Show = params.get('show') === 'urgent' ? 'urgent' : 'open'
  const titleName = useJobTitleName()
  const workerName = (p: { full_name: string; job_title_id: string | null }) => {
    const title = titleName(p.job_title_id)
    return title ? `${p.full_name} · ${title}` : p.full_name
  }
  const { ordered, reorder } = useRestaurantOrder()
  const { sort, choose } = useRestaurantSort()
  const first = useFirstArea()
  const [sorting, setSorting] = useState(false)
  const [closed, setClosed] = useState<string[]>([])
  const openInPane = useIsOpenInPane()
  const { data, isPending, isError, refetch } = useOpsDashboard(ordered.map((r) => r.id))

  const all = data ?? []
  const urgentCount = all.filter((t) => t.urgency === 'urgent').length
  const shown = (show === 'urgent' ? all.filter((t) => t.urgency === 'urgent') : all)
    .slice()
    .sort(byPriorityFrom(first.area))
  const groups = sortGroups(groupByRestaurant(shown, ordered), sort)
  const toggle = (id: string) => setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <Screen>
      <TitleBar
        to="/lead"
        label="Back to Overview"
        title={show === 'urgent' ? 'Urgent tickets' : 'Open tickets'}
        action={
          <OverflowMenu
            label="More ticket options"
            items={[
              { onSelect: () => setSorting(true), label: restaurants.length > 1 ? 'Sort restaurants' : 'Show first' },
            ]}
          />
        }
      />
      <div className="flex-none px-screen pt-3">
        <Segmented
          label="Show"
          value={show}
          onChange={(v) => setParams(v === 'urgent' ? { show: 'urgent' } : {}, { replace: true })}
          options={[
            { value: 'open', label: data ? `All open · ${all.length}` : 'All open' },
            { value: 'urgent', label: data ? `Urgent · ${urgentCount}` : 'Urgent' },
          ]}
        />
      </div>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the tickets"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : data && groups.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={22}
            icon={<IconCheckCircle size={30} />}
            title={show === 'urgent' ? 'Nothing urgent' : 'All caught up'}
            body={
              show === 'urgent' ? 'No urgent tickets are open at any restaurant.' : 'No open tickets at any restaurant.'
            }
          />
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-3 pb-4 pt-3">
          {isPending ? (
            <CardFeedSkeleton />
          ) : (
            groups.map(({ restaurant, tickets }) => (
              <RestaurantGroup
                key={restaurant.id}
                name={restaurant.name}
                color={restaurant.color}
                open={!closed.includes(restaurant.id)}
                onToggle={() => toggle(restaurant.id)}
                openCount={tickets.length}
                urgentCount={tickets.filter((t) => t.urgency === 'urgent').length}
                items={tickets.map((t) => {
                  const to = ticketPath('leadership', t.id)
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
                        meta={[...ticketPlace(t), ago(new Date(t.created_at), new Date())].filter(Boolean).join(' · ')}
                        worker={t.assignee ? workerName(t.assignee) : null}
                      />
                    ),
                  }
                })}
              />
            ))
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
            firstArea={first.area}
            onFirstArea={first.choose}
            firstAreaFailed={first.failed}
          />
        </Suspense>
      )}
    </Screen>
  )
}
