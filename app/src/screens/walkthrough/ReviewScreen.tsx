import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Textarea } from '../../components/Field'
import { Notice } from '../../components/Notice'
import { BackBar, Screen, ScreenBody, ScreenEmpty, ScreenFooter } from '../../components/Screen'
import { ConfirmSheet } from '../../components/Sheet'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { TaskList, TaskRow } from '../../components/TaskRow'
import { useToast } from '../../components/Toast'
import { CountTile, LeftRow, WalkthroughTicketRow } from '../../components/Walkthrough'
import { IconCheck, IconWarning } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useSetTaskDone } from '../tickets/useInHouse'
import { whereFrom } from './fixes'
import { useChecklist } from './useChecklist'
import { ticketPath, useSubmitWalkthrough, useWalkthroughTickets } from './useReview'
import { useWalkthroughFixes } from './useWalkthroughFixes'
import { localDay, monthName, onDay, quarterOf, timing } from './walkthrough'

/**
 * Manager · Review & submit (design/screens/WT-Review, WT-Review-Partial). How the
 * walkthrough went: all done and how early, or how many checks are still to do and where;
 * the Good count, and the in-house fixes and tickets still open (each opens its list); the tickets made;
 * the in-house fixes, to check off here; and a note for Ops. Submit walkthrough submits at
 * once when every check is done, and otherwise asks first (Keep going or Submit anyway),
 * since the database allows it. Once submitted it says when and by whom, with the note,
 * and takes nothing more. Under View as nothing submits or checks off, and someone
 * without Create tickets has no Submit.
 */
