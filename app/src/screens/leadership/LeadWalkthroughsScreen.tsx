import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Kpi } from '../../components/Kpi'
import { Screen, ScreenBody, ScreenEmpty, SectionLabel } from '../../components/Screen'
import { MetricsSkeleton } from '../../components/Skeleton'
import { ProgressLine, StandingPill } from '../../components/Walkthrough'
import { IconClipboardCheck, IconWarning } from '../../components/icons'
import { useWalkthroughMonths, useWalkthroughOverview } from '../ops/useOpsWalkthroughs'
import { shortDay } from '../ops/walkthroughOverview'
import { monthName } from '../walkthrough/walkthrough'
import { LeadershipHeader } from './LeadershipHeader'
import { leadRows, onTimeShare, percentDone, rowLine, submittedCount } from './walkthroughs'

/**
 * Leadership · Walkthroughs (design/screens/WT-Exec, OT-147), read-only. The newest month
 * there is: how many restaurants have submitted, and the share of finished months over the
 * last six that were on time; then a row per restaurant with its progress, what it flagged
 * and its own record. It reads v_walkthrough_summary as the Ops overview does, for every
 * restaurant in useUser(), so View as shows the person viewed. The board draws no way
 * between months and no screen behind a row, so neither is here.
 */
export function LeadWalkthroughsScreen() {
  const { restaurants } = useUser()
  const ids = restaurants.map((r) => r.id)
  const months = useWalkthroughMonths(ids)
  const month = months.data?.[0]
  const overview = useWalkthroughOverview(ids, month)
  const header = <LeadershipHeader title="Walkthroughs" />

  if (months.isError || overview.isError) {
    return (
      <Screen>
        {header}
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
      </Screen>
    )
  }

  if (months.isSuccess && !month) {
    return (
      <Screen>
        {header}
        <ScreenEmpty>
          <EmptyState
            titleSize={22}
            icon={<IconClipboardCheck size={30} />}
            title="No walkthroughs yet"
            body="Each month's walkthrough opens on the 1st, one for every restaurant."
          />
        </ScreenEmpty>
      </Screen>
    )
  }

  if (!month || !overview.data) {
    return (
      <Screen>
        {header}
        <ScreenBody className="pb-6 pt-1">
          <MetricsSkeleton figures={2} label={month ? monthName(month) : 'This month'} loading="Loading walkthroughs" />
        </ScreenBody>
      </Screen>
    )
  }

  const history = overview.data
  const rows = leadRows(history, month, restaurants)
  const dues = new Set(rows.map((r) => r.row.due_on))
  const due = dues.size === 1 ? shortDay([...dues][0]!) : null
  const name = monthName(month)

  return (
    <Screen>
      {header}
      <ScreenBody className="gap-3 pb-6 pt-1">
        <div className="grid flex-none grid-cols-2 gap-2">
          <Kpi value={submittedCount(rows.map((r) => r.row))} label={`Submitted · ${name}`} />
          <Kpi value={onTimeShare(history, month)} label="On time · last 6 months" />
        </div>
        <SectionLabel className="-mb-0.5 pt-4">{due ? `${name} · due ${due}` : name}</SectionLabel>
        <ListCard className="flex-none">
          {rows.map(({ restaurant, row }) => {
            const line = rowLine(row, history, month)
            return (
              <div
                key={row.walkthrough_id}
                className="flex flex-col gap-[7px] border-t border-surface-muted px-3.5 py-3 first:border-t-0"
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-15 font-semibold [overflow-wrap:anywhere]">
                    {restaurant.name}
                  </span>
                  <StandingPill standing={row.standing} progress={percentDone(row)} />
                </span>
                <ProgressLine
                  done={row.done}
                  total={row.total}
                  label={`${restaurant.name}: ${row.done} of ${row.total} checks done`}
                />
                {line && <span className="text-12 text-text-muted">{line}</span>}
              </div>
            )
          })}
        </ListCard>
      </ScreenBody>
    </Screen>
  )
}
