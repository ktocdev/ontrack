import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Sk } from './Skeleton'
import { IconChevronRight } from './icons'

/**
 * The walkthrough's progress pieces (design/screens/WT-Home): a ring for a section, a bar
 * for the whole walkthrough split by how each done item ended (Good, in-house, ticket),
 * the small flag chips, and a section's row. Colors come from the progress and status
 * tokens, so dark mode needs nothing more.
 */

/** A section's progress: a 40px ring, filled clockwise from the top. */
export function ProgressRing({ done, total, className = '' }: { done: number; total: number; className?: string }) {
  const circumference = 2 * Math.PI * 15
  const share = total > 0 ? Math.min(done / total, 1) : 0
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className={`size-10 flex-none ${className}`}>
      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-surface-sunken" />
      {share > 0 && (
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          strokeWidth="4"
          strokeLinecap={share < 1 ? 'round' : 'butt'}
          strokeDasharray={`${share * circumference} ${circumference}`}
          transform="rotate(-90 18 18)"
          className="stroke-progress-good"
        />
      )}
    </svg>
  )
}

/** The whole walkthrough: Good, then in-house, then tickets, on an 8px track. */
export function ProgressBar({
  good,
  inhouse,
  tickets,
  total,
  label,
}: {
  good: number
  inhouse: number
  tickets: number
  total: number
  /** What a screen reader hears, as "20 of 50 checks done". */
  label: string
}) {
  const width = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`
  return (
    <div role="img" aria-label={label} className="flex h-2 overflow-hidden rounded-[4px] bg-surface-sunken">
      <span className="h-full bg-progress-good" style={{ width: width(good) }} />
      <span className="h-full bg-progress-inhouse" style={{ width: width(inhouse) }} />
      <span className="h-full bg-progress-ticket" style={{ width: width(tickets) }} />
    </div>
  )
}

const FLAG = {
  ticket: 'bg-status-open-bg text-status-open-text',
  inhouse: 'bg-status-waiting-bg text-status-waiting-text',
  good: 'bg-status-fixed-bg text-status-fixed-text',
  missed: 'bg-status-closed-bg text-status-closed-text',
}

/** "2 tickets", "1 in-house", "All good", "Not done": 11px bold on a status tint. */
export function FlagChip({ tone, children }: { tone: keyof typeof FLAG; children: ReactNode }) {
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-pill px-[7px] py-[2px] text-11 font-bold ${FLAG[tone]}`}
    >
      {children}
    </span>
  )
}

/** The flag chips for a count of tickets and in-house fixes; none for zero. */
export function FlagChips({ tickets, fixes }: { tickets: number; fixes: number }) {
  return (
    <>
      {tickets > 0 && <FlagChip tone="ticket">{tickets === 1 ? '1 ticket' : `${tickets} tickets`}</FlagChip>}
      {fixes > 0 && <FlagChip tone="inhouse">{fixes} in-house</FlagChip>}
    </>
  )
}

/** A section of the walkthrough: ring, name, "16 of 24" and its flags, and the way in. */
export function WalkthroughSectionRow({
  to,
  name,
  done,
  total,
  tickets,
  fixes,
}: {
  /** Nothing to open (View as) leaves the row still. */
  to?: string
  name: string
  done: number
  total: number
  tickets: number
  fixes: number
}) {
  const body = (
    <>
      <ProgressRing done={done} total={total} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-15 font-semibold text-text">{name}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-12 text-text-muted">
          {done} of {total}
          <FlagChips tickets={tickets} fixes={fixes} />
        </span>
      </div>
      {to && <IconChevronRight size={16} className="flex-none text-text-muted" />}
    </>
  )
  const row = 'flex min-h-16 items-center gap-3 border-b border-border px-3.5 py-2.5 text-text'
  return to ? (
    <Link
      to={to}
      className={`${row} transition-colors hover:bg-surface-hover hover:text-text active:bg-surface-muted active:duration-0`}
    >
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  )
}

/** The walkthrough card while it loads: the header, the bar and three section rows. */
export function WalkthroughCardSkeleton() {
  return (
    <div className="flex-none overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5">
        <div className="flex justify-between">
          <Sk w={64} h={13} />
          <Sk w={92} h={12} />
        </div>
        <Sk w="70%" h={17} />
        <Sk h={8} r={4} />
        <Sk w={80} h={12} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
          <Sk w={40} h={40} r={20} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Sk w="45%" h={15} />
            <Sk w="25%" h={12} />
          </div>
        </div>
      ))}
    </div>
  )
}
