import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ticketPlace } from '../../app/areas'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { Card } from '../../components/Card'
import { PhotoViewer } from '../../components/Photo'
import { RestaurantName } from '../../components/RestaurantName'
import { StatusPill, UrgentTag } from '../../components/Pill'
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { IconChevronRight } from '../../components/icons'
import { shortDay } from '../../lib/words'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useOpsTicket } from '../ops/useOpsTicket'
import { serviceDay } from '../service/service'
import { Row, Rows } from '../service/ServiceRecordScreen'
import { useTicketService } from '../service/useLogService'
import { money } from '../tickets/closed'
import { ThreadFeed } from '../tickets/ThreadFeed'
import { ROLE_WORD, threadItems } from '../tickets/thread'
import { TicketBar, TicketPhotos, useScrolled } from '../tickets/TicketParts'
import { useSignedPhotos } from '../tickets/usePhotos'
import { scheduledLabel } from '../tickets/tickets'

/**
 * Leadership · Ticket, read-only (design/screens/Exec-Ticket, OT-145); the admin's ticket
 * (Admin-Ticket, OT-148) is the same board. Under READ-ONLY VIEW: the number and Urgent,
 * the title with the restaurant and who opened it when, then Status, who is on it (the
 * board's Assigned; nobody assigns since OT-48), where it belongs and the unit; the
 * description and photos; Service & cost with See costs, each visit opening its service
 * record; the thread without internal notes, which the database keeps from anyone without
 * Update status; and a line saying it can't be changed. A closed ticket shows the same,
 * with its resolution. Back returns where it came from inside this app, else to the
 * ticket's restaurant.
 *
 * The admin's (/admin/tickets/<id>, OT-148) differs as its board does: the restaurant with
 * its color, no Description label, and Back to Tickets. Visits open nothing, since no board
 * draws an admin's service record.
 */
