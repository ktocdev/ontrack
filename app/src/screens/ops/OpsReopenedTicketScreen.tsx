import { useState } from 'react'
import { Link } from 'react-router'
import { useUser } from '../../auth/context'
import { firstName } from '../../auth/session'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Textarea } from '../../components/Field'
import { Notice } from '../../components/Notice'
import { PhotoThumb, PhotoViewer } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { ReopenedFlag } from '../../components/ReopenedFlag'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { IconChevronLeft, IconWrench } from '../../components/icons'
import { money, reopenStory, timeline } from '../tickets/closed'
import { Fact, Step } from '../tickets/ClosedParts'
import { ROLE_WORD } from '../tickets/thread'
import { ago } from '../tickets/tickets'
import { useClosedFacts } from '../tickets/useCloseTicket'
import { useSignedPhotos } from '../tickets/usePhotos'
import { StartWorkSheet } from './StartWorkSheet'
import { useCloseAgain, type useOpsTicket } from './useOpsTicket'

/**
 * Ops · Reopened ticket (design/screens/Ops-Closed-Ticket), opened from its card on the
 * dashboard, so the arrow goes back there. Why it came back, how it ended last time and how
 * it went, with Start work and Close again. It stays put after either, with a banner and the
 * board's next step; OpsTicketScreen holds what it showed so the refreshed ticket doesn't
 * replace it. The board's promises that the person is notified wait for OT-46.
 */
type Data = NonNullable<ReturnType<typeof useOpsTicket>['data']>
type Ticket = NonNullable<Data['ticket']>
export type ReopenedResult = { kind: 'started'; note: string } | { kind: 'closed' }

