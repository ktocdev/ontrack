import { Link } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { ButtonLink } from '../../components/Button'
import { Card } from '../../components/Card'
import { IconPlus } from '../../components/icons'
import { money } from '../tickets/closed'
import { serviceDay } from './service'
import { useTicketService } from './useLogService'

/**
 * Service & cost on an Ops ticket (design/screens/Ops-Ticket): each visit, the contractor
 * or In-house with its amount, what was done and when, then "Ticket total so far". Only
 * with see_costs, which is what the database asks too. "+ Log service" needs log_cost and
 * is hidden under View as. A closed ticket has the same list under its Resolution (OT-98),
 * so each visit, and its invoice, still opens from there; its total is final.
 */
export function TicketService({ ticketId, closed = false }: { ticketId: string; closed?: boolean }) {
  const seeCosts = useRight('see_costs')
  const { data } = useTicketService(ticketId, !!seeCosts)
  if (!seeCosts) return null
  return (
    <section aria-label="Service & cost" className="flex flex-none flex-col gap-2">
      <div className="-mb-1 flex items-center justify-between gap-3 pt-1">
        <h2 className="eyebrow">Service &amp; cost</h2>
        <LogServiceLink to={`/ops/tickets/${ticketId}/service/new`} />
      </div>
      {data && (
        <Card className="overflow-hidden">
          {data.records.length === 0 ? (
            <p className="px-3.5 py-3 text-14 text-text-muted">No service logged yet.</p>
          ) : (
            data.records.map((r) => (
              <Link
                key={r.id}
                to={`/ops/service/${r.id}`}
                state={{ from: `/ops/tickets/${ticketId}` }}
                className="flex flex-col gap-1 border-t border-border px-3.5 py-3 text-text transition-colors first:border-t-0 hover:bg-surface-hover active:bg-surface-muted active:duration-0"
              >
                <div className="flex justify-between gap-3">
                  <span className="min-w-0 text-15 font-semibold [overflow-wrap:anywhere]">
                    {r.kind === 'in_house' ? 'In-house' : (r.contractor?.name ?? 'Contractor')}
                  </span>
                  <span className="flex-none text-15 font-bold">{money(r.totalCents)}</span>
                </div>
                <span className="text-12 text-text-muted [overflow-wrap:anywhere]">
                  {r.kind === 'in_house' ? 'In-house' : 'Contractor'} · {r.title} · {serviceDay(r.service_date, true)}
                </span>
              </Link>
            ))
          )}
          {data.records.length > 0 && (
            <div className="flex justify-between border-t border-border bg-surface-hover px-3.5 py-2.5 text-13">
              <span className="font-semibold text-text-secondary">
                {closed ? 'Ticket total' : 'Ticket total so far'}
              </span>
              <span className="font-bold">{money(data.totalCents)}</span>
            </div>
          )}
        </Card>
      )}
    </section>
  )
}

/** "+ Log service", for whoever may log costs and isn't viewing as someone else. */
export function LogServiceLink({ to, className = '' }: { to: string; className?: string }) {
  const { viewingAs } = useUser()
  const canLog = useRight('log_cost')
  if (!canLog || viewingAs) return null
  return (
    <Link
      to={to}
      className={`-mr-1 flex min-h-9 flex-none items-center px-1 text-14 font-semibold text-brand hover:text-brand-strong ${className}`}
    >
      + Log service
    </Link>
  )
}

/** The empty service log's button (design/screens/Empty-Ops-Service), with the same rule. */
export function LogServiceButton({ to }: { to: string }) {
  const { viewingAs } = useUser()
  const canLog = useRight('log_cost')
  if (!canLog || viewingAs) return null
  return (
    <ButtonLink to={to} variant="medium" className="w-full" icon={<IconPlus size={18} strokeWidth={2.2} />}>
      Log service
    </ButtonLink>
  )
}
