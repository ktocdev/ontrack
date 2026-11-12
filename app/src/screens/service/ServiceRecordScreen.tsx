import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { RestaurantSquare } from '../../components/RestaurantName'
import { BackBar, Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronRight, IconDownload, IconExpand, IconReplace, IconWarning } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { money } from '../tickets/closed'
import { invoiceFileProblem, loggedWhen, serviceDay } from './service'
import { InvoiceInput } from './ServiceFields'
import { useReplaceInvoice, useServiceRecord, type ServiceRecordData } from './useServiceRecord'

/**
 * Ops · Service record (design/screens/Service-Record, and its missingInvoice state).
 * Opened from a ticket's Service & cost, a unit's service log, and later a contractor's
 * visits and the Invoices tab; Back returns where it came from. The date and what was
 * done, the description, the invoice (View, Download, Replace; or Missing with Attach),
 * the cost line by line, and the details: contractor, technician, ticket, equipment and
 * who logged it. A visit with no ticket leaves out the Ticket row, and in-house work
 * shows Done by and no invoice unless one was attached. Edit, Replace and Attach need
 * log_cost and are hidden under View as. There is no delete: a visit is a record.
 * The file's page count on the board isn't known without opening it, so the line gives
 * its number and size.
 */
export function ServiceRecordScreen() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { data, isPending, isError, refetch } = useServiceRecord(id)
  const from = (location.state as { from?: string } | null)?.from
  // Back goes where the record was opened from, if that is a screen of this app.
  const back =
    from && from.startsWith('/ops/')
      ? from
      : data?.record.equipment
        ? `/ops/equipment/${data.record.equipment.id}/service`
        : data?.record.ticket
          ? `/ops/tickets/${data.record.ticket.id}`
          : '/ops/equipment'

  if (isPending || isError)
    return (
      <Screen>
        <BackBar to={back} label="Back" roomy>
          <span className="font-display text-20 font-bold text-text">Service record</span>
        </BackBar>
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-screen text-center">
            <span className="text-14 text-text-secondary">We couldn&apos;t load this record.</span>
            <Button variant="small" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <ScreenBody className="pt-4">
            <DetailSkeleton keys={['Contractor', 'Technician', 'Ticket', 'Equipment', 'Logged by']} />
          </ScreenBody>
        )}
      </Screen>
    )
  if (!data) return <NotFoundScreen />
  return <Record data={data} back={back} />
}

