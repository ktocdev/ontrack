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
 *
 * It asks about equipment the same way (from feedback, OT-167): with `askEquipment`,
 * Choose equipment closes it and sends focus to the form's equipment list, and with a
 * photo already there it is Attach equipment? alone. Asking for both in one sheet means
 * nobody meets two in a row; the Proceed button still begins "Proceed without photo"
 * whenever a photo is missing.
 */
export function PhotoPromptSheet({
  open,
  onOpenChange,
  onFiles,
  onProceed,
  askPhoto = true,
  askEquipment = false,
  onChooseEquipment,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiles: (files: File[]) => void
  onProceed: () => void
  /** Ask for a photo (no photo yet). */
  askPhoto?: boolean
  /** Ask for equipment too (the category has units here and none is picked). */
  askEquipment?: boolean
  /** Choose equipment: called as the sheet closes, to focus the equipment list. */
  onChooseEquipment?: () => void
}) {
  const camera = useRef<HTMLInputElement>(null)
  const choosing = useRef(false)
  const [tips, setTips] = useState(false)
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  const unit = askEquipment && !!onChooseEquipment
  const [title, description, proceed] =
    askPhoto && unit
      ? [
          'Add a photo and equipment?',
          'It is best practice to include a photo with a ticket, and the equipment it is about.',
          'Proceed without photo or equipment',
        ]
      : unit
        ? ['Attach equipment?', 'Ops finds the unit, its manual and its history faster.', 'Proceed without equipment']
        : ['Add a photo?', 'It is best practice to include a photo with a ticket.', 'Proceed without photo']
  return (
    <>
      <Sheet
        open={open && !tips}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        onCloseAutoFocus={(e) => {
          if (!choosing.current) return
          choosing.current = false
          e.preventDefault()
          onChooseEquipment?.()
        }}
      >
        <div className="flex flex-col gap-2.5 pt-1">
          {askPhoto && (
            <Button
              icon={<IconCamera size={20} />}
              onClick={() => {
                camera.current?.click()
                onOpenChange(false)
              }}
            >
              Open Camera
            </Button>
          )}
          {unit && (
            <Button
              variant={askPhoto ? 'secondary' : 'primary'}
              onClick={() => {
                choosing.current = true
                onOpenChange(false)
              }}
            >
              Choose equipment
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => {
              onOpenChange(false)
              onProceed()
            }}
          >
            {proceed}
          </Button>
          {askPhoto && <PhotoTipsLink className="self-center" onClick={() => setTips(true)} />}
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
