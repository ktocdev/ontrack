import { useState } from 'react'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Input, Select } from '../../components/Field'
import { ErrorBanner } from '../../components/Notice'
import { RadioCard } from '../../components/RadioCard'
import { Sheet } from '../../components/Sheet'
import { checklistSize, letterOf, listNames } from './schedule'
import type { Checklist, Rotation } from './useSchedule'

/**
 * The schedule's sheets (OT-133; no board draws them, so they follow Close ticket's): a
 * month's checklist, the due day, the reminders, and a restaurant's own rotation. Each
 * saves the rotation whole through save_rotation, which checks set_walkthrough_schedule
 * and logs it. A walkthrough already open keeps the checklist it opened with.
 */

const KEPT = 'A walkthrough already open keeps the checklist it opened with.'

function SaveFailed({ error }: { error: unknown }) {
  const code = (error as { code?: string } | null)?.code
  return (
    <ErrorBanner title="Couldn't save that.">
      {code === '23505'
        ? 'Another rotation has that name. Try another.'
        : code === '42501'
          ? 'You can’t change the walkthrough schedule.'
          : 'Check your connection and try again.'}
    </ErrorBanner>
  )
}

/** Pick the checklist for one month of the cycle, or a new month's; remove one from a longer cycle. */
export function MonthSheet({
  open,
  onOpenChange,
  position,
  rotation,
  checklists,
  saving,
  error,
  onSave,
  onEditChecklist,
  onNewChecklist,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The month being edited, or null to add one at the end. */
  position: number | null
  rotation: Rotation
  checklists: Map<string, Checklist>
  saving: boolean
  error: unknown
  onSave: (months: string[]) => void
  /** Opens the checklist editor (OT-136) on this month's checklist. */
  onEditChecklist?: (id: string) => void
  /** Makes a new checklist from the one picked, to edit and then pick. */
  onNewChecklist?: (fromId: string) => void
}) {
  const adding = position === null
  const current = adding ? '' : (rotation.months[position] ?? '')
  const [picked, setPicked] = useState(current)
  // A checklist turned off goes on no new month; one already in this rotation may stay.
  const choices = [...checklists.values()].filter((c) => !c.replaced_by && (c.active || rotation.months.includes(c.id)))
  const letter = letterOf(adding ? rotation.months.length : position)

  const save = () => {
    if (!picked) return
    const months = [...rotation.months]
    if (adding) months.push(picked)
    else months[position] = picked
    onSave(months)
  }
  const remove = () => onSave(rotation.months.filter((_, i) => i !== position))

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setPicked(current)
        onOpenChange(o)
      }}
      title={adding ? `Add month ${letter}` : `Month ${letter}`}
      description={`Which checklist this month of the cycle uses. ${KEPT}`}
    >
      <Select label="Checklist" value={picked} onChange={(e) => setPicked(e.target.value)}>
        {adding && <option value="">Choose…</option>}
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {checklistSize(c.sections, c.items)}
          </option>
        ))}
      </Select>
      {(onEditChecklist || onNewChecklist) && picked && (
        <div className="-mt-1 flex flex-wrap gap-x-4">
          {onEditChecklist && picked === current && (
            <button
              type="button"
              onClick={() => onEditChecklist(picked)}
              className="min-h-tap text-14 font-semibold text-brand"
            >
              Edit this checklist
            </button>
          )}
          {onNewChecklist && (
            <button
              type="button"
              onClick={() => onNewChecklist(picked)}
              className="min-h-tap text-14 font-semibold text-brand"
            >
              Make a new checklist from this one
            </button>
          )}
        </div>
      )}
      {!!error && <SaveFailed error={error} />}
      <Button loading={saving} disabled={!picked} onClick={save}>
        {adding ? 'Add month' : 'Save'}
      </Button>
      {!adding && rotation.months.length > 1 && (
        <Button variant="secondary-danger" disabled={saving} onClick={remove}>
          Remove month {letter} from the cycle
        </Button>
      )}
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}

