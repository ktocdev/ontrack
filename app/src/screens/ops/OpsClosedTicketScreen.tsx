import { useState } from 'react'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Card } from '../../components/Card'
import { PhotoViewer } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { TicketMenu } from '../../components/TicketMenu'
import { LogServiceLink } from '../service/TicketService'
import { money, timeline } from '../tickets/closed'
import { ClosingComment, Fact, Timeline } from '../tickets/ClosedParts'
import { ROLE_WORD } from '../tickets/thread'
import { useClosedFacts } from '../tickets/useCloseTicket'
import { useSignedPhotos } from '../tickets/usePhotos'
import { TicketBar, TicketPhotos, useScrolled } from '../tickets/TicketParts'
import type { useOpsTicket } from './useOpsTicket'

/**
 * Ops · Closed ticket (design/screens/Ops-Closed-Ticket, its closed state). How it ended and
 * how it went, read-only, with the back arrow to Closed tickets. The board leaves out what
 * was wrong, because its flag says that; a closed ticket has no flag, so the description
 * and its photos stay, as on a manager's Closed ticket. Contractor and Cost appear only if
 * the database returns them, which takes see_costs. A bill often comes after closing, so
 * "+ Log service" sits beside Resolution for anyone with log_cost (OT-92).
 */
type Data = NonNullable<ReturnType<typeof useOpsTicket>['data']>
type Ticket = NonNullable<Data['ticket']>

export function OpsClosedTicketScreen({ ticket, data }: { ticket: Ticket; data: Data }) {
  const { user, viewingAs } = useUser()
  const canLog = useRight('log_cost') && !viewingAs
  const facts = useClosedFacts(ticket.id).data
  const paths = data.photos.filter((p) => !p.update_id).map((p) => p.path)
  const urls = useSignedPhotos(paths)
  const [viewing, setViewing] = useState<string | null>(null)
  const { scrolled, onScroll } = useScrolled()
  const steps = timeline(data.updates)
  const closedOn = facts?.closed_at
    ? new Date(facts.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const hasCost = facts?.totalCents != null
  const hasResolution = !!facts?.resolution || !!facts?.contractor || hasCost

  return (
    <Screen>
      <TicketBar to="/ops/closed" label="Back to closed tickets" scrolled={scrolled}>
        <span className="flex-1 font-mono text-13 text-text-secondary">{ticket.display_id}</span>
        <StatusPill status="closed" className="mr-2" />
        <TicketMenu displayId={ticket.display_id ?? ''} title={ticket.title} />
      </TicketBar>

      <ScreenBody className="gap-3 pb-5 pt-3.5" onScroll={onScroll}>
        <div className="flex flex-none flex-col gap-1">
          <h1 className="font-display text-24 font-bold leading-[1.2] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {ticket.title}
          </h1>
          <span className="text-13 text-text-muted">
            {ticket.restaurant && (
              <span className="font-bold text-text-body">
                <RestaurantSquare color={ticket.restaurant.color} size={9} className="mr-1.5" />
                {ticket.restaurant.name}
              </span>
            )}
            {ticket.equipment && ` · ${ticket.equipment.name}`}
            {closedOn && ` · Closed ${closedOn}`}
          </span>
        </div>

        {ticket.description && (
          <p className="whitespace-pre-wrap text-14 leading-normal text-text-body [overflow-wrap:anywhere]">
            {ticket.description}
          </p>
        )}
        <TicketPhotos paths={paths} urls={urls.data} onOpen={setViewing} />

        {(hasResolution || canLog) && (
          <div className="-mb-0.5 flex items-end justify-between gap-3">
            <SectionLabel>{hasResolution ? 'Resolution' : 'Service & cost'}</SectionLabel>
            <LogServiceLink to={`/ops/tickets/${ticket.id}/service/new`} className="-mb-2" />
          </div>
        )}
        {hasResolution && (
          <>
            <Card className="overflow-hidden">
              {facts?.resolution && (
                <ClosingComment
                  heading={
                    facts.closer?.id === user.id
                      ? 'Your closing comment'
                      : `Closing comment${facts.closer ? ` · ${facts.closer.full_name}, ${ROLE_WORD[facts.closer.role]}` : ''}`
                  }
                >
                  {facts.resolution}
                </ClosingComment>
              )}
              {facts?.contractor && <Fact label="Contractor">{facts.contractor}</Fact>}
              {hasCost && (
                <Fact label="Cost">
                  <span className="font-mono">{money(facts.totalCents!)}</span>
                </Fact>
              )}
            </Card>
          </>
        )}

        <Timeline steps={steps} />
      </ScreenBody>
      <PhotoViewer src={viewing} alt="Photo on this ticket" onClose={() => setViewing(null)} />
    </Screen>
  )
}
