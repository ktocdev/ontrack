import type { ReactNode } from 'react'
import { Card, CardLink } from './Card'
import { NEW_RING, useNewTicket } from './newTicket'
import { StatusPill, WalkthroughTag, type PillStatus } from './Pill'
import { RestaurantName } from './RestaurantName'

/**
 * A ticket in a list (design/screens/Main): 14px 16px padding with 8px gaps. The
 * number and any Walkthrough tag across from the status pill, a 16px title, where
 * it is, then who has it and when under a hairline. `restaurant` is for lists that
 * span more than one. Without `to` it is not a link (View as). Given `createdAt`, a
 * new ticket has a ring for its first minutes (newTicket.ts).
 */
type Props = {
  to?: string
  displayId: string
  title: string
  status: PillStatus
  /** Replaces the pill's words ("Scheduled Thu"). */
  statusLabel?: string
  walkthrough?: boolean
  place: string
  restaurant?: { name: string; color: string }
  who: ReactNode
  when: string
  createdAt?: string
}

export function TicketCard({
  to,
  displayId,
  title,
  status,
  statusLabel,
  walkthrough,
  place,
  restaurant,
  who,
  when,
  createdAt,
}: Props) {
  const ring = useNewTicket(createdAt, status) ? NEW_RING : ''
  const body = (
    <div className="flex flex-col gap-2 px-4 py-3.5">
      {ring && <span className="sr-only">New ticket.</span>}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-12 text-text-muted">{displayId}</span>
          {walkthrough && <WalkthroughTag />}
        </span>
        <StatusPill status={status} label={statusLabel} />
      </div>
      {restaurant && <RestaurantName name={restaurant.name} color={restaurant.color} variant="meta" />}
      <span className="text-16 font-semibold leading-[1.3]">{title}</span>
      <span className="text-13 text-text-muted">{place}</span>
      <div className="flex justify-between gap-3 border-t border-surface-muted pt-2 text-12 text-text-muted">
        <span className="min-w-0">{who}</span>
        <span className="flex-none">{when}</span>
      </div>
    </div>
  )
  return to ? (
    <CardLink to={to} className={ring}>
      {body}
    </CardLink>
  ) : (
    <Card className={ring}>{body}</Card>
  )
}