/** The due day: the last day of the month, or a day from 1 to 28. */
export function DueSheet({
  open,
  onOpenChange,
  rotation,
  saving,
  error,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rotation: Rotation
  saving: boolean
  error: unknown
  onSave: (dueDay: number | null) => void
}) {
  const [day, setDay] = useState(String(rotation.due_day ?? ''))
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setDay(String(rotation.due_day ?? ''))
        onOpenChange(o)
      }}
      title="Due date"
      description="When each month’s walkthrough is due. One submitted after it counts as late."
    >
      <Select label="Due" value={day} onChange={(e) => setDay(e.target.value)}>
        <option value="">Last day of the month</option>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            Day {d}
          </option>
        ))}
      </Select>
      {!!error && <SaveFailed error={error} />}
      <Button loading={saving} onClick={() => onSave(day ? Number(day) : null)}>
        Save
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}

const REMINDER_DAYS = [14, 10, 7, 5, 3, 2, 1, 0]
const MAX_REMINDERS = 4

/** The reminders: up to four days before the due day, picked as chips. */
export function RemindersSheet({
  open,
  onOpenChange,
  rotation,
  saving,
  error,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rotation: Rotation
  saving: boolean
  error: unknown
  onSave: (days: number[]) => void
}) {
  const [days, setDays] = useState<number[]>(rotation.reminder_days)
  const toggle = (d: number) =>
    setDays((now) => (now.includes(d) ? now.filter((x) => x !== d) : now.length < MAX_REMINDERS ? [...now, d] : now))
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setDays(rotation.reminder_days)
        onOpenChange(o)
      }}
      title="Reminders"
      description={`Days before the due date when the restaurant’s team gets a reminder by push and email, while the walkthrough is still open. Up to ${MAX_REMINDERS}.`}
    >
      <div role="group" aria-label="Remind this many days before" className="flex flex-wrap gap-2">
        {REMINDER_DAYS.map((d) => (
          <Chip
            key={d}
            tone="pick"
            selected={days.includes(d)}
            aria-pressed={days.includes(d)}
            disabled={!days.includes(d) && days.length >= MAX_REMINDERS}
            onClick={() => toggle(d)}
          >
            {d === 0 ? 'On the day' : d === 1 ? '1 day' : `${d} days`}
          </Chip>
        ))}
      </div>
      {!!error && <SaveFailed error={error} />}
      <Button loading={saving} onClick={() => onSave(days)}>
        Save
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}

/**
 * Give a restaurant its own schedule: a new rotation that starts as a copy of the group's,
 * or one that already exists, which several restaurants may share (decided Nov 12, 2026).
 */
export function OwnScheduleSheet({
  open,
  onOpenChange,
  restaurant,
  others,
  usedBy,
  saving,
  error,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurant: string
  /** Rotations other than the group's. */
  others: Rotation[]
  usedBy: (rotationId: string) => string[]
  saving: boolean
  error: unknown
  onPick: (choice: { rotationId: string } | { name: string }) => void
}) {
  const [choice, setChoice] = useState<string>('new')
  const [name, setName] = useState(restaurant)
  const [missing, setMissing] = useState(false)
  const go = () => {
    if (choice !== 'new') return onPick({ rotationId: choice })
    if (!name.trim()) return setMissing(true)
    onPick({ name: name.trim() })
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setChoice('new')
          setName(restaurant)
          setMissing(false)
        }
        onOpenChange(o)
      }}
      title={`Give ${restaurant} its own schedule`}
      description={`Changes to the group schedule won’t affect it. ${KEPT}`}
    >
      <div role="radiogroup" aria-label="Schedule" className="flex flex-col gap-2">
        <RadioCard
          checked={choice === 'new'}
          title="A new rotation"
          subtitle="Starts as a copy of the group’s, to change from there"
          onSelect={() => setChoice('new')}
        />
        {others.map((r) => (
          <RadioCard
            key={r.id}
            checked={choice === r.id}
            title={r.name}
            subtitle={`${r.months.length}-month cycle · ${usedBy(r.id).length ? `used by ${listNames(usedBy(r.id))}` : 'used by no restaurant yet'}`}
            onSelect={() => setChoice(r.id)}
          />
        ))}
      </div>
      {choice === 'new' && (
        <Input
          label="Rotation name"
          maxLength={40}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setMissing(false)
          }}
          error={missing ? 'Give the rotation a name.' : undefined}
        />
      )}
      {!!error && <SaveFailed error={error} />}
      <Button loading={saving} onClick={go}>
        {choice === 'new' ? 'Create and use it' : 'Use this rotation'}
      </Button>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
    </Sheet>
  )
}
