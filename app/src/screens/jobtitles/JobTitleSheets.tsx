import { useState, type FormEvent } from 'react'
import { AREAS, AREA_LABEL, AREA_SEGMENTS_SHORT, type Area } from '../../app/areas'
import { Button } from '../../components/Button'
import { Input } from '../../components/Field'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { DEFAULT_VIEW, ViewSettingFields } from '../../components/ViewSetting'
import {
  jobTitleError,
  useAddJobTitle,
  useDeleteJobTitle,
  useSaveJobTitle,
  useSetJobTitleActive,
  type ManagedJobTitle,
  type StartingView,
} from './useJobTitles'

function Failed({ error }: { error: unknown }) {
  return (
    <span role="alert" className="text-13 font-semibold text-danger">
      {jobTitleError(error)}
    </span>
  )
}

const EVERYTHING_ON = Object.fromEntries(AREAS.map((a) => [a, DEFAULT_VIEW])) as StartingView

/** The name, each area's starting view and Show first, shared by Add and Edit. */
function TitleFields({
  name,
  onName,
  view,
  onView,
  firstArea,
  onFirstArea,
  missing,
}: {
  name: string
  onName: (name: string) => void
  view: StartingView
  onView: (view: StartingView) => void
  firstArea: Area
  onFirstArea: (area: Area) => void
  missing: boolean
}) {
  return (
    <>
      <Input
        label="Name"
        maxLength={40}
        placeholder="e.g. Sous chef"
        value={name}
        onChange={(e) => onName(e.target.value)}
        error={missing ? 'Give it a name.' : undefined}
      />
      <div className="flex flex-col gap-1">
        <span className="text-13 font-semibold text-text-body">Starting view</span>
        <span className="text-12 leading-[1.45] text-text-secondary">
          Given once, when someone gets this title. They can change it on Profile.
        </span>
      </div>
      {AREAS.map((a) => (
        <div key={a} className="flex flex-col gap-1.5 rounded-input border border-border px-3.5 py-3">
          <span className="text-14 font-semibold">{AREA_LABEL[a]}</span>
          <ViewSettingFields
            label={AREA_LABEL[a]}
            value={view[a]}
            onChange={(next) => onView({ ...view, [a]: next })}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-13 font-semibold text-text-body">Show first</span>
        <span className="text-12 leading-[1.45] text-text-secondary">
          Which area’s tickets come first in each restaurant, after the urgent ones, until someone picks their own on
          Sort restaurants.
        </span>
        <Segmented label="Show first" value={firstArea} onChange={onFirstArea} options={AREA_SEGMENTS_SHORT} />
      </div>
    </>
  )
}

/** Add a job title (OT-117; no board draws it). It goes at the end of the list. */
export function AddJobTitleSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const add = useAddJobTitle()
  const toast = useToast()
  const [name, setName] = useState('')
  const [view, setView] = useState(EVERYTHING_ON)
  const [firstArea, setFirstArea] = useState<Area>('foh')
  const [missing, setMissing] = useState(false)

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setName('')
      setView(EVERYTHING_ON)
      setFirstArea('foh')
      setMissing(false)
      add.reset()
    }
    onOpenChange(isOpen)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setMissing(true)
    add.mutate(
      { name, view, firstArea },
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
      title="Add job title"
      description="Picked on Invite user and User profile. A title says who someone is; it grants nothing."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <TitleFields
          name={name}
          onName={(n) => {
            setName(n)
            setMissing(false)
            add.reset()
          }}
          view={view}
          onView={setView}
          firstArea={firstArea}
          onFirstArea={setFirstArea}
          missing={missing}
        />
        {add.isError && <Failed error={add.error} />}
        <Button type="submit" loading={add.isPending}>
          Add job title
        </Button>
        <Button type="button" variant="secondary" onClick={() => close(false)}>
          Cancel
        </Button>
      </form>
    </Sheet>
  )
}

type Step = 'menu' | 'edit' | 'off' | 'delete'

/**
 * What can be done to one title, opened from its row, as for a trade: a menu, then a step
 * that says exactly what happens. Delete is offered only for a title nobody has.
 */
export function JobTitleSheet({ title: t, onClose }: { title: ManagedJobTitle; onClose: () => void }) {
  const [step, setStep] = useState<Step>('menu')
  const [name, setName] = useState(t.name)
  const [view, setView] = useState(t.view)
  const [firstArea, setFirstArea] = useState(t.firstArea)
  const save = useSaveJobTitle()
  const setActive = useSetJobTitleActive()
  const remove = useDeleteJobTitle()
  const toast = useToast()

  const close = () => {
    setStep('menu')
    save.reset()
    setActive.reset()
    remove.reset()
    onClose()
  }
  const done = (message: string) => () => {
    toast.show(message)
    close()
  }
  const error = save.error ?? setActive.error ?? remove.error

  const content =
    step === 'edit' ? (
      <form
        noValidate
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          save.mutate({ id: t.id, name, view, firstArea }, { onSuccess: done(`${name.trim()} saved.`) })
        }}
      >
        <TitleFields
          name={name}
          onName={(n) => {
            setName(n)
            save.reset()
          }}
          view={view}
          onView={setView}
          firstArea={firstArea}
          onFirstArea={setFirstArea}
          missing={!name.trim()}
        />
        <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
          Save job title
        </Button>
        {/* Cancel leaves the sheet for Job titles, from feedback (OT-176). */}
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
      </form>
    ) : step === 'off' ? (
      <>
        <Button
          loading={setActive.isPending}
          onClick={() => setActive.mutate({ id: t.id, active: false }, { onSuccess: done(`${t.name} turned off.`) })}
        >
          Turn off job title
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
          Delete job title
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
            Turn on job title
          </Button>
        )}
        <Button variant="secondary" onClick={() => setStep('edit')}>
          Edit job title
        </Button>
        {t.active && (
          <Button variant="secondary" onClick={() => setStep('off')}>
            Turn off job title
          </Button>
        )}
        <Button variant="secondary-danger" disabled={t.inUse} onClick={() => setStep('delete')}>
          Delete job title
        </Button>
        {t.inUse && (
          <span className="-mt-1.5 text-13 text-text-secondary">
            Someone has this title or has been invited with it, so it can be turned off but not deleted.
          </span>
        )}
      </>
    )

  const title =
    step === 'edit'
      ? `Edit ${t.name}`
      : step === 'off'
        ? `Turn off ${t.name}?`
        : step === 'delete'
          ? `Delete ${t.name}?`
          : t.name
  const description =
    step === 'edit'
      ? 'A new name shows on everyone who has it. A new starting view is for people given it from now on; nobody’s settings change.'
      : step === 'off'
        ? 'It leaves the choices on Invite user and User profile. People who have it keep it, and you can turn it back on any time.'
        : step === 'delete'
          ? 'This removes it for good. Nobody has it, so nothing else is lost.'
          : t.active
            ? t.inUse
              ? 'Offered on Invite user and User profile.'
              : 'Offered on Invite user and User profile. Nobody has it yet.'
            : 'Turned off. It isn’t offered anywhere, and people who have it keep it.'

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title={title} description={description}>
      {content}
      {error && <Failed error={error} />}
    </Sheet>
  )
}
