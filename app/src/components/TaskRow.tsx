import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusPill } from './Pill'
import { RestaurantName } from './RestaurantName'
import { IconTicket, IconTrash } from './icons'

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
  note,
  done,
  tag,
  restaurant,
  onToggle,
  onDelete,
}: {
  title: string
  meta: string
  /** What the sender added, on a task from the Support Team ("It's the 2-pin kind"). */
  note?: string | null
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
          {note && <span className="text-13 leading-[1.4] text-text-body [overflow-wrap:anywhere]">{note}</span>}
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

/**
 * An in-house fix as the Support Team sees it (WT-Ops-Fix): read-only, since the restaurant
 * checks it off. The title in 15px semibold, where it came from and who added it under it,
 * and on the right Open, Fixed, or the ticket it became as a link. An open one offers
 * Convert to ticket under its text, unless onConvert is left out (View as, no Update status).
 */
export function FixRow({
  title,
  where,
  meta,
  note,
  restaurant,
  state,
  onConvert,
}: {
  title: string
  /** "BOH › Electrical › Outlets"; left out when a filter already says it. */
  where?: string | null
  meta: string
  note?: string | null
  restaurant?: { name: string; color: string }
  state: { kind: 'open' } | { kind: 'fixed' } | { kind: 'ticket'; displayId: string; to: string }
  onConvert?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border px-3.5 py-3 first:border-t-0">
      <div className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {restaurant && <RestaurantName name={restaurant.name} color={restaurant.color} variant="meta" />}
          <span className="text-15 font-semibold [overflow-wrap:anywhere]">{title}</span>
          {note && <span className="text-13 leading-[1.4] text-text-body [overflow-wrap:anywhere]">{note}</span>}
          {where && <span className="text-12 text-text-secondary">{where}</span>}
          <span className="text-12 text-text-secondary">{meta}</span>
        </span>
        {state.kind === 'ticket' ? (
          <Link
            to={state.to}
            aria-label={`Open ticket ${state.displayId}`}
            className="inline-flex flex-none items-center whitespace-nowrap rounded-pill bg-status-scheduled-bg px-[9px] py-[3px] font-mono text-12 font-medium text-status-scheduled-text no-underline hover:underline"
          >
            {state.displayId}
          </Link>
        ) : (
          <StatusPill status={state.kind === 'fixed' ? 'fixed' : 'open'} className="flex-none" />
        )}
      </div>
      {state.kind === 'open' && onConvert && (
        <button
          type="button"
          aria-label={`Convert to ticket: ${title}`}
          onClick={onConvert}
          className="-mb-1.5 -ml-0.5 -mt-1 inline-flex min-h-tap items-center gap-1.5 self-start px-0.5 text-13 font-semibold text-brand hover:text-brand-strong"
        >
          <IconTicket size={14} strokeWidth={2.2} />
          Convert to ticket
        </button>
      )}
    </div>
  )
}
