import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import {
  categoryError,
  useAddCategory,
  useDeleteCategory,
  useRenameCategory,
  useSetCategoryActive,
  type Area,
  type ManagedCategory,
} from './useCategoryAdmin'

const AREAS = [
  { value: 'foh' as const, label: 'Front of House' },
  { value: 'boh' as const, label: 'Back of House' },
]

function Failed({ error }: { error: unknown }) {
  return (
    <span role="alert" className="text-13 font-semibold text-danger">
      {categoryError(error)}
    </span>
  )
}

/** Add a category to Front or Back of House (OT-86; no board draws it). */
export function AddCategorySheet({
  open,
  area: startArea,
  onOpenChange,
}: {
  open: boolean
  area: Area
  onOpenChange: (open: boolean) => void
}) {
  const add = useAddCategory()
  const toast = useToast()
  const [name, setName] = useState('')
  const [area, setArea] = useState<Area>(startArea)
  const [missing, setMissing] = useState(false)

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setName('')
      setMissing(false)
      add.reset()
    }
    onOpenChange(isOpen)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setMissing(true)
    add.mutate(
      { name, area },
      {
        onSuccess: () => {
          toast.show(`${name.trim()} added.`)
          close(false)
        },
      },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Add category"
      description="It shows up for every restaurant, in Create ticket and on the equipment form."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <Input
          label="Name"
          maxLength={60}
          placeholder="e.g. Patio"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setMissing(false)
            add.reset()
          }}
          error={missing ? 'Give it a name.' : undefined}
        />
        <Segmented<Area> label="Area" value={area} onChange={setArea} options={AREAS} />
        {add.isError && <Failed error={add.error} />}
        <Button type="submit" loading={add.isPending}>
          Add category
        </Button>
        <Button type="button" variant="secondary" onClick={() => close(false)}>
          Cancel
        </Button>
      </form>
    </Sheet>
  )
}

type Step = 'menu' | 'rename' | 'off' | 'delete'

/**
 * What can be done to one category, opened from its row, following the restaurant
 * sheet (OT-9): a menu, then a step that says exactly what happens. Delete is offered
 * only for a category nothing has used, and says why otherwise.
 */
export function CategorySheet({ category: c, onClose }: { category: ManagedCategory; onClose: () => void }) {
  const [step, setStep] = useState<Step>('menu')
  const [name, setName] = useState(c.name)
  const rename = useRenameCategory()
  const setActive = useSetCategoryActive()
  const remove = useDeleteCategory()
  const toast = useToast()

  const close = () => {
    setStep('menu')
    rename.reset()
    setActive.reset()
    remove.reset()
    onClose()
  }
  const done = (message: string) => () => {
    toast.show(message)
    close()
  }
  const error = rename.error ?? setActive.error ?? remove.error

  const content =
    step === 'rename' ? (
      <form
        noValidate
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          rename.mutate({ id: c.id, name }, { onSuccess: done(`Renamed to ${name.trim()}.`) })
        }}
      >
        <Input
          label="Name"
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            rename.reset()
          }}
          error={name.trim() ? undefined : 'Give it a name.'}
        />
        <Button type="submit" loading={rename.isPending} disabled={!name.trim() || name.trim() === c.name}>
          Save name
        </Button>
        <Button type="button" variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </form>
    ) : step === 'off' ? (
      <>
        <Button
          loading={setActive.isPending}
          onClick={() => setActive.mutate({ id: c.id, active: false }, { onSuccess: done(`${c.name} turned off.`) })}
        >
          Turn off category
        </Button>
        <Button variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </>
    ) : step === 'delete' ? (
      <>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => remove.mutate(c.id, { onSuccess: done(`${c.name} deleted.`) })}
        >
          Delete category
        </Button>
        <Button variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </>
    ) : (
      <>
        {!c.active && (
          <Button
            loading={setActive.isPending}
            onClick={() => setActive.mutate({ id: c.id, active: true }, { onSuccess: done(`${c.name} turned on.`) })}
          >
            Turn on category
          </Button>
        )}
        <Button variant="secondary" onClick={() => setStep('rename')}>
          Rename category
        </Button>
        {c.active && (
          <Button variant="secondary" onClick={() => setStep('off')}>
            Turn off category
          </Button>
        )}
        <Button variant="secondary-danger" disabled={c.inUse} onClick={() => setStep('delete')}>
          Delete category
        </Button>
        {c.inUse && (
          <span className="-mt-1.5 text-13 text-text-secondary">
            Tickets or equipment use it, so it can be turned off but not deleted.
          </span>
        )}
      </>
    )

  const area = c.area === 'foh' ? 'Front of House' : 'Back of House'
  const title =
    step === 'rename'
      ? `Rename ${c.name}`
      : step === 'off'
        ? `Turn off ${c.name}?`
        : step === 'delete'
          ? `Delete ${c.name}?`
          : c.name
  const description =
    step === 'rename'
      ? `The new name shows everywhere ${c.name} does, for every restaurant, old tickets included.`
      : step === 'off'
        ? 'It leaves Create ticket and the equipment form. Tickets and equipment that use it keep it, and you can turn it back on any time.'
        : step === 'delete'
          ? 'This removes it for good. Nothing has used it, so nothing else is lost.'
          : c.active
            ? area
            : `${area} · Turned off. It isn’t offered anywhere, and what already uses it keeps it.`

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title={title} description={description}>
      {content}
      {error && <Failed error={error} />}
    </Sheet>
  )
}
