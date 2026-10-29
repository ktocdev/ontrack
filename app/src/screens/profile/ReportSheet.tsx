import { useState } from 'react'
import { Button } from '../../components/Button'
import { Textarea } from '../../components/Field'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useSendReport } from './useProfile'

/**
 * Report a problem (Profile and Help & support): what happened, then Send to
 * support. The report is saved with the page, app version and device; the
 * toast gives the case number. The design's "Include a screenshot" box is left
 * out until reports show a need for it.
 */
export function ReportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [body, setBody] = useState('')
  const send = useSendReport()
  const toast = useToast()

  const close = (next: boolean) => {
    if (!next) send.reset()
    onOpenChange(next)
  }

  const submit = () =>
    send.mutate(body, {
      onSuccess: (caseNo) => {
        setBody('')
        close(false)
        toast.show(`Sent to support. Case #${caseNo}.`)
      },
    })

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Report a problem"
      description="Goes to OnTrack support. Your account, the page you were on and your device type are attached."
    >
      <Textarea
        label="What happened?"
        rows={3}
        maxLength={4000}
        placeholder="What were you trying to do, and what went wrong?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={send.isError ? "Couldn't send that. Check your connection and try again." : undefined}
      />
      <Button onClick={submit} loading={send.isPending} disabled={!body.trim()}>
        Send to support
      </Button>
      <Button variant="secondary" onClick={() => close(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
