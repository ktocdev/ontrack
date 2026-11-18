import { useState } from 'react'
import { useRoleNames } from '../../auth/group'
import { Button } from '../../components/Button'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Sheet } from '../../components/Sheet'
import { useHandBack } from '../tickets/useInHouse'

/**
 * Hand back as in-house task (OT-132; no board draws it, so it is a sheet like Close ticket):
 * what the restaurant should do and an optional note. One step closes the ticket with
 * "Handed back as an in-house task: …" and adds the task, with the ticket's unit and
 * category and a link back, to the restaurant's In-house list. Its Reporters get one
 * notification, the task's, by their My categories.
 */
export function HandBackSheet({
  open,
  onOpenChange,
  ticket,
  onHandedBack,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: { id: string; displayId: string; restaurant: string }
  onHandedBack: () => void
}) {
  const roles = useRoleNames()
  const handBack = useHandBack(ticket.id)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [missing, setMissing] = useState(false)

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('')
      setNote('')
      setMissing(false)
      handBack.reset()
    }
    onOpenChange(isOpen)
  }

  const confirm = () => {
    if (!title.trim()) {
      setMissing(true)
      return
    }
    handBack.mutate(
      { title, note },
      {
        onSuccess: () => {
          close(false)
          onHandedBack()
        },
      },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={`Hand back ${ticket.displayId}?`}
      description={`This closes the ticket and adds a task to ${ticket.restaurant}’s In-house list, linked to this ticket. Its ${roles.name('manager', 'managers')} get a notification.`}
    >
      <Input
        label="What to do"
        maxLength={140}
        placeholder="e.g. Replace the bulb over table 4"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setMissing(false)
        }}
        error={missing ? 'Say what the restaurant should do.' : undefined}
      />
      <Textarea
        label="Note"
        optional
        maxLength={1000}
        placeholder="e.g. It’s the 2-pin kind, spares are in the office"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {handBack.isError && (
        <ErrorBanner title="Couldn't hand this back.">
          {(handBack.error as { code?: string } | null)?.code === '22023'
            ? 'The ticket was closed in the meantime.'
            : 'Check your connection and try again.'}
        </ErrorBanner>
      )}
      <Button loading={handBack.isPending} onClick={confirm}>
        Hand back
      </Button>
      <Button variant="secondary" onClick={() => close(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
