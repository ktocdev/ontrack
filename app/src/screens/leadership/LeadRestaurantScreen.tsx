import { ticketPath } from '../../app/roles'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { AREA_SEGMENTS, ticketPlace } from '../../app/areas'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { EquipmentRow } from '../../components/Equipment'
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner'
import { RestaurantTitlePicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty, UnderlineTabs } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TicketCard } from '../../components/TicketCard'
import { IconCheckCircle, IconWarning, IconWrench } from '../../components/icons'
import { shortDay } from '../../lib/words'
import type { Area } from '../equipment/equipment'
import { EquipmentByArea, useEquipmentByArea } from '../equipment/EquipmentByArea'
import { useEquipmentList } from '../equipment/useEquipmentList'
import { money } from '../tickets/closed'
import { scheduledLabel } from '../tickets/tickets'
import { NewTicketButton } from './NewTicketButton'
import { useLeadRestaurant } from './useLeadRestaurant'

/**
 * /lead/restaurants: the restaurant asked for (?restaurant=, as the Overview's rows used to
 * link), else the first in scope.
 */
export function LeadRestaurantsIndex() {
  const { restaurants } = useUser()
  const [params] = useSearchParams()
  const pick = restaurants.find((r) => r.id === params.get('restaurant')) ?? restaurants[0]
  return pick ? <Navigate to={`/lead/restaurants/${pick.id}`} replace /> : <LeadRestaurantScreen tab="tickets" />
}

/**
 * Leadership · Restaurant view (design/screens/Exec-Restaurant, Empty-Exec-Restaurant,
 * OT-144), read-only. The restaurant is the title, picking another; under it the Reporters
 * whose home it is, by the group's name for the role. Open tickets: each card with where it
 * belongs and what has been logged on it, opening the ticket by its lasting link; with none,
 * when the last one closed. Equipment, which no board draws: the units by area and type, as
 * a Reporter browses them, opening nothing, since no board draws leadership's unit page.
 * New ticket beside the title files one here (OT-170), and comes back to this page.
 */
export function LeadRestaurantScreen({ tab }: { tab: 'tickets' | 'equipment' }) {
  const { restaurants } = useUser()
  const { id } = useParams()
  const navigate = useNavigate()
  const roles = useRoleNames()
  const restaurant = restaurants.find((r) => r.id === id)
  const data = useLeadRestaurant(restaurant?.id)

  if (!restaurant) {
    return restaurants[0] ? <Navigate to={`/lead/restaurants/${restaurants[0].id}`} replace /> : null
  }
  const base = `/lead/restaurants/${restaurant.id}`
  const open = data.data?.tickets.length
  const reporters = data.data?.reporters ?? []

  return (
    <Screen>
      <ReadOnlyBanner />
      <header className="flex flex-none flex-col gap-3.5 px-screen pt-[18px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <RestaurantTitlePicker
                restaurants={restaurants}
                selected={restaurant}
                onSelect={(r) => navigate(`/lead/restaurants/${r}${tab === 'equipment' ? '/equipment' : ''}`)}
              />
            </div>
            <NewTicketButton restaurantId={restaurant.id} back={base} />
          </div>
          {reporters.length > 0 && (
            <span className="text-13 text-text-secondary">
              {roles.name('manager')}: {reporters.join(', ')}
            </span>
          )}
        </div>
        <UnderlineTabs
          label="Restaurant sections"
          items={[
            { to: base, label: open === undefined ? 'Open tickets' : `Open tickets · ${open}`, end: true },
            { to: `${base}/equipment`, label: 'Equipment' },
          ]}
        />
      </header>
      {tab === 'tickets' ? (
        <OpenTickets name={restaurant.name} query={data} />
      ) : (
        <Equipment restaurantId={restaurant.id} />
      )}
    </Screen>
  )
}

function OpenTickets({ name, query }: { name: string; query: ReturnType<typeof useLeadRestaurant> }) {
  const seesCosts = useRight('see_costs') === true
  if (query.isError) {
    return (
      <ScreenEmpty>
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load the tickets"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </EmptyState>
      </ScreenEmpty>
    )
  }
  if (!query.data) {
    return (
      <ScreenBody className="pb-4 pt-3.5">
        <CardFeedSkeleton />
      </ScreenBody>
    )
  }
  const { tickets, lastClosedAt } = query.data
  if (tickets.length === 0) {
    return (
      <ScreenEmpty>
        <EmptyState
          titleSize={20}
          icon={<IconCheckCircle size={30} />}
          title="No open tickets"
          body={`Nothing needs attention at ${name} right now.${lastClosedAt ? ` Last ticket closed ${shortDay(lastClosedAt)}.` : ''}`}
        />
      </ScreenEmpty>
    )
  }
  return (
    <ScreenBody className="gap-2.5 pb-4 pt-3.5">
      {tickets.map((t) => (
        <TicketCard
          key={t.id}
          // Leadership's own ticket route, so on a laptop it opens beside this list (OT-159).
          to={ticketPath('leadership', t.id)}
          displayId={t.display_id ?? ''}
          title={t.title}
          status={t.status}
          statusLabel={t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined}
          walkthrough={t.source === 'walkthrough'}
          place={[...ticketPlace(t), seesCosts ? (t.costCents ? `${money(t.costCents)} logged` : 'No cost yet') : null]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </ScreenBody>
  )
}

function Equipment({ restaurantId }: { restaurantId: string }) {
  const { data, isPending, isError, refetch } = useEquipmentList([restaurantId], null)
  const view = useEquipmentByArea(data ?? [])
  if (isError) {
    return (
      <ScreenEmpty>
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load equipment"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      </ScreenEmpty>
    )
  }
  if (!isPending && (data ?? []).length === 0) {
    return (
      <ScreenEmpty>
        <EmptyState
          titleSize={20}
          icon={<IconWrench size={30} />}
          title="No equipment yet"
          body="The operations team adds equipment. Once they do, it shows up here, grouped by area."
        />
      </ScreenEmpty>
    )
  }
  return (
    <ScreenBody className="gap-2.5 pb-4 pt-3.5">
      <Segmented<Area> label="Area" value={view.area} onChange={view.pick} options={AREA_SEGMENTS} />
      <EquipmentByArea
        view={view}
        isPending={isPending}
        row={(u) => <EquipmentRow key={u.id} name={u.name} brand={u.brand} serial={u.serial} openCount={u.openCount} />}
      />
    </ScreenBody>
  )
}
