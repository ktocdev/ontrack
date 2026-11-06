import { useState, type FormEvent } from 'react'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { useAddTask } from './useInHouse'

type Area = 'foh' | 'boh'

/**
 * Add an in-house task by hand (OT-83; no board draws it): what to fix, Front or Back,
 * and the restaurant for someone with more than one. It opens on Front of House, as
 * Create ticket does. A task is the restaurant's own, so nobody is notified.
 */
export function AddTaskSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, restaurants } = useUser()
  const add = useAddTask()
  const [title, setTitle] = useState('')
  const [area, setArea] = useState<Area>('foh')
  const [restaurantId, setRestaurantId] = useState('')
  const [missing, setMissing] = useState(false)

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('')
      setArea('foh')
      setRestaurantId('')
      setMissing(false)
      add.reset()
    }
    onOpenChange(isOpen)
  }
  const place = restaurants.length === 1 ? restaurants[0]!.id : restaurantId

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !place) {
      setMissing(true)
      return
    }
    add.mutate({ restaurantId: place, title, area, userId: user.id }, { onSuccess: () => close(false) })
  }

  return (
    <Sheet open={open} onOpenChange={close} title="Add in-house task">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <Input
          label="Task"
          maxLength={140}
          placeholder="e.g. Clean the grease under the prep table"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setMissing(false)
          }}
          error={missing && !title.trim() ? 'Say what needs doing.' : undefined}
        />
        {restaurants.length > 1 && (
          <Select
            label="Restaurant"
            value={restaurantId}
            onChange={(e) => {
              setRestaurantId(e.target.value)
              setMissing(false)
            }}
            error={missing && !restaurantId ? 'Pick a restaurant.' : undefined}
          >
            <option value="">Choose…</option>
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
          onChange={setArea}
          options={[
            { value: 'foh', label: 'Front of House' },
            { value: 'boh', label: 'Back of House' },
          ]}
        />
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
