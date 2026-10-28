import type { ReactNode } from 'react'
import { ButtonLink, IconButton } from '../../components/Button'
import { IconClose, Logo } from '../../components/icons'
import { Spinner } from '../../components/Skeleton'
import { Screen } from '../../components/Screen'

/**
 * Centered spinner screen (design: Loading · Centered spinner). Two forms:
 * the invite check shows the OnTrack mark top-left; the QR lookup shows a
 * close button top-right and a Cancel link under the text.
 */
type Props = {
  title: string
  body?: ReactNode
  /** Show the mark and name in the top-left (invite flow). */
  brand?: boolean
  /** A route to go to when cancelling (QR lookup). */
  cancelTo?: string
  cancelLabel?: string
}

export function CenteredLoading({ title, body, brand = true, cancelTo, cancelLabel = 'Cancel' }: Props) {
  return (
    <Screen>
      {cancelTo ? (
        <div className="flex justify-end px-3 pt-safe">
          <IconButton label="Cancel" className="mt-3" onClick={() => window.history.back()}>
            <IconClose />
          </IconButton>
        </div>
      ) : brand ? (
        <div className="flex items-center gap-2 px-6 pt-safe">
          <span className="mt-7 flex items-center gap-2">
            <Logo size={28} />
            <span className="font-display text-[18px] font-bold tracking-[-0.01em]">OnTrack</span>
          </span>
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center"
        style={{ paddingBottom: cancelTo ? 120 : 140 }}
      >
        <Spinner />
        <h1 className="mt-1.5 font-display text-22 font-bold tracking-[-0.01em]">{title}</h1>
        {body && <p className="max-w-[280px] text-14 leading-normal text-text-secondary">{body}</p>}
        {cancelTo && (
          <ButtonLink to={cancelTo} variant="small" className="mt-2">
            {cancelLabel}
          </ButtonLink>
        )}
      </div>
    </Screen>
  )
}
