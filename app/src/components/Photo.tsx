import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { Spinner } from './Skeleton'
import { IconCamera, IconClose, IconImage } from './icons'

/**
 * Photos on a ticket. A thumb is 120 by 88 in the thread (design/screens/Ticket) and
 * 96 square on the ticket itself (Closed-Ticket), and shows the boards' image icon
 * until the picture has loaded, or if it can't. Tapping one opens it large, which has
 * no board. The tray shows what has been picked before it is sent, also with no board.
 */

const SIZE = {
  thread: 'h-[88px] w-[120px] rounded-[10px]',
  ticket: 'h-24 w-24 rounded-input',
}

export function PhotoThumb({
  src,
  alt,
  size = 'thread',
  tinted = false,
  onOpen,
}: {
  src?: string
  alt: string
  size?: keyof typeof SIZE
  /** On your own message, whose bubble is already brand-tinted. */
  tinted?: boolean
  onOpen?: () => void
}) {
  const [failed, setFailed] = useState<string | undefined>()
  const show = src && failed !== src
  const tone = `flex flex-none items-center justify-center overflow-hidden ${SIZE[size]} ${
    tinted ? 'bg-brand-tint text-brand-strong' : 'bg-surface-sunken text-text-muted'
  }`
  const picture = show ? (
    <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(src)} />
  ) : (
    <IconImage size={size === 'ticket' ? 28 : 24} strokeWidth={1.8} />
  )
  return show && onOpen ? (
    <button type="button" onClick={onOpen} aria-label={`Open: ${alt}`} className={tone}>
      {picture}
    </button>
  ) : (
    <span role={show ? undefined : 'img'} aria-label={show ? undefined : alt} className={tone}>
      {picture}
    </span>
  )
}

/** One photo, large. */
export function PhotoViewer({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  return (
    <Sheet open={src !== null} onOpenChange={(open) => !open && onClose()} title="Photo">
      {src && <img src={src} alt={alt} className="max-h-[68dvh] w-full rounded-input object-contain" />}
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  )
}

/** What has been picked: 72px squares, each with a 44px remove target on its corner. */
export function PhotoTray({
  photos,
  reading = false,
  onRemove,
}: {
  photos: { id: string; url: string }[]
  reading?: boolean
  onRemove: (id: string) => void
}) {
  if (photos.length === 0 && !reading) return null
  return (
    <ul aria-label="Photos to send" className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <li key={p.id} className="relative h-[72px] w-[72px] flex-none">
          <img src={p.url} alt={`Photo ${i + 1} to send`} className="h-full w-full rounded-control object-cover" />
          <button
            type="button"
            aria-label={`Remove photo ${i + 1}`}
            onClick={() => onRemove(p.id)}
            className="absolute -right-2.5 -top-2.5 flex h-11 w-11 items-center justify-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-text text-bg">
              <IconClose size={14} strokeWidth={2.4} />
            </span>
          </button>
        </li>
      ))}
      {reading && (
        <li className="flex h-[72px] w-[72px] items-center justify-center rounded-control bg-surface-sunken">
          <Spinner size={24} />
          <span className="sr-only">Reading the photo</span>
        </li>
      )}
    </ul>
  )
}

/** Add photo: the form's text button or the composer's 44px camera. The phone offers camera or library. */
export function AddPhotoButton({
  variant = 'text',
  disabled = false,
  onFiles,
}: {
  variant?: 'text' | 'icon'
  disabled?: boolean
  onFiles: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          aria-label="Add photo"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-text-secondary transition-colors not-disabled:hover:bg-surface-hover not-disabled:active:bg-surface-muted active:duration-0 disabled:opacity-50"
        >
          <IconCamera size={22} />
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="inline-flex min-h-10 flex-none items-center gap-1.5 self-start text-14 font-semibold text-brand transition-colors not-disabled:hover:text-brand-strong disabled:opacity-50"
        >
          <IconCamera size={18} />
          Add photo
        </button>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*"
        aria-label="Choose photos"
        className="sr-only"
        tabIndex={-1}
        onChange={change}
      />
    </>
  )
}
