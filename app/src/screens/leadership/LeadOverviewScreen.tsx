import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ticketPlace } from '../../app/areas'
import { ticketPath } from '../../app/roles'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Kpi } from '../../components/Kpi'
import { MonthStepper } from '../../components/MonthStepper'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { MetricsSkeleton } from '../../components/Skeleton'
import { TicketCard } from '../../components/TicketCard'
import { IconChart, IconWarning } from '../../components/icons'
import { monthKey, monthName } from '../ops/closedMonths'
import { money } from '../tickets/closed'
import { scheduledLabel } from '../tickets/tickets'
import { NewTicketButton } from './NewTicketButton'
import { LeadershipHeader } from './LeadershipHeader'
import { addMonths, closeTime, monthBounds, overviewFor, type OverviewRow } from './overview'
import { useFiledByYou } from './useFiledByYou'
import { useOverview } from './useOverview'

/**
 * Leadership · Overview (design/screens/Exec-Overview, OT-143), read-only. Open tickets
 * and Urgent are what is open now, as on the Ops dashboard; Spend (every visit, OT-142) and
 * the average time to close are the month's. A row per restaurant, most spent first, with a
 * bar against the most and what is open there, opening the restaurant. The boards draw no
 * way between months, but the empty state's "See September" changes it, so the Ops
 * walkthroughs overview's stepper sits under the title, from the earliest month with
 * anything recorded to this one, and the month is in the address (?month=2026-10). Scoped by useUser(), so View as shows the person viewed.
 *
 * Leadership files tickets (OT-170): New ticket beside the title, picking the restaurant on
 * Create ticket, and Filed by you under the restaurants, their open tickets, each opening
 * beside the Overview on a laptop. No board draws either; where Filed by you sits is a first
 * try. Under View as there is no New ticket and the cards open nothing.
 *
 * From feedback (Nov 24, 2026): Open tickets and Urgent open those tickets, every restaurant's
 * in its own panel (LeadTicketsScreen), as the Ops dashboard shows them, and Spend opens what
 * it adds up for the same month (LeadSpendScreen, OT-178), for a reader who sees costs.
 */
