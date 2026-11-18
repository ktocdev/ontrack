import { useState, type FormEvent } from 'react'
import { AREA_SEGMENTS, type Area } from '../../app/areas'
import { useRoleNames } from '../../auth/group'
import { Button } from '../../components/Button'
import { Input, Select, Textarea } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { useAddOpsTask, useUnitsAt } from '../tickets/useInHouse'

/**
 * Add task from the Support Team (OT-131; no board draws it, so it follows the manager's
 * Add in-house task): the restaurant when more than one is in view, what to do, a note,
 * and an optional unit, which brings its category and area; without a unit, the area.
 * The restaurant's Reporters get one notification, by their My categories.
 */
export function OpsAddTaskSheet({
  open,
  onOpenChange,
  restaurants,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurants: { id: string; name: string }[]
  onAdded: (restaurantName: string) => void
}) {
  const roles = useRoleNames()
  const add = useAddOpsTask()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [area, setArea] = useState<Area>('foh')
  const [chosen, setChosen] = useState('')
  const [unitId, setUnitId] = useState('')
  const [missing, setMissing] = useState(false)
  const restaurantId = restaurants.length === 1 ? restaurants[0]!.id : chosen
  const units = useUnitsAt(restaurantId || null)

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('')
      setNote('')
      setArea('foh')
      setChosen('')
      setUnitId('')
      setMissing(false)
      add.reset()
    }
    onOpenChange(isOpen)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !restaurantId) {
      setMissing(true)
      return
    }
    const name = restaurants.find((r) => r.id === restaurantId)?.name ?? ''
    add.mutate(
      { restaurantId, title, note, equipmentId: unitId || null, area },
      {
        onSuccess: () => {
          close(false)
          onAdded(name)
        },
      },
    )
  }

  const byCategory = new Map<string, { id: string; name: string }[]>()
  for (const u of units.data ?? []) {
    const group = (u.category as unknown as { name: string } | null)?.name ?? 'Other'
    byCategory.set(group, [...(byCategory.get(group) ?? []), { id: u.id, name: u.name }])
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Add in-house task"
      description={`The restaurant’s ${roles.name('manager', 'managers')} get a notification and check it off when it’s done.`}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {restaurants.length > 1 && (
          <Select
            label="Restaurant"
            value={chosen}
            onChange={(e) => {
              setChosen(e.target.value)
              setUnitId('')
              setMissing(false)
            }}
            error={missing && !chosen ? 'Pick a restaurant.' : undefined}
          >
            <option value="">Choose…</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Task"
          maxLength={140}
          placeholder="e.g. Replace the bulb over table 4"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setMissing(false)
          }}
          error={missing && !title.trim() ? 'Say what needs doing.' : undefined}
        />
        <Textarea
          label="Note"
          optional
          maxLength={1000}
          placeholder="e.g. It’s the 2-pin kind, spares are in the office"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {restaurantId && (units.data?.length ?? 0) > 0 && (
          <Select label="Unit" optional value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">None</option>
            {[...byCategory].map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
        {unitId ? (
          <span className="text-13 text-text-secondary">The task takes the unit’s category and area.</span>
        ) : (
          <Segmented<Area> label="Area" value={area} onChange={setArea} options={AREA_SEGMENTS} />
        )}
        {add.isError && <ErrorBanner title="Couldn't add this task.">Check your connection and try again.</ErrorBanner>}
        <Button type="submit" loading={add.isPending}>
          Add task
        </Button>
        <Button type="button" variant="secondary" onClick={() => close(false)}>
          Cancel
        </Button>
      </form>
    </Sheet>
  )
}
