import type { ReactNode } from 'react'
import { IconReopen } from './icons'

/**
 * Why a ticket came back (Ops-Closed-Ticket): a gold panel with the label, the reason in
 * quotes, any photos and who said it when. 14px radius, 12px 14px padding, 8px gaps.
 */
export function ReopenedFlag({ reason, photos, by }: { reason: string; photos?: ReactNode; by: string }) {
  return (
    <div
      role="region"
      aria-label="Reopened"
      className="flex flex-none flex-col gap-2 rounded-card border border-reopened-banner-border bg-reopened-banner-bg px-3.5 py-3"
    >
      <span className="flex items-center gap-1.5 text-12 font-bold uppercase tracking-[.04em] text-status-reopened-text">
        <IconReopen size={14} strokeWidth={2.4} />
        Reopened
      </span>
      <span className="whitespace-pre-wrap text-15 leading-[1.45] [overflow-wrap:anywhere]">&quot;{reason}&quot;</span>
      {photos && <div className="flex flex-wrap gap-2">{photos}</div>}
      <span className="text-12 text-status-reopened-text">{by}</span>
    </div>
  )
}
