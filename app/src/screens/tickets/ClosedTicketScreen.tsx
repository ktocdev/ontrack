import { ticketArea, ticketPlace } from '../../app/areas'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, ButtonLink } from '../../components/Button'
import { Card } from '../../components/Card'
import { Notice } from '../../components/Notice'
import { PhotoViewer } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { TicketMenu } from '../../components/TicketMenu'
import { IconPlus, IconReopen } from '../../components/icons'
import { longDate, money, reopenDaysLeft, timeline, timeToClose } from './closed'
import { ClosingComment, Fact, HandedBackFact, Step, Timeline } from './ClosedParts'
import { TicketBar, TicketPhotos, useScrolled } from './TicketParts'
import { ROLE_WORD, type Update } from './thread'
import { useRoleNames } from '../../auth/group'
import { useClosedFacts } from './useCloseTicket'
import { ReopenSheet } from './ReopenSheet'
import { useSignedPhotos } from './usePhotos'
import type { useTicket } from './useTicket'

/**
 * Manager · Closed ticket (design/screens/Closed-Ticket). What was wrong, how it ended
 * and how it went, read-only, with Reopen ticket for 30 days and then Create ticket
 * from this. Contractor and Cost appear only if the database returns them, which takes
 * see_costs. After reopening it stays put with a banner and the new step, as the board
 * draws it; TicketScreen holds what it showed so the refreshed ticket doesn't replace it.
 * The banner promises a notification when work starts, as the board does. Opened from
 * the Closed tickets list (?from=closed), the back arrow returns there.
 */
type Data = NonNullable<ReturnType<typeof useTicket>['data']>
type Ticket = NonNullable<Data['ticket']>

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
  const [params] = useSearchParams()
  const fromList = params.get('from') === 'closed'
  const facts = useClosedFacts(ticket.id).data
  const roleNames = useRoleNames()
  const paths = photos.filter((p) => !p.update_id).map((p) => p.path)
  const urls = useSignedPhotos(paths)
  const [asking, setAsking] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const { scrolled, onScroll } = useScrolled()

  // Held on arrival: once reopened, the refreshed ticket no longer has these.
  const [held] = useState(() => ({ closedAt: ticket.closed_at }))
  const closedAt = facts?.closed_at ?? held.closedAt
  const left = closedAt ? reopenDaysLeft(closedAt) : 0
  const closerName = facts?.closer?.full_name
  const steps = timeline(updates)

  return (
    <Screen>
      <TicketBar
        to={fromList ? '/tickets/closed' : '/tickets'}
        label={fromList ? 'Back to closed tickets' : 'Back to open tickets'}
        scrolled={scrolled}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-12 font-semibold text-text-secondary">
            {ticket.equipment ? `${ticket.equipment.name} · Tickets` : 'Tickets'}
          </span>
          <h1 className="font-display text-20 font-bold">Closed ticket</h1>
        </div>
        <TicketMenu displayId={ticket.display_id ?? ''} title={ticket.title} />
      </TicketBar>

      <ScreenBody className="gap-3 pb-5 pt-4" onScroll={onScroll}>
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
            <b>Reopened and sent to Ops.</b> It&apos;s back on the Ops list. You&apos;ll get a notification when work
            starts.
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
          {ticketPlace(ticket).map((part) => ` › ${part}`)}
          {ticket.equipment && <span className="block">{ticket.equipment.name}</span>}
        </span>
        {ticket.description && (
          <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
            {ticket.description}
          </p>
        )}
        <TicketPhotos paths={paths} urls={urls.data} onOpen={setViewing} />
        <div className="flex flex-none justify-between gap-3 text-12 text-text-muted">
          <span>
            Opened by {ticket.opener?.full_name ?? 'someone'} · {longDate(new Date(ticket.created_at))}
          </span>
          <span className="flex-none capitalize">{ticket.urgency}</span>
        </div>

        <SectionLabel className="-mb-0.5">Resolution</SectionLabel>
        <Card className="overflow-hidden">
          {facts?.resolution && (
            <ClosingComment
              heading={`Closing comment${facts.closer ? ` · ${facts.closer.full_name}, ${roleNames.name(facts.closer.role, ROLE_WORD[facts.closer.role])}` : ''}`}
            >
              {facts.resolution}
            </ClosingComment>
          )}
          {facts?.handedBack && <HandedBackFact task={facts.handedBack} to="/tickets/in-house" />}
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

        <Timeline steps={steps}>
          {reopened !== null && (
            <Step title="You reopened this" note={reopened} when="You · Just now" dot="bg-status-waiting-text" />
          )}
        </Timeline>
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
              to={
                // A walkthrough ticket with no category (OT-141) starts at its area's categories.
                ticket.category_id
                  ? `/tickets/new/${ticket.category_id}?area=${ticket.category?.area ?? 'boh'}&restaurant=${ticket.restaurant_id}`
                  : `/tickets/new?area=${ticketArea(ticket) ?? 'boh'}&restaurant=${ticket.restaurant_id}`
              }
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

      <ReopenSheet
        ticketId={ticket.id}
        closerName={closerName}
        open={asking}
        onOpenChange={setAsking}
        onReopened={onReopened}
      />
      <PhotoViewer src={viewing} alt="Photo on this ticket" onClose={() => setViewing(null)} />
    </Screen>
  )
}
