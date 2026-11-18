import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Select } from '../../components/Field'
import { RestaurantSquare } from '../../components/RestaurantName'
import { AddMonthRow, RotationMonthRow, RotationTag, ScheduleNote, YearPreview } from '../../components/Schedule'
import { BackBar, Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronRight, IconWarning } from '../../components/icons'
import { DueSheet, MonthSheet, OwnScheduleSheet, RemindersSheet } from './ScheduleSheets'
import {
  checklistSize,
  dueLabel,
  letterOf,
  listNames,
  MONTH_SHORT,
  positionFor,
  remindersLabel,
  toneOf,
} from './schedule'
import { useSaveRotation, useSchedule, useSetRestaurantRotation, type Rotation } from './useSchedule'

type Editing = { kind: 'month'; position: number | null } | { kind: 'due' } | { kind: 'reminders' } | { kind: 'own' }

/**
 * Ops · Walkthrough schedule (design/screens/WT-Ops-Schedule, OT-133), from the overview's
 * Schedule button. Schedule for picks the group's rotation (All restaurants) or a
 * restaurant's (?restaurant=): its months with Edit and Add a month to the cycle, the year's
 * preview with this month outlined, every restaurant with the rotation it is on, and the due
 * date and reminders. A rotation stands on its own and restaurants may share one (Nov 12,
 * 2026), so the board's Own reads as the rotation's name, and Give it its own schedule offers
 * a new rotation copied from the group's or one that exists; Switch back puts the restaurant
 * on the group's. The board's Checklist items row shows this month's checklist, and its
 * Quarterly location tasks row opens the quarterly tasks (OT-135). Changes need set_walkthrough_schedule and
 * are never offered under View as.
 */
