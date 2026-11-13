import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { UrgentTag } from './Pill'
import { IconCheck, IconChevronDown, IconChevronRight, IconClose, IconHelpCircle } from './icons'

/**
 * The walkthrough checklist's pieces (design/screens/WT-Checklist): a group's card that
 * opens and closes, an item with its Good / In-house / Ticket buttons, the list of what
 * was made from an item, the inline in-house fix, and the Help panel.
 */

const CHOICE = {
  good: 'border-[1.5px] border-choice-good-border bg-choice-good-bg text-choice-good-text',
  inhouse: 'border-[1.5px] border-choice-inhouse-border bg-choice-inhouse-bg text-choice-inhouse-text',
  ticket: 'border-[1.5px] border-choice-ticket-border bg-choice-ticket-bg text-choice-ticket-text',
}

/**
 * One of Good, In-house, Ticket: 40px as drawn, reaching 44px through a transparent layer
 * above and below. Lit once picked: Good when the item is Good, the others once the item
 * has a fix or a ticket.
 */
export function CheckChoice({
  tone,
  lit,
  className = '',
  children,
  ...rest
}: { tone: keyof typeof CHOICE; lit: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`relative min-h-10 min-w-14 rounded-segment px-1.5 text-12 font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-0.5 active:duration-0 disabled:cursor-not-allowed disabled:opacity-60 ${
        lit
          ? CHOICE[tone]
          : 'border border-border-strong bg-surface text-text-body not-disabled:hover:bg-surface-hover not-disabled:active:bg-surface-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A group of items (Electrical): its name, "3/5", a check when every item is done. */
export function ChecklistGroup({
  name,
  done,
  total,
  open,
  onToggle,
  children,
}: {
  name: string
  done: number
  total: number
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
        className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 text-left text-15 font-semibold text-text transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0"
      >
        <IconChevronRight
          size={16}
          className={`flex-none text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>{name}</span>
        <span className="text-13 font-medium text-text-secondary">
          {done}/{total}
        </span>
        {done === total && total > 0 && (
          <span role="img" aria-label="Complete" className="flex flex-none text-brand">
            <IconCheck size={16} />
          </span>
        )}
      </button>
      {open && children}
    </section>
  )
}

/** An item: its name and buttons, then whatever was made from it. */
export function ChecklistItem({ name, choices, children }: { name: string; choices: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 text-14 font-semibold leading-[1.3] text-text">{name}</span>
        <div role="group" aria-label={name} className="flex flex-none gap-1">
          {choices}
        </div>
      </div>
      {children}
    </div>
  )
}

/** The fixes and tickets made from an item, on a sunken panel, with lines between. */
export function ChecklistEntries({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 flex flex-col gap-2.5 rounded-control border border-border bg-surface-hover px-3.5 py-3 [&>*+*]:border-t [&>*+*]:border-border [&>*+*]:pt-2.5">
      {children}
    </div>
  )
}

/** A fix or a ticket from an item: its tag, its words, and the way to it. */
export function ChecklistEntry({
  to,
  kind,
  label,
  urgent = false,
  done = false,
  children,
}: {
  /** Nothing to open (View as) leaves it still. */
  to?: string
  kind: 'fix' | 'ticket'
  /** The ticket's number; a fix says In-house. */
  label?: string
  urgent?: boolean
  /** A fix checked off or a ticket closed. */
  done?: boolean
  children: ReactNode
}) {
  const tag =
    kind === 'fix' ? (
      <span className="flex-none whitespace-nowrap rounded-chip bg-choice-inhouse-bg px-1.5 py-px text-11 font-bold text-choice-inhouse-text">
        In-house
      </span>
    ) : (
      <span className="flex flex-none flex-col items-start gap-1">
        <span className="whitespace-nowrap rounded-chip bg-status-open-bg px-1.5 py-px font-mono text-11 font-bold text-status-open-text">
          {label}
        </span>
        {urgent && <UrgentTag />}
      </span>
    )
  const body = (
    <>
      {tag}
      <span className={`min-w-0 flex-1 ${done ? 'text-text-muted line-through' : ''}`}>{children}</span>
      {done && (
        <span className="flex-none text-12 font-semibold text-text-muted">{kind === 'fix' ? 'Done' : 'Closed'}</span>
      )}
      {to && <IconChevronRight size={16} className="flex-none self-center text-text-muted" />}
    </>
  )
  const row = 'flex min-h-7 items-start gap-2.5 text-13 leading-[1.45] text-text-body'
  return to ? (
    <Link to={to} className={`${row} hover:text-text [&:hover>span:nth-child(2)]:underline`}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  )
}

/** Typing an in-house fix under its item: the field, Add, and a way out. */
export function InlineFix({
  item,
  saving,
  onAdd,
  onCancel,
  autoFocus = true,
}: {
  item: string
  /** Off where it is only shown (/kit), so the page doesn't jump to it. */
  autoFocus?: boolean
  saving: boolean
  onAdd: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const ready = title.trim().length > 0
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !saving) onAdd(title.trim())
      }}
    >
      <input
        // The field takes the focus as soon as In-house is tapped.
        autoFocus={autoFocus}
        type="text"
        value={title}
        maxLength={140}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What will your team fix?"
        aria-label={`In-house fix for ${item}`}
        className="min-h-tap min-w-0 flex-1 rounded-segment border border-border-strong bg-surface px-2.5 text-text placeholder:text-text-faint"
      />
      <button
        type="submit"
        disabled={!ready || saving}
        className="flex min-h-tap min-w-11 flex-none items-center justify-center rounded-segment bg-brand-fill px-2.5 text-13 font-semibold text-on-brand transition-colors not-disabled:hover:bg-brand-fill-hover not-disabled:active:bg-brand-fill-active active:duration-0 disabled:opacity-60"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel in-house fix"
        className="flex min-h-tap min-w-11 flex-none items-center justify-center rounded-segment text-text-secondary active:bg-surface-muted"
      >
        <IconClose size={18} />
      </button>
    </form>
  )
}

/** Help above the checklist: what each choice means, and when Good waits. */
export function ChecklistHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-none flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-1.5 self-start text-13 font-semibold text-brand"
      >
        <IconHelpCircle size={16} />
        Help
        <IconChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-1.5 pt-0.5 text-13 leading-[1.45] text-text-body">
          <span>
            <b className="text-choice-good-text">Good</b> no issues
          </span>
          <span>
            <b className="text-choice-inhouse-text">In-house</b> your team fixes it
          </span>
          <span>
            <b className="text-choice-ticket-text">Ticket</b> needs a repair
          </span>
          <span className="text-text-secondary">An item can have several in-house fixes and tickets.</span>
          <span className="text-text-secondary">
            Items with an In-house fix or Ticket can’t be marked Good unless those In-house and Ticket items are
            resolved or deleted.
          </span>
        </div>
      )}
    </div>
  )
}
