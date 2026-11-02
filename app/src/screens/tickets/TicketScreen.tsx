import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { Card } from '../../components/Card'
import { ErrorBanner } from '../../components/Notice'
import { AddPhotoButton, PhotoThumb, PhotoTray, PhotoViewer } from '../../components/Photo'
import { StatusPill, UrgentTag } from '../../components/Pill'
import { RestaurantSquare } from '../../components/RestaurantName'
import { Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { Composer } from '../../components/Thread'
import { IconChevronLeft, IconEdit, IconWrench } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { ClosedTicketScreen } from './ClosedTicketScreen'
import { threadItems } from './thread'
import { ThreadFeed } from './ThreadFeed'
import { scheduledLabel } from './tickets'
import { usePickedPhotos, useSignedPhotos } from './usePhotos'
import { usePostUpdate, useTicket } from './useTicket'

/**
 * Manager · Ticket (design/screens/Ticket): the header with the status, the title and
 * where it is, the description, its photos and equipment, then the updates and the
 * composer. The equipment card opens the unit once Phase 4 builds that page. A photo
 * opens large when tapped, which has no board. A closed ticket has its own screen,
 * which stays up after reopening it until the person leaves.
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
  const picked = usePickedPhotos()
  const urls = useSignedPhotos(data?.photos.map((p) => p.path) ?? [])
  const [viewing, setViewing] = useState<{ src: string; alt: string } | null>(null)
  const queryClient = useQueryClient()
  const [reopened, setReopened] = useState<{ note: string; shown: NonNullable<typeof data> } | null>(null)

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  const ticket = data?.ticket
  if (!ticket) return <NotFoundScreen />

  if (reopened || ticket.status === 'closed') {
    const shown = reopened?.shown ?? data
    return (
      <ClosedTicketScreen
        ticket={shown.ticket!}
        updates={shown.updates}
        photos={shown.photos}
        reopened={reopened?.note ?? null}
        onReopened={(note) => {
          setReopened({ note, shown: data })
          void queryClient.invalidateQueries({ queryKey: ['ticket', id] })
        }}
      />
    )
  }

  const items = threadItems(data.updates, user.id, data.names)
  const count = items.filter((i) => i.type === 'message').length

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
        <Link
          to={`/tickets/${ticket.id}/edit`}
          className="flex min-h-tap flex-none items-center gap-1.5 px-2.5 text-15 font-semibold no-underline"
        >
          <IconEdit size={17} />
          Edit
        </Link>
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

        {data.photos.some((p) => !p.update_id) && (
          <div className="flex flex-none flex-wrap gap-2">
            {data.photos
              .filter((p) => !p.update_id)
              .map((p) => {
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
        <ThreadFeed items={items} photos={data.photos} urls={urls.data} onOpen={setViewing} />
      </ScreenBody>

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
      <PhotoViewer src={viewing?.src ?? null} alt={viewing?.alt ?? ''} onClose={() => setViewing(null)} />
    </Screen>
  )
}
