import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { useOpenInPane } from '../../app/SplitView'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Kpi } from '../../components/Kpi'
import { MonthStepper } from '../../components/MonthStepper'
import { RestaurantName, RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenEmpty, TitleBar } from '../../components/Screen'
import { MetricsSkeleton } from '../../components/Skeleton'
import { IconChart, IconWarning } from '../../components/icons'
import { monthKey, monthName } from '../ops/closedMonths'
import { serviceDay } from '../service/service'
import { money } from '../tickets/closed'
import { addMonths, monthBounds } from './overview'
import { spendFor, visitCount, workerOf, type SpendLine, type SpendVisit } from './spend'
import { useLeadSpend } from './useLeadSpend'
import { useOverview } from './useOverview'

/**
 * Leadership · Spend (from feedback, Nov 24, 2026; no board): what the Overview's Spend card
 * adds up, for the same month (?month=2026-10) and the same months on the stepper. Four
 * figures (the total, the visits, contractor and in-house), then the month by restaurant, by
 * contractor (in-house work as one line) and by category, each the most spent first with a
 * bar against the most, and every visit, newest first, each opening its service record
 * beside the list on a laptop. A contractor's line opens the contractor. Built from the
 * Overview's parts; the bars are the Overview's. Needs see_costs, which the database asks
 * too. The Overview links here only when not viewing as someone.
 */
export function LeadSpendScreen() {
  const seeCosts = useRight('see_costs')
  if (seeCosts === false) return <Navigate to="/lead" replace />
  return <Spend />
}

