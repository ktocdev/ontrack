import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import {
  CheckChoice,
  ChecklistEntries,
  ChecklistEntry,
  ChecklistGroup,
  ChecklistHelp,
  ChecklistItem,
  HowToVideo,
  InlineFix,
  TaskCard,
  TaskLabel,
} from '../../components/Checklist'
import { BackBar, Screen, ScreenBody, UnderlineTabs } from '../../components/Screen'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { FlagChip, FlagChips } from '../../components/Walkthrough'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import {
  firstOpen,
  groupsOf,
  litChoices,
  openAfter,
  type ChecklistGroup as Group,
  type FixRow,
  type TicketRow,
} from './checklist'
import { goodRefusal, useAddFix, useChecklist, useSetGood, type CheckTarget } from './useChecklist'
import { QuickTicketSheet, type QuickTicketTarget } from './QuickTicketSheet'
import { monthName, quarterEnd } from './walkthrough'

/**
 * Manager · Walkthrough checklist (design/screens/WT-Checklist) and the quarter's tasks
 * (WT-Quarterly), one tab each. A section's groups are cards; each item has Good, In-house
 * and Ticket, and every tap saves at once. Good is hidden while an item has a fix or ticket
 * still open, as the database refuses it then. In-house opens a field under the item;
 * Ticket opens the quick ticket sheet. What was made from an item is listed under it: a
 * ticket still open opens the walkthrough's Edit ticket, one closed its own page, and a fix
 * this walkthrough's In-house fixes for that item. When a group fills, it closes and the next one opens. The quarter's
 * tasks are cards with directions, the how-to video and the same Result; one done in an
 * earlier walkthrough this quarter says so and takes nothing more. A submitted
 * walkthrough, or one seen under View as, shows its marks and changes nothing.
 */
export function ChecklistScreen() {
  const { id = '', section = '' } = useParams()
  const { data, isPending, isError } = useChecklist(id)
  const { viewingAs } = useUser()

  if (isPending) {
    return (
      <Screen>
        <BackBar to="/walkthrough" label="Back to walkthrough" />
        <ScreenBody className="pb-4">
          <GroupedListSkeleton />
        </ScreenBody>
      </Screen>
    )
  }
  if (isError || !data) return <NotFoundScreen />
  const part = data.progress.parts.find((p) => p.key === section)
  if (!part) return <NotFoundScreen />

  const w = data.walkthrough
  const readOnly = !!viewingAs || w.status !== 'open'
  const base = `/walkthrough/${w.id}`
  const quarterly = section === 'quarterly'

  return (
    <Screen>
      <BackBar
        to="/walkthrough"
        label="Back to walkthrough"
        roomy
        action={
          <span aria-live="polite" className="flex-none pl-2 text-13 font-bold text-text">
            {part.done}/{part.total}
          </span>
        }
      >
        <span className="block text-12 text-text-secondary">
          {monthName(w.period)} walkthrough · {w.restaurantName}
        </span>
        <h1 className="font-display text-20 font-bold text-text">{part.name}</h1>
      </BackBar>
      {!quarterly && (
        <div className="mx-screen mt-2.5 h-1.5 flex-none overflow-hidden rounded-[3px] bg-surface-sunken">
          <div
            className="h-full bg-progress-good"
            style={{ width: `${part.total ? Math.round((part.done / part.total) * 100) : 0}%` }}
          />
        </div>
      )}
      <UnderlineTabs
        label="Walkthrough parts"
        className={`mx-screen flex-none ${quarterly ? 'mt-2.5' : 'mt-1.5'}`}
        items={data.progress.parts.map((p) => ({
          to: `${base}/${p.key}`,
          label: p.key === 'quarterly' ? `${p.shortName} tasks` : p.shortName,
        }))}
      />
      {quarterly ? (
        <Quarter data={data} readOnly={readOnly} linksOff={!!viewingAs} />
      ) : (
        <Section key={section} sectionId={section} data={data} readOnly={readOnly} linksOff={!!viewingAs} />
      )}
    </Screen>
  )
}

type Data = NonNullable<ReturnType<typeof useChecklist>['data']>

/** An item or a task, as its buttons and records see it. */
type Thing = {
  target: CheckTarget
  title: string
  good: boolean
  /** A fix not checked off or a ticket not closed, which keeps Good away. */
  open: boolean
  fixes: FixRow[]
  tickets: TicketRow[]
  /** What the quick ticket shows and asks for. */
  ticket: Omit<QuickTicketTarget, 'openTickets'>
  /** The item's group, opened again on the way back. */
  group?: string
}

