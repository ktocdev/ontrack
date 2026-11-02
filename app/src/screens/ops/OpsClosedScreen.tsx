import { useState, type ReactNode } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ClosedTicketRow, MonthHeading } from '../../components/ClosedTicketRow'
import { EmptyState } from '../../components/EmptyState'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, TitleBar } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { IconTray, IconWarning } from '../../components/icons'
import { money } from '../tickets/closed'
import { monthName, shownMonths, type ClosedMonth } from './closedMonths'
import { useClosedMonth, useClosedMonths } from './useOpsClosed'
import { useRestaurantOrder } from './useRestaurantOrder'
import { useRestaurantScope } from './useRestaurantScope'

/**
 * Ops · Closed tickets (design/screens/Ops-Closed, Empty-Ops-Closed), opened from the
 * dashboard's menu instead of the boards' tab, so it has a back arrow and a title of its
 * own. This month comes first, four tickets to a month until Show more, and See <month>
 * adds the month before. The board's lines about each unit's history wait for Phase 4,
 * when there is one to see. View as never reaches this screen.
 */
const FIRST_ROWS = 4

type Restaurant = { id: string; name: string; color: string }

export function OpsClosedScreen() {
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const { data, isPending, isError, refetch } = useClosedMonths(scope.ids)
  const [extra, setExtra] = useState(0)
  const { shown, next } = shownMonths(data ?? [], extra)
  const emptyMonth = shown[0]?.closed_count === 0
  const seeNext = next && (
    <Button variant="small" className="w-full flex-none" onClick={() => setExtra(extra + 1)}>
      See {monthName(next.month)} · {next.closed_count} closed
    </Button>
  )

  return (
    <Screen>
      <TitleBar to="/ops" label="Back to dashboard" title="Closed tickets" />
      <div className="flex flex-none items-center justify-between px-screen pt-2">
        <div className="flex min-h-tap min-w-0 items-center">
          <RestaurantPicker
            restaurants={ordered}
            selectedId={scope.selected?.id ?? null}
            onSelect={(id) => {
              scope.select(id)
              setExtra(0)
            }}
          />
        </div>
        <ProfileLink />
      </div>

      {isError ? (
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load closed tickets"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      ) : isPending ? (
        <ScreenBody className="gap-2.5 pb-4 pt-4">
          <CardFeedSkeleton label="Loading closed tickets" />
        </ScreenBody>
      ) : (
        <ScreenBody className="gap-2.5 pb-4">
          {shown.map((m) => (
            <Month
              // Show more starts over when the picker changes.
              key={`${m.month} ${scope.selected?.id ?? 'all'}`}
              month={m}
              restaurantIds={scope.ids}
              restaurants={ordered}
            >
              {seeNext}
            </Month>
          ))}
          {!emptyMonth && seeNext}
        </ScreenBody>
      )}
    </Screen>
  )
}

function Month({
  month,
  restaurantIds,
  restaurants,
  children,
}: {
  month: ClosedMonth
  restaurantIds: string[]
  restaurants: Restaurant[]
  /** The way to the month before, which an empty month offers itself. */
  children: ReactNode
}) {
  const empty = month.closed_count === 0
  const { data, isPending, isError, refetch } = useClosedMonth(restaurantIds, month.month, !empty)
  const [all, setAll] = useState(false)
  const name = monthName(month.month)
  const rows = data ?? []
  const visible = all ? rows : rows.slice(0, FIRST_ROWS)
  const more = rows.length - visible.length

  return (
    <section aria-label={name} className={`flex flex-col gap-2.5 ${empty ? 'flex-1' : 'flex-none'}`}>
      <MonthHeading
        label={`${name} · ${month.closed_count} closed`}
        total={month.total_cents === null ? undefined : money(month.total_cents)}
        muted={empty}
      />
      {empty ? (
        <EmptyState
          titleSize={20}
          icon={<IconTray size={30} />}
          title="Nothing closed this month"
          body={`When you close a ticket in ${name}, it shows up here with its cost.`}
        >
          {children}
        </EmptyState>
      ) : isError ? (
        <Button variant="small" onClick={() => void refetch()}>
          Couldn&apos;t load {name}. Try again
        </Button>
      ) : isPending ? (
        <CardFeedSkeleton label={`Loading ${name}`} />
      ) : (
        <>
          <Card className="overflow-hidden rounded-input">
            {visible.map((t) => (
              <ClosedTicketRow
                key={t.id}
                to={`/ops/tickets/${t.id}`}
                title={t.title}
                displayId={t.display_id ?? ''}
                restaurant={restaurants.find((r) => r.id === t.restaurant_id)}
                date={new Date(t.last_closed_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                cost={t.totalCents === null ? undefined : money(t.totalCents)}
                reopened={t.status !== 'closed'}
              />
            ))}
          </Card>
          {more > 0 && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="min-h-tap flex-none text-14 font-semibold text-brand"
            >
              Show {more} more from {name}
            </button>
          )}
        </>
      )}
    </section>
  )
}