const shortDate = (at: string) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function OpsReopenedTicketScreen({
  ticket,
  data,
  result,
  onResult,
  onGoToTicket,
}: {
  ticket: Ticket
  data: Data
  result: ReopenedResult | null
  onResult: (result: ReopenedResult) => void
  onGoToTicket: () => void
}) {
  const { user } = useUser()
  const facts = useClosedFacts(ticket.id).data
  const closeAgain = useCloseAgain(ticket.id)
  const story = reopenStory(data.updates)
  const photos = data.photos.filter((p) => story.reasonUpdateId && p.update_id === story.reasonUpdateId)
  const urls = useSignedPhotos(photos.map((p) => p.path))
  const [starting, setStarting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reply, setReply] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const steps = timeline(data.updates)
  const reporter = firstName(ticket.opener?.full_name) ?? 'The restaurant'
  const days = story.daysAfterClosing
  const flagBy = [
    story.reopenedBy && (ticket.restaurant ? `${story.reopenedBy}, ${ticket.restaurant.name}` : story.reopenedBy),
    story.reopenedAt && ago(new Date(story.reopenedAt), new Date()),
    days !== null && (days === 0 ? 'the day it closed' : `${days} ${days === 1 ? 'day' : 'days'} after closing`),
  ]
    .filter(Boolean)
    .join(' · ')

  const send = () =>
    closeAgain.mutate(reply.trim(), {
      onSuccess: () => {
        setClosing(false)
        onResult({ kind: 'closed' })
      },
    })

  return (
    <Screen>
      <div
        className={`relative z-10 flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-3 pt-[calc(12px+var(--safe-top))] transition-shadow ${
          scrolled ? 'shadow-scrolled' : ''
        }`}
      >
        <Link
          to="/ops"
          aria-label="Back to dashboard"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <span className="flex-1 font-mono text-13 text-text-secondary">{ticket.display_id}</span>
        <StatusPill
          status={result?.kind === 'started' ? 'in_progress' : result?.kind === 'closed' ? 'closed' : 'reopened'}
          className="mr-2"
        />
      </div>

      <ScreenBody className="gap-3 pb-5 pt-3.5" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
        {result?.kind === 'started' && (
          <Notice>
            <b>Work started and you&apos;re on it.</b> It&apos;s In progress on your dashboard.
          </Notice>
        )}
        {result?.kind === 'closed' && (
          <Notice>
            <b>Closed again.</b> {reporter} can see your reply.
          </Notice>
        )}

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
            {story.closedAt && ` · Closed ${shortDate(story.closedAt)}`}
          </span>
        </div>

        {story.reason && (
          <ReopenedFlag
            reason={story.reason}
            by={flagBy}
            photos={
              photos.length > 0
                ? photos.map((p) => {
                    const src = urls.data?.get(p.path)
                    return (
                      <PhotoThumb
                        key={p.path}
                        size="ticket"
                        src={src}
                        alt="Photo from the reopen"
                        onOpen={() => src && setViewing(src)}
                      />
                    )
                  })
                : undefined
            }
          />
        )}

        {(story.closingComment || facts?.contractor || facts?.totalCents != null) && (
          <>
            <SectionLabel className="-mb-0.5">Resolution</SectionLabel>
            <Card className="overflow-hidden">
              {story.closingComment && (
                <div className="flex flex-col gap-1 bg-surface-hover px-3.5 py-3">
                  <span className="text-12 font-bold text-text-secondary">
                    {story.closer?.id === user.id
                      ? 'Your closing comment'
                      : `Closing comment${story.closer ? ` · ${story.closer.full_name}, ${ROLE_WORD[story.closer.role]}` : ''}`}
                  </span>
                  <span className="whitespace-pre-wrap text-14 leading-[1.45] [overflow-wrap:anywhere]">
                    {story.closingComment}
                  </span>
                </div>
              )}
              {facts?.contractor && <Fact label="Contractor">{facts.contractor}</Fact>}
              {facts?.totalCents != null && (
                <Fact label="Cost">
                  <span className="font-mono">{money(facts.totalCents)}</span>
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
              dot={s.end ? 'bg-brand' : s.title === 'Reopened' ? 'bg-status-waiting-text' : 'bg-border-muted'}
            />
          ))}
          {result?.kind === 'started' && (
            <Step
              title="You started work · In progress"
              note={result.note}
              when="Just now"
              dot="bg-status-progress-text"
            />
          )}
        </Card>
      </ScreenBody>

      <ScreenFooter>
        {result?.kind === 'started' ? (
          <Button onClick={onGoToTicket}>Go to ticket</Button>
        ) : result?.kind === 'closed' ? (
          <Button variant="secondary" onClick={() => setStarting(true)}>
            Start work anyway
          </Button>
        ) : (
          <>
            <Button icon={<IconWrench size={20} />} onClick={() => setStarting(true)}>
              Start work
            </Button>
            <Button variant="secondary" onClick={() => setClosing(true)}>
              Close again
            </Button>
          </>
        )}
      </ScreenFooter>

      <StartWorkSheet
        ticketId={ticket.id}
        displayId={ticket.display_id ?? ''}
        reporter={ticket.opener?.full_name}
        open={starting}
        onOpenChange={setStarting}
        onStarted={(note) => {
          setStarting(false)
          onResult({ kind: 'started', note })
        }}
      />
      <Sheet
        open={closing}
        onOpenChange={(open) => {
          if (!open) closeAgain.reset()
          setClosing(open)
        }}
        title="Close again"
        description={`Use this if it's a different problem, or the original fix is fine. ${reporter} sees your reply and the ticket goes back to Closed.`}
      >
        <Textarea label="Message" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
        {closeAgain.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </span>
        )}
        <Button loading={closeAgain.isPending} disabled={!reply.trim()} onClick={send}>
          Send and close
        </Button>
        <Button variant="secondary" onClick={() => setClosing(false)}>
          Cancel
        </Button>
      </Sheet>
      <PhotoViewer src={viewing} alt="Photo from the reopen" onClose={() => setViewing(null)} />
    </Screen>
  )
}
