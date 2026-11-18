import { useState } from 'react'
import { Button } from '../../components/Button'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Sheet } from '../../components/Sheet'
import { isVideoUrl } from './quarterly'

export type TaskDraft = { title: string; directions: string; videoUrl: string }

/**
 * The task editor (WT-Ops-Tasks' sheet): where it applies ("Q4 · All restaurants"), the
 * task's name, directions and how-to video link, and Save. On a restaurant's version,
 * "Use the all-restaurants version instead". Delete asks first and says it is permanent; a
 * task a walkthrough has had can't be deleted (the archive rule), so it offers Turn off and
 * says why. Keyed by the screen per opening, so it starts from the task each time.
 */
export function TaskEditorSheet({
  open,
  onOpenChange,
  title,
  scope,
  initial,
  saveLabel,
  saving,
  error,
  onSave,
  onReset,
  remove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  scope: string
  initial: TaskDraft
  saveLabel: string
  saving: boolean
  error: unknown
  onSave: (draft: TaskDraft) => void
  onReset?: () => void
  remove?: {
    label: string
    /** "… will be removed from every restaurant." */
    confirmText: string
    /** False once a walkthrough has had it: Turn off, not Delete. */
    deletable: boolean
    onDelete: () => void
    onTurnOff: () => void
  }
}) {
  const [draft, setDraft] = useState(initial)
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const set = (k: keyof TaskDraft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value })
  const badLink = draft.videoUrl.trim() !== '' && !isVideoUrl(draft.videoUrl.trim())

  const save = () => {
    setTried(true)
    if (!draft.title.trim() || badLink) return
    onSave(draft)
  }

  if (confirming && remove) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Delete this task?">
        <p className="text-14 leading-[1.5] text-text-body">{remove.confirmText}</p>
        <b className="text-14">This is permanent and cannot be undone.</b>
        {!!error && <ErrorBanner title="Couldn't delete this task.">Check your connection and try again.</ErrorBanner>}
        <Button variant="danger" loading={saving} onClick={remove.onDelete}>
          Delete
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={scope}>
      <Input
        label="Task name"
        maxLength={140}
        placeholder="e.g. Clean HVAC registers"
        value={draft.title}
        onChange={set('title')}
        error={tried && !draft.title.trim() ? 'Give the task a name.' : undefined}
      />
      <Textarea
        label="Directions"
        rows={4}
        maxLength={2000}
        placeholder="What should the manager do, and when should they submit a ticket?"
        value={draft.directions}
        onChange={set('directions')}
      />
      <Input
        label="How-to video link"
        optional
        type="url"
        inputMode="url"
        maxLength={500}
        placeholder="https://youtube.com/…"
        value={draft.videoUrl}
        onChange={set('videoUrl')}
        error={tried && badLink ? 'Use a web address that starts with https://' : undefined}
      />
      {!!error && <ErrorBanner title="Couldn't save that.">Check your connection and try again.</ErrorBanner>}
      <Button loading={saving} onClick={save}>
        {saveLabel}
      </Button>
      {onReset && (
        <Button variant="ghost" disabled={saving} onClick={onReset}>
          Use the all-restaurants version instead
        </Button>
      )}
      {remove &&
        (remove.deletable ? (
          <Button variant="ghost" className="text-danger" disabled={saving} onClick={() => setConfirming(true)}>
            {remove.label}
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="secondary" disabled={saving} onClick={remove.onTurnOff}>
              Turn off
            </Button>
            <span className="text-13 text-text-secondary">
              A walkthrough has had this task, so it stays on the record. Turned off, it goes on no new walkthrough.
            </span>
          </div>
        ))}
    </Sheet>
  )
}