function Spend() {
  const { restaurants, viewingAs } = useUser()
  const ids = useMemo(() => restaurants.map((r) => r.id), [restaurants])
  const overview = useOverview(ids)
  const spend = useLeadSpend(ids.length > 0)
  const [params, setParams] = useSearchParams()
  // This month, once per visit, so a render reads no clock.
  const [current] = useState(() => monthKey(new Date()))
  const { earliest, latest } = monthBounds(overview.data?.months ?? [], current)
  const asked = params.get('month')
  const wanted = asked && /^\d{4}-\d{2}$/.test(asked) ? `${asked}-01` : null
  // Until the months load, the month asked for stands, so Back keeps it however soon it is tapped.
  const month = wanted && wanted <= latest && (!overview.data || wanted >= earliest) ? wanted : current
  const older = month > earliest ? addMonths(month, -1) : undefined
  const newer = month < latest ? addMonths(month, 1) : undefined
  const go = (m: string) => setParams(m === current ? {} : { month: m.slice(0, 7) }, { replace: true })
  const name = monthName(month)
  const back = month === current ? '/lead' : `/lead?month=${month.slice(0, 7)}`

  const header = (
    <>
      <TitleBar to={back} label="Back to Overview" title="Spend" />
      <div className="flex-none px-screen pt-3">
        <MonthStepper month={month} older={older} newer={newer} onGo={go} />
      </div>
    </>
  )

  if (spend.isError || overview.isError) {
    return (
      <Screen>
        {header}
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load spend"
            body="Check your connection and try again."
          >
            <Button
              variant="small"
              className="w-full"
              onClick={() => void Promise.all([spend.refetch(), overview.refetch()])}
            >
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  }

  if (!spend.data || !overview.data) {
    return (
      <Screen>
        {header}
        <ScreenBody className="pb-6 pt-3">
          <MetricsSkeleton label={`By restaurant · ${name}`} loading="Loading spend" />
        </ScreenBody>
      </Screen>
    )
  }

  const s = spendFor(spend.data, restaurants, month)
  const most = (lines: { cents: number }[]) => Math.max(0, ...lines.map((l) => l.cents))
  const linked = !viewingAs
  return (
    <Screen>
      {header}
      <ScreenBody className="gap-3 pb-6 pt-3">
        <div className="grid flex-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <Kpi
            size="large"
            value={money(s.totalCents)}
            label={`Spend · ${name}`}
            tone={s.totalCents ? 'default' : 'muted'}
          />
          <Kpi
            size="large"
            value={String(s.visits.length)}
            label={s.missing ? `Visits · ${s.missing} missing invoice${s.missing === 1 ? '' : 's'}` : 'Visits'}
            tone={s.visits.length ? 'default' : 'muted'}
          />
          <Kpi
            size="large"
            value={money(s.contractorCents)}
            label="Contractors"
            tone={s.contractorCents ? 'default' : 'muted'}
          />
          <Kpi
            size="large"
            value={money(s.inHouseCents)}
            label="In-house"
            tone={s.inHouseCents ? 'default' : 'muted'}
          />
        </div>

        {s.visits.length === 0 ? (
          <EmptyState
            titleSize={20}
            icon={<IconChart size={30} />}
            title="No spend this month"
            body={`No service was logged in ${name}. Contractor and in-house visits show up here, by restaurant, contractor and category.`}
          >
            {older && (
              <Button variant="small" className="w-full" onClick={() => go(older)}>
                See {monthName(older)}
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            <Section title={`By restaurant · ${name}`}>
              {s.byRestaurant.map((r) => (
                <BarRow
                  key={r.id}
                  name={r.name}
                  square={r.color}
                  color={r.color}
                  cents={r.cents}
                  most={most(s.byRestaurant)}
                  meta={visitCount(r.visits)}
                />
              ))}
            </Section>
            <Section title="By contractor">
              {s.byContractor.map((c) => (
                <BarRow
                  key={c.key}
                  name={c.name}
                  cents={c.cents}
                  most={most(s.byContractor)}
                  meta={visitCount(c.visits)}
                  to={linked && c.contractorId ? `/lead/contractors/${c.contractorId}` : undefined}
                />
              ))}
            </Section>
            <Section title="By category">
              {s.byCategory.map((c: SpendLine) => (
                <BarRow
                  key={c.key}
                  name={c.name}
                  cents={c.cents}
                  most={most(s.byCategory)}
                  meta={visitCount(c.visits)}
                />
              ))}
            </Section>
            <Section title={`Visits · ${s.visits.length}`}>
              {s.visits.map((v) => (
                <VisitRow key={v.id} visit={v} linked={linked} />
              ))}
            </Section>
          </>
        )}
      </ScreenBody>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-none flex-col gap-2.5">
      <h2 className="eyebrow pt-2">{title}</h2>
      <ListCard className="flex-none">{children}</ListCard>
    </section>
  )
}

/** A line of the month: its name and amount, a bar against the most spent, and its visits. */
function BarRow({
  name,
  square,
  color,
  cents,
  most,
  meta,
  to,
}: {
  name: string
  /** A restaurant's color square before its name. */
  square?: string
  /** The bar's color: the restaurant's, else the brand's. */
  color?: string
  cents: number
  most: number
  meta: string
  to?: string
}) {
  const cls = 'flex flex-col gap-1.5 border-t border-surface-muted px-3.5 py-3 text-text first:border-t-0'
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-15 font-semibold">
          {square && <RestaurantSquare color={square} size={10} />}
          <span className="truncate">{name}</span>
        </span>
        <span className="flex-none text-14 font-bold">{money(cents)}</span>
      </span>
      <span className="block h-1.5 rounded-[3px]" aria-hidden="true">
        <span
          className={`block h-full rounded-[3px] ${color ? '' : 'bg-brand'}`}
          style={{ background: color, width: most ? `${(cents / most) * 100}%` : 0 }}
        />
      </span>
      <span className="text-12 text-text-muted">{meta}</span>
    </>
  )
  return to ? (
    <Link
      to={to}
      className={`${cls} no-underline transition-colors hover:bg-surface-hover hover:text-text active:bg-surface-hover active:duration-0`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** A visit: who did it and where, the unit and ticket, the day and what was done, the amount. */
function VisitRow({ visit: v, linked }: { visit: SpendVisit; linked: boolean }) {
  const location = useLocation()
  const to = `/lead/service/${v.id}`
  const open = useOpenInPane(to)
  const amount = money(v.totalCents)
  const what = [v.equipment?.name, v.ticket?.display_id].filter(Boolean).join(' · ')
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-15 font-semibold [overflow-wrap:anywhere]">{workerOf(v)}</span>
        {v.restaurant && <RestaurantName variant="meta" name={v.restaurant.name} color={v.restaurant.color} />}
        {what && <span className="text-12 text-text-muted">{what}</span>}
        <span className="text-12 text-text-muted [overflow-wrap:anywhere]">
          {serviceDay(v.service_date)} · {v.title}
          {v.kind === 'contractor' && v.invoiceMissing ? ' · Missing invoice' : ''}
        </span>
      </span>
      <span className="flex-none font-mono text-14 font-medium">{amount}</span>
    </>
  )
  const cls =
    'flex min-h-16 items-center gap-3 border-t border-border px-3.5 py-2.5 text-text first:border-t-0 transition-colors'
  if (!linked) return <div className={cls}>{body}</div>
  return (
    <Link
      to={to}
      state={{ from: location.pathname + location.search }}
      aria-label={[workerOf(v), v.restaurant?.name, v.equipment?.name, amount].filter(Boolean).join(', ')}
      aria-current={open ? 'page' : undefined}
      className={`${cls} hover:bg-surface-hover active:bg-surface-muted active:duration-0 ${open ? 'bg-brand-tint-faint' : ''}`}
    >
      {body}
    </Link>
  )
}
