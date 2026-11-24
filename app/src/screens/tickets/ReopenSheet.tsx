import { useState } from 'react'
import { Button } from '../../components/Button'
import { Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { AddPhotoButton, PhotoTray } from '../../components/Photo'
import { Sheet } from '../../components/Sheet'
import { useReopenTicket } from './useCloseTicket'
import { usePickedPhotos } from './usePhotos'

/**
 * Is the problem back? (design/screens/Closed-Ticket): the reason, required, with photos,
 * then Reopen ticket through `reopen_ticket`. A Reporter's closed ticket and leadership's own
 * (OT-170) both open it.
 */
export function ReopenSheet({
  ticketId,
  closerName,
  open,
  onOpenChange,
  onReopened,
}: {
  ticketId: string
  closerName: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onReopened: (note: string) => void
}) {
  const reopen = useReopenTicket(ticketId)
  const picked = usePickedPhotos()
  const [note, setNote] = useState('')
  const refused = (reopen.error as { code?: string } | null)?.code === '42501'

  const send = () =>
    reopen.mutate(
      { note: note.trim(), photos: picked.photos },
      {
        onSuccess: () => {
          onOpenChange(false)
          onReopened(note.trim())
        },
      },
    )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reopen.reset()
        onOpenChange(next)
      }}
      title="Is the problem back?"
      description={`${closerName ?? 'Ops'} closed this. Describe what’s happening and it goes back on the Ops list as Reopened.`}
    >
      {reopen.isError && (
        <ErrorBanner title="Couldn't reopen yet.">
          {refused
            ? 'This ticket was closed too long ago, or your account can’t reopen it.'
            : 'Check your connection and try again.'}{' '}
          What you wrote is still here.
        </ErrorBanner>
      )}
      <div className="flex flex-col gap-1.5">
        <Textarea label="What's happening?" value={note} onChange={(e) => setNote(e.target.value)} />
        <PhotoTray photos={picked.photos} reading={picked.reading} onRemove={picked.remove} />
        {picked.error && (
          <span role="alert" className="text-13 font-semibold text-danger">
            {picked.error}
          </span>
        )}
        <AddPhotoButton disabled={picked.reading} onFiles={(f) => void picked.add(f)} />
      </div>
      <Button loading={reopen.isPending} disabled={!note.trim() || picked.reading} onClick={send}>
        Reopen ticket
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
