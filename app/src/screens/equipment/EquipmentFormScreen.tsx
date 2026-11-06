import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { PhotoThumb } from '../../components/Photo'
import { CloseBar, Screen, ScreenBody, ScreenFooter } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { Spinner } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconCamera, IconClose, IconFile, IconPaperclip } from '../../components/icons'
import { resizeToJpeg } from '../../lib/image'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import type { Area } from './equipment'
import {
  useCategories,
  useDeleteEquipment,
  useEquipmentToEdit,
  useSaveEquipment,
  useSetRetired,
  type EquipmentToEdit,
  type EquipmentValues,
  type FileChange,
} from './useEquipmentForm'

/**
 * Add equipment and Edit equipment (design/screens/Ops-Add-Equipment, Ops-Edit-Equipment),
 * for Ops and for a manager with Add / edit equipment, who has no board of their own and
 * gets the same form at their restaurant. Until QR labels (OT-74) there is no "A QR label
 * is created when you save", no serial barcode button, and the button reads Save
 * equipment and opens the new unit; the import banner waits for Phase 7. The manual is a
 * PDF; the data plate photo is shrunk to 1600 px like a ticket's. Edit keeps the unit's
 * restaurant while anything points to it, since the database refuses the move. Retire,
 * Restore and Delete are in a sheet from the link at the bottom, which no board draws
 * past the link itself, so it follows the restaurant sheet (OT-9): a menu, then a confirm
 * step that says what happens, and Delete disabled with the reason while the unit has
 * history.
 */
export function AddEquipmentScreen() {
  return <Form ops={false} />
}
export function OpsAddEquipmentScreen() {
  return <Form ops />
}
export function EditEquipmentScreen() {
  return <Edit ops={false} />
}
export function OpsEditEquipmentScreen() {
  return <Edit ops />
}

function Edit({ ops }: { ops: boolean }) {
  const { id = '' } = useParams()
  const { data, isPending, isError } = useEquipmentToEdit(id)
  if (isPending || isError)
    return (
      <Screen>
        <CloseBar to={`${ops ? '/ops' : ''}/equipment/${id}`} title="Edit equipment" />
        <div className="flex flex-1 items-center justify-center">
          {isError ? (
            <span className="text-14 text-text-secondary">We couldn&apos;t load this equipment.</span>
          ) : (
            <Spinner />
          )}
        </div>
      </Screen>
    )
  if (!data) return <NotFoundScreen />
  return <Form ops={ops} editing={data} />
}

const month = (date: string | null) => (date ? date.slice(0, 7) : '')

