import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { Input, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { CloseBar, Screen, ScreenBody, ScreenFooter, SectionLabel } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { useToast } from '../../components/Toast'
import { IconStar } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { TradePicker } from '../trades/TradePicker'
import { useTrades } from '../trades/useTrades'
import { EMAIL, monthEnd, monthOf, NAME_TAKEN, saveProblem } from './contractor'
import {
  useContractor,
  useDeleteContractor,
  useSaveContractor,
  useSetContractorArchived,
  type ContractorRow,
} from './useContractor'

/**
 * Add contractor and Edit contractor (design/screens/Ops-Add-Contractor,
 * Ops-Edit-Contractor), for Ops with Log cost, who change contractors. Trades are chips
 * you tap on and off, since a contractor can have several (OT-99), where the boards draw
 * one dropdown; a turned-off trade shows only on a contractor who has it. Contact name
 * and phone are required, as the boards draw them; email, insurance and notes are not.
 * Insurance is a month, kept as its last day, which the directory warns about 30 days
 * before. The import banner waits for Phase 7. Add opens on a trade a directory search
 * named (?trade=). Edit's "Remove contractor" opens a sheet like the equipment one:
 * Archive, which keeps their visits, or Delete only while no visit names them; an
 * archived contractor gets Restore instead. Saving opens the contractor.
 */
export function AddContractorScreen() {
  return <Form />
}

export function EditContractorScreen() {
  const { id = '' } = useParams()
  const { data, isPending, isError } = useContractor(id, false)
  if (isPending || isError)
    return (
      <Screen>
        <CloseBar to={`/ops/contractors/${id}`} title="Edit contractor" />
        <div className="flex flex-1 items-center justify-center">
          {isError ? (
            <span className="text-14 text-text-secondary">We couldn&apos;t load this contractor.</span>
          ) : (
            <Spinner />
          )}
        </div>
      </Screen>
    )
  if (!data) return <NotFoundScreen />
  return <Form editing={data.contractor} inUse={data.inUse} />
}

function Form({ editing, inUse = true }: { editing?: ContractorRow; inUse?: boolean }) {
  const { viewingAs } = useUser()
  const canEdit = useRight('log_cost')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const trades = useTrades()
  const save = useSaveContractor()
  const closeTo = editing ? `/ops/contractors/${editing.id}` : '/ops/contractors'
  const startTrade = params.get('trade')

  const [values, setValues] = useState({
    name: editing?.name ?? '',
    contactName: editing?.contact_name ?? '',
    phone: editing?.phone ?? '',
    email: editing?.email ?? '',
    insurance: monthOf(editing?.insurance_until ?? null),
    notes: editing?.notes ?? '',
  })
  const [preferred, setPreferred] = useState(editing?.preferred ?? false)
  // Untouched on Add, it is the trade the screen opened on, once the list has loaded.
  const [picked, setPicked] = useState<string[] | null>(editing ? editing.trades.map((t) => t.id) : null)
  const tradeIds = picked ?? (trades.data ?? []).filter((t) => t.name === startTrade).map((t) => t.id)
  const [tried, setTried] = useState(false)
  const [managing, setManaging] = useState(false)
  const banner = useRef<HTMLDivElement>(null)
  const code = (save.error as { code?: string } | null)?.code

  useEffect(() => {
    if (save.isError && code !== '23505') banner.current?.scrollIntoView({ block: 'center' })
  }, [save.isError, code])

  if (canEdit === false || viewingAs) return <NotFoundScreen />

  const set = (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    save.reset()
    setValues((v) => ({ ...v, [key]: e.target.value }))
  }
  const errors = {
    name: !values.name.trim() ? 'Enter the company name.' : undefined,
    trades: tradeIds.length === 0 ? 'Pick at least one trade.' : undefined,
    contactName: !values.contactName.trim() ? 'Enter who you talk to there.' : undefined,
    phone: !values.phone.trim() ? 'Enter a phone number.' : undefined,
    email: values.email.trim() && !EMAIL.test(values.email.trim()) ? 'That doesn’t look like an email.' : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const show = (e: string | undefined) => (tried ? e : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (invalid || save.isPending) return
    save.mutate(
      {
        id: editing?.id ?? null,
        values: { ...values, tradeIds, preferred, insuranceUntil: monthEnd(values.insurance) },
      },
      {
        onSuccess: (id) => {
          toast.show(editing ? 'Changes saved.' : `${values.name.trim()} added.`)
          navigate(`/ops/contractors/${id}`, { replace: true })
        },
      },
    )
  }

  return (
    <Screen>
      <CloseBar
        to={closeTo}
        title={editing ? 'Edit contractor' : 'Add contractor'}
        subtitle={editing ? editing.name : 'Available to pick when you log service'}
        bordered={false}
      />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="gap-4 pb-4 pt-3">
          {save.isError && code !== '23505' && (
            <div ref={banner} className="flex-none">
              <ErrorBanner title="Couldn't save yet.">
                {saveProblem(code)} Everything you entered is still here.
              </ErrorBanner>
            </div>
          )}
          <Input
            label="Company name"
            maxLength={120}
            autoComplete="organization"
            value={values.name}
            onChange={set('name')}
            error={code === '23505' ? NAME_TAKEN : show(errors.name)}
          />
          <div className="flex flex-none flex-col gap-1.5">
            <TradePicker
              trades={trades.data ?? []}
              value={tradeIds}
              onChange={(ids) => {
                save.reset()
                setPicked(ids)
              }}
            />
            {show(errors.trades) && (
              <span role="alert" className="text-13 font-semibold text-danger">
                {errors.trades}
              </span>
            )}
          </div>

          <SectionLabel className="-mb-2">Contact</SectionLabel>
          <Input
            label="Contact name"
            maxLength={120}
            autoComplete="name"
            value={values.contactName}
            onChange={set('contactName')}
            error={show(errors.contactName)}
          />
          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            autoComplete="tel"
            value={values.phone}
            onChange={set('phone')}
            hint="Used for the call button in the directory and on tickets."
            error={show(errors.phone)}
          />
          <Input
            label="Email"
            optional
            type="email"
            maxLength={254}
            autoComplete="email"
            placeholder="name@company.com"
            value={values.email}
            onChange={set('email')}
            error={show(errors.email)}
          />

          <SectionLabel className="-mb-2">Details</SectionLabel>
          <div className="flex flex-none items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-16 font-semibold text-text">
                <IconStar size={14} className="text-brand" />
                Preferred contractor
              </span>
              <span className="text-13 leading-snug text-text-secondary">
                Gets a star in the directory and shows first when you log service.
              </span>
            </div>
            <Switch checked={preferred} onCheckedChange={setPreferred} label="Preferred contractor" />
          </div>
          <Input
            label="Insurance expires"
            optional
            type="month"
            value={values.insurance}
            onChange={set('insurance')}
            hint="You'll see a warning in the directory 30 days before."
          />
          <Textarea
            label="Notes"
            optional
            rows={2}
            maxLength={2000}
            placeholder="Hours, after-hours number, account #"
            value={values.notes}
            onChange={set('notes')}
          />

          {editing && (
            <div className="mt-2 flex flex-none flex-col items-center gap-0.5 text-center">
              <Button
                type="button"
                variant={editing.archived_at ? 'ghost' : 'ghost-danger'}
                onClick={() => setManaging(true)}
              >
                {editing.archived_at ? 'Restore contractor' : 'Remove contractor'}
              </Button>
              {!editing.archived_at && (
                <span className="text-13 text-text-muted">Past visits and invoices stay on their tickets.</span>
              )}
            </div>
          )}
        </ScreenBody>
        <ScreenFooter>
          <Button type="submit" loading={save.isPending}>
            {editing ? 'Save changes' : 'Save contractor'}
          </Button>
        </ScreenFooter>
      </form>
      {editing && managing && (
        <ManageSheet
          contractor={editing}
          inUse={inUse}
          onClose={() => setManaging(false)}
          onArchived={() => navigate(`/ops/contractors/${editing.id}`, { replace: true })}
          onDeleted={() => navigate('/ops/contractors', { replace: true })}
        />
      )}
    </Screen>
  )
}

type Step = 'menu' | 'archive' | 'delete'

/** Archive, Restore or Delete, each with a confirm step that says what happens. */
function ManageSheet({
  contractor: c,
  inUse,
  onClose,
  onArchived,
  onDeleted,
}: {
  contractor: ContractorRow
  inUse: boolean
  onClose: () => void
  onArchived: () => void
  onDeleted: () => void
}) {
  const [step, setStep] = useState<Step>(c.archived_at ? 'menu' : 'archive')
  const archive = useSetContractorArchived()
  const remove = useDeleteContractor()
  const toast = useToast()
  const keepReason = inUse ? 'They have visits on record, so they can only be archived.' : null
  const error = archive.error ?? remove.error
  const taken = (archive.error as { code?: string } | null)?.code === '23505'

  const setArchived = (archived: boolean) =>
    archive.mutate(
      { id: c.id, archived },
      {
        onSuccess: () => {
          toast.show(archived ? `${c.name} archived.` : `${c.name} restored.`)
          onClose()
          onArchived()
        },
      },
    )

  const title = step === 'archive' ? `Archive ${c.name}?` : step === 'delete' ? `Delete ${c.name}?` : c.name
  const description =
    step === 'archive'
      ? 'They leave the directory and the Log service picker. Their visits and invoices stay, and you can restore them any time.'
      : step === 'delete'
        ? 'This removes them for good. No visit names them, so nothing else is lost.'
        : 'Archived. They are out of the directory and take no new visits.'

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={title} description={description}>
      {step === 'archive' ? (
        <>
          <Button variant="danger" loading={archive.isPending} onClick={() => setArchived(true)}>
            Archive contractor
          </Button>
          <Button variant="secondary-danger" disabled={keepReason !== null} onClick={() => setStep('delete')}>
            Delete instead
          </Button>
          {keepReason && <span className="-mt-1.5 text-13 text-text-secondary">{keepReason}</span>}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </>
      ) : step === 'delete' ? (
        <>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(c.id, {
                onSuccess: () => {
                  toast.show(`${c.name} deleted.`)
                  onDeleted()
                },
              })
            }
          >
            Delete contractor
          </Button>
          <Button variant="secondary" onClick={() => setStep(c.archived_at ? 'menu' : 'archive')}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button loading={archive.isPending} onClick={() => setArchived(false)}>
            Restore contractor
          </Button>
          <Button variant="secondary-danger" disabled={keepReason !== null} onClick={() => setStep('delete')}>
            Delete contractor
          </Button>
          {keepReason && <span className="-mt-1.5 text-13 text-text-secondary">{keepReason}</span>}
        </>
      )}
      {error && (
        <span role="alert" className="text-13 font-semibold text-danger">
          {taken
            ? 'Another contractor has this name now. Rename one of them first.'
            : 'That didn’t go through. Check your connection and try again.'}
        </span>
      )}
    </Sheet>
  )
}