function Record({ data, back }: { data: ServiceRecordData; back: string }) {
  const { viewingAs } = useUser()
  const canLog = !!useRight('log_cost') && !viewingAs
  const { record: r, lines, invoice, totalCents } = data
  const here = `/ops/service/${r.id}`
  const backLabel = r.equipment ? `Back to ${r.equipment.name}` : r.ticket ? `Back to ${r.ticket.display_id}` : 'Back'
  const showInvoice = r.kind === 'contractor' || !!invoice

  return (
    <Screen>
      <BackBar
        to={back}
        label={backLabel}
        roomy
        action={
          canLog ? (
            <Link
              to={`${here}/edit`}
              state={{ from: back }}
              className="flex min-h-tap flex-none items-center px-2 text-16 font-semibold text-brand hover:text-brand-strong"
            >
              Edit
            </Link>
          ) : undefined
        }
      >
        <span className="flex flex-col gap-px">
          <span className="text-12 text-text-secondary">
            {r.equipment && `${r.equipment.name} · `}
            {r.restaurant && (
              <span className="inline-flex items-center gap-1.5 font-bold text-text-body">
                <RestaurantSquare color={r.restaurant.color} size={9} />
                {r.restaurant.name}
              </span>
            )}
          </span>
          <span className="font-display text-20 font-bold text-text">Service record</span>
        </span>
      </BackBar>

      <ScreenBody className="gap-3 pb-6 pt-2">
        <div className="flex flex-none flex-col gap-1">
          <span className="text-13 font-semibold text-text-secondary">{serviceDay(r.service_date)}</span>
          <h1 className="font-display text-24 font-bold leading-[1.2] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {r.title}
          </h1>
        </div>

        {r.notes && (
          <>
            <SectionLabel className="-mb-0.5">Description</SectionLabel>
            <p className="whitespace-pre-wrap text-15 leading-normal text-text-body [overflow-wrap:anywhere]">
              {r.notes}
            </p>
          </>
        )}

        {showInvoice && (
          <>
            <SectionLabel className="-mb-0.5">Invoice</SectionLabel>
            {invoice?.attached ? (
              <InvoiceCard id={r.id} invoice={invoice} canReplace={canLog} />
            ) : (
              <MissingInvoice id={r.id} canAttach={canLog} />
            )}
          </>
        )}

        <SectionLabel className="-mb-0.5">Cost</SectionLabel>
        <Rows>
          {lines.map((l) => (
            <Row key={l.id} label={`${KIND[l.kind] ?? l.kind}${l.description ? ` · ${l.description}` : ''}`}>
              <span className="font-mono font-medium">{money(l.amount_cents)}</span>
            </Row>
          ))}
          <Row label="Total" total>
            <span className="font-mono text-16 font-bold">{money(totalCents)}</span>
          </Row>
        </Rows>

        <SectionLabel className="-mb-0.5">Details</SectionLabel>
        <Rows>
          {r.kind === 'contractor' ? (
            <>
              <Row
                label="Contractor"
                to={r.contractor && !viewingAs ? `/ops/contractors/${r.contractor.id}` : undefined}
              >
                {r.contractor?.name ?? '—'}
              </Row>
              {r.technician && <Row label="Technician">{r.technician}</Row>}
            </>
          ) : (
            <Row label="Done by">{r.technician ?? 'In-house'}</Row>
          )}
          {r.ticket && (
            <Row label="Ticket" to={viewingAs ? undefined : `/ops/tickets/${r.ticket.id}`}>
              <span className="font-mono font-medium">{r.ticket.display_id}</span>
            </Row>
          )}
          {r.equipment && (
            <Row label="Equipment" to={viewingAs ? undefined : `/ops/equipment/${r.equipment.id}`}>
              {r.equipment.name}
            </Row>
          )}
          <Row label="Logged by">
            {[r.logger?.full_name, loggedWhen(new Date(r.created_at))].filter(Boolean).join(' · ')}
          </Row>
        </Rows>
      </ScreenBody>
    </Screen>
  )
}

const KIND: Record<string, string> = { labor: 'Labor', parts: 'Parts', trip: 'Trip fee' }

function Rows({ children }: { children: ReactNode }) {
  return <div className="flex-none overflow-hidden rounded-card border border-border bg-surface">{children}</div>
}

