import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useUser } from '../../auth/context'
import { Button, ButtonLink } from '../../components/Button'
import { RadioRow } from '../../components/Card'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner, Notice } from '../../components/Notice'
import { AddPhotoButton, PhotoTray } from '../../components/Photo'
import { StatusPill } from '../../components/Pill'
import { Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronLeft } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { longDate } from './closed'
import { AREA_LABEL, scheduledLabel } from './tickets'
import { CloseTicketSheet } from './CloseTicketSheet'
import { useSaveTicket, type TicketEdits } from './useCloseTicket'
import { useTicketForm } from './useCreateTicket'
import { usePickedPhotos } from './usePhotos'
import { useTicket } from './useTicket'

/**
 * Manager · Edit / close ticket (design/screens/Edit-Ticket). Description, equipment,
 * a photo and urgency, as the board has them, plus Title, which it leaves out, then
 * Close ticket with a confirm sheet. After closing it stays here with the fields off,
 * as the board draws it; this also offers View closed ticket. A ticket that was already
 * closed has nothing to edit and goes to its own screen.
 */
export function EditTicketScreen() {
  const { id = '' } = useParams()
  const { data, isPending } = useTicket(id)
  const [closedHere, setClosedHere] = useState<string | null>(null)

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Spinner />
      </Screen>
    )
  }
  const ticket = data?.ticket
  if (!ticket) return <NotFoundScreen />
  if (ticket.status === 'closed' && closedHere === null) return <Navigate to={`/tickets/${id}`} replace />
  return <EditForm ticket={ticket} closedNote={closedHere} onClosed={setClosedHere} />
}

type Ticket = NonNullable<NonNullable<ReturnType<typeof useTicket>['data']>['ticket']>

