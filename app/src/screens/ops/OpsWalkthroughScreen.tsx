import { Link, useParams } from 'react-router'
import { ticketPath } from '../../app/roles'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RestaurantSquare } from '../../components/RestaurantName'
import { BackBar, Screen, ScreenBody, ScreenEmpty, ScreenFooter } from '../../components/Screen'
import { Sk } from '../../components/Skeleton'
import { FlaggedRow, SectionProgressRow, StandingPill } from '../../components/Walkthrough'
import { IconBell, IconChevronDown, IconClockSmall, IconWarning } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { whereFrom } from '../walkthrough/fixes'
import { useWalkthroughTickets } from '../walkthrough/useReview'
import { monthName, monthShort, quarterOf } from '../walkthrough/walkthrough'
import { lastReminderLabel, pastLine, reminderFor } from './opsWalkthrough'
import { useOpsWalkthrough, useSendReminder } from './useOpsWalkthrough'
import { submittedDay } from './walkthroughOverview'

/**
 * Ops · one restaurant's walkthrough (design/screens/WT-Ops-Restaurant, OT-130), opened from
 * the overview. Read-only, as the boards draw: how it stands and who is on it, each part's
 * progress, what it has flagged so far (each ticket opens; an in-house fix opens with
 * OT-131), the restaurant's months before it, and Send reminder with when the last one went.
 * Send reminder shows only while it is open, to someone with Update status, and never
 * under View as.
 */
export function OpsWalkthroughScreen() {
  const { id = '' } = useParams()
  // Keyed, so going to a past month starts it fresh, Send reminder too.
  return <OneWalkthrough key={id} id={id} />
}

