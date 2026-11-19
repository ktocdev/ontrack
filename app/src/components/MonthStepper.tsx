import type { ReactNode } from 'react'
import { IconChevronLeft, IconChevronRight } from './icons'

/** "October", from "2026-10-01". */
const nameOf = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', { month: 'long' })

/**
 * A month at a time (the Ops walkthroughs overview, OT-129; leadership's Overview, OT-143):
 * the month and year between Previous and Next, with an optional line under it. Months are
 * "2026-10-01"; a missing neighbour disables its button.
 */
export function MonthStepper({
  month,
  line,
  older,
  newer,
  onGo,
}: {
  month: string
  line?: ReactNode
  older: string | undefined
  newer: string | undefined
  onGo: (month: string) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-input border border-border bg-surface p-1">
      <StepButton label="Previous month" to={older} onGo={onGo} icon={<IconChevronLeft size={18} />} />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-px text-center">
        <span className="text-15 font-bold">
          {nameOf(month)} {month.slice(0, 4)}
        </span>
        {line && <span className="truncate text-12 text-text-secondary">{line}</span>}
      </div>
      <StepButton label="Next month" to={newer} onGo={onGo} icon={<IconChevronRight size={18} />} />
    </div>
  )
}

function StepButton({
  label,
  to,
  onGo,
  icon,
}: {
  label: string
  to: string | undefined
  onGo: (month: string) => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!to}
      onClick={() => to && onGo(to)}
      className="flex size-11 flex-none items-center justify-center rounded-control text-text disabled:text-border-muted not-disabled:active:bg-surface-muted"
    >
      {icon}
    </button>
  )
}
