import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { safeReturnPath } from '../../auth/returnPath'
import { Notice } from '../../components/Notice'
import { BackBar, Screen, ScreenBody } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TaskList, TaskRow } from '../../components/TaskRow'
import { useToast } from '../../components/Toast'
import { IconChevronDown, IconClose } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { DeleteTaskSheet } from '../tickets/DeleteTaskSheet'
import { useSetTaskDone } from '../tickets/useInHouse'
import { addedLine, whereFrom } from './fixes'
import { useWalkthroughFixes, type WalkthroughFix } from './useWalkthroughFixes'
import { monthName } from './walkthrough'

const SECTION = 'text-12 font-bold uppercase tracking-[.06em] text-text-secondary'

/**
 * Walkthrough · In-house fixes (design/screens/WT-Fix, WT-Fix-All). Every fix made on
 * this walkthrough, the same rows as the In-house tab: check one off when it's fixed, and
 * delete one never checked off, after a confirm step. Opened from an item or task (?item=
 * or ?task=) it shows only that one's fixes, under a chip that clears the filter, with
 * Show all beside it; each row then says who added it, where the whole list says what it
 * came from. Checked-off fixes sit under Closed. Back returns to where it was opened from.
 * Under View as nothing checks off or deletes.
 */
export function WalkthroughFixesScreen() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const from = useLocation().state as { backTo?: string; openGroup?: string } | null
  const backTo = safeReturnPath(from?.backTo) ?? '/walkthrough'
  // Back on the checklist, the item's group is open again.
  const back = { openGroup: from?.openGroup }
  const { restaurants, viewingAs } = useUser()
  const { data, isPending, isError } = useWalkthroughFixes(id)
  const setDone = useSetTaskDone(restaurants.map((r) => r.id))
  const toast = useToast()
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null)
  const [deleted, setDeleted] = useState(false)

  if (isPending) {
    return (
      <Screen>
        <BackBar to={backTo} label="Back" />
        <ScreenBody className="pb-4 pt-1">
          <CardFeedSkeleton label="Loading in-house fixes" />
        </ScreenBody>
      </Screen>
    )
  }
  if (isError || !data) return <NotFoundScreen />

  const item = params.get('item')
  const task = params.get('task')
  const filtered = item || task
  const all = data.fixes
  const shown = filtered ? all.filter((f) => (item ? f.itemId === item : f.taskId === task)) : all
  const open = shown.filter((f) => !f.done_at)
  const closed = shown.filter((f) => f.done_at).sort((a, b) => Date.parse(b.done_at!) - Date.parse(a.done_at!))
  const chip = filtered ? (whereFrom(shown[0]?.origin_label ?? null) ?? 'This item') : null
  const showAll = () => setParams({}, { replace: true, state: from })

  const toggle = (fix: WalkthroughFix) => {
    setDeleted(false)
    setDone.mutate(
      { id: fix.id, done: !fix.done_at },
      { onError: () => toast.show('Couldn’t save that. Check your connection and try again.') },
    )
  }
  const row = (f: WalkthroughFix) => (
    <TaskRow
      key={f.id}
      title={f.title}
      meta={[
        filtered
          ? addedLine(f.created_at, f.adder?.full_name)
          : (whereFrom(f.origin_label) ?? addedLine(f.created_at, f.adder?.full_name)),
        f.done_at && 'Completed',
      ]
        .filter(Boolean)
        .join(' · ')}
      done={!!f.done_at}
      onToggle={viewingAs ? undefined : () => toggle(f)}
      onDelete={
        viewingAs || f.first_done_at
          ? undefined
          : () => {
              setDeleted(false)
              setDeleting({ id: f.id, title: f.title })
            }
      }
    />
  )

  return (
    <Screen>
      <BackBar to={backTo} state={back} label="Back" roomy>
        <span className="block text-12 text-text-secondary">
          {monthName(data.walkthrough.period)} walkthrough · {data.walkthrough.restaurantName}
        </span>
        <h1 className="font-display text-20 font-bold text-text">In-house fixes</h1>
      </BackBar>
      <ScreenBody className="gap-2.5 pb-4 pt-2">
        {filtered && (
          <div className="flex flex-none items-center justify-between gap-3">
            <button
              type="button"
              onClick={showAll}
              aria-label={`Showing ${chip}. Clear the filter`}
              className="inline-flex min-h-tap min-w-0 items-center gap-2 rounded-pill bg-brand-tint px-3 text-14 font-semibold text-brand-strong"
            >
              <span className="truncate">{chip}</span>
              <IconClose size={16} className="flex-none" />
            </button>
            <Link
              to={`/walkthrough/${id}/fixes`}
              replace
              state={from}
              className="flex min-h-tap flex-none items-center text-15 font-semibold text-brand"
            >
              Show all {all.length}
            </Link>
          </div>
        )}
        <div className="flex flex-none items-baseline justify-between pt-1">
          <span className={SECTION}>In-house to fix · {open.length}</span>
          {!viewingAs && <span className="text-12 text-text-secondary">Check off when fixed</span>}
        </div>
        {open.length > 0 ? (
          <TaskList>{open.map(row)}</TaskList>
        ) : (
          <div className="flex-none rounded-input border border-border bg-surface px-4 py-[18px] text-14 leading-[1.45] text-text-secondary">
            {closed.length > 0 ? 'Nothing left to fix. Checked-off fixes are under Closed.' : 'No in-house fixes yet.'}
          </div>
        )}
        {closed.length > 0 && (
          <details className="group mt-1 flex-none">
            <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
              <span className={SECTION}>Closed · {closed.length}</span>
              <IconChevronDown size={16} strokeWidth={2.2} className="text-text-secondary group-open:rotate-180" />
            </summary>
            <TaskList>{closed.map(row)}</TaskList>
          </details>
        )}
        {deleted && <Notice>In-house fix deleted.</Notice>}
      </ScreenBody>
      <DeleteTaskSheet
        task={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          setDeleted(true)
        }}
      />
    </Screen>
  )
}