function Form({ ops, editing }: { ops: boolean; editing?: EquipmentToEdit }) {
  const { restaurants, viewingAs } = useUser()
  const scope = useRestaurantScope()
  const canEdit = useRight('edit_equipment')
  const navigate = useNavigate()
  const toast = useToast()
  const categories = useCategories()
  const save = useSaveEquipment()
  const base = ops ? '/ops/equipment' : '/equipment'
  const closeTo = editing ? `${base}/${editing.id}` : base

  const [restaurantId, setRestaurantId] = useState(
    editing?.restaurant_id ?? (restaurants.length === 1 ? restaurants[0]!.id : (scope.selected?.id ?? '')),
  )
  const [area, setArea] = useState<Area>(editing?.category?.area ?? 'boh')
  const [values, setValues] = useState({
    categoryId: editing?.category_id ?? '',
    name: editing?.name ?? '',
    brand: editing?.brand ?? '',
    model: editing?.model ?? '',
    serial: editing?.serial ?? '',
    location: editing?.location_note ?? '',
    installed: month(editing?.installed_on ?? null),
    warrantyThrough: month(editing?.warranty_until ?? null),
  })
  const [manual, setManual] = useState<FileChange>({ kind: 'keep' })
  const [plate, setPlate] = useState<FileChange & { url?: string }>({ kind: 'keep' })
  const [fileError, setFileError] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const banner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (save.isError) banner.current?.scrollIntoView({ block: 'center' })
  }, [save.isError])
  useEffect(() => () => void (plate.kind === 'set' && plate.url && URL.revokeObjectURL(plate.url)), [plate])

  if (canEdit === false || viewingAs) return <NotFoundScreen />

  const set = (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    save.reset()
    setValues((v) => ({ ...v, [key]: e.target.value }))
  }
  // A turned-off category isn't offered, except to a unit that already has it (OT-86).
  const inArea = (categories.data ?? []).filter((c) => c.area === area && (c.active || c.id === editing?.category_id))
  const pickArea = (a: Area) => {
    setArea(a)
    setValues((v) => ({ ...v, categoryId: '' }))
  }
  const ready = restaurantId && values.categoryId && values.name.trim() && !save.isPending

  const pickManual = (file: File) => {
    setFileError(null)
    if (file.type !== 'application/pdf') return setFileError('The manual has to be a PDF.')
    if (file.size > 50 * 1024 * 1024) return setFileError('That PDF is over 50 MB.')
    setManual({ kind: 'set', blob: file, name: file.name })
  }
  const pickPlate = async (file: File) => {
    setFileError(null)
    try {
      const blob = await resizeToJpeg(file, 1600)
      setPlate({ kind: 'set', blob, name: 'plate.jpg', url: URL.createObjectURL(blob) })
    } catch {
      setFileError("That photo couldn't be read. Try a JPG or PNG.")
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    const v: EquipmentValues = { restaurantId, ...values }
    save.mutate(
      { values: v, editing, manual, plate },
      {
        onSuccess: ({ id, filesFailed }) => {
          const what = editing ? 'Changes saved' : `${v.name.trim()} added`
          toast.show(filesFailed ? `${what}, but a file didn't upload. Try it again from Edit.` : `${what}.`)
          navigate(`${base}/${id}`, { replace: true })
        },
      },
    )
  }

  const manualName =
    manual.kind === 'set'
      ? manual.name
      : manual.kind === 'keep' && editing?.manual_path
        ? editing.manual_path.split('/').pop()
        : null
  const plateUrl =
    plate.kind === 'set' ? plate.url : plate.kind === 'keep' ? (editing?.plateUrl ?? undefined) : undefined
  const hasPlate = plate.kind === 'set' || (plate.kind === 'keep' && !!editing?.plate_photo_path)
  const movable = !editing || !editing.inUse
  const code = (save.error as { code?: string } | null)?.code

  return (
    <Screen>
      <CloseBar to={closeTo} title={editing ? 'Edit equipment' : 'Add equipment'} />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScreenBody className="gap-4 pb-4 pt-4">
          {save.isError && (
            <div ref={banner} className="flex-none">
              <ErrorBanner title="Couldn't save yet.">
                {code === '42501'
                  ? 'Your account can’t add or change equipment at this restaurant. Ask your admin. '
                  : code === '23514'
                    ? 'Check the name and the other fields, then try again. '
                    : 'Check your connection and try again. '}
                Everything you entered is still here.
              </ErrorBanner>
            </div>
          )}
          {restaurants.length > 1 && (
            <Select
              label="Restaurant"
              value={restaurantId}
              disabled={!movable}
              hint={movable ? undefined : 'It has tickets or service here, so it stays at this restaurant.'}
              onChange={(e) => {
                save.reset()
                setRestaurantId(e.target.value)
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
          <Segmented<Area>
            label="Area"
            value={area}
            onChange={pickArea}
            options={[
              { value: 'foh', label: 'Front of House' },
              { value: 'boh', label: 'Back of House' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={values.categoryId} onChange={set('categoryId')}>
              <option value="">Choose</option>
              {inArea.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Location" optional maxLength={200} value={values.location} onChange={set('location')} />
          </div>
          <Input label="Name" maxLength={120} value={values.name} onChange={set('name')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Brand" maxLength={120} value={values.brand} onChange={set('brand')} />
            <Input label="Model" maxLength={120} value={values.model} onChange={set('model')} />
          </div>
          <Input
            label="Serial number"
            maxLength={120}
            autoCapitalize="characters"
            spellCheck={false}
            value={values.serial}
            onChange={set('serial')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Installed" type="month" value={values.installed} onChange={set('installed')} />
            <Input
              label="Warranty through"
              optional
              type="month"
              value={values.warrantyThrough}
              onChange={set('warrantyThrough')}
            />
          </div>

          <div className="flex flex-none flex-col gap-1.5">
            <span className="text-13 font-semibold text-text-body">
              Manual &amp; photo <span className="font-normal text-text-muted">(optional)</span>
            </span>
            {manualName && (
              <div className="flex min-h-[52px] items-center gap-3 rounded-input border border-border bg-surface pl-3.5">
                <IconFile size={20} className="flex-none text-brand" />
                <span className="min-w-0 flex-1 truncate text-15 font-semibold">{manualName}</span>
                <button
                  type="button"
                  aria-label="Remove manual"
                  onClick={() => setManual(editing?.manual_path ? { kind: 'remove' } : { kind: 'keep' })}
                  className="flex h-11 w-11 flex-none items-center justify-center text-text-muted hover:text-text"
                >
                  <IconClose size={20} />
                </button>
              </div>
            )}
            {hasPlate && (
              <div className="flex items-center gap-3">
                <PhotoThumb src={plateUrl} alt="Data plate photo" size="ticket" />
                <Button
                  type="button"
                  variant="ghost-danger"
                  onClick={() => setPlate(editing?.plate_photo_path ? { kind: 'remove' } : { kind: 'keep' })}
                >
                  Remove photo
                </Button>
              </div>
            )}
            <div className={`grid gap-3 ${!manualName && !hasPlate ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {!manualName && (
                <FileButton
                  label="Manual PDF"
                  accept="application/pdf"
                  icon={<IconPaperclip size={18} />}
                  onFile={pickManual}
                />
              )}
              {!hasPlate && (
                <FileButton
                  label="Data plate photo"
                  accept="image/*"
                  icon={<IconCamera size={18} />}
                  onFile={(f) => void pickPlate(f)}
                />
              )}
            </div>
            {fileError && (
              <span role="alert" className="text-13 font-semibold text-danger">
                {fileError}
              </span>
            )}
          </div>

          {editing && (
            <Button
              type="button"
              variant={editing.retired_at ? 'ghost' : 'ghost-danger'}
              className="self-center"
              onClick={() => setManaging(true)}
            >
              {editing.retired_at ? 'Restore this equipment' : 'Retire this equipment'}
            </Button>
          )}
        </ScreenBody>
        <ScreenFooter>
          <Button type="submit" loading={save.isPending} disabled={!ready}>
            {editing ? 'Save changes' : 'Save equipment'}
          </Button>
        </ScreenFooter>
      </form>
      {editing && managing && (
        <ManageSheet
          unit={editing}
          onClose={() => setManaging(false)}
          onDeleted={() => navigate(base, { replace: true })}
        />
      )}
    </Screen>
  )
}

/** The board's dashed button, opening the file picker (the camera for a photo on a phone). */
function FileButton({
  label,
  accept,
  icon,
  onFile,
}: {
  label: string
  accept: string
  icon: ReactNode
  onFile: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-input border border-dashed border-border-muted px-3 text-15 font-semibold text-brand transition-colors hover:text-brand-strong active:bg-surface-muted active:duration-0"
      >
        {icon}
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={label}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </>
  )
}

type Step = 'menu' | 'retire' | 'delete'

/** Retire, Restore or Delete, each with a confirm step that says what happens. */
function ManageSheet({
  unit,
  onClose,
  onDeleted,
}: {
  unit: EquipmentToEdit
  onClose: () => void
  onDeleted: () => void
}) {
  const [step, setStep] = useState<Step>(unit.retired_at ? 'menu' : 'retire')
  const retire = useSetRetired()
  const remove = useDeleteEquipment()
  const toast = useToast()
  const failed = retire.isError || remove.isError
  const setRetired = (retired: boolean) =>
    retire.mutate(
      { id: unit.id, retired },
      {
        onSuccess: () => {
          toast.show(retired ? `${unit.name} retired.` : `${unit.name} restored.`)
          onClose()
        },
      },
    )
  const keepReason = unit.inUse ? 'It has tickets or service records, so it can only be retired.' : null

  const title = step === 'retire' ? `Retire ${unit.name}?` : step === 'delete' ? `Delete ${unit.name}?` : unit.name
  const description =
    step === 'retire'
      ? 'It leaves the equipment lists and can’t be picked for a new ticket. Its tickets and service history stay, and you can restore it any time.'
      : step === 'delete'
        ? 'This removes it for good, with its manual and photo. Nothing points to it, so nothing else is lost.'
        : 'Retired. It is off the lists and takes no new tickets.'

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={title} description={description}>
      {step === 'retire' ? (
        <>
          <Button variant="danger" loading={retire.isPending} onClick={() => setRetired(true)}>
            Retire equipment
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
              remove.mutate(unit, {
                onSuccess: () => {
                  toast.show(`${unit.name} deleted.`)
                  onDeleted()
                },
              })
            }
          >
            Delete equipment
          </Button>
          <Button variant="secondary" onClick={() => setStep(unit.retired_at ? 'menu' : 'retire')}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button loading={retire.isPending} onClick={() => setRetired(false)}>
            Restore equipment
          </Button>
          <Button variant="secondary-danger" disabled={keepReason !== null} onClick={() => setStep('delete')}>
            Delete equipment
          </Button>
          {keepReason && <span className="-mt-1.5 text-13 text-text-secondary">{keepReason}</span>}
        </>
      )}
      {failed && (
        <span role="alert" className="text-13 font-semibold text-danger">
          That didn&apos;t go through. Check your connection and try again.
        </span>
      )}
    </Sheet>
  )
}