export function LeadOverviewScreen() {
  const { user, restaurants, viewingAs } = useUser()
  const ids = useMemo(() => restaurants.map((r) => r.id), [restaurants])
  const overview = useOverview(ids)
  const [params, setParams] = useSearchParams()
  // This month, once per visit, so a render reads no clock.
  const [current] = useState(() => monthKey(new Date()))
  const { earliest, latest } = monthBounds(overview.data?.months ?? [], current)
  const asked = params.get('month')
  const wanted = asked && /^\d{4}-\d{2}$/.test(asked) ? `${asked}-01` : null
  const month = wanted && wanted >= earliest && wanted <= latest ? wanted : current
  const older = month > earliest ? addMonths(month, -1) : undefined
  const newer = month < latest ? addMonths(month, 1) : undefined
  const go = (m: string) => setParams(m === current ? {} : { month: m.slice(0, 7) }, { replace: true })
  const name = monthName(month)
  const spendPath = month === current ? '/lead/spend' : `/lead/spend?month=${month.slice(0, 7)}`

  const header = (
    <LeadershipHeader title="Overview" action={<NewTicketButton back="/lead" />}>
      <MonthStepper month={month} older={older} newer={newer} onGo={go} />
    </LeadershipHeader>
  )

  if (overview.isError) {
    return (
      <Screen>
        {header}
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the overview"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void overview.refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  }

  if (!overview.data) {
    return (
      <Screen>
        {header}
        <ScreenBody className="pb-6 pt-1">
          <MetricsSkeleton label={`By restaurant · ${name}`} />
        </ScreenBody>
      </Screen>
    )
  }

  const o = overviewFor(overview.data.months, overview.data.open, restaurants, month)
  const most = Math.max(0, ...o.rows.map((r) => r.spendCents))
  return (
    <Screen>
      {header}
      <ScreenBody className="gap-3 pb-6 pt-1">
        <div className="grid flex-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <Kpi
            size="large"
            value={String(o.open)}
            label="Open tickets"
            tone={o.open ? 'default' : 'muted'}
            to={viewingAs ? undefined : '/lead/tickets'}
          />
          <Kpi
            size="large"
            value={String(o.urgent)}
            label="Urgent"
            tone={o.urgent ? 'urgent' : 'muted'}
            to={viewingAs ? undefined : '/lead/tickets?show=urgent'}
          />
          <Kpi
            size="large"
            value={o.spendCents === null ? '—' : money(o.spendCents)}
            label={`Spend · ${name}`}
            tone={o.spendCents ? 'default' : 'muted'}
            to={viewingAs || o.spendCents === null ? undefined : spendPath}
          />
          <Kpi
            size="large"
            value={closeTime(o.closeSeconds)}
            label="Avg. time to close"
            tone={o.closeSeconds === null ? 'muted' : 'default'}
          />
        </div>
        <h2 className="eyebrow flex-none">By restaurant · {name}</h2>
        {o.quiet ? (
          <EmptyState
            titleSize={20}
            icon={<IconChart size={30} />}
            title="No activity this month"
            body={`No tickets have been opened or closed in ${name}. Ticket counts and spend for each restaurant show up here as your teams log work.`}
          >
            {older && (
              <Button variant="small" className="w-full" onClick={() => go(older)}>
                See {monthName(older)}
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="flex-none overflow-hidden rounded-input border border-border bg-surface">
            {o.rows.map((r) => (
              <RestaurantRow key={r.id} row={r} most={most} seesCosts={o.spendCents !== null} linked={!viewingAs} />
            ))}
          </div>
        )}
        <FiledByYou userId={user.id} linked={!viewingAs} />
      </ScreenBody>
    </Screen>
  )
}

/** The open tickets this person filed, at every restaurant; nothing at all while there are none. */
function FiledByYou({ userId, linked }: { userId: string; linked: boolean }) {
  const { data } = useFiledByYou(userId)
  if (!data?.length) return null
  return (
    <section aria-label="Filed by you" className="flex flex-none flex-col gap-2.5">
      <h2 className="eyebrow pt-2">Filed by you · {data.length}</h2>
      {data.map((t) => (
        <TicketCard
          key={t.id}
          to={linked ? ticketPath('leadership', t.id) : undefined}
          displayId={t.display_id ?? ''}
          title={t.title}
          status={t.status}
          statusLabel={t.status === 'scheduled' && t.scheduled_for ? scheduledLabel(t.scheduled_for) : undefined}
          walkthrough={t.source === 'walkthrough'}
          restaurant={t.restaurant ?? undefined}
          place={ticketPlace(t).join(' · ')}
          createdAt={t.created_at}
        />
      ))}
    </section>
  )
}

/** A restaurant's month: name and spend, a bar against the most spent, and what is open now. */
function RestaurantRow({
  row,
  most,
  seesCosts,
  linked,
}: {
  row: OverviewRow
  most: number
  seesCosts: boolean
  /** Under View as nothing leads away from the home screen. */
  linked: boolean
}) {
  const counts = [`${row.open} open`, row.urgent ? `${row.urgent} urgent` : null].filter(Boolean).join(' · ')
  const cls = 'flex flex-col gap-1.5 border-t border-surface-muted px-3.5 py-3 text-text first:border-t-0'
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-15 font-semibold">
          <RestaurantSquare color={row.color} size={10} />
          <span className="truncate">{row.name}</span>
        </span>
        {seesCosts && <span className="flex-none text-14 font-bold">{money(row.spendCents)}</span>}
      </span>
      {seesCosts && (
        <span className="block h-1.5 rounded-[3px]" aria-hidden="true">
          <span
            className="block h-full rounded-[3px]"
            style={{ background: row.color, width: most ? `${(row.spendCents / most) * 100}%` : 0 }}
          />
        </span>
      )}
      <span className="text-12 text-text-muted">{counts}</span>
    </>
  )
  return linked ? (
    <Link
      to={`/lead/restaurants/${row.id}`}
      className={`${cls} no-underline transition-colors hover:bg-surface-hover hover:text-text active:bg-surface-hover active:duration-0`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