export function ReadOnlyTicketScreen({ base }: { base: '/lead' | '/admin' }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user } = useUser()
  const roles = useRoleNames()
  const { data, isPending } = useOpsTicket(id)
  const urls = useSignedPhotos(data?.photos.map((p) => p.path) ?? [])
  const [viewing, setViewing] = useState<{ src: string; alt: string } | null>(null)
  const { scrolled, onScroll } = useScrolled()
  const from = (location.state as { from?: string } | null)?.from

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  const ticket = data?.ticket
  if (!ticket) return <NotFoundScreen />

  // From a lasting link there is nothing to go back to, so Back opens the ticket's restaurant.
  const admin = base === '/admin'
  const opened = new Date(ticket.created_at)
  const back =
    from && from.startsWith(`${base}/`)
      ? from
      : admin
        ? '/admin/tickets'
        : `${base}/restaurants/${ticket.restaurant_id}`
  const by = `by ${ticket.opener?.full_name ?? 'someone'}, ${shortDay(opened)} ${opened.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  const items = threadItems(data.updates, user.id, data.names, {
    roleWord: (role) => roles.name(role, ROLE_WORD[role]),
  })
  const count = items.filter((i) => i.type === 'message').length
  const status =
    ticket.status === 'scheduled' && ticket.scheduled_for ? scheduledLabel(ticket.scheduled_for) : undefined

  return (
    <Screen>
      <ReadOnlyBanner />
      <TicketBar to={back} label="Back" scrolled={scrolled} underBanner>
        <span className="flex-1 font-mono text-13 text-text-secondary">{ticket.display_id}</span>
        {ticket.urgency === 'urgent' && <UrgentTag className="mr-2" />}
      </TicketBar>
      <ScreenBody className="gap-3.5 pb-6 pt-3.5" onScroll={onScroll}>
        <div className="flex flex-none flex-col gap-1">
          <h1 className="font-display text-24 font-bold leading-[1.2] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {ticket.title}
          </h1>
          {admin && ticket.restaurant ? (
            <span className="text-13 text-text-secondary">
              <RestaurantName
                name={ticket.restaurant.name}
                color={ticket.restaurant.color}
                variant="meta"
                className="mr-1 align-middle text-13"
              />
              · {by}
            </span>
          ) : (
            <span className="text-13 text-text-secondary">
              {[ticket.restaurant?.name, by].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <Rows>
          <Row label="Status">
            <StatusPill status={ticket.status} label={status} />
          </Row>
          <Row label="On it">{ticket.assignee?.full_name ?? 'Nobody yet'}</Row>
          {ticketPlace(ticket, 'long').length > 0 && (
            <Row label={ticket.category ? 'Area' : 'Checklist'}>{ticketPlace(ticket, 'long').join(' › ')}</Row>
          )}
          {ticket.equipment && <Row label="Equipment">{ticket.equipment.name}</Row>}
        </Rows>
        {ticket.description && (
          <>
            {!admin && <SectionLabel className="-mb-0.5">Description</SectionLabel>}
            <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
              {ticket.description}
            </p>
          </>
        )}
        <TicketPhotos
          paths={data.photos.filter((p) => !p.update_id).map((p) => p.path)}
          urls={urls.data}
          onOpen={(src) => setViewing({ src, alt: 'Photo on this ticket' })}
        />
        {ticket.status === 'closed' && ticket.resolution && (
          <>
            <SectionLabel className="-mb-0.5">Resolution</SectionLabel>
            <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
              {ticket.resolution}
            </p>
          </>
        )}
        <ServiceAndCost ticketId={ticket.id} base={admin ? null : base} />
        <h2 className="eyebrow -mb-1 pt-1">Updates · {count}</h2>
        <ThreadFeed items={items} photos={data.photos} urls={urls.data} onOpen={setViewing} />
        <p className="pt-2 text-center text-13 leading-normal text-text-muted">
          You can view this ticket but not change it. {roles.name('ops', 'Ops')} internal notes aren&apos;t shown.
        </p>
      </ScreenBody>
      <PhotoViewer src={viewing?.src ?? null} alt={viewing?.alt ?? ''} onClose={() => setViewing(null)} />
    </Screen>
  )
}

/** Each visit on the ticket: who, when and whether its invoice is in, and what it cost. */
function ServiceAndCost({ ticketId, base }: { ticketId: string; base: string | null }) {
  const seeCosts = useRight('see_costs') === true
  const { viewingAs } = useUser()
  const { data } = useTicketService(ticketId, seeCosts)
  if (!seeCosts || !data || data.records.length === 0) return null
  return (
    <section aria-label="Service & cost" className="flex flex-none flex-col gap-2">
      <h2 className="eyebrow -mb-1 pt-1">Service &amp; cost</h2>
      <Card className="overflow-hidden">
        {data.records.map((r) => {
          const body = (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-15 font-semibold [overflow-wrap:anywhere]">
                  {r.kind === 'in_house' ? 'In-house' : (r.contractor?.name ?? 'Contractor')}
                </span>
                <span className="text-12 text-text-muted">
                  {serviceDay(r.service_date)}
                  {r.kind === 'contractor' && (r.invoiceAttached ? ' · Invoice attached' : ' · Invoice missing')}
                </span>
              </span>
              <span className="flex-none font-mono text-15 font-medium">{money(r.totalCents)}</span>
              {!viewingAs && base && <IconChevronRight size={16} className="flex-none text-text-muted" />}
            </>
          )
          const cls = 'flex items-center gap-3 border-t border-border px-3.5 py-3 text-text first:border-t-0'
          return viewingAs || !base ? (
            <div key={r.id} className={cls}>
              {body}
            </div>
          ) : (
            <Link
              key={r.id}
              to={`${base}/service/${r.id}`}
              state={{ from: `${base}/tickets/${ticketId}` }}
              className={`${cls} transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
            >
              {body}
            </Link>
          )
        })}
      </Card>
    </section>
  )
}
