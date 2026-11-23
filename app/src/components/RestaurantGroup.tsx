import { useId, type ReactNode } from 'react'
import { RestaurantSquare } from './RestaurantName'
import { IconChevronDown } from './icons'

/**
 * A restaurant's open work on the Ops dashboard (from feedback, Nov 23, 2026; no board):
 * one row per restaurant, read at a glance in the morning. The row is the restaurant's
 * name, larger than the old eyebrow label, with how many are open and how many of those
 * are urgent, and a chevron. Closed, it still shows its `pinned` items (urgent tickets,
 * and the ticket open beside the list); open, it shows every item in the order given.
 * Without `onToggle` it is a plain heading over every item, for one restaurant picked.
 */
export type GroupItem = { key: string; node: ReactNode; pinned?: boolean }

export function RestaurantGroup({
  name,
  color,
  open = true,
  onToggle,
  openCount,
  urgentCount,
  items,
}: {
  name: string
  color: string
  open?: boolean
  /** Makes the row a button that opens and closes it. */
  onToggle?: () => void
  openCount: number
  urgentCount: number
  items: GroupItem[]
}) {
  const listId = useId()
  const shown = !onToggle || open ? items : items.filter((i) => i.pinned)
  const counts = (
    <span className="flex flex-none items-baseline gap-1 text-13 font-semibold text-text-secondary">
      <span>{openCount} open</span>
      {urgentCount > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-urgent">{urgentCount} urgent</span>
        </>
      )}
    </span>
  )
  const title = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <RestaurantSquare color={color} size={14} />
      <span className="truncate font-display text-18 font-bold tracking-[-0.01em] text-text">{name}</span>
    </span>
  )
  return (
    <section aria-label={name} className="flex flex-none flex-col gap-2.5">
      {onToggle ? (
        <h2 className="flex">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${name}, ${openCount} open${urgentCount > 0 ? `, ${urgentCount} urgent` : ''}`}
            onClick={onToggle}
            className="-mx-2 flex min-h-tap flex-1 items-center gap-2.5 rounded-control px-2 text-left transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0"
          >
            {title}
            {counts}
            <IconChevronDown
              size={18}
              aria-hidden="true"
              className={`flex-none text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </h2>
      ) : (
        <h2 className="flex min-h-tap items-center gap-2.5">
          {title}
          {counts}
        </h2>
      )}
      {shown.length > 0 && (
        <div id={listId} className="flex flex-col gap-2.5">
          {shown.map((i) => (
            <div key={i.key} className="contents">
              {i.node}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
