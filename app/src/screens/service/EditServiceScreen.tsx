import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { CostCard } from '../../components/Cost'
import { Input, Select, Textarea } from '../../components/Field'
import { CloseBar, Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { useToast } from '../../components/Toast'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { FormLoading } from './LogServiceScreen'
import { amountText } from './service'
import { SaveFailed, TicketSelect, WorkFields, type WorkValues } from './ServiceFields'
import { useAmounts } from './useAmounts'
import { DuplicateInvoiceError, useTicketChoices, useUnitChoices } from './useLogService'
import { useServiceRecord, useUpdateServiceRecord, type ServiceRecordData } from './useServiceRecord'

/**
 * Ops · Edit service record (design/screens/Ops-Edit-Service). What was done, who did
 * the work, the date, the amounts and the description, as the board draws them; under
 * them, which no board draws, the ticket, which can be added, changed or taken off (the
 * visit then takes that ticket's equipment), and the equipment when there is no ticket.
 * The board's "Delete this record" is left off: a visit is a record, so a mistake is
 * corrected here and the change is logged. The invoice file is replaced on the record
 * itself, not here. The restaurant stays as logged, and the ticket and equipment are
 * picked from that restaurant's; a visit logged at the wrong restaurant is moved by Ops
 * in the database until someone asks for a way in the app.
 */
export function EditServiceScreen() {
  const { id = '' } = useParams()
  const { viewingAs } = useUser()
  const canLog = useRight('log_cost')
  const { data, isPending, isError } = useServiceRecord(id)
  const to = `/ops/service/${id}`
  if (viewingAs || canLog === false) return <NotFoundScreen />
  if (isPending || isError || canLog === undefined)
    return <FormLoading to={to} title="Edit service record" failed={isError} />
  if (!data) return <NotFoundScreen />
  return <Form data={data} />
}

function Form({ data }: { data: ServiceRecordData }) {
  const r = data.record
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const save = useUpdateServiceRecord(r.id)
  const banner = useRef<HTMLDivElement>(null)
  const recordTo = `/ops/service/${r.id}`
  const from = (location.state as { from?: string } | null)?.from
  const touch = () => save.isError && save.reset()

  const [title, setTitle] = useState(r.title)
  const [work, setWork] = useState<WorkValues>({
    kind: r.kind,
    contractorId: r.contractor_id ?? '',
    technician: r.kind === 'contractor' ? (r.technician ?? '') : '',
    doneBy: r.kind === 'in_house' ? (r.technician ?? '') : '',
    invoiceNumber: data.invoice?.number ?? '',
  })
  const [date, setDate] = useState(r.service_date)
  const amounts = useAmounts(
    {
      labor: amountText(data.amounts.labor),
      parts: amountText(data.amounts.parts),
      trip: amountText(data.amounts.trip),
    },
    touch,
  )
  const [notes, setNotes] = useState(r.notes ?? '')
  const [ticketId, setTicketId] = useState(r.ticket_id ?? '')
  const [unitId, setUnitId] = useState(r.equipment_id ?? '')

  const tickets = useTicketChoices(r.restaurant_id, null)
  const units = useUnitChoices(ticketId ? null : r.restaurant_id)

  useEffect(() => {
    if (save.isError) banner.current?.scrollIntoView({ block: 'center' })
  }, [save.isError])

  // The visit's own ticket and unit stay offered, even past the list's newest or retired since.
  const open = tickets.data?.open ?? []
  const closed = tickets.data?.closed ?? []
  const listed = [...open, ...closed].some((t) => t.id === r.ticket_id)
  const ownTicket =
    r.ticket && !listed ? [{ id: r.ticket.id, display_id: r.ticket.display_id, title: r.ticket.title, status: '' }] : []
  const unitChoices = [
    ...(r.equipment && !(units.data ?? []).some((u) => u.id === r.equipment!.id)
      ? [{ id: r.equipment.id, name: r.equipment.name }]
      : []),
    ...(units.data ?? []),
  ]

  const ready = !!title.trim() && !!date && amounts.ok && (work.kind === 'in_house' || !!work.contractorId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready || save.isPending) return
    save.mutate(
      {
        title,
        kind: work.kind,
        ticketId: ticketId || null,
        restaurantId: r.restaurant_id,
        equipmentId: ticketId ? null : unitId || null,
        contractorId: work.contractorId || null,
        technician: work.kind === 'contractor' ? work.technician : work.doneBy,
        date,
        invoiceNumber: work.invoiceNumber,
        notes,
        laborCents: amounts.cents.labor,
        partsCents: amounts.cents.parts,
        tripCents: amounts.cents.trip,
      },
      {
        onSuccess: () => {
          toast.show('Changes saved.')
          navigate(recordTo, { replace: true, state: from ? { from } : undefined })
        },
      },
    )
  }

  const subtitle = [r.ticket?.display_id, r.equipment?.name].filter(Boolean).join(' · ') || undefined

  return (
    <Screen>
      <CloseBar to={recordTo} title="Edit service record" subtitle={subtitle} bordered={false} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="pb-4 pt-3">
          <fieldset
            disabled={save.isPending}
            className={`flex flex-col gap-3.5 transition-opacity ${save.isPending ? 'opacity-60' : ''}`}
          >
            {save.isError && (
              <div ref={banner} className="flex-none">
                <SaveFailed error={save.error} verb="change service" />
              </div>
            )}
            <Input
              label="What was done"
              maxLength={200}
              value={title}
              onChange={(e) => {
                touch()
                setTitle(e.target.value)
              }}
            />
            <WorkFields
              values={work}
              current={r.contractor}
              duplicate={save.error instanceof DuplicateInvoiceError ? save.error.duplicate : null}
              onChange={(next) => {
                touch()
                setWork((w) => ({ ...w, ...next }))
              }}
            />
            <Input
              label="Service date"
              type="date"
              value={date}
              onChange={(e) => {
                touch()
                setDate(e.target.value)
              }}
            />

            <SectionLabel className="-mb-0.5">Cost</SectionLabel>
            <CostCard rows={amounts.rows(work.kind)} total={amounts.total} />

            <Textarea
              label="Description"
              rows={3}
              maxLength={4000}
              value={notes}
              onChange={(e) => {
                touch()
                setNotes(e.target.value)
              }}
            />

            <SectionLabel className="-mb-0.5">Ticket &amp; equipment</SectionLabel>
            <TicketSelect
              value={ticketId}
              onChange={(id) => {
                touch()
                setTicketId(id)
              }}
              open={[...ownTicket, ...open]}
              closed={closed}
              hint={ticketId ? 'The visit is on this ticket’s equipment.' : undefined}
            />
            {!ticketId && (
              <Select
                label="Equipment"
                optional
                value={unitId}
                onChange={(e) => {
                  touch()
                  setUnitId(e.target.value)
                }}
              >
                <option value="">No particular unit</option>
                {unitChoices.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            )}
          </fieldset>
        </ScreenBody>
        <ScreenFooter>
          <Button type="submit" loading={save.isPending} disabled={!ready && !save.isPending}>
            {save.isPending ? 'Saving changes…' : 'Save changes'}
          </Button>
        </ScreenFooter>
      </form>
    </Screen>
  )
}
