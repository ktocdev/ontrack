import type { ReactNode } from 'react'
import { RestaurantName } from './RestaurantName'
import { IconTrash } from './icons'

/**
 * A to-do you check off (Main-InHouse): a 22px checkbox, the title in 14px semibold with
 * where it came from under it, and a delete button on the right. A done row strikes its
 * title through. With no onDelete the button is left out, and with no onToggle the
 * checkbox only shows the state (View as).
 */
export function TaskList({ children }: { children: ReactNode }) {
  return <div className="flex-none overflow-hidden rounded-input border border-border bg-surface">{children}</div>
}

export function TaskRow({
  title,
  meta,
  done,
  restaurant,
  onToggle,
  onDelete,
}: {
  title: string
  meta: string
  done: boolean
  /** For a person with more than one restaurant. */
  restaurant?: { name: string; color: string }
  onToggle?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex min-h-14 items-center gap-2.5 border-t border-border py-2.5 pl-4 pr-2 text-14 first:border-t-0">
      <label className={`flex min-w-0 flex-1 items-center gap-3 ${onToggle ? 'cursor-pointer' : ''}`}>
        <input
          type="checkbox"
          checked={done}
          disabled={!onToggle}
          onChange={onToggle}
          aria-label={`Mark complete: ${title}`}
          className="m-0 h-[22px] w-[22px] flex-none accent-brand-fill"
        />
        <span className="flex min-w-0 flex-col gap-[3px]">
          {restaurant && <RestaurantName name={restaurant.name} color={restaurant.color} variant="meta" />}
          <span className={`font-semibold [overflow-wrap:anywhere] ${done ? 'text-text-secondary line-through' : ''}`}>
            {title}
          </span>
          <span className="text-12 text-text-muted">{meta}</span>
        </span>
      </label>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete in-house task: ${title}`}
          onClick={onDelete}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control text-danger transition-colors hover:bg-status-open-bg active:bg-status-open-bg active:duration-0"
        >
          <IconTrash size={20} />
        </button>
      )}
    </div>
  )
}