function EditForm({
  ticket,
  closedNote,
  onClosed,
}: {
  ticket: Ticket
  closedNote: string | null
  onClosed: (note: string) => void
}) {
  const { user } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const save = useSaveTicket(ticket.id)
  const picked = usePickedPhotos()
  const units = useTicketForm(ticket.category_id, ticket.restaurant_id)

  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description ?? '')
  const [urgency, setUrgency] = useState<TicketEdits['urgency']>(ticket.urgency)
  const [equipmentId, setEquipmentId] = useState(ticket.equipment_id)
  const [choosing, setChoosing] = useState(false)
  const [closing, setClosing] = useState(false)

  const closed = closedNote !== null
  const list = units.data?.equipment ?? []
  const chosen = list.find((u) => u.id === equipmentId)
  const shown =
    equipmentId === ticket.equipment_id && ticket.equipment
      ? ticket.equipment
      : chosen && { name: chosen.name, brand: null, serial: chosen.serial }
  const pill = closed ? 'closed' : ticket.status

  const submit = () =>
    save.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        urgency,
        ...(equipmentId !== ticket.equipment_id ? { equipmentId } : {}),
        photos: picked.photos,
        createdBy: user.id,
      },
      {
        onSuccess: () => {
          toast.show('Changes saved.')
          navigate(`/tickets/${ticket.id}`)
        },
      },
    )

  return (
    <Screen>
      <div className="flex flex-none items-center gap-1 border-b border-border pb-2 pl-2 pr-5 pt-[calc(12px+var(--safe-top))]">
        <Link
          to={`/tickets/${ticket.id}`}
          aria-label="Back to ticket"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-text transition-colors hover:bg-surface-hover active:bg-surface-sunken active:duration-0"
        >
          <IconChevronLeft size={22} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-mono text-12 font-medium text-text-secondary">{ticket.display_id}</span>
          <h1 className="font-display text-20 font-bold">Edit ticket</h1>
        </div>
        <StatusPill
          status={pill}
          label={pill === 'scheduled' && ticket.scheduled_for ? scheduledLabel(ticket.scheduled_for) : undefined}
        />
      </div>

      <ScreenBody className="gap-3.5 pb-4 pt-5">
        {closed && (
          <Notice>
            <b>Ticket closed.</b> {closedNote ? `Your comment: "${closedNote}"` : 'Ops will see it as closed.'}
          </Notice>
        )}
        {save.isError && (
          <ErrorBanner title="Couldn't save yet.">
            Check your connection and try again. Everything you entered is still here.
          </ErrorBanner>
        )}
        {ticket.category && (
          <div className="flex flex-none flex-wrap gap-1.5 text-12 font-semibold text-text-body">
            <span className="rounded-pill bg-surface-sunken px-[9px] py-1">{AREA_LABEL[ticket.category.area]}</span>
            <span className="rounded-pill bg-surface-sunken px-[9px] py-1">{ticket.category.name}</span>
          </div>
        )}
        <Input
          label="Title"
          maxLength={140}
          value={title}
          disabled={closed}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          label="Description"
          value={description}
          disabled={closed}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex flex-none flex-col gap-1">
          {(shown || list.length > 0) && (
            <>
              <span className="text-13 font-semibold text-text-body">
                Equipment <span className="font-medium text-text-muted">(optional)</span>
              </span>
              <div className="flex items-center gap-3 rounded-control border border-border bg-surface py-2 pl-3.5 pr-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-15 font-semibold">{shown?.name ?? 'None'}</span>
                  {shown && (shown.brand || shown.serial) && (
                    <span className="font-mono text-12 text-text-muted">
                      {[shown.brand, shown.serial].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {!closed && list.length > 0 && (
                  <Button type="button" variant="ghost" className="px-2.5" onClick={() => setChoosing(true)}>
                    Change
                  </Button>
                )}
              </div>
            </>
          )}
          {!closed && (
            <>
              <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
              {picked.error && (
                <span role="alert" className="text-13 font-semibold text-danger">
                  {picked.error}
                </span>
              )}
              <AddPhotoButton variant="dashed" disabled={picked.reading} onFiles={(f) => void picked.add(f)} />
            </>
          )}
        </div>
        <div className="flex flex-none flex-col gap-1">
          <span className="text-13 font-semibold text-text-body">Urgency</span>
          {closed ? (
            <span className="text-15 capitalize">{urgency}</span>
          ) : (
            <Segmented
              label="Urgency"
              value={urgency}
              onChange={setUrgency}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          )}
        </div>
        <span className="text-12 text-text-muted">
          Opened by {ticket.opener?.full_name ?? 'someone'} · {longDate(new Date(ticket.created_at))}
        </span>
      </ScreenBody>

      <ScreenFooter>
        {closed ? (
          <>
            <ButtonLink to="/tickets" className="w-full">
              Back to open tickets
            </ButtonLink>
            <ButtonLink to={`/tickets/${ticket.id}`} variant="secondary" className="w-full">
              View closed ticket
            </ButtonLink>
          </>
        ) : (
          <>
            <Button loading={save.isPending} disabled={!title.trim() || picked.reading} onClick={submit}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={() => setClosing(true)}>
              Close ticket
            </Button>
          </>
        )}
      </ScreenFooter>

      <Sheet open={choosing} onOpenChange={setChoosing} title="Change equipment">
        <div
          role="radiogroup"
          aria-label="Equipment"
          className="overflow-hidden rounded-card border border-border bg-surface"
        >
          {list.map((u) => (
            <RadioRow
              key={u.id}
              checked={equipmentId === u.id}
              title={u.name}
              subtitle={u.serial ? `SN ${u.serial}` : undefined}
              onSelect={() => setEquipmentId(equipmentId === u.id ? null : u.id)}
            />
          ))}
        </div>
        <Button onClick={() => setChoosing(false)}>Done</Button>
      </Sheet>

      <CloseTicketSheet
        ticketId={ticket.id}
        displayId={ticket.display_id ?? ''}
        open={closing}
        onOpenChange={setClosing}
        onClosed={(note) => {
          onClosed(note)
          setClosing(false)
          void queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
        }}
      />
    </Screen>
  )
}
