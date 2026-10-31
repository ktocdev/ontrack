import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { Avatar } from '../../components/Avatar'
import { Card } from '../../components/Card'
import { ErrorBanner } from '../../components/Notice'
import { StatusPill, UrgentTag } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { Composer, ThreadEvent, ThreadMessage } from '../../components/Thread'
import { IconChevronLeft, IconEdit, IconWrench } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useAvatarUrl } from '../profile/useProfile'
import { threadItems, type ThreadItem } from './thread'
import { scheduledLabel } from './tickets'
import { usePostUpdate, useTicket } from './useTicket'

/**
 * Manager · Ticket (design/screens/Ticket): the header with the status, the title and
 * where it is, the description and equipment, then the updates and the composer. The
 * equipment card opens the unit once Phase 4 builds that page, and photos come with
 * OT-28. Closed tickets get their own screen in OT-29; until then this one drops the
 * composer and Edit for them.
 */
const AREA_SHORT = { foh: 'FOH', boh: 'BOH' }

export function TicketScreen() {
  const { id = '' } = useParams()
  const { user } = useUser()
  const { data, isPending } = useTicket(id)
  const post = usePostUpdate(id)
  const [draft, setDraft] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  const ticket = data?.ticket
  if (!ticket) return <NotFoundScreen />

  const items = threadItems(data.updates, user.id, data.names)
  const count = items.filter((i) => i.type === 'message').length
  const closed = ticket.status === 'closed'

  const send = () =>
    post.mutate(
      { body: draft.trim(), authorId: user.id },
      {
        onSuccess: () => {
          setDraft('')
          // After the refreshed thread has drawn.
          requestAnimationFrame(() => body.current?.scrollTo({ top: body.current.scrollHeight }))
        },
      },
    )

  return (
    <Screen>
      <div
        className={`relative z-10 flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-3 pt-[calc(12px+var(--safe-top))] transition-shadow ${
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-13 text-text-secondary">{ticket.display_id}</span>
          <StatusPill
            status={ticket.status}
            label={
              ticket.status === 'scheduled' && ticket.scheduled_for ? scheduledLabel(ticket.scheduled_for) : undefined
            }
          />
        </div>
        {!closed && (
          <Link
            to={`/tickets/${ticket.id}/edit`}
            className="flex min-h-tap flex-none items-center gap-1.5 px-2.5 text-15 font-semibold no-underline"
          >
            <IconEdit size={17} />
            Edit
          </Link>
        )}
      </div>

      <ScreenBody ref={body} className="gap-3 pb-4 pt-3.5" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 2)}>
        <div className="flex flex-none flex-col items-start gap-1.5">
          {ticket.urgency === 'urgent' && <UrgentTag />}
          <h1 className="font-display text-24 font-bold leading-[1.2] tracking-[-0.02em]">{ticket.title}</h1>
          <span className="text-13 leading-[1.4] text-text-muted">
            {ticket.restaurant && (
              <span className="font-bold text-text-body">
                <RestaurantSquare color={ticket.restaurant.color} size={9} className="mr-1.5" />
                {ticket.restaurant.name}
              </span>
            )}
            {ticket.category && ` › ${AREA_SHORT[ticket.category.area]} › ${ticket.category.name}`}
          </span>
        </div>

        {ticket.description && (
          <>
            <SectionLabel className="-mb-0.5">Description</SectionLabel>
            <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
              {ticket.description}
            </p>
          </>
        )}

        {ticket.equipment && (
          <>
            <SectionLabel className="-mb-0.5">Equipment</SectionLabel>
            <Card className="flex items-center gap-3 rounded-input px-3.5 py-3">
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

        <SectionLabel className="-mb-0.5">Updates · {count}</SectionLabel>
        <div role="log" aria-label="Ticket updates" className="flex flex-none flex-col">
          {items.map((item) => (
            <ThreadRow key={item.key} item={item} />
          ))}
        </div>
      </ScreenBody>

      {!closed && (
        <>
          {post.isError && (
            <div className="flex-none px-3 pb-2">
              <ErrorBanner title="Couldn't post that yet.">
                Check your connection and try again. Your update is still here.
              </ErrorBanner>
            </div>
          )}
          <Composer
            label="Write an update for Ops"
            placeholder="Write an update…"
            maxLength={4000}
            value={draft}
            onChange={(value) => {
              if (post.isError) post.reset()
              setDraft(value)
            }}
            onSend={send}
            busy={post.isPending}
          />
        </>
      )}
    </Screen>
  )
}

function ThreadRow({ item }: { item: ThreadItem }) {
  if (item.type === 'event') return <ThreadEvent text={item.text} when={item.when} />
  return <Message item={item} />
}

function Message({ item }: { item: Extract<ThreadItem, { type: 'message' }> }) {
  const photo = useAvatarUrl(item.avatarPath)
  return (
    <ThreadMessage
      who={item.who}
      when={item.when}
      mine={item.mine}
      avatar={<Avatar name={item.name} role={item.role} size={30} src={photo.data} />}
    >
      {item.text}
    </ThreadMessage>
  )
}