export function ReviewScreen() {
  const { id = '' } = useParams()
  const { restaurants, viewingAs } = useUser()
  const checklist = useChecklist(id)
  const fixes = useWalkthroughFixes(id)
  const tickets = useWalkthroughTickets(id)
  const setDone = useSetTaskDone(restaurants.map((r) => r.id))
  const submit = useSubmitWalkthrough(id)
  const mayWork = useRight('create_tickets') !== false
  const toast = useToast()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)

  if (checklist.isPending || fixes.isPending || tickets.isPending) {
    return (
      <Screen>
        <BackBar to="/walkthrough" label="Back to walkthrough" />
        <ScreenBody className="pb-4">
          <GroupedListSkeleton />
        </ScreenBody>
      </Screen>
    )
  }
  if (fixes.isError || tickets.isError) {
    return (
      <Screen>
        <BackBar to="/walkthrough" label="Back to walkthrough" />
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the review"
            body="Check your connection and try again."
          >
            <Button
              variant="small"
              className="w-full"
              onClick={() => void Promise.all([fixes.refetch(), tickets.refetch()])}
            >
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  }
  if (checklist.isError || !checklist.data || !fixes.data) return <NotFoundScreen />

  const w = checklist.data.walkthrough
  const p = checklist.data.progress
  const open = w.status === 'open'
  const canAct = open && !viewingAs && mayWork
  const left = p.total - p.done
  const partsLeft = p.parts.filter((part) => part.total > part.done)
  // Fixes still to do first, then the ones checked off, which stay on the record.
  const allFixes = [...fixes.data.fixes].sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at))
  const allTickets = tickets.data ?? []
  // The counts are what is still open (from feedback, Nov 13, 2026); the lists keep everything.
  const openFixes = allFixes.filter((f) => !f.done_at).length
  const openTickets = allTickets.filter((t) => t.status !== 'closed').length
  const base = `/walkthrough/${w.id}`
  const submitter = (w.submitter as unknown as { full_name: string } | null)?.full_name

  const send = () =>
    submit.mutate(note, {
      onSuccess: () => {
        setAsking(false)
        toast.show(`${monthName(w.period)} walkthrough submitted.`)
        navigate('/walkthrough')
      },
      onError: () => toast.show('Couldn’t submit. Check your connection and try again.'),
    })

  return (
    <Screen>
      <BackBar to="/walkthrough" label="Back to walkthrough" roomy>
        <span className="block text-12 text-text-secondary">
          {monthName(w.period)} walkthrough · {w.restaurantName}
        </span>
        <h1 className="font-display text-20 font-bold text-text">Review &amp; submit</h1>
      </BackBar>

      <ScreenBody className="gap-3 pb-4 pt-2">
        {!open ? (
          <Notice>
            Submitted{w.submitted_at ? ` ${onDay(w.submitted_at)}` : ''}
            {submitter ? ` by ${submitter}` : ''}.
          </Notice>
        ) : left === 0 ? (
          <p className="flex flex-none items-center gap-2 text-14 font-semibold text-brand">
            <IconCheck size={18} strokeWidth={2.6} className="flex-none" />
            All {p.total} checks done, {timing(w.due_on, localDay())}
          </p>
        ) : (
          <Notice tone="warn">
            <b>
              {left} of {p.total} checks are still to do.
            </b>{' '}
            You can submit now, or go back and finish them first.
          </Notice>
        )}

        <div className="grid flex-none grid-cols-3 gap-2">
          <CountTile tone="good" count={p.good} label="Good" />
          <CountTile
            tone="inhouse"
            count={openFixes}
            label="In-house"
            to={viewingAs ? undefined : `${base}/fixes`}
            state={{ backTo: `${base}/review` }}
            ariaLabel={`${openFixes} in-house ${openFixes === 1 ? 'fix' : 'fixes'} to do, view and manage all`}
          />
          <CountTile
            tone="ticket"
            count={openTickets}
            label="Tickets"
            to={viewingAs ? undefined : `${base}/tickets`}
            ariaLabel={`${openTickets} open ${openTickets === 1 ? 'ticket' : 'tickets'}, view and edit all`}
          />
        </div>

        {open && left > 0 && (
          <>
            <span className="eyebrow pt-1">Still to do · {left}</span>
            <div className="flex-none overflow-hidden rounded-control border border-border bg-surface">
              {partsLeft.map((part) => (
                <LeftRow
                  key={part.key}
                  to={viewingAs ? undefined : `${base}/${part.key}`}
                  name={part.name}
                  left={part.total - part.done}
                />
              ))}
            </div>
          </>
        )}

        {allTickets.length > 0 && (
          <>
            <span className="eyebrow pt-1">Tickets created · {allTickets.length}</span>
            <div className="flex-none overflow-hidden rounded-input border border-border-strong bg-surface">
              {allTickets.map((t) => (
                <WalkthroughTicketRow
                  key={t.id}
                  compact
                  to={viewingAs ? undefined : ticketPath(w.id, t)}
                  displayId={t.displayId}
                  title={t.item?.title ?? t.task ?? t.title}
                  where={
                    t.section && t.item
                      ? `${t.section.short} › ${t.item.group}`
                      : t.task
                        ? `${quarterOf(w.period)} tasks`
                        : 'Walkthrough'
                  }
                  status={t.status}
                />
              ))}
            </div>
          </>
        )}

        {allFixes.length > 0 && (
          <>
            <div className="flex flex-none items-baseline justify-between pt-1">
              <span className="eyebrow">In-house to fix · {openFixes}</span>
              {!viewingAs && <span className="text-12 text-text-secondary">Check off when fixed</span>}
            </div>
            <TaskList>
              {allFixes.map((f) => (
                <TaskRow
                  key={f.id}
                  title={f.title}
                  meta={whereFrom(f.origin_label) ?? ''}
                  done={!!f.done_at}
                  onToggle={
                    viewingAs
                      ? undefined
                      : () =>
                          setDone.mutate(
                            { id: f.id, done: !f.done_at },
                            { onError: () => toast.show('Couldn’t save that. Check your connection and try again.') },
                          )
                  }
                />
              ))}
            </TaskList>
          </>
        )}

        {canAct ? (
          <Textarea
            label="Note for Ops"
            optional
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              left === 0
                ? 'Anything they should know?'
                : 'e.g. Short-staffed this week, will finish FOH next walkthrough'
            }
          />
        ) : (
          w.submitted_note && (
            <div className="flex flex-none flex-col gap-1">
              <span className="eyebrow">Note for Ops</span>
              <p className="whitespace-pre-wrap text-14 leading-[1.5] text-text-body">{w.submitted_note}</p>
            </div>
          )
        )}
      </ScreenBody>

      {canAct && (
        <ScreenFooter>
          <Button loading={submit.isPending && !asking} onClick={() => (left === 0 ? send() : setAsking(true))}>
            Submit walkthrough
          </Button>
          <span className="text-center text-13 text-text-secondary">
            Ops and leadership see it as soon as you submit.
          </span>
        </ScreenFooter>
      )}

      <ConfirmSheet
        open={asking}
        onOpenChange={setAsking}
        title={`${left} ${left === 1 ? 'check is' : 'checks are'} still to do`}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-reopened-banner-bg text-reopened-banner-text">
            <IconWarning size={24} />
          </span>
        }
        description="Are you sure you want to submit? Unchecked items won't be marked Good, and Ops will see this walkthrough as not finished."
      >
        <div className="overflow-hidden rounded-control border border-border bg-surface">
          {partsLeft.map((part) => (
            <LeftRow key={part.key} name={part.name} left={part.total - part.done} />
          ))}
        </div>
        <Button onClick={() => setAsking(false)}>Keep going</Button>
        <Button variant="secondary" loading={submit.isPending} onClick={send}>
          Submit anyway
        </Button>
      </ConfirmSheet>
    </Screen>
  )
}
