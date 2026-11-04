import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { AddPhotoButton, PhotoThumb, PhotoTray, PhotoViewer } from '../../components/Photo'
import { statusLabel, UrgentTag, type PillStatus } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { StatusMenu } from '../../components/StatusMenu'
import { Composer, VisibilityToggle } from '../../components/Thread'
import { TicketMenu } from '../../components/TicketMenu'
import { useToast } from '../../components/Toast'
import { IconChevronLeft, IconClipboardCheck, IconClose, IconPlus, IconWrench } from '../../components/icons'
import type { TicketStatus } from '../../lib/supabase'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { longDate } from '../tickets/closed'
import { scheduledLabel } from '../tickets/tickets'
import { ThreadFeed } from '../tickets/ThreadFeed'
import { threadItems } from '../tickets/thread'
import { useCloseTicket } from '../tickets/useCloseTicket'
import { usePickedPhotos, useSignedPhotos } from '../tickets/usePhotos'
import { usePostUpdate } from '../tickets/useTicket'
import { OpsClosedTicketScreen } from './OpsClosedTicketScreen'
import { useOpsTicket, useSetTicketStatus, useTakeTicket } from './useOpsTicket'

/**
 * Ops · Ticket (from design/screens/Ops-Ticket, simplified from feedback). Nobody assigns
 * a ticket, so the board's Assigned dropdown is a line saying who is on it, and the status
 * decides that: In progress puts you on it, back to Open takes the person off. Take this
 * over is for one a colleague has. Scheduled asks for its date, which has no board. Links
 * to later phases stay off: the equipment card and the walkthrough open nothing yet, and
 * Service & cost waits for Phase 5. Writing back and forth is rare for Ops, so the message
 * box stays hidden until Add update, keeps any draft if hidden again, and closes on posting.
 * Updates go to the restaurant unless the toggle says internal, and Close ticket takes an
 * optional comment, then goes back to the dashboard.
 * A closed ticket has its own screen. A reopened ticket is an ordinary one here.
 */
const OPTIONS: PillStatus[] = ['open', 'in_progress', 'waiting_parts', 'scheduled']

