import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import {
  tradeError,
  useAddTrade,
  useDeleteTrade,
  useRenameTrade,
  useSetTradeActive,
  type ManagedTrade,
} from './useTrades'

function Failed({ error }: { error: unknown }) {
  return (
    <span role="alert" className="text-13 font-semibold text-danger">
      {tradeError(error)}
    </span>
  )
}

/** Add a trade (OT-99; no board draws it). It goes just before Other. */
export function AddTradeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const add = useAddTrade()
  const toast = useToast()
  const [name, setName] = useState('')
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
    add.mutate(name, {
      onSuccess: () => {
        toast.show(`${name.trim()} added.`)
        close(false)
      },
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Add trade"
      description="It shows up when you add or edit a contractor, and as a chip in the directory once someone has it."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <Input
          label="Name"
          maxLength={60}
          placeholder="e.g. Pest control"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setMissing(false)
            add.reset()
          }}
          error={missing ? 'Give it a name.' : undefined}
        />
        {add.isError && <Failed error={add.error} />}
        <Button type="submit" loading={add.isPending}>
          Add trade
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
 * What can be done to one trade, opened from its row, as for a category: a menu, then a
 * step that says exactly what happens. Delete is offered only for a trade no contractor
 * has, and says why otherwise.
 */
export function TradeSheet({ trade: t, onClose }: { trade: ManagedTrade; onClose: () => void }) {
  const [step, setStep] = useState<Step>('menu')
  const [name, setName] = useState(t.name)
  const rename = useRenameTrade()
  const setActive = useSetTradeActive()
  const remove = useDeleteTrade()
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
          rename.mutate({ id: t.id, name }, { onSuccess: done(`Renamed to ${name.trim()}.`) })
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
        <Button type="submit" loading={rename.isPending} disabled={!name.trim() || name.trim() === t.name}>
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
          onClick={() => setActive.mutate({ id: t.id, active: false }, { onSuccess: done(`${t.name} turned off.`) })}
        >
          Turn off trade
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
          onClick={() => remove.mutate(t.id, { onSuccess: done(`${t.name} deleted.`) })}
        >
          Delete trade
        </Button>
        <Button variant="secondary" onClick={() => setStep('menu')}>
          Cancel
        </Button>
      </>
    ) : (
      <>
        {!t.active && (
          <Button
            loading={setActive.isPending}
            onClick={() => setActive.mutate({ id: t.id, active: true }, { onSuccess: done(`${t.name} turned on.`) })}
          >
            Turn on trade
          </Button>
        )}
        <Button variant="secondary" onClick={() => setStep('rename')}>
          Rename trade
        </Button>
        {t.active && (
          <Button variant="secondary" onClick={() => setStep('off')}>
            Turn off trade
          </Button>
        )}
        <Button variant="secondary-danger" disabled={t.inUse} onClick={() => setStep('delete')}>
          Delete trade
        </Button>
        {t.inUse && (
          <span className="-mt-1.5 text-13 text-text-secondary">
            A contractor has this trade, so it can be turned off but not deleted.
          </span>
        )}
      </>
    )

  const title =
    step === 'rename'
      ? `Rename ${t.name}`
      : step === 'off'
        ? `Turn off ${t.name}?`
        : step === 'delete'
          ? `Delete ${t.name}?`
          : t.name
  const description =
    step === 'rename'
      ? `The new name shows everywhere ${t.name} does, on every contractor who has it.`
      : step === 'off'
        ? 'It leaves the trade choices when you add or edit a contractor. Contractors who have it keep it, and you can turn it back on any time.'
        : step === 'delete'
          ? 'This removes it for good. No contractor has it, so nothing else is lost.'
          : t.active
            ? t.inUse
              ? 'Offered when you add or edit a contractor.'
              : 'Offered when you add or edit a contractor. No contractor has it yet.'
            : 'Turned off. It isn’t offered anywhere, and contractors who have it keep it.'

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title={title} description={description}>
      {content}
      {error && <Failed error={error} />}
    </Sheet>
  )
}
