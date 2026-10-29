import type { ReactNode } from 'react'
import type { TicketStatus } from '../lib/supabase'
import {
  IconClipboardSmall,
  IconStatusDone,
  IconStatusOpen,
  IconStatusProgress,
  IconStatusReopened,
  IconStatusScheduled,
  IconStatusWaiting,
} from './icons'

/**
 * Status pills, tags and badges. Colors come from the status tokens so the
 * dark theme's 20% tints apply without a second code path.
 */

export type PillStatus = TicketStatus | 'unassigned' | 'fixed'

const STATUS: Record<PillStatus, { label: string; cls: string; Icon: (p: { size?: number }) => ReactNode }> = {
  open: { label: 'Open', cls: 'bg-status-open-bg text-status-open-text', Icon: IconStatusOpen },
  unassigned: { label: 'Unassigned', cls: 'bg-status-open-bg text-status-open-text', Icon: IconStatusOpen },
  in_progress: {
    label: 'In progress',
    cls: 'bg-status-progress-bg text-status-progress-text',
    Icon: IconStatusProgress,
  },
  waiting_parts: {
    label: 'Waiting on parts',
    cls: 'bg-status-waiting-bg text-status-waiting-text',
    Icon: IconStatusWaiting,
  },
  scheduled: {
    label: 'Scheduled',
    cls: 'bg-status-scheduled-bg text-status-scheduled-text',
    Icon: IconStatusScheduled,
  },
  reopened: { label: 'Reopened', cls: 'bg-status-reopened-bg text-status-reopened-text', Icon: IconStatusReopened },
  closed: { label: 'Closed', cls: 'bg-status-closed-bg text-status-closed-text', Icon: IconStatusDone },
  fixed: { label: 'Fixed', cls: 'bg-status-fixed-bg text-status-fixed-text', Icon: IconStatusDone },
}

export function statusLabel(status: PillStatus) {
  return STATUS[status].label
}

/** The status pill with its icon: 12px semibold, 3px 9px padding, full radius. */
export function StatusPill({
  status,
  label,
  className = '',
}: {
  status: PillStatus
  label?: string
  className?: string
}) {
  const s = STATUS[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-[9px] py-[3px] text-12 font-semibold ${s.cls} ${className}`}
    >
      <s.Icon />
      {label ?? s.label}
    </span>
  )
}

/** URGENT: white text on the urgent token, 11px bold, 5px radius. */
export function UrgentTag({ className = '' }: { className?: string }) {
  return (
    <span className={`rounded-chip bg-urgent px-[7px] py-[2px] text-11 font-bold text-white ${className}`}>URGENT</span>
  )
}

/** Walkthrough: white outline chip with a clipboard. */
export function WalkthroughTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-chip border border-wt-tag-border bg-surface px-1.5 py-px text-11 font-bold leading-[15px] text-wt-tag-text ${className}`}
    >
      <IconClipboardSmall />
      Walkthrough
    </span>
  )
}

/** Count badge next to a tab label ("Tickets 5"); active variant is brand-tinted. */
export function CountBadge({
  count,
  active = false,
  className = '',
}: {
  count: number
  active?: boolean
  className?: string
}) {
  return (
    <span
      className={`rounded-pill px-[7px] py-px text-12 font-bold ${
        active ? 'bg-brand-tint text-brand-strong' : 'bg-surface-sunken text-text-body'
      } ${className}`}
    >
      {count}
    </span>
  )
}

/** Role tag on list rows: 11px bold on surface-muted, 6px radius. */
export function RoleTag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`flex-none whitespace-nowrap rounded-tag bg-surface-muted px-2 py-[2px] text-11 font-bold text-text-body ${className}`}
    >
      {children}
    </span>
  )
}

/** Alert count on a tab ("Closed 1" with a reopened ticket). */
export function TabAlert({ count, label }: { count: number; label: string }) {
  return (
    <span aria-label={label} className="rounded-pill bg-alert-badge px-[7px] py-px text-11 font-bold text-white">
      {count}
    </span>
  )
}
