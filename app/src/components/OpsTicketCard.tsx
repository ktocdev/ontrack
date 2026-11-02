import { Card, CardLink } from './Card'
import { StatusPill, UrgentTag, WalkthroughTag, type PillStatus } from './Pill'

/**
 * A ticket on the Ops dashboard, under its restaurant's label: 12px 14px padding with
 * 6px gaps. Any URGENT and the number across from the status pill, a 16px title, a meta
 * line, then any Walkthrough tag and a badge with the name of whoever is working on it.
 * Without `to` it is not a link (View as).
 */
type Props = {
  to?: string
  displayId: string
  title: string
  status: PillStatus
  /** Replaces the pill's words ("Scheduled Thu"). */
  statusLabel?: string
  urgent?: boolean
  walkthrough?: boolean
  /** Area, category and how long ago it was opened. */
  meta: string
  /** Who is working on it. */
  worker?: { name: string; mine: boolean } | null
}

export function OpsTicketCard({
  to,
  displayId,
  title,
  status,
  statusLabel,
  urgent = false,
  walkthrough = false,
  meta,
  worker,
}: Props) {
  const body = (
    <div className="flex flex-col gap-1.5 px-3.5 py-3">
      <span className="flex items-center gap-2">
        {urgent && <UrgentTag className="flex-none" />}
        <span className="font-mono text-12 text-text-muted">{displayId}</span>
        <span className="flex-1" />
        <StatusPill status={status} label={statusLabel} />
      </span>
      <span className="text-16 font-semibold [overflow-wrap:anywhere]">{title}</span>
      <span className="text-12 text-text-muted">{meta}</span>
      {(walkthrough || worker) && (
        <span className="flex items-center justify-between gap-2">
          {walkthrough ? <WalkthroughTag /> : <span />}
          {worker && (
            <span
              title={worker.mine ? 'You are working on this' : `${worker.name} is working on this`}
              className={`min-w-0 truncate rounded-pill px-2.5 py-0.5 text-12 font-semibold ${
                worker.mine ? 'bg-brand-tint text-brand' : 'bg-surface-sunken text-text-body'
              }`}
            >
              {worker.mine ? 'You' : worker.name}
            </span>
          )}
        </span>
      )}
    </div>
  )
  return to ? (
    <CardLink to={to} className="flex-none text-text no-underline hover:text-text">
      {body}
    </CardLink>
  ) : (
    <Card className="flex-none">{body}</Card>
  )
}
