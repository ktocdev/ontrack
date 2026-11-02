import { Link } from 'react-router'
import { RestaurantSquare } from './RestaurantName'

/**
 * Closed tickets on Ops (design/screens/Ops-Closed). A month's heading with its total, and
 * a row inside a list card: 11px 14px padding, a 15px title, the restaurant, number and
 * date, and the cost on the right. The total and the cost are left out without see_costs.
 * The board's tinted reopened row is gone, since a reopened ticket is on the dashboard.
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
}: {
  to: string
  title: string
  displayId: string
  restaurant?: { name: string; color: string }
  date: string
  cost?: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-t border-surface-muted px-3.5 py-[11px] text-text no-underline transition-colors first:border-t-0 hover:bg-surface-hover hover:text-text active:bg-surface-sunken active:duration-0"
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
      </span>
      {cost && <span className="flex-none text-14 font-bold">{cost}</span>}
    </Link>
  )
}
