import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ticketPath } from '../../app/roles'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Notice } from '../../components/Notice'
import { RestaurantSquare } from '../../components/RestaurantName'
import { BackBar, Screen, ScreenBody } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { FixRow, TaskList, TaskListEmpty } from '../../components/TaskRow'
import { IconClose, IconEye } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { addedLine, whereFrom } from '../walkthrough/fixes'
import { useWalkthroughFixes, type WalkthroughFix } from '../walkthrough/useWalkthroughFixes'
import { monthName } from '../walkthrough/walkthrough'
import { ConvertFixSheet, type ConvertTarget } from './ConvertFixSheet'
import { convertedLine, convertedNotice, fixedLine } from './opsFixes'

/**
 * Ops · a walkthrough's in-house fixes (design/screens/WT-Ops-Fix, OT-131), opened from
 * one restaurant's page. Read-only, since the restaurant checks them off: To fix, each
 * with Convert to ticket for one that needs a contractor; Converted to tickets, each
 * linking its ticket; and Fixed. Opened from an item or task (?item= or ?task=), it shows
 * only that one's fixes under a chip that clears the filter, with Show all beside it.
 * Convert shows to someone with Update status, never under View as.
 */
export function OpsWalkthroughFixesScreen() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { user, viewingAs } = useUser()
  const updatesStatus = useRight('update_status')
  const { data, isPending, isError } = useWalkthroughFixes(id)
  const [converting, setConverting] = useState<ConvertTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const back = `/ops/walkthroughs/${id}`

  if (isPending) {
    return (
      <Screen>
        <BackBar to={back} label="Back to the walkthrough" />
        <ScreenBody className="pb-4 pt-1">
          <CardFeedSkeleton label="Loading in-house fixes" />
        </ScreenBody>
      </Screen>
    )
  }
  if (isError || !data) return <NotFoundScreen />

  const canConvert = !viewingAs && updatesStatus === true
  const item = params.get('item')
  const task = params.get('task')
  const filtered = !!(item || task)
  const all = data.fixes
  const shown = filtered ? all.filter((f) => (item ? f.itemId === item : f.taskId === task)) : all
  const byAge = (a: WalkthroughFix, b: WalkthroughFix) => Date.parse(a.created_at) - Date.parse(b.created_at)
  const open = shown.filter((f) => !f.converted_ticket_id && !f.done_at).sort(byAge)
  const converted = shown.filter((f) => f.converted_ticket_id).sort(byAge)
  const fixed = shown
    .filter((f) => !f.converted_ticket_id && f.done_at)
    .sort((a, b) => Date.parse(b.done_at!) - Date.parse(a.done_at!))
  const chip = filtered ? (whereFrom(shown[0]?.origin_label ?? null) ?? 'This item') : null
  const showAll = () => setParams({}, { replace: true })
  const where = (f: WalkthroughFix) => (filtered ? null : whereFrom(f.origin_label))

  const ticketOf = (f: WalkthroughFix) =>
    f.converted as unknown as {
      id: string
      display_id: string
      created_by: string | null
      creator: { full_name: string } | null
    } | null

  return (
    <Screen>
      <BackBar to={back} label={`Back to ${data.walkthrough.restaurantName} walkthrough`} roomy>
        <span className="flex items-center gap-1.5 text-12 font-semibold text-text-secondary">
          {data.walkthrough.restaurantColor && <RestaurantSquare color={data.walkthrough.restaurantColor} size={8} />}
          <span className="min-w-0 truncate">
            {monthName(data.walkthrough.period)} walkthrough · {data.walkthrough.restaurantName}
          </span>
        </span>
        <h1 className="font-display text-20 font-bold text-text">In-house fixes</h1>
      </BackBar>
      <ScreenBody className="gap-2.5 pb-4 pt-2">
        {filtered && (
          <div className="mb-0.5 flex flex-none items-center justify-between gap-3">
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
              to={`/ops/walkthroughs/${id}/fixes`}
              replace
              className="flex min-h-tap flex-none items-center text-15 font-semibold text-brand"
            >
              Show all {all.length}
            </Link>
          </div>
        )}
        <p className="flex flex-none items-start gap-2 text-13 leading-[1.4] text-text-secondary">
          <IconEye size={15} strokeWidth={2.2} className="mt-0.5 flex-none" />
          <span>
            The restaurant team checks these off.
            {canConvert ? ' Convert one to a ticket if it needs a contractor.' : ''}
          </span>
        </p>

        {open.length + converted.length + fixed.length === 0 && (
          <TaskListEmpty>No in-house fixes on this walkthrough.</TaskListEmpty>
        )}

        {open.length > 0 && (
          <>
            <span className="eyebrow pt-1.5">To fix · {open.length}</span>
            <TaskList>
              {open.map((f) => (
                <FixRow
                  key={f.id}
                  title={f.title}
                  where={where(f)}
                  meta={addedLine(f.created_at, f.adder?.full_name)}
                  state={{ kind: 'open' }}
                  onConvert={
                    canConvert
                      ? () => {
                          setNotice(null)
                          setConverting({
                            id: f.id,
                            title: f.title,
                            knownCategory: f.knownCategory,
                            fromWalkthrough: true,
                          })
                        }
                      : undefined
                  }
                />
              ))}
            </TaskList>
          </>
        )}

        {converted.length > 0 && (
          <>
            <span className="eyebrow pt-1.5">Converted to tickets · {converted.length}</span>
            <TaskList>
              {converted.map((f) => {
                const t = ticketOf(f)
                return (
                  <FixRow
                    key={f.id}
                    title={f.title}
                    where={where(f)}
                    meta={convertedLine(
                      { id: t?.created_by ?? null, name: t?.creator?.full_name },
                      user.id,
                      addedLine(f.created_at, f.adder?.full_name),
                    )}
                    state={
                      t ? { kind: 'ticket', displayId: t.display_id, to: ticketPath('ops', t.id)! } : { kind: 'fixed' }
                    }
                  />
                )
              })}
            </TaskList>
          </>
        )}

        {fixed.length > 0 && (
          <>
            <span className="eyebrow pt-1.5">Fixed · {fixed.length}</span>
            <TaskList>
              {fixed.map((f) => (
                <FixRow
                  key={f.id}
                  title={f.title}
                  where={where(f)}
                  meta={fixedLine(f.done_at!, f.doner?.full_name, f.created_at)}
                  state={{ kind: 'fixed' }}
                />
              ))}
            </TaskList>
          </>
        )}

        {notice && <Notice>{notice}</Notice>}
      </ScreenBody>
      <ConvertFixSheet
        fix={converting}
        onClose={() => setConverting(null)}
        onConverted={(displayId) => setNotice(convertedNotice(displayId))}
      />
    </Screen>
  )
}
