import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { IconClose, IconFile, IconPaperclip } from '../../components/icons'
import { shortDay } from './service'
import {
  useAddContractor,
  useContractorChoices,
  useTrades,
  type DuplicateInvoice,
  type TicketChoice,
} from './useLogService'

/**
 * The parts Log service and Edit service record share: who did the work (in-house or a
 * contractor, with the picker, technician and invoice number), the three amounts and
 * their total, the ticket picker, the invoice file, "+ Add new contractor", and the
 * banner when a save doesn't go through.
 */

export type Kind = 'in_house' | 'contractor'
const NEW = '__new'

/** What went wrong with a save, in the banner at the top. */
export function SaveFailed({ error, verb }: { error: unknown; verb: string }) {
  const code = (error as { code?: string } | null)?.code
  const duplicate = (error as { duplicate?: DuplicateInvoice } | null)?.duplicate
  return (
    <ErrorBanner title="Couldn't save yet.">
      {duplicate
        ? 'Fix the invoice number below. '
        : code === '42501'
          ? `Your account can’t ${verb} at this restaurant. Ask your admin. `
          : code === '22023' || code === '23514'
            ? 'Check the contractor, the unit and the amounts, then try again. '
            : 'Check your connection and try again. '}
      Everything else you entered is still here.
    </ErrorBanner>
  )
}

export type WorkValues = {
  kind: Kind
  contractorId: string
  technician: string
  doneBy: string
  invoiceNumber: string
}

/**
 * In-house or Outside contractor, then the contractor, technician and invoice number, or
 * Done by. An invoice number the contractor already has is marked under the pair, with
 * the visit that has it, as Error-Save-Failed draws it.
 */
export function WorkFields({
  values,
  onChange,
  duplicate,
  current,
}: {
  values: WorkValues
  onChange: (next: Partial<WorkValues>) => void
  duplicate: DuplicateInvoice | null
  /** The contractor already on a visit being edited, shown even if archived since. */
  current?: { id: string; name: string } | null
}) {
  const contractors = useContractorChoices()
  const [adding, setAdding] = useState(false)
  const v = values
  // An archived contractor already on the visit stays shown, so an edit doesn't drop them.
  const listed = (contractors.data ?? []).some((c) => c.id === v.contractorId)
  return (
    <>
      <Segmented<Kind>
        label="Who did the work"
        value={v.kind}
        onChange={(kind) => onChange({ kind })}
        options={[
          { value: 'in_house', label: 'In-house' },
          { value: 'contractor', label: 'Outside contractor' },
        ]}
      />
      {v.kind === 'contractor' ? (
        <div className="flex flex-col gap-2.5">
          <Select
            label="Contractor company"
            value={v.contractorId}
            onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange({ contractorId: e.target.value }))}
          >
            {!v.contractorId && <option value="">Choose a contractor</option>}
            {current && current.id === v.contractorId && !listed && contractors.data && (
              <option value={current.id}>{current.name}</option>
            )}
            {(contractors.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW}>+ Add new contractor</option>
          </Select>
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Technician"
              maxLength={120}
              autoComplete="off"
              value={v.technician}
              onChange={(e) => onChange({ technician: e.target.value })}
            />
            <Input
              label="Invoice #"
              maxLength={60}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={v.invoiceNumber}
              aria-invalid={duplicate ? true : undefined}
              aria-describedby={duplicate ? 'duplicate-invoice' : undefined}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
            />
          </div>
          {duplicate && (
            <>
              <span id="duplicate-invoice" role="alert" className="-mt-1 text-13 font-semibold text-danger">
                {duplicate.number} is already logged
                {duplicate.ticket ? ` on ${duplicate.ticket}` : duplicate.unit ? ` for ${duplicate.unit}` : ''}
                {duplicate.date ? ` (${shortDay(duplicate.date)})` : ''}. Check the number on this visit&apos;s invoice.
              </span>
              <Link
                to="/profile/help"
                className="flex min-h-tap items-center self-start text-14 font-semibold text-brand"
              >
                Think this is wrong? Report a problem
              </Link>
            </>
          )}
        </div>
      ) : (
        <Input
          label="Done by"
          maxLength={120}
          autoComplete="off"
          value={v.doneBy}
          onChange={(e) => onChange({ doneBy: e.target.value })}
        />
      )}
      {adding && (
        <AddContractorSheet
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            onChange({ contractorId: id })
            setAdding(false)
          }}
        />
      )}
    </>
  )
}

