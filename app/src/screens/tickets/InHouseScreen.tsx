import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { firstName } from '../../auth/session'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ErrorBanner, Notice } from '../../components/Notice'
import { CountBadge, WalkthroughTag } from '../../components/Pill'
import { AllRestaurantsSquare, RestaurantName } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenEmpty, ScreenHeader, UnderlineTabs } from '../../components/Screen'
import { ConfirmSheet } from '../../components/Sheet'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TaskList, TaskRow } from '../../components/TaskRow'
import { useToast } from '../../components/Toast'
import { IconChevronDown, IconPlus, IconTrash, IconWarning } from '../../components/icons'
import { AddTaskSheet } from './AddTaskSheet'
import { RECENT_DAYS, splitClosed } from './inHouse'
import { useDeleteTask, useInHouse, useSetTaskDone } from './useInHouse'
import { useOpenTickets } from './useOpenTickets'

/**
 * Manager · In-house tasks (design/screens/Main-InHouse). What the restaurant fixes
 * itself, in one list; the board's search and Front / Back are left out, as on Open
 * tickets (from feedback, OT-63). Checking a task moves it to Closed, and unchecking
 * brings it back. The board also draws Delete on a closed row, but a checked-off task
 * is a record, so only a task never checked off offers it: unchecking one is for a
 * mis-tap and is logged, and it stays on the record (OT-84). Add (OT-83, no board) puts
 * in a task by hand beside the walkthrough's, which carry the Walkthrough tag; a
 * hand-added one says who added it and when. Under View as the boxes only show their
 * state and Add is gone. Closed shows what was checked off in the last 30 days, latest
 * first; older ones wait behind Show older, still there to look at (from feedback, OT-85).
 */
const SECTION = 'text-12 font-bold uppercase tracking-[.06em] text-text-secondary'

