import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * Bottom sheet: scrim at 45% text color, panel on the screen background with
 * 22px top corners, a 40×5 handle, a 22px Archivo title, 10px 20px 24px
 * padding plus the home-bar inset. From the lg breakpoint it is a centered
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
}: Props) {
  const hold = modal ? (e: Event) => e.preventDefault() : undefined
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-scrim data-[state=open]:animate-[fade-in_.15s_ease-out]" />
        <Dialog.Content
          onEscapeKeyDown={hold}
          onPointerDownOutside={hold}
          onInteractOutside={hold}
          className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[520px] flex-col gap-3.5 rounded-t-sheet ${surface ? 'bg-surface' : 'bg-bg'} px-screen pb-[calc(24px+var(--safe-bottom))] pt-2.5 outline-none data-[state=open]:animate-[sheet-up_.2s_ease-out] lg:bottom-auto lg:top-1/2 lg:max-w-[440px] lg:-translate-y-1/2 lg:rounded-sheet lg:p-6 lg:shadow-dialog`}
        >
          <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-square bg-border-strong lg:hidden" />
          {icon}
          <Dialog.Title
            className={`font-display text-22 font-bold tracking-[-0.01em] text-text ${hideTitle ? 'sr-only' : ''}`}
          >
            {title}
          </Dialog.Title>
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