/** A label and its value, 48px, 10px 14px; a link has a hover and a chevron. */
function Row({ label, to, total, children }: { label: string; to?: string; total?: boolean; children: ReactNode }) {
  const body = (
    <>
      <span className={`flex-none text-13 ${total ? 'font-bold text-text' : 'text-text-muted'}`}>{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right text-14 font-semibold [overflow-wrap:anywhere]">
        {children}
        {to && <IconChevronRight size={16} className="flex-none text-text-muted" />}
      </span>
    </>
  )
  const cls = `flex min-h-12 items-center justify-between gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0 ${
    total ? 'bg-surface-hover' : ''
  }`
  return to ? (
    <Link
      to={to}
      className={`${cls} text-text transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** The file with its number and size and who attached it, then View, Download and Replace. */
function InvoiceCard({
  id,
  invoice,
  canReplace,
}: {
  id: string
  invoice: NonNullable<ServiceRecordData['invoice']>
  canReplace: boolean
}) {
  const replace = usePickInvoice(id, 'Invoice replaced.')
  const action =
    'flex min-h-[46px] flex-1 items-center justify-center gap-1.5 border-l border-border text-14 font-semibold text-brand first:border-l-0 transition-colors hover:bg-surface-hover active:bg-surface-muted active:duration-0'
  const attached = invoice.attachedAt
    ? new Date(invoice.attachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  return (
    <div className="flex-none overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center gap-3.5 p-3.5">
        <div
          aria-hidden="true"
          className="flex h-[98px] w-[76px] flex-none flex-col gap-[5px] rounded-tag border border-border bg-surface px-2 py-[9px] shadow-page"
        >
          <i className="block h-1 w-3/5 rounded-full bg-brand" />
          <i className="block h-1 rounded-full bg-border" />
          <i className="block h-1 w-4/5 rounded-full bg-border" />
          <i className="block h-1 rounded-full bg-border" />
          <i className="block h-1 w-[70%] rounded-full bg-border" />
          <i className="mt-auto block h-1 w-[45%] self-end rounded-full bg-border-muted" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-15 font-semibold [overflow-wrap:anywhere]">{invoice.name}</span>
          <span className="text-12 text-text-muted">
            {[
              invoice.number && (
                <>
                  Invoice <span className="font-mono">{invoice.number}</span>
                </>
              ),
              invoice.size !== null && size(invoice.size),
            ]
              .filter(Boolean)
              .map((part, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {part}
                </span>
              ))}
          </span>
          {(invoice.attachedBy || attached) && (
            <span className="text-12 text-text-muted">
              Attached{invoice.attachedBy && ` by ${invoice.attachedBy}`}
              {attached && ` · ${attached}`}
            </span>
          )}
        </div>
      </div>
      <div className="flex border-t border-border">
        {invoice.viewUrl && (
          <a href={invoice.viewUrl} target="_blank" rel="noreferrer" className={action}>
            <IconExpand />
            View
          </a>
        )}
        {invoice.downloadUrl && (
          <a href={invoice.downloadUrl} download={invoice.name ?? true} className={action}>
            <IconDownload size={18} />
            Download
          </a>
        )}
        {canReplace && (
          <button type="button" onClick={replace.open} disabled={replace.busy} className={action}>
            <IconReplace />
            {replace.busy ? 'Replacing…' : 'Replace'}
          </button>
        )}
      </div>
      {replace.input}
      {replace.error && (
        <span role="alert" className="block border-t border-border px-3.5 py-2.5 text-13 font-semibold text-danger">
          {replace.error}
        </span>
      )}
    </div>
  )
}

/** The board's missingInvoice state: a yellow card saying why, and Attach invoice. */
function MissingInvoice({ id, canAttach }: { id: string; canAttach: boolean }) {
  const attach = usePickInvoice(id, 'Invoice attached.')
  return (
    <div className="flex flex-none flex-col gap-2.5 rounded-card border border-reopened-banner-border bg-reopened-banner-bg p-3.5">
      <span className="flex items-center gap-2 text-14 font-bold text-status-waiting-text">
        <IconWarning size={18} />
        Missing invoice
      </span>
      <span className="text-13 leading-[1.45] text-reopened-banner-text">
        Attach the contractor&apos;s invoice so this cost can be checked later. PDF or a photo works.
      </span>
      {canAttach && (
        <Button variant="medium" loading={attach.busy} onClick={attach.open}>
          Attach invoice
        </Button>
      )}
      {attach.input}
      {attach.error && (
        <span role="alert" className="text-13 font-semibold text-danger">
          {attach.error}
        </span>
      )}
    </div>
  )
}

/** Opens the file picker and attaches what is picked, saying so or saying why not. */
function usePickInvoice(id: string, done: string) {
  const input = useRef<HTMLInputElement>(null)
  const replace = useReplaceInvoice(id)
  const toast = useToast()
  const [problem, setProblem] = useState<string | null>(null)
  return {
    open: () => input.current?.click(),
    busy: replace.isPending,
    error: problem ?? (replace.isError ? 'The invoice didn’t upload. Check your connection and try again.' : null),
    input: (
      <InvoiceInput
        label={done === 'Invoice replaced.' ? 'Replace invoice' : 'Attach invoice'}
        inputRef={input}
        onPick={(f) => {
          const p = invoiceFileProblem(f)
          setProblem(p)
          if (!p) replace.mutate(f, { onSuccess: () => toast.show(done) })
        }}
      />
    ),
  }
}