export function ScheduleScreen() {
  const { restaurants, viewingAs } = useUser()
  const roles = useRoleNames()
  const canEdit = useRight('set_walkthrough_schedule') === true && !viewingAs
  const { data, isPending, isError, refetch } = useSchedule()
  const save = useSaveRotation()
  const setRotation = useSetRestaurantRotation()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(0)

  const restaurant = restaurants.find((r) => r.id === params.get('restaurant')) ?? null
  const open = (e: Editing) => {
    save.reset()
    setRotation.reset()
    setOpened((n) => n + 1)
    setEditing(e)
  }
  const close = () => setEditing(null)

  const header = (
    <>
      <BackBar to="/ops/walkthroughs" label="Back to walkthroughs">
        {`Walkthroughs · ${roles.name('ops', 'Operations')}`}
      </BackBar>
      <h1 className="flex-none px-screen pb-3 pt-1 font-display text-28 font-bold leading-[1.15] tracking-[-0.02em]">
        Walkthrough schedule
      </h1>
    </>
  )

  if (isError) {
    return (
      <Screen>
        {header}
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load the schedule"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      </Screen>
    )
  }
  if (isPending || !data?.group) {
    return (
      <Screen>
        {header}
        <ScreenBody className="pt-2">
          <CardFeedSkeleton label="Loading the schedule" />
        </ScreenBody>
      </Screen>
    )
  }

  const { group, checklists } = data
  const rotationOf = (restaurantId: string) => data.rotations.find((r) => r.id === data.own.get(restaurantId)) ?? group
  const rotation: Rotation = restaurant ? rotationOf(restaurant.id) : group
  const isOwn = !!restaurant && rotation.id !== group.id
  const editable = canEdit && (!restaurant || isOwn)
  const usedBy = (id: string) => restaurants.filter((r) => rotationOf(r.id).id === id).map((r) => r.name)

  const now = new Date()
  const year = now.getFullYear()
  const checklistAt = (position: number | null) =>
    position === null ? undefined : checklists.get(rotation.months[position] ?? '')
  const thisMonth = checklistAt(positionFor(rotation.starts_on, rotation.months.length, year, now.getMonth()))

  const saveRotation = (change: Partial<Rotation>, done: string) =>
    save.mutate(
      { ...rotation, ...change },
      {
        onSuccess: () => {
          close()
          toast.show(done)
        },
      },
    )

  const giveOwn = (choice: { rotationId: string } | { name: string }) => {
    if (!restaurant) return
    const putOn = (rotationId: string) =>
      setRotation.mutate(
        { restaurantId: restaurant.id, rotationId },
        {
          onSuccess: () => {
            close()
            toast.show(`${restaurant.name} has its own schedule.`)
          },
        },
      )
    if ('rotationId' in choice) return putOn(choice.rotationId)
    // A new rotation starts as a copy of the group's.
    save.mutate({ ...group, id: null, name: choice.name }, { onSuccess: (id) => putOn(id) })
  }
  const switchBack = () =>
    restaurant &&
    setRotation.mutate(
      { restaurantId: restaurant.id, rotationId: null },
      {
        onSuccess: () => toast.show(`${restaurant.name} follows the group schedule again.`),
        onError: () => toast.show('Couldn’t switch back. Check your connection and try again.'),
      },
    )

  return (
    <Screen>
      {header}
      <ScreenBody className="gap-3 pb-6 pt-1">
        <Select
          label="Schedule for"
          labelClassName="eyebrow"
          value={restaurant?.id ?? ''}
          onChange={(e) => setParams(e.target.value ? { restaurant: e.target.value } : {}, { replace: true })}
        >
          <option value="">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>

        {!restaurant ? (
          <ScheduleNote kind="group">
            <b>Group schedule.</b> Every restaurant uses this unless it has its own. Used by{' '}
            {listNames(usedBy(group.id))}.
          </ScheduleNote>
        ) : isOwn ? (
          <ScheduleNote
            kind="own"
            action={
              canEdit && (
                <Button variant="small" className="self-start" loading={setRotation.isPending} onClick={switchBack}>
                  Switch back to group schedule
                </Button>
              )
            }
          >
            <b>{restaurant.name} has its own schedule,</b> {rotation.name}
            {usedBy(rotation.id).length > 1
              ? `, shared with ${listNames(usedBy(rotation.id).filter((n) => n !== restaurant.name))}`
              : ''}
            . Changes to the group schedule won’t affect it
            {usedBy(rotation.id).length > 1 ? ', and changes here reach every restaurant on it' : ''}.
          </ScheduleNote>
        ) : (
          <ScheduleNote
            kind="follows"
            action={
              canEdit && (
                <Button variant="small" className="self-start" onClick={() => open({ kind: 'own' })}>
                  Give {restaurant.name} its own schedule
                </Button>
              )
            }
          >
            <b>{restaurant.name} follows the group schedule.</b> Changes to the group schedule apply here too.
          </ScheduleNote>
        )}

        <span className="eyebrow pt-3">Rotation · {rotation.months.length}-month cycle</span>
        <ListCard className="flex-none">
          {rotation.months.map((id, i) => {
            const c = checklists.get(id)
            return (
              <RotationMonthRow
                key={i}
                letter={letterOf(i)}
                tone={toneOf(i)}
                name={c?.name ?? 'Checklist'}
                detail={[c?.description, c && `${c.items} checks`].filter(Boolean).join(' · ')}
                onEdit={editable ? () => open({ kind: 'month', position: i }) : undefined}
              />
            )
          })}
          {editable && rotation.months.length < 12 && (
            <AddMonthRow onAdd={() => open({ kind: 'month', position: null })} />
          )}
        </ListCard>

        <span className="eyebrow pt-3">{year} preview</span>
        <ListCard className="flex-none">
          <YearPreview
            year={year}
            months={MONTH_SHORT.map((name, m) => {
              const p = positionFor(rotation.starts_on, rotation.months.length, year, m) ?? 0
              const c = checklistAt(p)
              const isNow = m === now.getMonth()
              return {
                name,
                letter: letterOf(p),
                tone: toneOf(p),
                now: isNow,
                label: `${name}: ${c?.name ?? letterOf(p)}${isNow ? ', this month' : ''}`,
              }
            })}
            legend={rotation.months.map((id, i) => ({
              letter: letterOf(i),
              tone: toneOf(i),
              name: checklists.get(id)?.short_name ?? checklists.get(id)?.name ?? '',
            }))}
          />
        </ListCard>

        {!restaurant && (
          <>
            <span className="eyebrow pt-3">Restaurants</span>
            <ListCard className="flex-none">
              {restaurants.map((r) => {
                const on = rotationOf(r.id)
                const own = on.id !== group.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setParams({ restaurant: r.id })}
                    className="flex min-h-14 w-full items-center gap-2.5 border-t border-surface-muted px-3.5 text-left first:border-t-0 hover:bg-surface-hover active:bg-surface-muted"
                  >
                    <RestaurantSquare color={r.color} size={10} />
                    <span className="min-w-0 flex-1 truncate text-15 font-semibold">{r.name}</span>
                    <RotationTag own={own}>{own ? `${on.name} · ${on.months.length}-month` : 'Group'}</RotationTag>
                    <IconChevronRight size={16} className="flex-none text-text-secondary" />
                  </button>
                )
              })}
            </ListCard>
          </>
        )}

        <span className="eyebrow pt-3">Settings</span>
        <ListCard className="flex-none">
          <SettingRow
            label="Due date"
            value={dueLabel(rotation.due_day)}
            onOpen={editable ? () => open({ kind: 'due' }) : undefined}
          />
          <SettingRow
            label="Reminders"
            value={remindersLabel(rotation.reminder_days)}
            onOpen={editable ? () => open({ kind: 'reminders' }) : undefined}
          />
          {thisMonth && (
            <SettingRow label="Checklist items" value={checklistSize(thisMonth.sections, thisMonth.items)} />
          )}
          <SettingRow
            label="Quarterly location tasks"
            hint="Directions and how-to videos"
            value="All + per restaurant"
            to="/ops/walkthroughs/tasks"
          />
        </ListCard>
      </ScreenBody>

      {editing?.kind === 'month' && (
        <MonthSheet
          key={opened}
          open
          onOpenChange={(o) => !o && close()}
          position={editing.position}
          rotation={rotation}
          checklists={checklists}
          saving={save.isPending}
          error={save.error}
          onSave={(months) => saveRotation({ months }, 'Rotation saved.')}
        />
      )}
      {editing?.kind === 'due' && (
        <DueSheet
          key={opened}
          open
          onOpenChange={(o) => !o && close()}
          rotation={rotation}
          saving={save.isPending}
          error={save.error}
          onSave={(due_day) => saveRotation({ due_day }, 'Due date saved.')}
        />
      )}
      {editing?.kind === 'reminders' && (
        <RemindersSheet
          key={opened}
          open
          onOpenChange={(o) => !o && close()}
          rotation={rotation}
          saving={save.isPending}
          error={save.error}
          onSave={(reminder_days) => saveRotation({ reminder_days }, 'Reminders saved.')}
        />
      )}
      {editing?.kind === 'own' && restaurant && (
        <OwnScheduleSheet
          key={opened}
          open
          onOpenChange={(o) => !o && close()}
          restaurant={restaurant.name}
          others={data.rotations.filter((r) => !r.is_group)}
          usedBy={usedBy}
          saving={save.isPending || setRotation.isPending}
          error={save.error ?? setRotation.error}
          onPick={giveOwn}
        />
      )}
    </Screen>
  )
}

/** A setting on the schedule: its name and value, opening its sheet when it can be changed. */
function SettingRow({
  label,
  hint,
  value,
  onOpen,
  to,
}: {
  label: string
  hint?: string
  value: string
  onOpen?: () => void
  to?: string
}) {
  const inner = (
    <>
      <span className="flex flex-1 flex-col">
        <span className="text-15 font-semibold">{label}</span>
        {hint && <span className="text-12 text-text-secondary">{hint}</span>}
      </span>
      <span className="text-14 text-text-secondary">{value}</span>
      {(onOpen || to) && <IconChevronRight size={16} className="flex-none text-text-secondary" />}
    </>
  )
  const row =
    'flex min-h-14 w-full items-center gap-2.5 border-t border-surface-muted px-3.5 py-2 text-left text-text no-underline first:border-t-0'
  if (to) {
    return (
      <Link to={to} className={`${row} hover:bg-surface-hover active:bg-surface-muted`}>
        {inner}
      </Link>
    )
  }
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${row} hover:bg-surface-hover active:bg-surface-muted`}>
      {inner}
    </button>
  ) : (
    <div className={row}>{inner}</div>
  )
}
