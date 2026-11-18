import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { ticketPath } from '../../app/roles'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { safeReturnPath } from '../../auth/returnPath'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { HiddenCategories } from '../../components/HiddenCategories'
import { Notice } from '../../components/Notice'
import { AllRestaurantsSquare, RestaurantSquare } from '../../components/RestaurantName'
import { BackBar, Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { FixRow, TaskList, TaskListEmpty } from '../../components/TaskRow'
import { IconChevronDown, IconEye, IconPlus, IconWarning } from '../../components/icons'
import { useListView } from '../mycategories/useMyCategories'
import { addedBy, RECENT_DAYS, splitClosed } from '../tickets/inHouse'
import { useInHouse, type Task } from '../tickets/useInHouse'
import { addedLine } from '../walkthrough/fixes'
import { ConvertFixSheet, type ConvertTarget } from './ConvertFixSheet'
import { OpsAddTaskSheet } from './OpsAddTaskSheet'
import { convertedLine, convertedNotice, fixedLine } from './opsFixes'
import { useRestaurantScope } from './useRestaurantScope'

type Converted = {
  id: string
  display_id: string
  created_at: string
  created_by: string | null
  creator: { full_name: string } | null
} | null

/**
 * Ops · In-house tasks (OT-131; no board draws it, so it follows WT-Ops-Fix's rows and the
 * manager's In-house tab): every task at the restaurants in view, whether from a
 * walkthrough, added by the restaurant, or sent by the Support Team. Read-only, since the
 * restaurant checks them off; an open one offers Convert to ticket, and Add sends the
 * restaurant a task. Opened from the dashboard's menu, in the picker's restaurants, or from
 * one restaurant's walkthrough (?restaurant=). Closed holds what was fixed or made a ticket
 * in the last 30 days, older behind Show older. My categories leaves hidden areas off, as on
 * the manager's tab. Under View as, or without Update status, it only shows.
 */
export function OpsInHouseScreen() {
  const { user, restaurants, viewingAs } = useUser()
  const [params] = useSearchParams()
  const from = useLocation().state as { backTo?: string } | null
  const back = safeReturnPath(from?.backTo) ?? '/ops'
  const scope = useRestaurantScope()
  const asked = restaurants.find((r) => r.id === params.get('restaurant'))
  const inView = asked ? [asked] : scope.selected ? [scope.selected] : restaurants
  const ids = inView.map((r) => r.id)
  const only = inView.length === 1 ? inView[0] : undefined
  const placeOf = new Map(restaurants.map((r) => [r.id, r]))

  const { data, isPending, isError, refetch } = useInHouse(ids)
  const roles = useRoleNames()
  const updatesStatus = useRight('update_status')
  const canAct = !viewingAs && updatesStatus === true
  const view = useListView()
  const [adding, setAdding] = useState(false)
  const [converting, setConverting] = useState<ConvertTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showOlder, setShowOlder] = useState(false)

  const tasks = data ?? []
  const all = tasks.filter((t) => view.shows(t))
  const converted = (t: Task) => t.converted as unknown as Converted
  const open = all.filter((t) => !t.done_at && !t.converted_ticket_id)
  const { recent, older } = splitClosed(
    all
      .filter((t) => t.done_at || t.converted_ticket_id)
      .map((t) => ({ task: t, done_at: converted(t)?.created_at ?? t.done_at })),
  )
  const closedCount = recent.length + older.length

  const row = (t: Task) => {
    const ticket = converted(t)
    const added = t.walkthrough_id ? addedLine(t.created_at, t.adder?.full_name) : addedBy(t)
    const itemCategory = (t.check as unknown as { item: { category_id: string | null } | null } | null)?.item
    return (
      <FixRow
        key={t.id}
        title={t.title}
        note={t.note}
        where={t.origin_label}
        restaurant={only ? undefined : placeOf.get(t.restaurant_id)}
        meta={
          ticket
            ? convertedLine({ id: ticket.created_by, name: ticket.creator?.full_name }, user.id, added)
            : t.done_at
              ? fixedLine(t.done_at, t.doner?.full_name, t.created_at)
              : added
        }
        state={
          ticket
            ? { kind: 'ticket', displayId: ticket.display_id, to: ticketPath('ops', ticket.id)! }
            : t.done_at
              ? { kind: 'fixed' }
              : { kind: 'open' }
        }
        onConvert={
          canAct
            ? () => {
                setNotice(null)
                setConverting({
                  id: t.id,
                  title: t.title,
                  knownCategory: t.category_id ?? itemCategory?.category_id ?? null,
                  fromWalkthrough: !!t.walkthrough_id,
                })
              }
            : undefined
        }
      />
    )
  }

  return (
    <Screen>
      <BackBar
        to={back}
        label="Back"
        roomy
        action={
          canAct ? (
            <Button
              variant="compact"
              aria-label="Add in-house task"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => {
                setNotice(null)
                setAdding(true)
              }}
            >
              Add
            </Button>
          ) : undefined
        }
      >
        <span className="flex items-center gap-1.5 text-12 font-semibold text-text-secondary">
          {only ? (
            <>
              <RestaurantSquare color={only.color} size={8} />
              <span className="min-w-0 truncate">{only.name}</span>
            </>
          ) : (
            <>
              <AllRestaurantsSquare colors={inView.map((r) => r.color)} />
              {inView.length} restaurants
            </>
          )}
        </span>
        <h1 className="font-display text-20 font-bold text-text">In-house tasks</h1>
      </BackBar>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the in-house tasks"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-2">
          {isPending ? (
            <CardFeedSkeleton label="Loading in-house tasks" />
          ) : (
            <>
              <HiddenCategories
                count={view.areaHidden || tasks.some((t) => t.category_id) ? view.hidden : 0}
                showAll={view.showAll}
                onShowAll={view.setShowAll}
                className="-my-1"
              />
              <p className="flex flex-none items-start gap-2 text-13 leading-[1.4] text-text-secondary">
                <IconEye size={15} strokeWidth={2.2} className="mt-0.5 flex-none" />
                <span>
                  The restaurant team checks these off.
                  {canAct ? ' Convert one to a ticket if it needs a contractor.' : ''}
                </span>
              </p>
              <span className="eyebrow pt-1.5">To fix · {open.length}</span>
              {open.length > 0 ? (
                <TaskList>{open.map(row)}</TaskList>
              ) : (
                <TaskListEmpty>
                  {closedCount > 0
                    ? 'Nothing left to fix. Fixed and converted tasks are under Closed.'
                    : 'Nothing to fix right now.'}
                </TaskListEmpty>
              )}
              {closedCount > 0 && (
                <details className="group mt-1 flex-none">
                  <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow">Closed · {closedCount}</span>
                    <IconChevronDown
                      size={16}
                      strokeWidth={2.2}
                      className="text-text-secondary group-open:rotate-180"
                    />
                  </summary>
                  {recent.length > 0 && <TaskList>{recent.map((c) => row(c.task))}</TaskList>}
                  {older.length > 0 &&
                    (showOlder ? (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <span className="text-12 text-text-secondary">Closed more than {RECENT_DAYS} days ago</span>
                        <TaskList>{older.map((c) => row(c.task))}</TaskList>
                      </div>
                    ) : (
                      <Button variant="ghost" className="mt-1" onClick={() => setShowOlder(true)}>
                        Show older ({older.length})
                      </Button>
                    ))}
                </details>
              )}
              {notice && <Notice>{notice}</Notice>}
            </>
          )}
        </ScreenBody>
      )}

      <OpsAddTaskSheet
        open={adding}
        onOpenChange={setAdding}
        restaurants={inView}
        onAdded={(name) =>
          setNotice(`Task added. ${roles.name('manager', 'The managers')} at ${name} get a notification.`)
        }
      />
      <ConvertFixSheet
        fix={converting}
        onClose={() => setConverting(null)}
        onConverted={(displayId) => setNotice(convertedNotice(displayId))}
      />
    </Screen>
  )
}
