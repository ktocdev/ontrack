import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { IconPhone, IconStar } from './icons'

/**
 * A contractor in the directory (design/screens/Ops-Contractors): white card, 14px
 * radius, 12px 14px padding. The name, 16px semibold on one line, with this year's spend
 * on the right; a tag for each trade (several wrap, OT-99), a Preferred star and an insurance warning; the contact;
 * the visits line. A 44px call button on the right when there is a phone. The card opens
 * the contractor when given `to`; under View as it is plain text.
 */
export function ContractorCard({
  name,
  trades,
  preferred,
  warning,
  contact,
  visits,
  spend,
  phone,
  to,
}: {
  name: string
  /** One or more, in the trade list's order. */
  trades: string[]
  preferred?: boolean
  /** "Insurance expires Nov 1", in the warning tag. */
  warning?: string | null
  contact?: string | null
  /** "11 visits · last Oct 19, 2026"; none without see_costs. */
  visits?: ReactNode
  /** "$4,812", or undefined without see_costs. */
  spend?: string
  phone?: string | null
  to?: string
}) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-16 font-semibold">{name}</span>
        {spend !== undefined && <span className="flex-none text-14 font-bold">{spend}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {trades.map((t) => (
          <span key={t} className="rounded-tag bg-surface-muted px-2 py-0.5 text-11 font-bold text-text-body">
            {t}
          </span>
        ))}
        {preferred && (
          <span className="inline-flex items-center gap-[3px] text-11 font-bold text-brand">
            <IconStar />
            Preferred
          </span>
        )}
        {warning && (
          <span className="rounded-tag bg-status-open-bg px-2 py-0.5 text-11 font-bold text-status-open-text">
            {warning}
          </span>
        )}
      </span>
      {contact && <span className="text-12 text-text-muted">{contact}</span>}
      {visits && <span className="text-12 text-text-muted">{visits}</span>}
    </>
  )
  const main = 'flex min-w-0 flex-1 flex-col gap-[5px] text-text'
  return (
    <article
      aria-label={name}
      className="flex flex-none items-start gap-3 rounded-card border border-border bg-surface px-3.5 py-3"
    >
      {to ? (
        <Link
          to={to}
          className={`${main} -m-1 rounded-control p-1 transition-colors active:bg-surface-hover active:duration-0`}
        >
          {body}
        </Link>
      ) : (
        <div className={main}>{body}</div>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          aria-label={`Call ${name}`}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-control bg-brand-tint-soft text-brand transition-colors active:bg-brand-tint active:duration-0"
        >
          <IconPhone size={20} />
        </a>
      )}
    </article>
  )
}
