import { useState } from 'react'
import { Link } from 'react-router'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PhotoThumb, PhotoViewer } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { IconChevronLeft } from '../../components/icons'
import { money, timeline } from '../tickets/closed'
import { Fact, Step } from '../tickets/ClosedParts'
import { ROLE_WORD } from '../tickets/thread'
import { useClosedFacts } from '../tickets/useCloseTicket'
import { useSignedPhotos } from '../tickets/usePhotos'
import { StartWorkSheet } from './StartWorkSheet'
import type { useOpsTicket } from './useOpsTicket'

/**
 * Ops · Closed ticket (design/screens/Ops-Closed-Ticket, its closed state). How it ended and
 * how it went, read-only, with the back arrow to Closed tickets. The board leaves out what
 * was wrong, because its flag says that; a closed ticket has no flag, so the description
 * and its photos stay, as on a manager's Closed ticket. Contractor and Cost appear only if
 * the database returns them, which takes see_costs. Start work anyway brings it back as
 * In progress, and the refreshed ticket then shows its ordinary screen.
 */
type Data = NonNullable<ReturnType<typeof useOpsTicket>['data']>
type Ticket = NonNullable<Data['ticket']>

export function OpsClosedTicketScreen({ ticket, data }: { ticket: Ticket; data: Data }) {
  const { user } = useUser()
  const facts = useClosedFacts(ticket.id).data
  const paths = data.photos.filter((p) => !p.update_id).map((p) => p.path)
  const urls = useSignedPhotos(paths)
  const [starting, setStarting] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const steps = timeline(data.updates)
  const closedOn = facts?.closed_at
    ? new Date(facts.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const hasCost = facts?.totalCents != null
  const hasResolution = !!facts?.resolution || !!facts?.contractor || hasCost

  return (
    <Screen>
      <div
        className={`relative z-10 flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-3 pt-[calc(12px+var(--safe-top))] transition-shadow ${
          scrolled ? 'shadow-scrolled' : ''
        }`}
      >
        <Link
          to="/ops/closed"
          aria-label="Back to closed tickets"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <span className="flex-1 font-mono text-13 text-text-secondary">{ticket.display_id}</span>
        <StatusPill status="closed" className="mr-2" />
      </div>

      <ScreenBody className="gap-3 pb-5 pt-3.5" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
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

        {hasResolution && (
          <>
            <SectionLabel className="-mb-0.5">Resolution</SectionLabel>
            <Card className="overflow-hidden">
              {facts?.resolution && (
                <div className="flex flex-col gap-1 bg-surface-hover px-3.5 py-3">
                  <span className="text-12 font-bold text-text-secondary">
                    {facts.closer?.id === user.id
                      ? 'Your closing comment'
                      : `Closing comment${facts.closer ? ` · ${facts.closer.full_name}, ${ROLE_WORD[facts.closer.role]}` : ''}`}
                  </span>
                  <span className="whitespace-pre-wrap text-14 leading-[1.45] [overflow-wrap:anywhere]">
                    {facts.resolution}
                  </span>
                </div>
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
        </Card>
      </ScreenBody>
      <ScreenFooter>
        <Button variant="secondary" onClick={() => setStarting(true)}>
          Start work anyway
        </Button>
      </ScreenFooter>
      <StartWorkSheet
        ticketId={ticket.id}
        displayId={ticket.display_id ?? ''}
        reporter={ticket.opener?.full_name}
        open={starting}
        onOpenChange={setStarting}
        onStarted={() => setStarting(false)}
      />
      <PhotoViewer src={viewing} alt="Photo on this ticket" onClose={() => setViewing(null)} />
    </Screen>
  )
}
