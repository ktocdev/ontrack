import type { ReactNode } from 'react'
import { RestaurantName } from './RestaurantName'
import { IconTrash } from './icons'

/**
 * A to-do you check off (Main-InHouse): a 22px checkbox, the title in 14px semibold with
 * where it came from under it, after any tag, and a delete button on the right. A done row strikes its
 * title through. With no onDelete the button is left out, and with no onToggle the
 * checkbox only shows the state (View as).
 */
export function TaskList({ children }: { children: ReactNode }) {
  return <div className="flex-none overflow-hidden rounded-input border border-border bg-surface">{children}</div>
}

/** What a list says in its place while it has no rows: "Nothing left to fix." */
export function TaskListEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex-none rounded-input border border-border bg-surface px-4 py-[18px] text-14 leading-[1.45] text-text-secondary">
      {children}
    </div>
  )
}

export function TaskRow({
  title,
  meta,
  done,
  tag,
  restaurant,
  onToggle,
  onDelete,
}: {
  title: string
  meta: string
  done: boolean
  /** A chip before the meta line (Walkthrough). */
  tag?: ReactNode
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
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-12 text-text-muted">
            {tag}
            {meta}
          </span>
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
