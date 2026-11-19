import { Card, CardLink } from './Card'
import { RestaurantName } from './RestaurantName'
import { NEW_RING, useNewTicket } from './newTicket'
import { StatusPill, UrgentTag, WalkthroughTag, type PillStatus } from './Pill'

/**
 * A ticket on the Ops dashboard, under its restaurant's label: 12px 14px padding with
 * 6px gaps. Any URGENT and the number across from the status pill, a 16px title, a meta
 * line, then any Walkthrough tag and a badge with the name of anyone else working on it.
 * Without `to` it is not a link (View as). Given `createdAt`, a new ticket has a ring
 * for its first minutes (newTicket.ts). Given a restaurant (Admin-Tickets, a list across
 * restaurants with no labels), the restaurant takes the number's place on top and the
 * number starts the meta line.
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
  /** Who else is working on it. */
  worker?: string | null
  createdAt?: string
  restaurant?: { name: string; color: string }
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
  createdAt,
  restaurant,
}: Props) {
  const ring = useNewTicket(createdAt, status) ? NEW_RING : ''
  const body = (
    <div className="flex flex-col gap-1.5 px-3.5 py-3">
      {ring && <span className="sr-only">New ticket.</span>}
      <span className="flex items-center gap-2">
        {urgent && <UrgentTag className="flex-none" />}
        {restaurant ? (
          <RestaurantName name={restaurant.name} color={restaurant.color} className="min-w-0 flex-1" />
        ) : (
          <>
            <span className="font-mono text-12 text-text-muted">{displayId}</span>
            <span className="flex-1" />
          </>
        )}
        <StatusPill status={status} label={statusLabel} />
      </span>
      <span className="text-16 font-semibold [overflow-wrap:anywhere]">{title}</span>
      <span className="text-12 text-text-muted">
        {restaurant && (
          <>
            <span className="font-mono">{displayId}</span>
            {meta && ' · '}
          </>
        )}
        {meta}
      </span>
      {(walkthrough || worker) && (
        <span className="flex items-center justify-between gap-2">
          {walkthrough ? <WalkthroughTag /> : <span />}
          {worker && (
            <span
              title={`${worker} is working on this`}
              className="min-w-0 truncate rounded-pill bg-surface-sunken px-2.5 py-0.5 text-12 font-semibold text-text-body"
            >
              {worker}
            </span>
          )}
        </span>
      )}
    </div>
  )
  return to ? (
    <CardLink to={to} className={`flex-none text-text no-underline hover:text-text ${ring}`}>
      {body}
    </CardLink>
  ) : (
    <Card className={`flex-none ${ring}`}>{body}</Card>
  )
}