function OneWalkthrough({ id }: { id: string }) {
  const { viewingAs } = useUser()
  const updatesStatus = useRight('update_status')
  const { data, isPending, isError, refetch } = useOpsWalkthrough(id)
  const tickets = useWalkthroughTickets(id)
  const remind = useSendReminder(id)

  if (data === null) return <NotFoundScreen />

  const s = data?.summary
  const back = s ? `/ops/walkthroughs?month=${s.period.slice(0, 7)}` : '/ops/walkthroughs'
  const name = data ? reminderFor(data.starter, data.restaurant.manager?.full_name) : null
  const canRemind = s?.status === 'open' && !viewingAs && updatesStatus === true
  const tooSoon = (remind.error as { code?: string } | null)?.code === '55000'

  return (
    <Screen>
      <BackBar to={back} label="Back to all walkthroughs">
        {s ? `Walkthroughs · ${monthName(s.period)}` : 'Walkthroughs'}
      </BackBar>

      {isError || tickets.isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load this walkthrough"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void Promise.all([refetch(), tickets.refetch()])}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : isPending || !data || !s ? (
        <WalkthroughSkeleton />
      ) : (
        <>
          <header className="flex flex-none flex-col gap-1 px-screen pt-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="flex items-start gap-2.5 font-display text-26 font-bold leading-[1.2] tracking-[-0.02em]">
                <RestaurantSquare color={data.restaurant.color} size={14} className="mt-[9px]" />
                {data.restaurant.name}
              </h1>
              <StandingPill standing={s.standing} submitted={s.submitted_at ? submittedDay(s.submitted_at) : null} />
            </div>
            {data.starter && <span className="text-13 text-text-secondary">{data.starter}</span>}
          </header>

          <ScreenBody className="gap-3 pb-4 pt-3.5">
            <ListCard className="flex-none">
              {data.sections.map((p) => (
                <SectionProgressRow
                  key={p.section_id ?? 'quarterly'}
                  name={p.kind === 'quarterly' ? `${quarterOf(s.period)} tasks` : (p.name ?? '')}
                  done={p.done ?? 0}
                  total={p.total ?? 0}
                />
              ))}
            </ListCard>

            <span className="eyebrow -mb-0.5 pt-4">Flagged so far</span>
            {(tickets.data?.length ?? 0) + data.fixes.length === 0 ? (
              <p className="text-14 text-text-secondary">Nothing flagged yet.</p>
            ) : (
              <ListCard className="flex-none">
                {(tickets.data ?? []).map((t) => (
                  <FlaggedRow
                    key={t.id}
                    to={ticketPath('ops', t.id) ?? undefined}
                    kind="ticket"
                    title={t.item?.title ?? t.task ?? t.title}
                    meta={
                      <>
                        <span className="font-mono">{t.displayId}</span>
                        {' · '}
                        {t.section && t.item
                          ? `${t.section.short} › ${t.item.group}`
                          : t.task
                            ? `${quarterOf(s.period)} tasks`
                            : 'Walkthrough'}
                      </>
                    }
                    status={t.status}
                  />
                ))}
                {data.fixes.map((f) => (
                  <FlaggedRow
                    key={f.id}
                    kind="inhouse"
                    title={f.title}
                    meta={whereFrom(f.origin_label)}
                    status={f.done_at ? 'fixed' : 'open'}
                  />
                ))}
              </ListCard>
            )}

            {data.past.length > 0 && (
              <details className="group flex-none pt-4">
                <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
                  <span className="eyebrow">Past walkthroughs</span>
                  <IconChevronDown
                    size={16}
                    className="text-text-secondary transition-transform group-open:rotate-180"
                  />
                </summary>
                <ListCard>
                  {data.past.map((p) => (
                    <Link
                      key={p.walkthrough_id}
                      to={`/ops/walkthroughs/${p.walkthrough_id}`}
                      className="flex min-h-14 items-center gap-2.5 border-t border-surface-muted px-3.5 py-2 text-text no-underline first:border-t-0 hover:bg-surface-hover active:bg-surface-muted"
                    >
                      <span className="w-9 flex-none font-bold">{monthShort(p.period)}</span>
                      <span className="min-w-0 flex-1 truncate text-14">
                        {p.template_short_name ?? p.template_name}
                      </span>
                      <span className="flex-none text-12 text-text-secondary">{pastLine(p)}</span>
                    </Link>
                  ))}
                </ListCard>
              </details>
            )}
          </ScreenBody>

          {canRemind && (
            <ScreenFooter>
              <div role="status" className="flex items-start gap-2 text-13 leading-[1.45] text-text-body">
                <IconClockSmall className="mt-0.5 flex-none text-text-secondary" />
                <span>
                  <b>Last reminder:</b> {lastReminderLabel(s.last_reminded_at)}
                </span>
              </div>
              <Button
                variant="secondary"
                icon={<IconBell />}
                loading={remind.isPending}
                disabled={remind.isSuccess}
                aria-live="polite"
                onClick={() => remind.mutate()}
              >
                {remind.isSuccess
                  ? name
                    ? `Reminder sent to ${name}`
                    : 'Reminder sent'
                  : name
                    ? `Send ${name} a reminder`
                    : 'Send a reminder'}
              </Button>
              {remind.isError && (
                <span role="alert" className="text-13 font-semibold text-danger">
                  {tooSoon
                    ? 'A reminder went out within the hour. Try again later.'
                    : "That didn't go through. Check your connection and try again."}
                </span>
              )}
            </ScreenFooter>
          )}
        </>
      )}
    </Screen>
  )
}

/** While it loads: the name, three parts and a flagged row. */
function WalkthroughSkeleton() {
  return (
    <div role="status" aria-label="Loading walkthrough" className="flex flex-col gap-3 px-screen pt-2">
      <Sk w="70%" h={28} />
      <Sk w="30%" h={13} />
      <ListCard className="mt-2 flex-none">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-surface-muted px-3.5 py-3 first:border-t-0">
            <Sk w={110} h={14} />
            <Sk h={6} r={3} className="flex-1" />
            <Sk w={32} h={14} />
          </div>
        ))}
      </ListCard>
    </div>
  )
}
