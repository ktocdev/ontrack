import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusPill, UrgentTag, WalkthroughTag, type PillStatus } from './Pill'
import { RestaurantName } from './RestaurantName'

/**
 * A ticket on the Ops dashboard (design/screens/Ops-Dashboard): 12px 14px padding with
 * 6px gaps. The restaurant across from the status pill, a 16px title, a meta line, then
 * any Walkthrough tag and a badge with the name of whoever is working on it. The board
 * draws initials in a circle; a name says more. A reopened ticket is tinted and
 * 12px 16px, and says why it came back in place of the tag and badge. Without `to` it
 * is not a link (View as).
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
  restaurant?: { name: string; color: string }
  /** Area, category and when, after the number. */
  meta: string
  /** Who is working on it. */
  worker?: { name: string; mine: boolean } | null
  /** Why it came back, for a reopened ticket. */
  reason?: string | null
}

function Shell({ to, reopened, children }: { to?: string; reopened: boolean; children: ReactNode }) {
  const look = `relative flex flex-none flex-col gap-1.5 rounded-card border text-text no-underline transition-colors hover:text-text ${
    reopened
      ? 'border-[var(--reopened-banner-border)] bg-[var(--reopened-banner-bg)] px-4 py-3 hover:border-alert-badge'
      : 'border-border bg-surface px-3.5 py-3 hover:border-border-muted'
  }`
  return to ? (
    <Link to={to} className={look}>
      {children}
    </Link>
  ) : (
    <div className={look}>{children}</div>
  )
}

export function OpsTicketCard({
  to,
  displayId,
  title,
  status,
  statusLabel,
  urgent = false,
  walkthrough = false,
  restaurant,
  meta,
  worker,
  reason,
}: Props) {
  const reopened = status === 'reopened'
  return (
    <Shell to={to} reopened={reopened}>
      <span className="flex items-center gap-2">
        {urgent && <UrgentTag className="flex-none" />}
        {restaurant && <RestaurantName name={restaurant.name} color={restaurant.color} variant="meta" wrap />}
        <span className="flex-1" />
        <StatusPill status={status} label={statusLabel} />
      </span>
      <span className="text-16 font-semibold [overflow-wrap:anywhere]">{title}</span>
      {reopened && reason && (
        <span className="text-13 leading-[1.4] text-[var(--reopened-banner-text)] [overflow-wrap:anywhere]">
          &quot;{reason}&quot;
        </span>
      )}
      <span className="text-12 text-text-muted">
        <span className="font-mono">{displayId}</span> · {meta}
      </span>
      {!reopened && (walkthrough || worker) && (
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
    </Shell>
  )
}
