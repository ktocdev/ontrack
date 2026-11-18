import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRoleNames } from '../../auth/group'
import { useRight } from '../../auth/rights'
import { Button } from '../../components/Button'
import { ListCard } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Select } from '../../components/Field'
import { RestaurantSquare } from '../../components/RestaurantName'
import { DashedAddButton, QuarterTaskRow, ScheduleNote } from '../../components/Schedule'
import { BackBar, Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { TaskListEmpty } from '../../components/TaskRow'
import { useToast } from '../../components/Toast'
import { IconChevronDown, IconChevronRight, IconWarning } from '../../components/icons'
import { TaskEditorSheet, type TaskDraft } from './TaskEditorSheet'
import { listFor, quarterOfDate, summaryFor, taskMeta, type ListedTask, type Quarter } from './quarterly'
import {
  useDeleteTask,
  useQuarterlyTasks,
  useResetTask,
  useSaveTask,
  useSetActive,
  useSetRemoved,
} from './useQuarterlyTasks'

type Editing = { mode: 'add' } | { mode: 'edit'; listed: ListedTask }
const QUARTERS = (['1', '2', '3', '4'] as const).map((q) => ({ value: q, label: `Q${q}` }))

/**
 * Ops · Quarterly tasks (design/screens/WT-Ops-Tasks, OT-135), from the schedule's Quarterly
 * location tasks row. Tasks for picks the group's list (All restaurants) or a restaurant's
 * (?restaurant=), and the segments pick the quarter, this one first. The group's list is
 * what every restaurant gets; a restaurant's shows each task with where it comes from (All
 * restaurants, Changed for, Only), Remove on the group's ones, what it removed with Restore,
 * and Add for its own. The editor sets the name, directions and how-to video link; Delete
 * asks first, and only for a task no walkthrough has had, otherwise it offers Turn off, and
 * what is turned off waits under its own heading with Turn on (the archive rule; no board
 * draws those). An open walkthrough keeps its tasks as they were (OT-134). Changes need
 * set_walkthrough_schedule and are never offered under View as.
 */
export function QuarterlyTasksScreen() {
  const { restaurants, viewingAs } = useUser()
  const roles = useRoleNames()
  const canEdit = useRight('set_walkthrough_schedule') === true && !viewingAs
  const { data, isPending, isError, refetch } = useQuarterlyTasks()
  const save = useSaveTask()
  const setRemoved = useSetRemoved()
  const reset = useResetTask()
  const setActive = useSetActive()
  const del = useDeleteTask()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [quarter, setQuarter] = useState<Quarter>(() => quarterOfDate(new Date()))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(0)

  const restaurant = restaurants.find((r) => r.id === params.get('restaurant')) ?? null
  const q = `Q${quarter}`
  const failed = () => toast.show('Couldn’t save that. Check your connection and try again.')
  const open = (e: Editing) => {
    for (const m of [save, reset, setActive, del]) m.reset()
    setOpened((n) => n + 1)
    setEditing(e)
  }
  const close = () => setEditing(null)
  const done = (message: string) => () => {
    close()
    toast.show(message)
  }

  const header = (
    <BackBar to="/ops/walkthroughs/schedule" label="Back to walkthrough schedule" roomy>
      <span className="block text-12 text-text-secondary">{`Walkthroughs · ${roles.name('ops', 'Operations')}`}</span>
      <h1 className="font-display text-20 font-bold text-text">Quarterly tasks</h1>
    </BackBar>
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
            title="We couldn't load the quarterly tasks"
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
  if (isPending) {
    return (
      <Screen>
        {header}
        <ScreenBody className="pt-2">
          <CardFeedSkeleton label="Loading the quarterly tasks" />
        </ScreenBody>
      </Screen>
    )
  }

  const { rows, used } = data
  const list = listFor(rows, restaurant?.id ?? null, quarter)
  const where = restaurant ? `${q} · ${restaurant.name} only` : `${q} · All restaurants`

  const tagOf = (l: ListedTask) =>
    !restaurant
      ? undefined
      : l.kind === 'changed'
        ? { kind: 'changed' as const, label: `Changed for ${restaurant.name}` }
        : l.kind === 'own'
          ? { kind: 'own' as const, label: `Only ${restaurant.name}` }
          : { kind: 'group' as const, label: 'All restaurants' }

  const saveDraft = (d: TaskDraft) => {
    if (!editing) return
    const base = { title: d.title, directions: d.directions, videoUrl: d.videoUrl }
    if (editing.mode === 'add') {
      return save.mutate(
        { ...base, id: null, restaurantId: restaurant?.id ?? null, quarter },
        { onSuccess: done('Task added.') },
      )
    }
    const l = editing.listed
    // A group task on a restaurant's list is changed for that restaurant only.
    const id = l.kind === 'inherited' || l.kind === 'changed' ? l.group!.id : l.task.id
    save.mutate({ ...base, id, restaurantId: restaurant?.id ?? null }, { onSuccess: done('Task saved.') })
  }

  const sheet = (() => {
    if (!editing) return null
    const l = editing.mode === 'edit' ? editing.listed : null
    const removable = l && (l.kind === 'group' || l.kind === 'own') ? l.task : null
    return (
      <TaskEditorSheet
        key={opened}
        open
        onOpenChange={(o) => !o && close()}
        title={editing.mode === 'add' ? 'Add task' : 'Edit task'}
        scope={where}
        initial={{
          title: l?.task.title ?? '',
          directions: l?.task.directions ?? '',
          videoUrl: l?.task.video_url ?? '',
        }}
        saveLabel={editing.mode === 'add' ? 'Add task' : 'Save changes'}
        saving={save.isPending || reset.isPending || setActive.isPending || del.isPending}
        error={save.error ?? reset.error ?? setActive.error ?? del.error}
        onSave={saveDraft}
        onReset={
          l?.kind === 'changed' && restaurant
            ? () =>
                reset.mutate(
                  { taskId: l.group!.id, restaurantId: restaurant.id },
                  { onSuccess: done(`${restaurant.name} uses the all-restaurants version.`) },
                )
            : undefined
        }
        remove={
          removable
            ? {
                label: l!.kind === 'group' ? 'Delete for all restaurants' : 'Delete task',
                confirmText: `“${removable.title}” will be removed from ${
                  l!.kind === 'group' ? 'every restaurant' : restaurant?.name
                }.`,
                deletable: !used.has(removable.id),
                onDelete: () => del.mutate(removable.id, { onSuccess: done('Task deleted.') }),
                onTurnOff: () =>
                  setActive.mutate({ id: removable.id, active: false }, { onSuccess: done('Task turned off.') }),
              }
            : undefined
        }
      />
    )
  })()

  return (
    <Screen>
      {header}
      <ScreenBody className="gap-3 pb-6 pt-1">
        <Select
          label="Tasks for"
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
        <Segmented
          label="Quarter"
          value={String(quarter) as '1' | '2' | '3' | '4'}
          onChange={(v) => setQuarter(Number(v) as Quarter)}
          options={QUARTERS}
        />

        {restaurant ? (
          <ScheduleNote kind="follows">
            <b>{restaurant.name}.</b> Changes here only apply to {restaurant.name}. Tasks marked “All restaurants” come
            from the group list.
          </ScheduleNote>
        ) : (
          <ScheduleNote kind="group">
            <b>Every restaurant gets these.</b> Pick a restaurant above to remove or change a task for just that
            location, or to add its own.
          </ScheduleNote>
        )}

        <span className="eyebrow pt-3">
          {q} tasks · {list.tasks.length}
        </span>
        {list.tasks.length > 0 ? (
          <ListCard className="flex-none">
            {list.tasks.map((l) => (
              <QuarterTaskRow
                key={l.task.id}
                name={l.task.title}
                meta={taskMeta(l.task)}
                tag={tagOf(l)}
                onEdit={canEdit ? () => open({ mode: 'edit', listed: l }) : undefined}
                onRemove={
                  canEdit && restaurant && (l.kind === 'inherited' || l.kind === 'changed')
                    ? () =>
                        setRemoved.mutate(
                          { taskId: l.group!.id, restaurantId: restaurant.id, removed: true },
                          { onError: failed },
                        )
                    : undefined
                }
                removeLabel={restaurant ? `Remove ${l.task.title} for ${restaurant.name}` : undefined}
              />
            ))}
          </ListCard>
        ) : (
          <TaskListEmpty>No tasks for {q} yet.</TaskListEmpty>
        )}
        {canEdit && (
          <DashedAddButton onClick={() => open({ mode: 'add' })}>
            {restaurant ? `Add ${q} task for ${restaurant.name}` : `Add ${q} task for all restaurants`}
          </DashedAddButton>
        )}

        {restaurant && list.removed.length > 0 && (
          <Fold title={`Removed for ${restaurant.name} · ${list.removed.length}`}>
            {list.removed.map((t) => (
              <QuarterTaskRow
                key={t.id}
                name={t.title}
                meta={taskMeta(t)}
                action={
                  canEdit
                    ? {
                        label: 'Restore',
                        onClick: () =>
                          setRemoved.mutate(
                            { taskId: t.id, restaurantId: restaurant.id, removed: false },
                            { onError: failed },
                          ),
                      }
                    : undefined
                }
              />
            ))}
          </Fold>
        )}
        {list.off.length > 0 && (
          <Fold title={`Turned off · ${list.off.length}`}>
            {list.off.map((t) => (
              <QuarterTaskRow
                key={t.id}
                name={t.title}
                meta={taskMeta(t)}
                action={
                  canEdit
                    ? {
                        label: 'Turn on',
                        onClick: () => setActive.mutate({ id: t.id, active: true }, { onError: failed }),
                      }
                    : undefined
                }
              />
            ))}
          </Fold>
        )}

        {!restaurant && (
          <>
            <span className="eyebrow pt-3">Restaurants</span>
            <ListCard className="flex-none">
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setParams({ restaurant: r.id })}
                  className="flex min-h-14 w-full items-center gap-3 border-t border-surface-muted px-3.5 py-2 text-left first:border-t-0 hover:bg-surface-hover active:bg-surface-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-15 font-semibold">
                      <RestaurantSquare color={r.color} size={10} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="text-12 text-text-secondary">{summaryFor(rows, r.id)}</span>
                  </span>
                  <IconChevronRight size={16} className="flex-none text-text-secondary" />
                </button>
              ))}
            </ListCard>
          </>
        )}
      </ScreenBody>
      {sheet}
    </Screen>
  )
}

/** A folded list under the tasks: Removed for a restaurant, or Turned off. */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group flex-none pt-1">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between group-open:mb-1 [&::-webkit-details-marker]:hidden">
        <span className="eyebrow">{title}</span>
        <IconChevronDown size={16} className="text-text-secondary transition-transform group-open:rotate-180" />
      </summary>
      <ListCard>{children}</ListCard>
    </details>
  )
}
