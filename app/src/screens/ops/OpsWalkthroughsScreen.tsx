import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { Card, ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RestaurantName, RestaurantSquare } from '../../components/RestaurantName'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader } from '../../components/Screen'
import { Sk } from '../../components/Skeleton'
import { FlagChips, HistoryLegend, HistorySquare, ProgressLine, StandingPill } from '../../components/Walkthrough'
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardCheck,
  IconWarning,
} from '../../components/icons'
import { localDay, monthName, monthShort } from '../walkthrough/walkthrough'
import { useRestaurantOrder } from './useRestaurantOrder'
import { useRestaurantScope } from './useRestaurantScope'
import { useWalkthroughMonths, useWalkthroughOverview } from './useOpsWalkthroughs'
import {
  historyLabel,
  lastSixMonths,
  monthLine,
  monthRows,
  submittedDay,
  summaryLine,
  type SummaryRow,
} from './walkthroughOverview'

/**
 * Ops · Walkthroughs (design/screens/WT-Ops-Overview, OT-129). A month at a time: how many
 * restaurants have submitted and how long is left, a row per restaurant with its progress,
 * standing and what it flagged, opening that restaurant's walkthrough (OT-130), and the
 * last six months as squares. It opens on the newest month there is, and the month shown is
 * in the address (?month=2026-10), so Back from a restaurant returns to it. The restaurant
 * picker scopes it as it does the dashboard. Read-only, as the boards draw; Schedule is
 * OT-133's, and View as hides it.
 */
