import { useState } from 'react'
import { Button } from '../../components/Button'
import { Textarea } from '../../components/Field'
import { Sheet } from '../../components/Sheet'
import { useCloseTicket } from './useCloseTicket'

/** A manager closing a ticket, from its menu or from Edit ticket: an optional comment, then a confirm. */
export function CloseTicketSheet({
  ticketId,
  displayId,
  open,
  onOpenChange,
  onClosed,
}: {
  ticketId: string
  displayId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: (note: string) => void
}) {
  const close = useCloseTicket(ticketId)
  const [comment, setComment] = useState('')

  const confirm = () => {
    const note = comment.trim()
    close.mutate(note, { onSuccess: () => onClosed(note) })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close.reset()
        onOpenChange(next)
      }}
      title={`Close ${displayId}?`}
      description="Ops will see this ticket as closed."
    >
      <Textarea
        label="Comment"
        optional
        placeholder="e.g. Tech replaced the compressor relay, holding 37°F"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {close.isError && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
      <Button loading={close.isPending} onClick={confirm}>
        Close ticket
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