/** What a tap does, shared by a section's items and the quarter's tasks. */
function useWork(data: Data, sectionKey: string, readOnly: boolean, linksOff: boolean) {
  const walkthroughId = data.walkthrough.id
  const toast = useToast()
  const setGood = useSetGood(walkthroughId)
  const addFix = useAddFix(walkthroughId)
  const [drafting, setDrafting] = useState<string | null>(null)
  const [ticketFor, setTicketFor] = useState<QuickTicketTarget | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Each opening starts a fresh sheet, even for the same item.
  const [opened, setOpened] = useState(0)
  const keyOf = (t: CheckTarget) => t.itemId ?? t.taskId!

  const choices = (thing: Thing, wide = false) => {
    const size = wide ? 'min-h-11 flex-1 text-13' : ''
    return (
      <>
        {!thing.open && (
          <CheckChoice
            tone="good"
            lit={thing.good}
            aria-pressed={thing.good}
            disabled={readOnly}
            className={size}
            onClick={() =>
              setGood.mutate(
                { target: thing.target, good: !thing.good },
                { onError: (e) => toast.show(goodRefusal(e)) },
              )
            }
          >
            Good
          </CheckChoice>
        )}
        <CheckChoice
          tone="inhouse"
          lit={litChoices(thing.fixes, thing.tickets).inhouse}
          disabled={readOnly}
          className={size}
          aria-label={
            thing.fixes.length
              ? `Add another in-house fix for ${thing.title} (${thing.fixes.length} so far)`
              : `Add in-house fix for ${thing.title}`
          }
          onClick={() => setDrafting(keyOf(thing.target))}
        >
          In-house
        </CheckChoice>
        <CheckChoice
          tone="ticket"
          lit={litChoices(thing.fixes, thing.tickets).ticket}
          disabled={readOnly}
          className={size}
          aria-label={
            thing.tickets.length
              ? `Add another ticket for ${thing.title} (${thing.tickets.length} so far)`
              : `Create ticket for ${thing.title}`
          }
          onClick={() => {
            setTicketFor({
              ...thing.ticket,
              openTickets: thing.tickets.filter((t) => t.status !== 'closed').map((t) => t.display_id ?? ''),
            })
            setOpened((n) => n + 1)
            setSheetOpen(true)
          }}
        >
          Ticket
        </CheckChoice>
      </>
    )
  }

  const records = (thing: Thing) => {
    const isDrafting = drafting === keyOf(thing.target)
    if (thing.fixes.length + thing.tickets.length === 0 && !isDrafting) return null
    return (
      <ChecklistEntries>
        {thing.fixes.map((f) => (
          <ChecklistEntry
            key={f.id}
            kind="fix"
            done={!!f.done_at}
            to={
              linksOff
                ? undefined
                : `/walkthrough/${walkthroughId}/fixes?${thing.target.itemId ? `item=${thing.target.itemId}` : `task=${thing.target.taskId}`}`
            }
            state={{ backTo: `/walkthrough/${walkthroughId}/${sectionKey}`, openGroup: thing.group }}
          >
            {f.title}
          </ChecklistEntry>
        ))}
        {thing.tickets.map((t) => (
          <ChecklistEntry
            key={t.id}
            kind="ticket"
            label={t.display_id ?? ''}
            urgent={t.urgency === 'urgent'}
            done={t.status === 'closed'}
            to={
              linksOff
                ? undefined
                : t.status === 'closed'
                  ? `/tickets/${t.id}`
                  : `/walkthrough/${walkthroughId}/${sectionKey}/ticket/${t.id}`
            }
          >
            {t.title}
          </ChecklistEntry>
        ))}
        {isDrafting && !readOnly && (
          <InlineFix
            item={thing.title}
            saving={addFix.isPending}
            onCancel={() => setDrafting(null)}
            onAdd={(title) =>
              addFix.mutate(
                { target: thing.target, title },
                {
                  onSuccess: () => setDrafting(null),
                  onError: () => toast.show('Couldn’t add that fix. Check your connection and try again.'),
                },
              )
            }
          />
        )}
      </ChecklistEntries>
    )
  }

  const sheet = ticketFor && (
    <QuickTicketSheet
      key={opened}
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      walkthroughId={walkthroughId}
      restaurantId={data.walkthrough.restaurant_id}
      target={ticketFor}
    />
  )
  return { choices, records, sheet }
}