export function OpsWalkthroughsScreen() {
  const { viewingAs } = useUser()
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const inScope = scope.selected ? [scope.selected] : ordered
  const [params, setParams] = useSearchParams()

  const months = useWalkthroughMonths(scope.ids)
  const list = months.data ?? []
  const asked = params.get('month')
  const month = (asked && list.find((m) => m.startsWith(asked))) || list[0]
  const overview = useWalkthroughOverview(scope.ids, month)

  const at = month ? list.indexOf(month) : -1
  const older = at >= 0 ? list[at + 1] : undefined
  const newer = at > 0 ? list[at - 1] : undefined
  const go = (m: string) => setParams({ month: m.slice(0, 7) }, { replace: true })

  const rows = overview.data ?? []
  const shown = month ? rows.filter((r) => r.period === month) : []
  const current = month ? monthRows(rows, month, inScope) : []
  const line = summaryLine(shown, localDay())
  const failed = months.isError || overview.isError

  return (
    <Screen>
      <ScreenHeader
        title="Walkthroughs"
        topLeft={
          <RestaurantPicker
            restaurants={ordered}
            selectedId={scope.selected?.id ?? null}
            onSelect={scope.select}
            heading="Show walkthroughs for"
          />
        }
        topRight={<ProfileLink />}
        action={
          viewingAs ? undefined : (
            <ButtonLink to="/ops/walkthroughs/schedule" variant="small" className="px-3" icon={<IconCalendar />}>
              Schedule
            </ButtonLink>
          )
        }
      >
        {month && (
          <div className="flex items-center gap-1 rounded-input border border-border bg-surface p-1">
            <StepButton label="Previous month" to={older} onGo={go} icon={<IconChevronLeft size={18} />} />
            <div className="flex min-w-0 flex-1 flex-col items-center gap-px text-center">
              <span className="text-15 font-bold">
                {monthName(month)} {month.slice(0, 4)}
              </span>
              <span className="truncate text-12 text-text-secondary">{monthLine(shown)}</span>
            </div>
            <StepButton label="Next month" to={newer} onGo={go} icon={<IconChevronRight size={18} />} />
          </div>
        )}
      </ScreenHeader>

      {failed ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the walkthroughs"
            body="Check your connection and try again."
          >
            <Button
              variant="small"
              className="w-full"
              onClick={() => void Promise.all([months.refetch(), overview.refetch()])}
            >
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : months.isSuccess && list.length === 0 ? (
        <ScreenEmpty>
          <EmptyState
            titleSize={22}
            icon={<IconClipboardCheck size={30} />}
            title="No walkthroughs yet"
            body="Each month's walkthrough opens on the 1st, one for every restaurant."
          />
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {!overview.data ? (
            <OverviewSkeleton />
          ) : (
            <>
              <p className="px-0.5 pb-1.5 pt-3.5 text-14">
                <b>{line.count}</b> submitted{line.left ? ` · ${line.left}` : ''}
              </p>
              <ListCard className="flex-none">
                {current.map(({ restaurant, row }) => (
                  <MonthRow key={row.walkthrough_id} name={restaurant.name} color={restaurant.color} row={row} />
                ))}
              </ListCard>
              <History month={month!} rows={rows} restaurants={inScope} />
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}

/** A month arrow: 44px to tap, off at the newest and oldest month there is. */
function StepButton({
  label,
  to,
  onGo,
  icon,
}: {
  label: string
  to: string | undefined
  onGo: (month: string) => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!to}
      onClick={() => to && onGo(to)}
      className="flex size-11 flex-none items-center justify-center rounded-control text-text disabled:text-border-muted not-disabled:active:bg-surface-muted"
    >
      {icon}
    </button>
  )
}

/** A restaurant's month: name and standing, the bar, and "20 of 50" with what it flagged. */
function MonthRow({ name, color, row }: { name: string; color: string; row: SummaryRow }) {
  return (
    <Link
      to={`/ops/walkthroughs/${row.walkthrough_id}`}
      aria-label={`${name}, ${row.done} of ${row.total}`}
      className="flex flex-col gap-[7px] border-t border-surface-muted px-3.5 py-3 text-text no-underline first:border-t-0 hover:bg-surface-hover active:bg-surface-muted"
    >
      <span className="flex items-center gap-2">
        <RestaurantName name={name} color={color} variant="row" className="flex-1" />
        <StandingPill standing={row.standing} submitted={row.submitted_at ? submittedDay(row.submitted_at) : null} />
      </span>
      <ProgressLine done={row.done} total={row.total} label={`${row.done} of ${row.total} checks done`} />
      <span className="flex flex-wrap items-center gap-1.5 text-12 text-text-muted">
        {row.done} of {row.total}
        <FlagChips tickets={row.tickets} fixes={row.fixes} />
      </span>
    </Link>
  )
}

/** Last 6 months, folded to begin with: a square per restaurant and month, and what they mean. */
function History({
  month,
  rows,
  restaurants,
}: {
  month: string
  rows: SummaryRow[]
  restaurants: { id: string; name: string; color: string }[]
}) {
  const months = lastSixMonths(month)
  return (
    <details className="group flex-none">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow">Last 6 months</span>
        <IconChevronDown size={16} className="text-text-secondary transition-transform group-open:rotate-180" />
      </summary>
      <Card className="overflow-hidden pr-2">
        {/* Fixed layout: six 30px months, and the name takes what is left and truncates. */}
        <table className="w-full table-fixed border-collapse text-12">
          <colgroup>
            <col />
            {months.map((m) => (
              <col key={m} className="w-[30px]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="py-1.5 pl-3.5 text-left">
                <span className="sr-only">Restaurant</span>
              </th>
              {months.map((m) => (
                <th key={m} scope="col" className="py-1.5 text-center font-semibold text-text-secondary">
                  {monthShort(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r) => (
              <tr key={r.id}>
                <th
                  scope="row"
                  className="border-t border-surface-muted py-[5px] pl-3.5 text-left font-semibold text-text"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <RestaurantSquare color={r.color} size={8} />
                    <span className="truncate">{r.name}</span>
                  </span>
                </th>
                {months.map((m) => {
                  const standing = rows.find((x) => x.restaurant_id === r.id && x.period === m)?.standing
                  return (
                    <td key={m} className="border-t border-surface-muted py-[5px] text-center">
                      {standing ? (
                        <HistorySquare standing={standing} label={historyLabel(r.name, m, standing)} />
                      ) : (
                        <span className="sr-only">{historyLabel(r.name, m, undefined)}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <HistoryLegend />
      </Card>
    </details>
  )
}

/** While the month loads: the line and four rows. */
function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading walkthroughs" className="flex flex-col gap-2.5 pt-3.5">
      <Sk w="44%" h={14} />
      <ListCard className="flex-none">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-surface-muted px-3.5 py-3 first:border-t-0">
            <Sk w={['58%', '46%', '64%', '52%'][i]} h={15} />
            <Sk h={6} r={3} />
            <Sk w="22%" h={11} />
          </div>
        ))}
      </ListCard>
    </div>
  )
}
