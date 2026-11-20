import { IconEye } from './icons'

/**
 * READ-ONLY VIEW across the top of leadership's screens and the admin's tickets (Exec-*,
 * Admin-Ticket): 36px of the text color with the background color on it. It sits above the
 * header, so it takes the phone's top inset, and the header under it is drawn without one.
 * From 768 px, in the reading column, it is an inset band with rounded corners (OT-158).
 */
export function ReadOnlyBanner() {
  return (
    <div className="flex min-h-[calc(36px+var(--safe-top))] flex-none items-center justify-center gap-2 bg-text pt-[var(--safe-top)] text-12 md:mx-screen md:mt-5 md:rounded-control font-bold tracking-[.04em] text-bg">
      <IconEye />
      READ-ONLY VIEW
    </div>
  )
}
