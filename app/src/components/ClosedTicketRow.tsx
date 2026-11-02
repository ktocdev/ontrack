import { Link } from 'react-router'
import { RestaurantSquare } from './RestaurantName'
import { IconReopen } from './icons'

/**
 * Closed tickets on Ops (design/screens/Ops-Closed). A month's heading with its total, and
 * a row inside a list card: 11px 14px padding, a 15px title, the restaurant, number and
 * date, and the cost on the right. A reopened ticket is tinted with a tag, and stays in the
 * month it closed. The total and the cost are left out without see_costs.
 */
export function MonthHeading({ label, total, muted = false }: { label: string; total?: string; muted?: boolean }) {
  return (
    <div className="-mb-0.5 flex flex-none items-baseline justify-between gap-3 pt-4">
      <h2 className="eyebrow">{label}</h2>
      {total && <span className={`text-13 font-bold ${muted ? 'text-text-muted' : ''}`}>{total}</span>}
    </div>
  )
}

export function ClosedTicketRow({
  to,
  title,
  displayId,
  restaurant,
  date,
  cost,
  reopened = false,
}: {
  to: string
  title: string
  displayId: string
  restaurant?: { name: string; color: string }
  date: string
  cost?: string
  reopened?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 border-t border-surface-muted px-3.5 py-[11px] text-text no-underline transition-colors first:border-t-0 hover:text-text active:duration-0 ${
        reopened ? 'bg-reopened-banner-bg' : 'hover:bg-surface-hover active:bg-surface-sunken'
      }`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-15 font-semibold [overflow-wrap:anywhere]">{title}</span>
        <span className="text-12 text-text-muted">
          {restaurant && (
            <span className="font-bold text-text-body">
              <RestaurantSquare color={restaurant.color} size={9} className="mr-1.5" />
              {restaurant.name}
            </span>
          )}
          {restaurant && ' · '}
          <span className="font-mono">{displayId}</span> · {date}
        </span>
        {reopened && (
          <span className="mt-px inline-flex items-center gap-1 self-start rounded-chip bg-status-reopened-bg px-[7px] py-0.5 text-11 font-bold text-status-reopened-text">
            <IconReopen size={11} strokeWidth={2.6} />
            Reopened
          </span>
        )}
      </span>
      {cost && <span className="flex-none text-14 font-bold">{cost}</span>}
    </Link>
  )
}
