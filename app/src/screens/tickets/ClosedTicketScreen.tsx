import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { Card } from '../../components/Card'
import { Textarea } from '../../components/Field'
import { ErrorBanner, Notice } from '../../components/Notice'
import { AddPhotoButton, PhotoThumb, PhotoTray, PhotoViewer } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { IconChevronLeft, IconPlus, IconReopen } from '../../components/icons'
import { longDate, money, reopenDaysLeft, timeline, timeToClose } from './closed'
import { ROLE_WORD, type Update } from './thread'
import { useClosedFacts, useReopenTicket } from './useCloseTicket'
import { usePickedPhotos, useSignedPhotos } from './usePhotos'
import type { useTicket } from './useTicket'

/**
 * Manager · Closed ticket (design/screens/Closed-Ticket). What was wrong, how it ended
 * and how it went, read-only, with Reopen ticket for 30 days and then Create ticket
 * from this. Contractor and Cost appear only if the database returns them, which takes
 * see_costs. After reopening it stays put with a banner and the new step, as the board
 * draws it; TicketScreen holds what it showed so the refreshed ticket doesn't replace it.
 * The board's promise of a notification when work starts waits for Phase 3.
 */
type Data = NonNullable<ReturnType<typeof useTicket>['data']>
type Ticket = NonNullable<Data['ticket']>

const AREA_SHORT = { foh: 'FOH', boh: 'BOH' }

