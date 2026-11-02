import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { TabAlert } from '../../components/Pill'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenHeader, UnderlineTabs } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { IconCheckCircle, IconWarning } from '../../components/icons'
import { ago, scheduledLabel } from '../tickets/tickets'
import { dashboardPill } from './dashboard'
import { useOpsDashboard } from './useOpsDashboard'
import { useRestaurantScope } from './useRestaurantScope'

/**
 * Ops · Dashboard (design/screens/Ops-Dashboard, Empty-Ops-Dashboard). The open work at
 * the picked restaurants, reopened tickets on top and then most urgent first. As the
 * board counts them, Open and All leave out reopened tickets, which the Closed tab's
 * badge counts. The filter sheet comes in OT-38. Under View as, nothing leads anywhere.
 */
const AREA_SHORT = { foh: 'FOH', boh: 'BOH' }

type Whose = 'all' | 'mine'

export function OpsDashboardScreen() {
  const { user, restaurants, viewingAs } = useUser()
  const scope = useRestaurantScope()
  const { data, isPending, isError, refetch } = useOpsDashboard(scope.ids)
  const [whose, setWhose] = useState<Whose>('all')

  const open = data?.open ?? []
  const reopened = data?.reopened ?? []
  const mine = open.filter((t) => t.assignee_id === user.id)
  const nothing = data !== undefined && open.length === 0 && reopened.length === 0
  const shownReopened = whose === 'mine' ? reopened.filter((t) => t.assignee_id === user.id) : reopened
  const shown = whose === 'mine' ? mine : open
  const placeOf = new Map(restaurants.map((r) => [r.id, r]))

  const card = (t: (typeof open)[number]) => (
    <OpsTicketCard
      key={t.id}
      to={viewingAs ? undefined : `/ops/tickets/${t.id}`}
      displayId={t.display_id ?? ''}
      title={t.title}
      status={dashboardPill(t.status, t.assignee_id)}
      statusLabel={t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined}
      urgent={t.urgency === 'urgent'}
      walkthrough={t.source === 'walkthrough'}
      restaurant={placeOf.get(t.restaurant_id)}
      meta={[t.category && AREA_SHORT[t.category.area], t.category?.name, ago(new Date(t.activity), new Date())]
        .filter(Boolean)
        .join(' · ')}
      assignee={
        t.assignee && t.assignee_id
          ? { name: t.assignee.full_name, role: t.assignee.role, mine: t.assignee_id === user.id }
          : null
      }
      reason={data?.reasons.get(t.id)}
    />
  )

  return (
    <Screen>
      <ScreenHeader
        title="Dashboard"
        className="pb-0!"
        topLeft={
          <RestaurantPicker restaurants={restaurants} selectedId={scope.selected?.id ?? null} onSelect={scope.select} />
        }
        topRight={<ProfileLink />}
      >
        <UnderlineTabs
          label="Ticket status"
          inert={viewingAs}
          items={[
            { to: '/ops', end: true, label: `Open · ${open.length}` },
            {
              to: '/ops/closed',
              label: (
                <>
                  Closed
                  {reopened.length > 0 && (
                    <TabAlert
                      count={reopened.length}
                      label={`${reopened.length} reopened ${reopened.length === 1 ? 'ticket' : 'tickets'}`}
                    />
                  )}
                </>
              ),
            },
          ]}
        />
      </ScreenHeader>

      {isError ? (
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
      ) : nothing ? (
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
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-3">
          <div className="flex flex-none items-center justify-between gap-3">
            <Segmented
              fit
              size="sm"
              label="Whose tickets"
              value={whose}
              onChange={setWhose}
              options={[
                { value: 'all', label: `All · ${open.length}` },
                { value: 'mine', label: `Mine · ${mine.length}` },
              ]}
            />
          </div>
          {isPending ? (
            <CardFeedSkeleton />
          ) : shown.length === 0 && shownReopened.length === 0 ? (
            <p className="px-3 py-7 text-center text-14 leading-normal text-text-secondary">
              Nothing is assigned to you right now.
            </p>
          ) : (
            <>
              {shownReopened.map(card)}
              {shown.map(card)}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}
