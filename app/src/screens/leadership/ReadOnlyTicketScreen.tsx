import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ticketPlace } from '../../app/areas'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ErrorBanner } from '../../components/Notice'
import { AddPhotoButton, PhotoTray, PhotoViewer } from '../../components/Photo'
import { RestaurantName } from '../../components/RestaurantName'
import { StatusPill, UrgentTag } from '../../components/Pill'
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner'
import { Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { Composer } from '../../components/Thread'
import { TicketMenu } from '../../components/TicketMenu'
import { useToast } from '../../components/Toast'
import { IconChevronRight, IconReopen } from '../../components/icons'
import { shortDay } from '../../lib/words'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useOpsTicket } from '../ops/useOpsTicket'
import { serviceDay } from '../service/service'
import { Row, Rows } from '../service/ServiceRecordScreen'
import { useTicketService } from '../service/useLogService'
import { money, reopenDaysLeft } from '../tickets/closed'
import { CloseTicketSheet } from '../tickets/CloseTicketSheet'
import { ReopenSheet } from '../tickets/ReopenSheet'
import { ThreadFeed } from '../tickets/ThreadFeed'
import { ROLE_WORD, threadItems } from '../tickets/thread'
import { TicketBar, TicketPhotos, useScrolled } from '../tickets/TicketParts'
import { usePickedPhotos, useSignedPhotos } from '../tickets/usePhotos'
import { usePostUpdate } from '../tickets/useTicket'
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
 * Since OT-170 leadership files tickets, so their ticket screen loses the band: the message
 * box while the ticket is open (they post on any open ticket, as `can_post_on_ticket()`
 * allows, never an internal note), and on a ticket they filed Edit and Close in the menu and
 * Reopen for 30 days once closed, as a Reporter has. Under View as there are none of these.
 *
 * The admin's (/admin/tickets/<id>, OT-148) stays read-only and differs as its board does: the
 * restaurant with its color, no Description label, and Back to Tickets. Visits open nothing,
 * since no board draws an admin's service record.
 */
export function ReadOnlyTicketScreen({ base }: { base: '/lead' | '/admin' }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user, viewingAs } = useUser()
  const roles = useRoleNames()
  const { data, isPending } = useOpsTicket(id)
  const urls = useSignedPhotos(data?.photos.map((p) => p.path) ?? [])
  const [viewing, setViewing] = useState<{ src: string; alt: string } | null>(null)
  const { scrolled, onScroll } = useScrolled()
  const from = (location.state as { from?: string } | null)?.from
  const files = useRight('create_tickets') === true
  const post = usePostUpdate(id)
  const picked = usePickedPhotos()
  const [draft, setDraft] = useState('')
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

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
  // The database already keeps internal notes from leadership and the Admin role; someone
  // holding Admin on the Support Team reads them, so this screen leaves them out as it says.
  const items = threadItems(
    data.updates.filter((u) => !u.internal),
    user.id,
    data.names,
    {
      roleWord: (role) => roles.name(role, ROLE_WORD[role]),
    },
  )
  const count = items.filter((i) => i.type === 'message').length
  const status =
    ticket.status === 'scheduled' && ticket.scheduled_for ? scheduledLabel(ticket.scheduled_for) : undefined

  // Leadership's controls (OT-170); the database holds them to what can_post_on_ticket() and
  // tickets_update allow, and View as shows none.
  const acts = !admin && !viewingAs
  const open = ticket.status !== 'closed'
  const mine = acts && ticket.created_by === user.id
  const canPost = acts && files && open
  const left = mine && !open && ticket.closed_at ? reopenDaysLeft(ticket.closed_at) : 0
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['ops-ticket', id] })

  const send = () =>
    post.mutate(
      { body: draft.trim(), photos: picked.photos },
      {
        onSuccess: () => {
          setDraft('')
          picked.clear()
          // After the refreshed thread has drawn.
          requestAnimationFrame(() => body.current?.scrollTo({ top: body.current.scrollHeight }))
        },
      },
    )

  return (
    <Screen>
      {admin && <ReadOnlyBanner />}
      <TicketBar to={back} label="Back" scrolled={scrolled} underBanner={admin}>
        <span className="flex-1 font-mono text-13 text-text-secondary">{ticket.display_id}</span>
        {ticket.urgency === 'urgent' && <UrgentTag className="mr-2" />}
        {acts && (
          <TicketMenu
            displayId={ticket.display_id ?? ''}
            title={ticket.title}
            items={
              mine && open
                ? [
                    { to: `/lead/tickets/${ticket.id}/edit`, label: 'Edit ticket' },
                    { onSelect: () => setClosing(true), label: 'Close ticket' },
                  ]
                : []
            }
          />
        )}
      </TicketBar>
      {mine && (
        <>
          <CloseTicketSheet
            ticketId={ticket.id}
            displayId={ticket.display_id ?? ''}
            open={closing}
            onOpenChange={setClosing}
            onClosed={() => {
              setClosing(false)
              toast.show(`${ticket.display_id} closed.`)
              refresh()
            }}
          />
          <ReopenSheet
            ticketId={ticket.id}
            closerName={ticket.closer?.full_name}
            open={reopening}
            onOpenChange={setReopening}
            onReopened={() => {
              toast.show(`${ticket.display_id} reopened and sent to ${roles.name('ops', 'Ops')}.`)
              refresh()
            }}
          />
        </>
      )}
      <ScreenBody ref={body} className="gap-3.5 pb-6 pt-3.5" onScroll={onScroll}>
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
          {canPost || left > 0 ? '' : 'You can view this ticket but not change it. '}
          {roles.name('ops', 'Ops')} internal notes aren&apos;t shown.
        </p>
      </ScreenBody>
      {canPost && (
        <>
          {post.isError && (
            <div className="flex-none px-3 pb-2">
              <ErrorBanner title="Couldn't post that yet.">
                Check your connection and try again. Your update is still here.
              </ErrorBanner>
            </div>
          )}
          <Composer
            label={`Write an update for ${roles.name('ops', 'Ops')}`}
            placeholder="Write an update…"
            maxLength={4000}
            value={draft}
            onChange={(value) => {
              if (post.isError) post.reset()
              setDraft(value)
            }}
            onSend={send}
            busy={post.isPending || picked.reading}
            canSendEmpty={picked.photos.length > 0}
            leading={
              <AddPhotoButton
                variant="icon"
                disabled={post.isPending || picked.reading}
                onFiles={(files) => {
                  if (post.isError) post.reset()
                  void picked.add(files)
                }}
              />
            }
            above={
              <>
                <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
                {picked.error && (
                  <span role="alert" className="text-13 font-semibold text-danger">
                    {picked.error}
                  </span>
                )}
              </>
            }
          />
        </>
      )}
      {left > 0 && (
        <ScreenFooter>
          <Button variant="tall" icon={<IconReopen size={20} />} onClick={() => setReopening(true)}>
            Reopen ticket
          </Button>
          <span className="text-center text-12 text-text-secondary">
            You can report this to {roles.name('ops', 'Ops')} for {left} more {left === 1 ? 'day' : 'days'}.
          </span>
        </ScreenFooter>
      )}
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