function timestamp(d: Date) {
  return `${longDate(d)} - ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function monthOf(period: string) {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-[68px] flex-none text-text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-text-body">{children}</span>
    </div>
  )
}

export function OpsTicketScreen() {
  const { id = '' } = useParams()
  const { user, viewingAs } = useUser()
  const { data, isPending } = useOpsTicket(id)
  const setStatus = useSetTicketStatus(id)
  const take = useTakeTicket(id)
  const toast = useToast()
  const urls = useSignedPhotos(data?.photos.map((p) => p.path) ?? [])
  const post = usePostUpdate(id)
  const close = useCloseTicket(id)
  const picked = usePickedPhotos()
  const navigate = useNavigate()
  const body = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [writing, setWriting] = useState(false)
  const [internal, setInternal] = useState(false)
  const [closing, setClosing] = useState(false)
  const [comment, setComment] = useState('')
  const [viewing, setViewing] = useState<{ src: string; alt: string } | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [date, setDate] = useState('')
  const [scrolled, setScrolled] = useState(false)

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  const ticket = data?.ticket
  if (!ticket) return <NotFoundScreen />
  if (ticket.status === 'closed') return <OpsClosedTicketScreen ticket={ticket} data={data} />

  const failed = () => toast.show('Couldn’t change that. Check your connection and try again.')
  const pick = (status: PillStatus) => {
    if (status === 'scheduled') {
      setDate(ticket.scheduled_for ?? '')
      setScheduling(true)
    } else if (status !== ticket.status && status !== 'fixed') {
      setStatus.mutate({ status: status as TicketStatus }, { onError: failed })
    }
  }
  const saveDate = () =>
    setStatus.mutate(
      { status: 'scheduled', scheduledFor: date },
      {
        onSuccess: () => setScheduling(false),
        onError: failed,
      },
    )

  const send = () =>
    post.mutate(
      { body: draft.trim(), photos: picked.photos, internal },
      {
        onSuccess: () => {
          setDraft('')
          picked.clear()
          setWriting(false)
          // After the refreshed thread has drawn.
          requestAnimationFrame(() => body.current?.scrollTo({ top: body.current.scrollHeight }))
        },
      },
    )
  const confirmClose = () =>
    close.mutate(comment.trim(), {
      onSuccess: () => {
        toast.show(`${ticket.display_id} closed.`)
        navigate('/ops')
      },
    })

  const items = threadItems(data.updates, user.id, data.names, { ops: true })
  const count = items.filter((i) => i.type === 'message').length
  const onTicket = data.photos.filter((p) => !p.update_id)
  const othersTicket = !!ticket.assignee_id && ticket.assignee_id !== user.id
  const onIt = ticket.assignee_id === user.id ? 'You' : (ticket.assignee?.full_name ?? 'Nobody yet')
  const label =
    ticket.status === 'scheduled' && ticket.scheduled_for
      ? scheduledLabel(ticket.scheduled_for)
      : statusLabel(ticket.status)

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
        {ticket.urgency === 'urgent' && <UrgentTag className="mr-2" />}
        {!viewingAs && <TicketMenu id={ticket.id} displayId={ticket.display_id ?? ''} title={ticket.title} />}
      </div>

      <ScreenBody
        ref={body}
        className="gap-3.5 pb-4 pt-3.5"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}
      >
        <div className="flex flex-none flex-col gap-2">
          <h1 className="font-display text-24 font-bold leading-[1.2] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {ticket.title}
          </h1>
          <div className="flex flex-col gap-[3px] pb-2.5 text-13">
            {ticket.restaurant && (
              <Fact label="Location">
                <RestaurantSquare color={ticket.restaurant.color} />
                {ticket.restaurant.name}
              </Fact>
            )}
            {ticket.opener && <Fact label="Reporter">{ticket.opener.full_name}</Fact>}
            {ticket.walkthrough && (
              <Fact label="Source">
                <IconClipboardCheck size={15} className="flex-none" />
                From {monthOf(ticket.walkthrough.period)} walkthrough
              </Fact>
            )}
            <Fact label="Date">{timestamp(new Date(ticket.created_at))}</Fact>
            <Fact label="On it">{onIt}</Fact>
          </div>
        </div>

        <StatusMenu
          value={ticket.status}
          valueLabel={label}
          options={OPTIONS}
          busy={setStatus.isPending || take.isPending}
          onPick={viewingAs ? undefined : pick}
          actions={[
            ...(othersTicket
              ? [{ label: 'Take this over', onSelect: () => take.mutate(undefined, { onError: failed }) }]
              : []),
            { label: 'Close ticket', onSelect: () => setClosing(true) },
          ]}
        />

        {ticket.description && (
          <>
            <SectionLabel className="-mb-0.5">Description</SectionLabel>
            <p className="whitespace-pre-wrap text-14 leading-normal text-text-body [overflow-wrap:anywhere]">
              {ticket.description}
            </p>
          </>
        )}

        {onTicket.length > 0 && (
          <div className="flex flex-none flex-wrap gap-2">
            {onTicket.map((p) => {
              const src = urls.data?.get(p.path)
              return (
                <PhotoThumb
                  key={p.path}
                  size="ticket"
                  src={src}
                  alt="Photo on this ticket"
                  onOpen={() => src && setViewing({ src, alt: 'Photo on this ticket' })}
                />
              )
            })}
          </div>
        )}

        {ticket.equipment && (
          <>
            <SectionLabel className="-mb-0.5">Equipment</SectionLabel>
            <Card className="flex flex-none items-center gap-3 rounded-input px-3.5 py-3">
              <IconWrench size={22} className="flex-none text-brand" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-15 font-semibold">{ticket.equipment.name}</span>
                {(ticket.equipment.brand || ticket.equipment.serial) && (
                  <span className="text-12 text-text-muted">
                    {ticket.equipment.brand}
                    {ticket.equipment.brand && ticket.equipment.serial && ' · '}
                    {ticket.equipment.serial && <span className="font-mono">{ticket.equipment.serial}</span>}
                  </span>
                )}
              </div>
            </Card>
          </>
        )}

        <div className="-mb-2.5 flex min-h-tap flex-none items-center justify-between gap-3 pt-1">
          <h2 className="eyebrow">Updates · {count}</h2>
          {!writing && !viewingAs && (
            <button
              type="button"
              onClick={() => setWriting(true)}
              className="-mr-1 flex min-h-tap flex-none items-center gap-1 px-1 text-14 font-semibold text-brand"
            >
              <IconPlus size={16} strokeWidth={2.4} />
              Add update
            </button>
          )}
        </div>
        <ThreadFeed items={items} photos={data.photos} urls={urls.data} onOpen={setViewing} />
      </ScreenBody>

      {post.isError && (
        <div className="flex-none px-3 pb-2">
          <ErrorBanner title="Couldn't post that yet.">
            Check your connection and try again. Your update is still here.
          </ErrorBanner>
        </div>
      )}
      {writing && !viewingAs && (
        <Composer
          autoFocus
          label={internal ? 'Write an internal note, only Ops can see it' : 'Write an update the restaurant can see'}
          placeholder={internal ? 'Write an internal note…' : 'Write an update…'}
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
              <div className="flex items-center justify-between">
                <VisibilityToggle internal={internal} onChange={setInternal} />
                <button
                  type="button"
                  aria-label="Hide message box"
                  onClick={() => {
                    post.reset()
                    setWriting(false)
                  }}
                  className="-my-1.5 flex h-11 w-11 flex-none items-center justify-center rounded-control text-text-secondary transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
                >
                  <IconClose size={20} />
                </button>
              </div>
              <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
              {picked.error && (
                <span role="alert" className="text-13 font-semibold text-danger">
                  {picked.error}
                </span>
              )}
            </>
          }
        />
      )}

      <Sheet
        open={closing}
        onOpenChange={(open) => {
          if (!open) close.reset()
          setClosing(open)
        }}
        title={`Close ${ticket.display_id}?`}
        description="The restaurant sees this as closed, with your comment."
      >
        <Textarea label="Comment" optional value={comment} onChange={(e) => setComment(e.target.value)} />
        {close.isError && (
          <span role="alert" className="text-13 font-semibold text-danger">
            That didn&apos;t go through. Check your connection and try again.
          </span>
        )}
        <Button loading={close.isPending} onClick={confirmClose}>
          Close ticket
        </Button>
        <Button variant="secondary" onClick={() => setClosing(false)}>
          Cancel
        </Button>
      </Sheet>

      <Sheet
        open={scheduling}
        onOpenChange={(open) => {
          if (!open) setStatus.reset()
          setScheduling(open)
        }}
        title="When is it scheduled?"
        description="The restaurant sees this date on the ticket."
      >
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button loading={setStatus.isPending} disabled={!date} onClick={saveDate}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => setScheduling(false)}>
          Cancel
        </Button>
      </Sheet>
      <PhotoViewer src={viewing?.src ?? null} alt={viewing?.alt ?? ''} onClose={() => setViewing(null)} />
    </Screen>
  )
}
