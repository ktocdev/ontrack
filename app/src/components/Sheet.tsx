import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { useSwipeToClose } from './swipeToClose'

/**
 * Bottom sheet: scrim at 45% text color, panel on the screen background with
 * 22px top corners, a 40×5 handle, a 22px Archivo title, 10px 20px 24px
 * padding plus the home-bar inset. On a phone a swipe down closes it (see
 * swipeToClose), except a `modal` one. From the lg breakpoint it is a centered
 * 440px dialog with all four corners rounded and no handle.
 */
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  /** Visually hide the title (it stays for screen readers). */
  hideTitle?: boolean
  /** White panel instead of the screen background (the signed-out sheet). */
  surface?: boolean
  /** Ignore Escape and outside taps: the sheet stays until an action closes it. */
  modal?: boolean
  /** A badge above the title (the signed-out lock). */
  icon?: ReactNode
  /** A link beside the title (Clear all on Filter equipment). */
  action?: ReactNode
  /**
   * Focus the panel on open rather than its first control, for a tall sheet whose only
   * button is at the bottom (Photo tips): it then opens at the top, handle and all.
   */
  focusPanel?: boolean
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  hideTitle = false,
  surface = false,
  modal = false,
  icon,
  action,
  focusPanel = false,
}: Props) {
  const hold = modal ? (e: Event) => e.preventDefault() : undefined
  const swipe = useSwipeToClose(() => onOpenChange(false), !modal)
  const heading = (
    <Dialog.Title
      className={`font-display text-22 font-bold tracking-[-0.01em] text-text ${hideTitle ? 'sr-only' : ''}`}
    >
      {title}
    </Dialog.Title>
  )
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-scrim data-[state=open]:animate-[fade-in_.15s_ease-out]" />
        <Dialog.Content
          ref={swipe}
          tabIndex={focusPanel ? -1 : undefined}
          onOpenAutoFocus={
            focusPanel
              ? (e) => {
                  e.preventDefault()
                  ;(e.currentTarget as HTMLElement).focus({ preventScroll: true })
                }
              : undefined
          }
          onEscapeKeyDown={hold}
          onPointerDownOutside={hold}
          onInteractOutside={hold}
          className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[92dvh] w-full max-w-[520px] flex-col gap-3.5 overflow-y-auto rounded-t-sheet ${surface ? 'bg-surface' : 'bg-bg'} px-screen pb-[calc(24px+var(--safe-bottom))] pt-2.5 outline-none data-[state=open]:animate-[sheet-up_.2s_ease-out] lg:bottom-auto lg:top-1/2 lg:max-w-[440px] lg:-translate-y-1/2 lg:rounded-sheet lg:p-6 lg:shadow-dialog`}
        >
          <span
            aria-hidden="true"
            className="h-[5px] w-10 flex-none self-center rounded-square bg-border-strong lg:hidden"
          />
          {icon}
          {action ? (
            <div className="flex items-center justify-between gap-3">
              {heading}
              {action}
            </div>
          ) : (
            heading
          )}
          {description ? (
            <Dialog.Description className="text-14 leading-normal text-text-body">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Confirm dialog for destructive actions: the same sheet, centered on desktop. */
export const ConfirmSheet = Sheet
