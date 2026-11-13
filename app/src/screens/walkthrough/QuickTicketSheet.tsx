import { useState, type FormEvent } from 'react'
import { useUser } from '../../auth/context'
import { Button, IconButton } from '../../components/Button'
import { Select, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { AddPhotoButton, PhotoTray } from '../../components/Photo'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { IconClose } from '../../components/icons'
import { PhotoPromptSheet } from '../tickets/PhotoPromptSheet'
import { usePickedPhotos } from '../tickets/usePhotos'
import { useCreateWalkthroughTicket, useQuickTicketOptions } from './useQuickTicket'

export type QuickTicketTarget = {
  itemId: string
  itemTitle: string
  groupName: string
  sectionName: string
  area: 'foh' | 'boh' | null
  /** The item's own category; with none, the sheet asks. */
  categoryId: string | null
  /** Its tickets still open, by number. */
  openTickets: string[]
}

/**
 * Walkthrough · Quick ticket (design/screens/WT-Ticket), over the checklist. The item it
 * is for as chips, what's wrong, Normal or Urgent, and a photo. Every ticket needs a
 * category: an item that names one gives it, and for one that doesn't (Walls, Paint) the
 * sheet asks. Equipment is a picker of the restaurant's units in that category, since the
 * board's Scan QR waits for QR labels (OT-74). With tickets already open on the item it
 * names them and the title becomes Add another ticket. With no photo, Create ticket asks
 * first, as on Create ticket (OT-77). A failed save keeps what was typed.
 */
export function QuickTicketSheet({
  open,
  onOpenChange,
  walkthroughId,
  restaurantId,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  walkthroughId: string
  restaurantId: string
  target: QuickTicketTarget
}) {
  const { user } = useUser()
  const toast = useToast()
  const create = useCreateWalkthroughTicket(walkthroughId)
  const picked = usePickedPhotos()
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal')
  const [categoryId, setCategoryId] = useState(target.categoryId ?? '')
  const [equipmentId, setEquipmentId] = useState('')
  const [asking, setAsking] = useState(false)
  const { categories, equipment } = useQuickTicketOptions(restaurantId, target.area, categoryId)

  const another = target.openTickets.length > 0
  const ready = title.trim().length > 0 && categoryId !== '' && !picked.reading

  const save = () =>
    create.mutate(
      {
        itemId: target.itemId,
        title: title.trim(),
        urgency,
        categoryId: target.categoryId ? null : categoryId,
        equipmentId: equipmentId || null,
        photos: picked.photos,
        createdBy: user.id,
      },
      {
        onSuccess: (ticket) => {
          onOpenChange(false)
          toast.show(
            ticket.photosFailed
              ? `${ticket.displayId} created, but its photos didn't upload. Add them in an update.`
              : `${ticket.displayId} created. Ops has been notified.`,
          )
        },
      },
    )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready || create.isPending) return
    if (picked.photos.length === 0) setAsking(true)
    else save()
  }

  return (
    <>
      <Sheet
        open={open && !asking}
        onOpenChange={onOpenChange}
        title={another ? 'Add another ticket' : 'Create ticket'}
        action={
          <IconButton label="Cancel" className="-mr-2.5" onClick={() => onOpenChange(false)}>
            <IconClose size={20} />
          </IconButton>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-wrap gap-1.5 text-12 font-semibold text-text-body">
            {[target.sectionName, target.groupName, target.itemTitle].map((chip) => (
              <span key={chip} className="rounded-pill bg-surface-sunken px-[9px] py-1">
                {chip}
              </span>
            ))}
          </div>
          {another && (
            <p className="text-13 leading-[1.4] text-text-secondary">
              Already on this item: <b className="text-text">{target.openTickets.join(', ')}</b>. Make a separate ticket
              only if it’s a different problem.
            </p>
          )}
          {create.isError && (
            <ErrorBanner title="Couldn't create the ticket.">
              Check your connection and try again. What you typed is still here.
            </ErrorBanner>
          )}
          <Textarea
            label="What's wrong?"
            rows={3}
            maxLength={140}
            placeholder="e.g. Hand sink faucet drips constantly"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {!target.categoryId && (
            <Select
              label="Category"
              hint="This item has no category, so pick the one that fits."
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setEquipmentId('')
              }}
            >
              <option value="" disabled>
                Pick a category
              </option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {(equipment.data?.length ?? 0) > 0 && (
            <Select label="Equipment" optional value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
              <option value="">None</option>
              {equipment.data!.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-col gap-1.5">
            <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
            {picked.error && (
              <span role="alert" className="text-13 font-semibold text-danger">
                {picked.error}
              </span>
            )}
            <AddPhotoButton variant="dashed" disabled={picked.reading} onFiles={(files) => void picked.add(files)} />
          </div>
          <Segmented
            label="Urgency"
            value={urgency}
            onChange={setUrgency}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          <Button type="submit" loading={create.isPending} disabled={!ready}>
            Create ticket
          </Button>
        </form>
      </Sheet>
      <PhotoPromptSheet
        open={open && asking}
        onOpenChange={setAsking}
        onFiles={(files) => void picked.add(files)}
        onProceed={() => {
          setAsking(false)
          save()
        }}
      />
    </>
  )
}