export function ClosedTicketScreen({
  ticket,
  updates,
  photos,
  reopened,
  onReopened,
}: {
  ticket: Ticket
  updates: Update[]
  photos: Data['photos']
  /** The reason, once it has been reopened from this screen. */
  reopened: string | null
  onReopened: (note: string) => void
}) {
  const facts = useClosedFacts(ticket.id).data
  const reopen = useReopenTicket(ticket.id)
  const picked = usePickedPhotos()
  const paths = photos.filter((p) => !p.update_id).map((p) => p.path)
  const urls = useSignedPhotos(paths)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  // Held on arrival: once reopened, the refreshed ticket no longer has these.
  const [held] = useState(() => ({ closedAt: ticket.closed_at }))
  const closedAt = facts?.closed_at ?? held.closedAt
  const left = closedAt ? reopenDaysLeft(closedAt) : 0
  const closerName = facts?.closer?.full_name
  const steps = timeline(updates)
  const refused = (reopen.error as { code?: string } | null)?.code === '42501'

  const send = () =>
    reopen.mutate(
      { note: note.trim(), photos: picked.photos },
      {
        onSuccess: () => {
          setAsking(false)
          onReopened(note.trim())
        },
      },
    )

  return (
    <Screen>
      <div
        className={`relative z-10 flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-5 pt-[calc(12px+var(--safe-top))] transition-shadow ${
          scrolled ? 'shadow-scrolled' : ''
        }`}
      >
        <Link
          to="/tickets"
          aria-label="Back to open tickets"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-12 font-semibold text-text-secondary">
            {ticket.equipment ? `${ticket.equipment.name} · Tickets` : 'Tickets'}
          </span>
          <h1 className="font-display text-20 font-bold">Closed ticket</h1>
        </div>
      </div>

      <ScreenBody className="gap-3 pb-5 pt-4" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
        <div className="flex flex-none items-center justify-between gap-2">
          <span className="font-mono text-12 text-text-muted">{ticket.display_id}</span>
          {reopened !== null ? (
            <StatusPill status="reopened" />
          ) : (
            <StatusPill status="closed" label={closedAt ? `Closed ${longDate(new Date(closedAt))}` : 'Closed'} />
          )}
        </div>
        {reopened !== null && (
          <Notice tone="waiting">
            <b>Reopened and sent to {ticket.assignee?.full_name ?? 'Ops'}.</b> It&apos;s back on the Ops list.
          </Notice>
        )}
        <h2 className="-mt-1 font-display text-26 font-bold leading-[1.2] tracking-[-0.02em]">{ticket.title}</h2>
        <span className="-mt-1.5 text-13 leading-[1.4] text-text-muted">
          {ticket.restaurant && (
            <span className="font-bold text-text-body">
              <RestaurantSquare color={ticket.restaurant.color} size={9} className="mr-1.5" />
              {ticket.restaurant.name}
            </span>
          )}
          {ticket.category && ` › ${AREA_SHORT[ticket.category.area]} › ${ticket.category.name}`}
          {ticket.equipment && <span className="block">{ticket.equipment.name}</span>}
        </span>
        {ticket.description && (
          <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
            {ticket.description}
          </p>
        )}
        {paths.length > 0 && (
          <div className="flex flex-none flex-wrap gap-2">
            {paths.map((path) => {
              const src = urls.data?.get(path)
              return (
                <PhotoThumb
                  key={path}
                  size="ticket"
                  src={src}
                  alt="Photo on this ticket"
                  onOpen={() => src && setViewing(src)}
                />
              )
            })}
          </div>
        )}
        <div className="flex flex-none justify-between gap-3 text-12 text-text-muted">
          <span>
            Opened by {ticket.opener?.full_name ?? 'someone'} · {longDate(new Date(ticket.created_at))}
          </span>
          <span className="flex-none capitalize">{ticket.urgency}</span>
        </div>

        <SectionLabel className="-mb-0.5">Resolution</SectionLabel>
        <Card className="overflow-hidden">
          {facts?.resolution && (
            <div className="flex flex-col gap-1 bg-surface-hover px-3.5 py-3">
              <span className="text-12 font-bold text-text-secondary">
                Closing comment
                {facts.closer && ` · ${facts.closer.full_name}, ${ROLE_WORD[facts.closer.role]}`}
              </span>
              <span className="whitespace-pre-wrap text-14 leading-[1.45] [overflow-wrap:anywhere]">
                {facts.resolution}
              </span>
            </div>
          )}
          {closedAt && (
            <Fact label="Closed by">
              {closerName ? `${closerName} · ` : ''}
              {longDate(new Date(closedAt))}
            </Fact>
          )}
          {closedAt && <Fact label="Time to close">{timeToClose(ticket.created_at, closedAt)}</Fact>}
          {facts?.contractor && <Fact label="Contractor">{facts.contractor}</Fact>}
          {facts?.totalCents != null && (
            <Fact label="Cost">
              <span className="font-mono">{money(facts.totalCents)}</span>
            </Fact>
          )}
        </Card>

        <SectionLabel className="-mb-0.5">Timeline</SectionLabel>
        <Card className="overflow-hidden">
          {steps.map((s) => (
            <Step
              key={s.key}
              title={s.title}
              note={s.note}
              when={s.when}
              dot={s.end ? 'bg-brand' : 'bg-border-muted'}
            />
          ))}
          {reopened !== null && (
            <Step title="You reopened this" note={reopened} when="You · Just now" dot="bg-status-waiting-text" />
          )}
        </Card>
      </ScreenBody>

      <ScreenFooter>
        {reopened !== null ? (
          <div
            aria-disabled="true"
            className="flex min-h-[52px] items-center justify-center rounded-input border border-border-strong text-16 font-bold text-text-muted"
          >
            Waiting on Ops
          </div>
        ) : left > 0 ? (
          <>
            <Button variant="tall" icon={<IconReopen size={20} />} onClick={() => setAsking(true)}>
              Reopen ticket
            </Button>
            <span className="text-center text-12 text-text-secondary">
              You can report this to Ops for {left} more {left === 1 ? 'day' : 'days'}.
            </span>
          </>
        ) : (
          <>
            <ButtonLink
              variant="tall"
              icon={<IconPlus size={20} />}
              to={`/tickets/new/${ticket.category_id}?area=${ticket.category?.area ?? 'boh'}&restaurant=${ticket.restaurant_id}`}
              state={{
                parentTicketId: ticket.id,
                title: ticket.title,
                description: ticket.description,
                equipmentId: ticket.equipment_id,
              }}
            >
              Create ticket from this
            </ButtonLink>
            <span className="text-center text-12 text-text-secondary">
              Closed more than 30 days ago. Starts a new ticket with {ticket.display_id} linked.
            </span>
          </>
        )}
      </ScreenFooter>

      <Sheet
        open={asking}
        onOpenChange={(open) => {
          if (!open) reopen.reset()
          setAsking(open)
        }}
        title="Is the problem back?"
        description={`${closerName ?? 'Ops'} closed this. Describe what’s happening and it goes back on the Ops list as Reopened.`}
      >
        {reopen.isError && (
          <ErrorBanner title="Couldn't reopen yet.">
            {refused
              ? 'This ticket was closed too long ago, or your account can’t reopen it.'
              : 'Check your connection and try again.'}{' '}
            What you wrote is still here.
          </ErrorBanner>
        )}
        <div className="flex flex-col gap-1.5">
          <Textarea label="What's happening?" value={note} onChange={(e) => setNote(e.target.value)} />
          <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
          {picked.error && (
            <span role="alert" className="text-13 font-semibold text-danger">
              {picked.error}
            </span>
          )}
          <AddPhotoButton disabled={picked.reading} onFiles={(f) => void picked.add(f)} />
        </div>
        <Button loading={reopen.isPending} disabled={!note.trim() || picked.reading} onClick={send}>
          Reopen ticket
        </Button>
        <Button variant="secondary" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </Sheet>
      <PhotoViewer src={viewing} alt="Photo on this ticket" onClose={() => setViewing(null)} />
    </Screen>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border px-3.5 py-3 text-14 first:border-t-0">
      <span className="flex-none text-13 text-text-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

function Step({ title, note, when, dot }: { title: string; note: string | null; when: string; dot: string }) {
  return (
    <div className="flex gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
      <span aria-hidden="true" className={`mt-[5px] h-2.5 w-2.5 flex-none rounded-full ${dot}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-14 font-semibold">{title}</span>
        {note && <span className="whitespace-pre-wrap text-14 leading-[1.4] text-text-body">{note}</span>}
        <span className="text-12 text-text-muted">{when}</span>
      </div>
    </div>
  )
}
