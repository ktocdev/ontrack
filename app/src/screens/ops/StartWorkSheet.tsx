import { useState } from 'react'
import { firstName } from '../../auth/session'
import { Button } from '../../components/Button'
import { Textarea } from '../../components/Field'
import { Sheet } from '../../components/Sheet'
import { useStartWork } from './useOpsTicket'

/**
 * Start work on a reopened or closed ticket (Ops-Closed-Ticket): a required note the
 * restaurant can read, then In progress with you on it. The board's promise that the
 * person is notified waits for OT-46.
 */
export function StartWorkSheet({
  ticketId,
  displayId,
  reporter,
  open,
  onOpenChange,
  onStarted,
}: {
  ticketId: string
  displayId: string
  reporter?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted: (note: string) => void
}) {
  const start = useStartWork(ticketId)
  const [note, setNote] = useState('')
  const who = firstName(reporter) ?? 'The restaurant'

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) start.reset()
        onOpenChange(next)
      }}
      title={`Start work on ${displayId}?`}
      description="It moves to In progress and you're on it. Any past cost stays on this ticket."
    >
      <Textarea
        label="Note for the ticket"
        hint={`Added to the ticket. ${who} can see it.`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {start.isError && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
      <Button
        loading={start.isPending}
        disabled={!note.trim()}
        onClick={() => start.mutate(note.trim(), { onSuccess: () => onStarted(note.trim()) })}
      >
        Start work
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
