import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { CostCard } from '../../components/Cost'
import { Input, Select, Textarea } from '../../components/Field'
import { CloseBar, Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { invoiceFileProblem, saveLabel, todayISO } from './service'
import { InvoiceFile, SaveFailed, TicketSelect, WorkFields, type WorkValues } from './ServiceFields'
import { useAmounts } from './useAmounts'
import {
  DuplicateInvoiceError,
  useLogService,
  useLogServiceOrigin,
  useTicketChoices,
  useUnitChoices,
  type LogServiceOrigin,
  type Origin,
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
 * From a contractor, Close and Save go back to the contractor's page.
 * While saving the form fades and the button spins and says where it is saving, as
 * Loading-Save draws it; when the database says no, everything typed stays and the
 * banner says why, and an invoice number the contractor already has is marked under its
 * field, as Error-Save-Failed draws it.
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
  return `/ops/contractors/${origin.id}`
}

function Load({ origin }: { origin: Origin }) {
  const { viewingAs } = useUser()
  const canLog = useRight('log_cost')
  const { data, isPending, isError } = useLogServiceOrigin(origin)
  if (viewingAs || canLog === false) return <NotFoundScreen />
  if (isPending || isError || canLog === undefined)
    return <FormLoading to={closeTo(origin)} title="Log service" failed={isError} />
  // A retired unit or an archived contractor takes no new visits.
  if (
    !data ||
    (data.from === 'equipment' && data.unit.retired_at) ||
    (data.from === 'contractor' && data.contractor.archived_at)
  )
    return <NotFoundScreen />
  return <Form origin={origin} loaded={data} />
}

/** The form's frame while what it needs loads, or a line if it couldn't. */
export function FormLoading({ to, title, failed }: { to: string; title: string; failed: boolean }) {
  return (
    <Screen>
      <CloseBar to={to} title={title} bordered={false} />
      <div className="flex flex-1 items-center justify-center">
        {failed ? (
          <span className="text-14 text-text-secondary">We couldn&apos;t load this. Check your connection.</span>
        ) : (
          <Spinner />
        )}
      </div>
    </Screen>
  )
}

function Form({ origin, loaded }: { origin: Origin; loaded: LogServiceOrigin }) {
  const { user, restaurants } = useUser()
  const scope = useRestaurantScope()
  const navigate = useNavigate()
  const toast = useToast()
  const save = useLogService()
  const banner = useRef<HTMLDivElement>(null)
  const back = closeTo(origin)
  const touch = () => save.isError && save.reset()

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
  const [work, setWork] = useState<WorkValues>({
    kind: 'contractor',
    contractorId: loaded.from === 'contractor' ? loaded.contractor.id : '',
    technician: '',
    doneBy: user.full_name,
    invoiceNumber: '',
  })
  const [date, setDate] = useState(todayISO())
  const amounts = useAmounts(undefined, touch)
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const units = useUnitChoices(loaded.from === 'contractor' ? restaurantId || null : null)
  const ticketChoices = useTicketChoices(
    loaded.from === 'contractor' ? restaurantId || null : null,
    fixedUnit?.id ?? (unitId || null),
  )

  useEffect(() => {
    if (save.isError) banner.current?.scrollIntoView({ block: 'center' })
  }, [save.isError])

  const pickedTicket = [...(ticketChoices.data?.open ?? []), ...(ticketChoices.data?.closed ?? [])].find(
    (t) => t.id === ticketId,
  )
  const onTicket = !!fixedTicket || !!ticketId
  const onUnit = fixedTicket ? !!fixedTicket.equipment : !!fixedUnit || !!unitId
  const ready =
    !!restaurantId && !!date && amounts.ok && (work.kind === 'in_house' || !!work.contractorId) && !save.isPending

  const subtitle = fixedTicket
    ? `${fixedTicket.display_id} · ${fixedTicket.equipment?.name ?? fixedTicket.title}`
    : fixedUnit
      ? pickedTicket
        ? `${pickedTicket.display_id} · ${fixedUnit.name}`
        : fixedUnit.name
      : loaded.from === 'contractor'
        ? loaded.contractor.name
        : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    save.mutate(
      {
        values: {
          kind: work.kind,
          ticketId: fixedTicket?.id ?? (ticketId || null),
          restaurantId,
          equipmentId: fixedUnit?.id ?? (unitId || null),
          contractorId: work.contractorId || null,
          technician: work.kind === 'contractor' ? work.technician : work.doneBy,
          date,
          invoiceNumber: work.invoiceNumber,
          notes,
          laborCents: amounts.cents.labor,
          partsCents: amounts.cents.parts,
          tripCents: amounts.cents.trip,
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
                <SaveFailed error={save.error} verb="log service" />
              </div>
            )}

            {loaded.from === 'contractor' && (
              <>
                {restaurants.length > 1 && (
                  <Select
                    label="Restaurant"
                    value={restaurantId}
                    onChange={(e) => {
                      touch()
                      setRestaurantId(e.target.value)
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
                    touch()
                    setUnitId(e.target.value)
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
                onChange={(id) => {
                  touch()
                  setTicketId(id)
                }}
                disabled={!restaurantId}
                open={ticketChoices.data?.open ?? []}
                closed={ticketChoices.data?.closed ?? []}
              />
            )}

            <WorkFields
              values={work}
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
              label="Work notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(e) => {
                touch()
                setNotes(e.target.value)
              }}
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
    </Screen>
  )
}