export function InHouseScreen() {
  const { restaurants, viewingAs } = useUser()
  const ids = restaurants.map((r) => r.id)
  const { data, isPending, isError, refetch } = useInHouse(ids)
  const openTickets = useOpenTickets(ids)
  const setDone = useSetTaskDone(ids)
  const remove = useDeleteTask()
  const toast = useToast()
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [adding, setAdding] = useState(false)
  const canAdd = useRight('create_tickets') && !viewingAs

  const only = restaurants.length === 1 ? restaurants[0] : undefined
  const placeOf = new Map(restaurants.map((r) => [r.id, r]))
  const all = data ?? []
  const open = all.filter((t) => !t.done_at)
  const { recent, older } = splitClosed(all)
  const closed = [...recent, ...older]
  const [showOlder, setShowOlder] = useState(false)

  const toggle = (id: string, done: boolean) => {
    setDeleted(false)
    setDone.mutate(
      { id, done },
      { onError: () => toast.show('Couldn’t save that. Check your connection and try again.') },
    )
  }
  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null)
        setDeleted(true)
      },
    })
  }

  const row = (t: (typeof all)[number]) => (
    <TaskRow
      key={t.id}
      title={t.title}
      meta={[t.origin_label ?? added(t), t.done_at && 'Completed'].filter(Boolean).join(' · ')}
      tag={t.origin_label ? <WalkthroughTag /> : undefined}
      done={!!t.done_at}
      restaurant={only ? undefined : placeOf.get(t.restaurant_id)}
      onToggle={viewingAs ? undefined : () => toggle(t.id, !t.done_at)}
      onDelete={
        viewingAs || t.first_done_at
          ? undefined
          : () => {
              setDeleted(false)
              setDeleting({ id: t.id, title: t.title })
            }
      }
    />
  )

  return (
    <Screen>
      <ScreenHeader
        title="In-house tasks"
        topLeft={
          only ? (
            <RestaurantName name={only.name} color={only.color} />
          ) : (
            <span className="flex items-center gap-1.5 text-14 font-semibold">
              <AllRestaurantsSquare colors={restaurants.map((r) => r.color)} />
              {restaurants.length} restaurants
            </span>
          )
        }
        topRight={<ProfileLink />}
        action={
          canAdd ? (
            <Button
              variant="compact"
              aria-label="Add in-house task"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => setAdding(true)}
            >
              Add
            </Button>
          ) : undefined
        }
      >
        <UnderlineTabs
          size="lg"
          label="Ticket or in-house view"
          className="-mt-1"
          items={[
            {
              to: '/tickets',
              end: true,
              label: (
                <>
                  Tickets <CountBadge count={openTickets.data?.tickets.length ?? 0} />
                </>
              ),
            },
            {
              to: '/tickets/in-house',
              label: (
                <>
                  In-house <CountBadge count={open.length} active />
                </>
              ),
            },
          ]}
        />
      </ScreenHeader>

      {isError ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load your in-house tasks"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {isPending ? (
            <CardFeedSkeleton label="Loading in-house tasks" />
          ) : (
            <>
              <div className="flex flex-none items-baseline justify-between">
                <span className={SECTION}>To fix · {open.length}</span>
                {!viewingAs && <span className="text-12 text-text-secondary">Check off when fixed</span>}
              </div>
              {open.length > 0 ? (
                <TaskList>{open.map(row)}</TaskList>
              ) : (
                <div className="flex-none rounded-input border border-border bg-surface px-4 py-[18px] text-14 leading-[1.45] text-text-secondary">
                  {closed.length > 0
                    ? 'Nothing left to fix. Checked-off tasks are under Closed.'
                    : 'Nothing to fix right now.'}
                </div>
              )}
              {closed.length > 0 && (
                <details className="group mt-1 flex-none">
                  <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
                    <span className={SECTION}>Closed · {closed.length}</span>
                    <IconChevronDown
                      size={16}
                      strokeWidth={2.2}
                      className="text-text-secondary group-open:rotate-180"
                    />
                  </summary>
                  {recent.length > 0 && <TaskList>{recent.map(row)}</TaskList>}
                  {older.length > 0 &&
                    (showOlder ? (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <span className="text-12 text-text-secondary">
                          Checked off more than {RECENT_DAYS} days ago
                        </span>
                        <TaskList>{older.map(row)}</TaskList>
                      </div>
                    ) : (
                      <Button variant="ghost" className="mt-1" onClick={() => setShowOlder(true)}>
                        Show older ({older.length})
                      </Button>
                    ))}
                </details>
              )}
              {deleted && <Notice>In-house task deleted.</Notice>}
            </>
          )}
        </ScreenBody>
      )}

      <AddTaskSheet open={adding} onOpenChange={setAdding} />

      <ConfirmSheet
        open={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            remove.reset()
            setDeleting(null)
          }
        }}
        title="Delete this in-house task?"
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-open-bg text-danger">
            <IconTrash size={24} />
          </span>
        }
        description={
          <span className="flex flex-col gap-2">
            <span>"{deleting?.title}" will be removed.</span>
            <b className="text-danger">This is permanent and cannot be undone.</b>
          </span>
        }
      >
        {remove.isError && (
          <ErrorBanner title="Couldn't delete this yet.">
            It may have just been checked off, or your connection dropped. Try again.
          </ErrorBanner>
        )}
        <Button variant="danger" loading={remove.isPending} onClick={confirmDelete}>
          Delete
        </Button>
        <Button variant="secondary" onClick={() => setDeleting(null)}>
          Cancel
        </Button>
      </ConfirmSheet>
    </Screen>
  )
}

/** "Added by Maya · Nov 6": a task put in by hand, with no walkthrough behind it. */
function added(t: { created_at: string; adder: { full_name: string } | null }) {
  const day = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const who = firstName(t.adder?.full_name)
  return who ? `Added by ${who} · ${day}` : `Added ${day}`
}
