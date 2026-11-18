import type { ReactNode } from 'react'
import { IconPlus } from './icons'

/**
 * The walkthrough schedule's pieces (WT-Ops-Schedule, OT-133): a rotation month's letter
 * badge and row, the year's preview, a restaurant's rotation tag and the note that says
 * whose schedule this is. The tones go A, B, C, then round again.
 */

const BG = { 1: 'bg-rotation-1-bg', 2: 'bg-rotation-2-bg', 3: 'bg-rotation-3-bg' } as const
const TEXT = { 1: 'text-rotation-1-text', 2: 'text-rotation-2-text', 3: 'text-rotation-3-text' } as const
export type Tone = keyof typeof BG

/** "A" on its tone: 30px, rounded. */
export function RotationBadge({ letter, tone }: { letter: string; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-segment font-display text-13 font-bold ${BG[tone]} ${TEXT[tone]}`}
    >
      {letter}
    </span>
  )
}

/** A month in the cycle: its letter, the checklist and what it is, and Edit when allowed. */
export function RotationMonthRow({
  letter,
  tone,
  name,
  detail,
  onEdit,
}: {
  letter: string
  tone: Tone
  name: string
  detail: string
  onEdit?: () => void
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 border-t border-surface-muted py-2.5 pl-3.5 pr-2 first:border-t-0">
      <RotationBadge letter={letter} tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-15 font-semibold [overflow-wrap:anywhere]">{name}</span>
        <span className="text-13 text-text-secondary">{detail}</span>
      </span>
      {onEdit && (
        <button
          type="button"
          aria-label={`Edit month ${letter}`}
          onClick={onEdit}
          className="flex min-h-tap flex-none items-center px-3 text-15 font-semibold text-brand hover:text-brand-strong"
        >
          Edit
        </button>
      )}
    </div>
  )
}

/** "+ Add a month to the cycle", the last row of the rotation's card. */
export function AddMonthRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex min-h-14 w-full items-center gap-2 border-t border-surface-muted px-5 text-15 font-semibold text-brand first:border-t-0 hover:text-brand-strong"
    >
      <IconPlus size={18} strokeWidth={2.4} />
      Add a month to the cycle
    </button>
  )
}

/** The year at a glance: twelve months with their letter, this month outlined, and a legend. */
export function YearPreview({
  year,
  months,
  legend,
}: {
  year: number
  months: { name: string; letter: string; tone: Tone; label: string; now?: boolean }[]
  legend: { letter: string; tone: Tone; name: string }[]
}) {
  return (
    <div className="flex flex-col">
      <div role="list" aria-label={`Months in ${year}`} className="grid grid-cols-6 gap-1.5 px-3.5 pb-2 pt-3">
        {months.map((m) => (
          <div
            key={m.name}
            role="listitem"
            aria-label={m.label}
            className={`flex flex-col items-center gap-1 rounded-segment py-1.5 text-11 font-semibold text-text-body ${BG[m.tone]} ${m.now ? 'outline outline-2 outline-offset-1 outline-text' : ''}`}
          >
            <span>{m.name}</span>
            <span className={`font-display text-13 font-bold ${TEXT[m.tone]}`}>{m.letter}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-3.5 pb-3 text-13 text-text-secondary">
        {legend.map((l) => (
          <span key={l.letter}>
            <b className={TEXT[l.tone]}>{l.letter}</b> {l.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A restaurant's rotation on the list: "Group", or the rotation it is on. */
export function RotationTag({ own, children }: { own: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex-none whitespace-nowrap rounded-pill px-2.5 py-0.5 text-12 font-semibold ${
        own ? 'bg-rotation-3-bg text-rotation-3-text' : 'bg-surface-muted text-text-secondary'
      }`}
    >
      {children}
    </span>
  )
}

/** Whose schedule this is: the group's, a restaurant following it, or one with its own. */
export function ScheduleNote({
  kind,
  children,
  action,
}: {
  kind: 'group' | 'follows' | 'own'
  children: ReactNode
  action?: ReactNode
}) {
  const tone =
    kind === 'group'
      ? 'bg-brand-tint-soft text-brand-strong'
      : kind === 'own'
        ? 'bg-rotation-3-bg text-rotation-own-text'
        : 'bg-surface-muted text-text-body'
  return (
    <div
      aria-live="polite"
      className={`flex flex-none flex-col gap-2.5 rounded-input px-3.5 py-3 text-13 leading-[1.45] ${tone}`}
    >
      <span>{children}</span>
      {action}
    </div>
  )
}

const TASK_TAG = {
  group: 'bg-surface-muted text-text-secondary',
  changed: 'bg-rotation-1-bg text-rotation-1-text',
  own: 'bg-rotation-3-bg text-rotation-3-text',
} as const

/**
 * A quarterly task (WT-Ops-Tasks): its name, "Directions · video", where it comes from on a
 * restaurant's list ("All restaurants", "Changed for …", "Only …"), and Edit and Remove when
 * they apply.
 */
export function QuarterTaskRow({
  name,
  meta,
  tag,
  onEdit,
  onRemove,
  removeLabel,
  action,
}: {
  name: string
  meta: string
  tag?: { kind: keyof typeof TASK_TAG; label: string }
  onEdit?: () => void
  onRemove?: () => void
  /** "Remove Patio heater test for Porter", for a screen reader. */
  removeLabel?: string
  /** One other action in Edit's place: Restore on a removed task, Turn on on one turned off. */
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-start gap-2.5 border-t border-surface-muted py-3 pl-3.5 pr-2 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="text-15 font-semibold leading-[1.3] [overflow-wrap:anywhere]">{name}</span>
        <span className="text-12 text-text-secondary">{meta}</span>
        {tag && (
          <span className={`whitespace-nowrap rounded-pill px-2 py-0.5 text-11 font-bold ${TASK_TAG[tag.kind]}`}>
            {tag.label}
          </span>
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          aria-label={`Edit ${name}`}
          onClick={onEdit}
          className="-my-1 flex min-h-tap flex-none items-center px-2 text-14 font-semibold text-brand hover:text-brand-strong"
        >
          Edit
        </button>
      )}
      {action && (
        <button
          type="button"
          aria-label={`${action.label} ${name}`}
          onClick={action.onClick}
          className="-my-1 flex min-h-tap flex-none items-center px-2 text-14 font-semibold text-brand hover:text-brand-strong"
        >
          {action.label}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${name}`}
          onClick={onRemove}
          className="-my-1 flex min-h-tap flex-none items-center px-2 text-14 font-semibold text-danger"
        >
          Remove
        </button>
      )}
    </div>
  )
}

/** The dashed "+ Add Q4 task for all restaurants" under a list. */
export function DashedAddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full flex-none items-center justify-center gap-1.5 rounded-input border border-dashed border-border-muted text-14 font-semibold text-brand hover:bg-surface-hover"
    >
      <IconPlus size={16} strokeWidth={2.4} />
      {children}
    </button>
  )
}
