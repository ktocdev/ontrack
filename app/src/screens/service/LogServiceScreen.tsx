import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { CostCard } from '../../components/Cost'
import { Input, Select, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { CloseBar, Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconClose, IconFile, IconPaperclip } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { money } from '../tickets/closed'
import { invoiceFileProblem, parseMoney, saveLabel, tidyMoney, todayISO } from './service'
import {
  DuplicateInvoiceError,
  useAddContractor,
  useContractorChoices,
  useLogService,
  useLogServiceOrigin,
  useTicketChoices,
  useTrades,
  useUnitChoices,
  type LogServiceOrigin,
  type Origin,
  type TicketChoice,
} from './useLogService'

/**
 * Ops · Log service & cost (design/screens/Ops-Log-Service, Loading-Save, Error-Save-
 * Failed). Opened from a ticket, as the board draws it, with the ticket and its unit
 * filled in; from a unit's service log, with a ticket optional and that unit's open
 * tickets offered first; and from a contractor, which no board draws, choosing the
 * restaurant, then a unit and a ticket, both optional (decided Nov 11, 2026). "Done by"
 * on in-house work and Technician on a contractor's visit are the same field, and Done
 * by starts with your name. The board asks for no title, so the database names the visit
 * after its ticket. "+ Add new contractor" opens a short sheet that adds one and picks it,
 * so nothing typed is lost; the full Add contractor screen is the directory's (OT-95).
 * While saving the form fades and the button spins and says where it is saving, as
 * Loading-Save draws it; a refusal keeps everything and says why, and an invoice number
 * the contractor already has is marked on its field, as Error-Save-Failed draws it.
 */
export function LogServiceFromTicketScreen() {
  const { id = '' } = useParams()
  return <Load origin={{ from: 'ticket', id }} />
}
export function LogServiceFromEquipmentScreen() {
  const { id = '' } = useParams()
  return <Load origin={{ from: 'equipment', id }} />
}
export function LogServiceFromContractorScreen() {
  const { id = '' } = useParams()
  return <Load origin={{ from: 'contractor', id }} />
}

function closeTo(origin: Origin) {
  if (origin.from === 'ticket') return `/ops/tickets/${origin.id}`
  if (origin.from === 'equipment') return `/ops/equipment/${origin.id}/service`
  // The contractor's own page arrives with OT-95.
  return '/ops/contractors'
}

function Load({ origin }: { origin: Origin }) {
  const { viewingAs } = useUser()
  const canLog = useRight('log_cost')
  const { data, isPending, isError } = useLogServiceOrigin(origin)
  if (viewingAs || canLog === false) return <NotFoundScreen />
  if (isPending || isError || canLog === undefined)
    return (
      <Screen>
        <CloseBar to={closeTo(origin)} title="Log service" bordered={false} />
        <div className="flex flex-1 items-center justify-center">
          {isError ? (
            <span className="text-14 text-text-secondary">We couldn&apos;t load this. Check your connection.</span>
          ) : (
            <Spinner />
          )}
        </div>
      </Screen>
    )
  // A retired unit or an archived contractor takes no new visits.
  if (
    !data ||
    (data.from === 'equipment' && data.unit.retired_at) ||
    (data.from === 'contractor' && data.contractor.archived_at)
  )
    return <NotFoundScreen />
  return <Form origin={origin} loaded={data} />
}

type Kind = 'in_house' | 'contractor'
const NEW = '__new'

function shortDay(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Form({ origin, loaded }: { origin: Origin; loaded: LogServiceOrigin }) {
  const { user, restaurants } = useUser()
  const scope = useRestaurantScope()
  const navigate = useNavigate()
  const toast = useToast()
  const contractors = useContractorChoices()
  const save = useLogService()
  const banner = useRef<HTMLDivElement>(null)
  const back = closeTo(origin)

  const fixedTicket = loaded.from === 'ticket' ? loaded.ticket : null
  const fixedUnit = loaded.from === 'equipment' ? loaded.unit : null
  const [restaurantId, setRestaurantId] = useState(
    fixedTicket?.restaurant_id ??
      fixedUnit?.restaurant_id ??
      scope.selected?.id ??
      (restaurants.length === 1 ? restaurants[0]!.id : ''),
  )
  const [unitId, setUnitId] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [kind, setKind] = useState<Kind>('contractor')
  const [contractorId, setContractorId] = useState(loaded.from === 'contractor' ? loaded.contractor.id : '')
  const [technician, setTechnician] = useState('')
  const [doneBy, setDoneBy] = useState(user.full_name)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [amounts, setAmounts] = useState({ labor: '', parts: '', trip: '' })
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const units = useUnitChoices(loaded.from === 'contractor' ? restaurantId || null : null)
  const ticketChoices = useTicketChoices(
    loaded.from === 'contractor' ? restaurantId || null : null,
    fixedUnit?.id ?? (unitId || null),
  )

  useEffect(() => {
    if (save.isError) banner.current?.scrollIntoView({ block: 'center' })
  }, [save.isError])

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      if (save.isError) save.reset()
      set(v)
    }

  const cents = {
    labor: parseMoney(amounts.labor),
    parts: parseMoney(amounts.parts),
    trip: parseMoney(amounts.trip),
  }
  const amountsOk = cents.labor !== null && cents.parts !== null && cents.trip !== null
  const total = amountsOk ? money(cents.labor! + cents.parts! + cents.trip!) : null

  const pickedTicket = [...(ticketChoices.data?.open ?? []), ...(ticketChoices.data?.closed ?? [])].find(
    (t) => t.id === ticketId,
  )
  const onTicket = !!fixedTicket || !!ticketId
  const onUnit = fixedTicket ? !!fixedTicket.equipment : !!fixedUnit || !!unitId
  const ready = !!restaurantId && !!date && amountsOk && (kind === 'in_house' || !!contractorId) && !save.isPending

  const subtitle = fixedTicket
    ? `${fixedTicket.display_id} · ${fixedTicket.equipment?.name ?? fixedTicket.title}`
    : fixedUnit
      ? pickedTicket
        ? `${pickedTicket.display_id} · ${fixedUnit.name}`
        : fixedUnit.name
      : loaded.from === 'contractor'
        ? loaded.contractor.name
        : undefined

  const duplicate = save.error instanceof DuplicateInvoiceError ? save.error.duplicate : null
  const code = (save.error as { code?: string } | null)?.code

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    save.mutate(
      {
        values: {
          kind,
          ticketId: fixedTicket?.id ?? (ticketId || null),
          restaurantId,
          equipmentId: fixedUnit?.id ?? (unitId || null),
          contractorId: contractorId || null,
          technician: kind === 'contractor' ? technician : doneBy,
          date,
          invoiceNumber,
          notes,
          laborCents: cents.labor!,
          partsCents: cents.parts!,
          tripCents: cents.trip!,
        },
        file,
      },
      {
        onSuccess: ({ fileFailed }) => {
          toast.show(
            fileFailed
              ? 'Service logged, but the invoice didn’t upload. It shows as missing until it’s attached.'
              : 'Service logged.',
          )
          navigate(back, { replace: true })
        },
      },
    )
  }

  const amountRow = (key: keyof typeof amounts, label: string) => ({
    label,
    value: amounts[key],
    invalid: cents[key] === null,
    onChange: edit((v: string) => setAmounts((a) => ({ ...a, [key]: v }))),
    onBlur: () => setAmounts((a) => ({ ...a, [key]: tidyMoney(a[key]) })),
  })

  const pickFile = (f: File) => {
    const problem = invoiceFileProblem(f)
    setFileError(problem)
    if (!problem) setFile(f)
  }

  return (
    <Screen>
      <CloseBar to={back} title="Log service" subtitle={subtitle} bordered={false} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="pb-4 pt-3">
          <fieldset
            disabled={save.isPending}
            className={`flex flex-col gap-3.5 transition-opacity ${save.isPending ? 'opacity-60' : ''}`}
          >
            {save.isError && (
              <div ref={banner} className="flex-none">
                <ErrorBanner title="Couldn't save yet.">
                  {duplicate
                    ? 'Fix the invoice number below. '
                    : code === '42501'
                      ? 'Your account can’t log service at this restaurant. Ask your admin. '
                      : code === '22023' || code === '23514'
                        ? 'Check the contractor, the unit and the amounts, then try again. '
                        : 'Check your connection and try again. '}
                  Everything else you entered is still here.
                </ErrorBanner>
              </div>
            )}

            {loaded.from === 'contractor' && (
              <>
                {restaurants.length > 1 && (
                  <Select
                    label="Restaurant"
                    value={restaurantId}
                    onChange={(e) => {
                      edit(setRestaurantId)(e.target.value)
                      setUnitId('')
                      setTicketId('')
                    }}
                  >
                    {!restaurantId && <option value="">Choose a restaurant</option>}
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Select
                  label="Equipment"
                  optional
                  value={unitId}
                  disabled={!restaurantId}
                  onChange={(e) => {
                    edit(setUnitId)(e.target.value)
                    setTicketId('')
                  }}
                >
                  <option value="">No particular unit</option>
                  {(units.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
            {loaded.from !== 'ticket' && (
              <TicketSelect
                value={ticketId}
                onChange={edit(setTicketId)}
                disabled={!restaurantId}
                open={ticketChoices.data?.open ?? []}
                closed={ticketChoices.data?.closed ?? []}
              />
            )}

            <Segmented<Kind>
              label="Who did the work"
              value={kind}
              onChange={edit(setKind)}
              options={[
                { value: 'in_house', label: 'In-house' },
                { value: 'contractor', label: 'Outside contractor' },
              ]}
            />

            {kind === 'contractor' ? (
              <div className="flex flex-col gap-2.5">
                <Select
                  label="Contractor company"
                  value={contractorId}
                  onChange={(e) => {
                    if (e.target.value === NEW) setAdding(true)
                    else edit(setContractorId)(e.target.value)
                  }}
                >
                  {!contractorId && <option value="">Choose a contractor</option>}
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
                    value={technician}
                    onChange={(e) => edit(setTechnician)(e.target.value)}
                  />
                  <Input
                    label="Invoice #"
                    maxLength={60}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={invoiceNumber}
                    aria-invalid={duplicate ? true : undefined}
                    aria-describedby={duplicate ? 'duplicate-invoice' : undefined}
                    onChange={(e) => edit(setInvoiceNumber)(e.target.value)}
                  />
                </div>
                {duplicate && (
                  // Under both fields, as Error-Save-Failed draws it.
                  <span id="duplicate-invoice" role="alert" className="-mt-1 text-13 font-semibold text-danger">
                    {duplicate.number} is already logged
                    {duplicate.ticket ? ` on ${duplicate.ticket}` : duplicate.unit ? ` for ${duplicate.unit}` : ''}
                    {duplicate.date ? ` (${shortDay(duplicate.date)})` : ''}. Check the number on this visit&apos;s
                    invoice.
                  </span>
                )}
                {duplicate && (
                  <Link
                    to="/profile/help"
                    className="flex min-h-tap items-center self-start text-14 font-semibold text-brand"
                  >
                    Think this is wrong? Report a problem
                  </Link>
                )}
              </div>
            ) : (
              <Input
                label="Done by"
                maxLength={120}
                autoComplete="off"
                value={doneBy}
                onChange={(e) => edit(setDoneBy)(e.target.value)}
              />
            )}

            <Input label="Service date" type="date" value={date} onChange={(e) => edit(setDate)(e.target.value)} />

            <SectionLabel className="-mb-0.5">Cost</SectionLabel>
            <CostCard
              rows={[
                amountRow('labor', 'Labor'),
                amountRow('parts', 'Parts'),
                amountRow('trip', 'Trip / call-out fee'),
              ]}
              total={total}
            />

            <Textarea
              label="Work notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(e) => edit(setNotes)(e.target.value)}
            />

            <InvoiceFile
              file={file}
              onPick={pickFile}
              onRemove={() => {
                setFile(null)
                setFileError(null)
              }}
            />
            {fileError && (
              <span role="alert" className="-mt-2 text-13 font-semibold text-danger">
                {fileError}
              </span>
            )}
          </fieldset>
        </ScreenBody>
        <ScreenFooter>
          <Button type="submit" loading={save.isPending} disabled={!ready && !save.isPending}>
            {saveLabel(onTicket, onUnit, save.isPending)}
          </Button>
        </ScreenFooter>
      </form>
      {adding && (
        <AddContractorSheet
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            edit(setContractorId)(id)
            setAdding(false)
          }}
        />
      )}
    </Screen>
  )
}

function TicketSelect({
  value,
  onChange,
  disabled,
  open,
  closed,
}: {
  value: string
  onChange: (id: string) => void
  disabled: boolean
  open: TicketChoice[]
  closed: TicketChoice[]
}) {
  const label = (t: TicketChoice) => `${t.display_id} · ${t.title}`
  return (
    <Select label="Ticket" optional value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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

/** The board's Attach invoice link, then the file picked, with a way to take it off. */
function InvoiceFile({
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
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        aria-label="Attach invoice"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onPick(f)
        }}
      />
    </>
  )
}

/** "+ Add new contractor": the name, trade and phone; the rest is filled in from the directory. */
function AddContractorSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const trades = useTrades()
  const add = useAddContractor()
  const [name, setName] = useState('')
  const [trade, setTrade] = useState('')
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
