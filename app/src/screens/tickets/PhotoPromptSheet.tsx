import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { IconCamera } from '../../components/icons'
import { PhotoTipsLink, PhotoTipsSheet } from './PhotoTips'

/**
 * Add a photo? (from feedback, OT-77; no board). Ops wants a photo on every ticket,
 * so Submit ticket with none asks first. Open Camera opens the phone's camera (a file
 * picker on a computer) and the photo joins the form, where the manager sees it and
 * submits again; Proceed without photo creates the ticket as it is. Closing the sheet
 * or the camera leaves the form as it was. The camera input sits outside the sheet so
 * it is still there when the sheet closes and the photo comes back. Photo tips opens
 * in its place, and closing the tips brings it back.
 */
export function PhotoPromptSheet({
  open,
  onOpenChange,
  onFiles,
  onProceed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[]) => void
  onProceed: () => void
}) {
  const camera = useRef<HTMLInputElement>(null)
  const [tips, setTips] = useState(false)
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <>
      <Sheet
        open={open && !tips}
        onOpenChange={onOpenChange}
        title="Add a photo?"
        description="It is best practice to include a photo with a ticket."
      >
        <div className="flex flex-col gap-2.5 pt-1">
          <Button
            icon={<IconCamera size={20} />}
            onClick={() => {
              camera.current?.click()
              onOpenChange(false)
            }}
          >
            Open Camera
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onOpenChange(false)
              onProceed()
            }}
          >
            Proceed without photo
          </Button>
          <PhotoTipsLink className="self-center" onClick={() => setTips(true)} />
        </div>
      </Sheet>
      <PhotoTipsSheet open={open && tips} onOpenChange={(o) => setTips(o)} />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take a photo"
        className="sr-only"
        tabIndex={-1}
        onChange={change}
      />
    </>
  )
}