function Section({
  sectionId,
  data,
  readOnly,
  linksOff,
}: {
  sectionId: string
  data: Data
  readOnly: boolean
  linksOff: boolean
}) {
  const work = useWork(data, sectionId, readOnly, linksOff)
  const section = data.sections.find((s) => s.id === sectionId)

  const groups = useMemo(
    () => groupsOf(sectionId, data.items, data.checks, data.fixes, data.tickets),
    [sectionId, data.items, data.checks, data.fixes, data.tickets],
  )
  // When a tap fills a group, it closes and the next opens (worked out as the data changes).
  const [seen, setSeen] = useState<Group[]>(groups)
  // Coming back from a ticket, its group is open as well.
  const openGroup = (useLocation().state as { openGroup?: string } | null)?.openGroup
  const [open, setOpen] = useState(() => {
    const first = firstOpen(groups)
    if (openGroup && groups.some((g) => g.name === openGroup)) first.add(openGroup)
    return first
  })
  if (seen !== groups) {
    setSeen(groups)
    setOpen(openAfter(seen, groups, open))
  }
  const toggle = (name: string) => setOpen((o) => flip(o, name))

  return (
    <ScreenBody className="gap-2.5 pb-5 pt-3">
      <ChecklistHelp />
      {groups.map((g) => (
        <ChecklistGroup
          key={g.name}
          name={g.name}
          done={g.done}
          total={g.total}
          open={open.has(g.name)}
          onToggle={() => toggle(g.name)}
          flags={
            <FlagChips
              tickets={g.items.reduce((n, it) => n + it.tickets.filter((t) => t.status !== 'closed').length, 0)}
              fixes={g.items.reduce((n, it) => n + it.fixes.filter((f) => !f.done_at).length, 0)}
            />
          }
        >
          {g.items.map((it) => {
            const thing: Thing = {
              target: { itemId: it.id },
              group: g.name,
              title: it.title,
              good: it.good,
              open: it.open,
              fixes: it.fixes,
              tickets: it.tickets,
              ticket: {
                check: { itemId: it.id },
                chips: [section?.name ?? '', g.name, it.title],
                area: section?.area ?? null,
                categoryId: data.items.find((i) => i.id === it.id)?.category_id ?? null,
              },
            }
            return (
              <ChecklistItem key={it.id} name={it.title} choices={work.choices(thing)}>
                {work.records(thing)}
              </ChecklistItem>
            )
          })}
        </ChecklistGroup>
      ))}
      {work.sheet}
    </ScreenBody>
  )
}

function Quarter({ data, readOnly, linksOff }: { data: Data; readOnly: boolean; linksOff: boolean }) {
  const work = useWork(data, 'quarterly', readOnly, linksOff)
  const w = data.walkthrough
  const quarter = data.progress.parts.find((p) => p.key === 'quarterly')

  const tasks = useMemo(
    () =>
      data.tasks.map((t) => {
        const check = data.checks.find((c) => c.quarterly_task_id === t.task_id)
        const fixes = check ? data.fixes.filter((f) => f.check_id === check.id) : []
        const tickets = check ? data.tickets.filter((k) => k.walkthrough_check_id === check.id) : []
        const thing: Thing = {
          target: { taskId: t.task_id },
          title: t.title,
          good: check?.result === 'good',
          open: fixes.some((f) => !f.done_at) || tickets.some((k) => k.status !== 'closed'),
          fixes,
          tickets,
          ticket: {
            check: { taskId: t.task_id },
            chips: [`${quarter?.shortName ?? ''} tasks`, t.title],
            area: null,
            categoryId: null,
          },
        }
        return { task: t, earlier: t.done && !!t.check_walkthrough_id && t.check_walkthrough_id !== w.id, thing }
      }),
    [data.tasks, data.checks, data.fixes, data.tickets, w.id, quarter?.shortName],
  )
  // The first task still to do is open.
  const [open, setOpen] = useState(() => {
    const first = tasks.find((t) => !t.task.done)
    return new Set(first ? [first.task.task_id] : [])
  })

  return (
    <ScreenBody className="gap-2.5 pb-5 pt-3">
      <p className="text-center text-13 leading-[1.45] text-text-secondary">Due {quarterEnd(w.period)}</p>
      {tasks.map(({ task, earlier, thing }) => {
        const issues = thing.fixes.length + thing.tickets.length
        const status: ReactNode =
          issues > 0 ? (
            <FlagChip tone="ticket">{issues === 1 ? '1 issue' : `${issues} issues`}</FlagChip>
          ) : thing.good || earlier ? (
            <FlagChip tone="good">Done</FlagChip>
          ) : (
            <FlagChip tone="missed">To do</FlagChip>
          )
        return (
          <TaskCard
            key={task.task_id}
            title={task.title}
            status={status}
            open={open.has(task.task_id)}
            onToggle={() => setOpen((o) => flip(o, task.task_id))}
          >
            {task.directions && (
              <>
                <TaskLabel>Directions</TaskLabel>
                <p className="whitespace-pre-wrap text-14 leading-[1.55] text-text-body">{task.directions}</p>
              </>
            )}
            {task.video_url && <HowToVideo url={task.video_url} task={task.title} />}
            <TaskLabel>Result</TaskLabel>
            {earlier ? (
              <p className="text-14 text-text-secondary">Done in an earlier walkthrough this quarter.</p>
            ) : (
              <>
                <div role="group" aria-label={task.title} className="flex gap-1">
                  {work.choices(thing, true)}
                </div>
                {work.records(thing)}
              </>
            )}
          </TaskCard>
        )
      })}
      {work.sheet}
    </ScreenBody>
  )
}

function flip(set: Set<string>, key: string) {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}
