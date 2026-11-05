import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { RestaurantName } from './RestaurantName'
import { IconChevronDown, IconChevronRight } from './icons'

/**
 * The equipment lists (Ops-Equipment-List, Equipment-List): a card per category that
 * opens to its units, with a badge for open tickets. The Ops rows also name the
 * restaurant and this year's spend; a manager's rows don't.
 */

/**
 * "1 open": open tickets on a category or a unit, in the Open pill's colors. `compact` is
 * the count alone, beside the Tickets tab on Ops (Ops-Equipment-Details).
 */
export function OpenBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  return compact ? (
    <span
      aria-label={`${count} open`}
      className="min-w-5 rounded-pill bg-status-open-bg px-1.5 py-px text-center text-12 font-bold text-status-open-text"
    >
      {count}
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-pill bg-status-open-bg px-2 py-1 text-11 font-bold leading-[15px] text-status-open-text">
      {count} open
    </span>
  )
}

/** A category's card: the head is a 52px button that opens and closes its rows. */
export function EquipmentGroup({
  name,
  count,
  openCount,
  open,
  onToggle,
  children,
}: {
  name: string
  count: number
  openCount: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section aria-label={name} className="flex-none overflow-hidden rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 text-left text-15 font-semibold leading-5 text-text transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0"
      >
        <span className="min-w-0 flex-1">{name}</span>
        {openCount > 0 && <OpenBadge count={openCount} />}
        <span className="min-w-[18px] text-right text-13 font-medium text-text-muted">{count}</span>
        <IconChevronDown
          size={18}
          className={`flex-none text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && children}
    </section>
  )
}

type RowProps = {
  /** Where the row goes; without it (View as) the row leads nowhere. */
  to?: string
  name: string
  restaurant?: { name: string; color: string }
  brand?: string | null
  serial?: string | null
  /** This year's spend, formatted, or null for none; leave it out without see_costs. */
  spend?: { amount: string | null; year: number }
  openCount?: number
}

/** A unit in its category: name, restaurant, brand · serial, then spend and its open badge. */
export function EquipmentRow({ to, name, restaurant, brand, serial, spend, openCount = 0 }: RowProps) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-15 font-semibold text-text">{name}</span>
        {restaurant && <RestaurantName variant="meta" name={restaurant.name} color={restaurant.color} />}
        {(brand || serial) && (
          <span className="text-12 text-text-muted">
            {brand}
            {brand && serial && ' · '}
            {serial && <span className="font-mono">{serial}</span>}
          </span>
        )}
      </div>
      {(spend || openCount > 0) && (
        <div className="flex flex-none flex-col items-end gap-1">
          {spend &&
            (spend.amount ? (
              <>
                <span className="font-mono text-14 font-semibold text-text">{spend.amount}</span>
                <span className="text-11 text-text-muted">spent in {spend.year}</span>
              </>
            ) : (
              <>
                <span className="text-13 font-semibold text-text-muted">No cost</span>
                <span className="text-11 text-text-muted">in {spend.year}</span>
              </>
            ))}
          {openCount > 0 && <OpenBadge count={openCount} />}
        </div>
      )}
      {to && <IconChevronRight size={16} className="flex-none text-text-muted" />}
    </>
  )
  const cls = 'flex min-h-[60px] items-center gap-3 border-t border-surface-muted px-3.5 py-2 text-text'
  return to ? (
    <Link
      to={to}
      className={`${cls} transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