export function TicketSelect({
  value,
  onChange,
  disabled,
  open,
  closed,
  hint,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  open: TicketChoice[]
  closed: TicketChoice[]
  hint?: ReactNode
}) {
  const label = (t: TicketChoice) => `${t.display_id} · ${t.title}`
  return (
    <Select
      label="Ticket"
      optional
      value={value}
      disabled={disabled}
      hint={hint}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">No ticket</option>
      {open.length > 0 && (
        <optgroup label="Open">
          {open.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      )}
      {closed.length > 0 && (
        <optgroup label="Closed">
          {closed.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  )
}

/** A hidden file input for an invoice: a PDF or a photo. */
export function InvoiceInput({
  label,
  inputRef,
  onPick,
}: {
  label: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (f: File) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,image/*"
      aria-label={label}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) onPick(f)
      }}
    />
  )
}

/** The board's Attach invoice link, then the file picked, with a way to take it off. */
export function InvoiceFile({
  file,
  onPick,
  onRemove,
}: {
  file: File | null
  onPick: (f: File) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  if (file)
    return (
      <div className="flex min-h-[52px] flex-none items-center gap-3 rounded-input border border-border bg-surface pl-3.5">
        <IconFile size={20} className="flex-none text-brand" />
        <span className="min-w-0 flex-1 truncate text-15 font-semibold">{file.name}</span>
        <button
          type="button"
          aria-label="Remove invoice"
          onClick={onRemove}
          className="flex h-11 w-11 flex-none items-center justify-center text-text-muted hover:text-text"
        >
          <IconClose size={20} />
        </button>
      </div>
    )
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-10 flex-none items-center gap-1.5 self-start text-14 font-semibold text-brand hover:text-brand-strong"
      >
        <IconPaperclip size={18} />
        Attach invoice
      </button>
      <InvoiceInput label="Attach invoice" inputRef={input} onPick={onPick} />
    </>
  )
}

/**
 * "+ Add new contractor": the name, trade and phone; the rest is filled in later. Log
 * service opens it from the picker, and the directory's Add until the full Add contractor
 * screen (OT-95), with the trade a search named.
 */
export function AddContractorSheet({
  onClose,
  onAdded,
  trade: startTrade = '',
}: {
  onClose: () => void
  onAdded: (id: string) => void
  trade?: string
}) {
  const trades = useTrades()
  const add = useAddContractor()
  const [name, setName] = useState('')
  const [trade, setTrade] = useState(startTrade)
  const [phone, setPhone] = useState('')
  const code = (add.error as { code?: string } | null)?.code
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add contractor"
      description="Available to pick when you log service. Add the rest from Contractors."
    >
      <Input
        label="Company name"
        maxLength={120}
        value={name}
        onChange={(e) => {
          add.reset()
          setName(e.target.value)
        }}
      />
      <Select label="Trade" value={trade} onChange={(e) => setTrade(e.target.value)}>
        <option value="">Choose a trade</option>
        {(trades.data ?? []).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Input
        label="Phone"
        optional
        type="tel"
        maxLength={40}
        autoComplete="off"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {add.isError && (
        <span role="alert" className="text-13 font-semibold text-danger">
          {code === '23505'
            ? 'A contractor by that name is already in the list.'
            : code === '42501'
              ? 'Only Ops or an admin can add a contractor.'
              : 'That didn’t go through. Check your connection and try again.'}
        </span>
      )}
      <Button
        loading={add.isPending}
        disabled={!name.trim() || !trade}
        onClick={() => add.mutate({ name, trade, phone }, { onSuccess: onAdded })}
      >
        Add contractor
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  )
}
