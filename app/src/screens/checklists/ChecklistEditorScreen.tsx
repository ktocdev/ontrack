import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { safeReturnPath } from '../../auth/returnPath'
import { Button } from '../../components/Button'
import { ListCard, ListRowButton } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RoleTag } from '../../components/Pill'
import { ScheduleNote } from '../../components/Schedule'
import { BackBar, Screen, ScreenBody, ScreenEmpty } from '../../components/Screen'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { IconChevronRight, IconPlus, IconWarning } from '../../components/icons'
import { NotFoundScreen } from '../errors/NotFoundScreen'
import { useAllCategories } from '../mycategories/useMyCategories'
import { listNames } from '../schedule/schedule'
import { ChecklistDetailsSheet, GroupSheet, ItemSheet, OrderSheet, SectionSheet } from './ChecklistSheets'
import { groupsOf, idsByGroups, itemLine } from './checklist'
import {
  useChecklistChange,
  useChecklistEditor,
  type ChecklistFn,
  type EditorItem,
  type EditorSection,
} from './useChecklistEditor'

type Editing =
  | { kind: 'details' }
  | { kind: 'section'; section: EditorSection | null }
  | { kind: 'item'; item: EditorItem | null; sectionId: string }
  | { kind: 'group'; sectionId: string; name: string }
  | { kind: 'order-sections' }
  | { kind: 'order-groups'; sectionId: string }
  | { kind: 'order-items'; sectionId: string }

/**
 * Ops · Checklist editor (OT-136; no board draws it, so it follows Categories), from a
 * rotation month on the schedule. A checklist's sections, each with its groups and items:
 * add, rename, reorder, turn off and on, and delete what has no history. A walkthrough keeps
 * the checklist it opened with, so the first change to one a walkthrough has had makes a new
 * version, which the rotation's months move to; the screen follows it there and says so.
 * Changes need set_walkthrough_schedule and are never offered under View as.
 */
export function ChecklistEditorScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const from = useLocation().state as { backTo?: string } | null
  const back = safeReturnPath(from?.backTo) ?? '/ops/walkthroughs/schedule'
  const { viewingAs } = useUser()
  const canEdit = useRight('set_walkthrough_schedule') === true && !viewingAs
  const { data, isPending, isError, refetch } = useChecklistEditor(id)
  const categories = useAllCategories().data ?? []
  const change = useChecklistChange()
  const toast = useToast()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(0)

  const header = (
    <BackBar to={back} label="Back to the schedule">
      Walkthrough schedule
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
            title="We couldn't load this checklist"
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
          <CardFeedSkeleton label="Loading the checklist" />
        </ScreenBody>
      </Screen>
    )
  }
  if (!data) return <NotFoundScreen />
  // An edit made a newer version: that is the one to edit.
  if (data.checklist.replaced_by) {
    return <Navigate to={`/ops/walkthroughs/checklists/${data.checklist.replaced_by}`} replace state={from} />
  }

  const { checklist, sections, items, used, rotations } = data
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const itemsOf = (sectionId: string) => items.filter((i) => i.section_id === sectionId)
  const activeItems = items.filter((i) => i.active && sections.find((s) => s.id === i.section_id)?.active).length

  const open = (e: Editing) => {
    change.reset()
    setOpened((n) => n + 1)
    setEditing(e)
  }
  const close = () => setEditing(null)
  const run = (fn: ChecklistFn, args: Record<string, unknown>, done = 'Saved.') =>
    change.mutate(
      { fn, args },
      {
        onSuccess: (newId) => {
          close()
          if (newId && newId !== checklist.id) {
            toast.show('Saved as a new version. Walkthroughs that had the earlier one keep it.')
            navigate(`/ops/walkthroughs/checklists/${newId}`, { replace: true, state: from })
          } else toast.show(done)
        },
      },
    )
  const t = { p_template: checklist.id }
  const common = {
    open: true,
    onOpenChange: (o: boolean) => !o && close(),
    saving: change.isPending,
    error: change.error,
  }

  const sheet = (() => {
    if (!editing) return null
    switch (editing.kind) {
      case 'details':
        return (
          <ChecklistDetailsSheet
            key={opened}
            {...common}
            checklist={checklist}
            deletable={!used && rotations.length === 0}
            onSave={(v) =>
              run('save_checklist', { ...t, p_name: v.name, p_description: v.description, p_short_name: v.shortName })
            }
            onActive={(active) =>
              run('set_checklist_active', { ...t, p_active: active }, active ? 'Turned on.' : 'Turned off.')
            }
            onDelete={() =>
              change.mutate(
                { fn: 'delete_checklist', args: t },
                {
                  onSuccess: () => {
                    toast.show('Checklist deleted.')
                    navigate(back, { replace: true })
                  },
                },
              )
            }
          />
        )
      case 'section': {
        const s = editing.section
        return (
          <SectionSheet
            key={opened}
            {...common}
            section={s}
            deletable={!used && !!s && !s.copied_from && itemsOf(s.id).every((i) => !i.copied_from)}
            onSave={(v) =>
              run('save_checklist_section', {
                ...t,
                p_id: s?.id ?? null,
                p_name: v.name,
                p_short_name: v.shortName,
                p_area: v.area,
              })
            }
            onActive={(active) =>
              run('set_checklist_part_active', { ...t, p_kind: 'section', p_id: s!.id, p_active: active })
            }
            onDelete={() => run('delete_checklist_part', { ...t, p_kind: 'section', p_id: s!.id }, 'Section deleted.')}
          />
        )
      }
      case 'item': {
        const i = editing.item
        return (
          <ItemSheet
            key={opened}
            {...common}
            item={i}
            deletable={!used && !!i && !i.copied_from}
            sectionId={editing.sectionId}
            sections={sections}
            groups={groupsOf(itemsOf(editing.sectionId)).map((g) => g.name)}
            categories={categories}
            onSave={(v) =>
              run('save_checklist_item', {
                ...t,
                p_id: i?.id ?? null,
                p_section: v.section,
                p_group: v.group,
                p_title: v.title,
                p_directions: v.directions,
                p_video_url: v.videoUrl,
                p_category: v.category,
              })
            }
            onActive={(active) =>
              run('set_checklist_part_active', { ...t, p_kind: 'item', p_id: i!.id, p_active: active })
            }
            onDelete={() => run('delete_checklist_part', { ...t, p_kind: 'item', p_id: i!.id }, 'Item deleted.')}
          />
        )
      }
      case 'group':
        return (
          <GroupSheet
            key={opened}
            {...common}
            name={editing.name}
            onSave={(name) =>
              run('rename_checklist_group', { ...t, p_section: editing.sectionId, p_from: editing.name, p_to: name })
            }
          />
        )
      case 'order-sections':
        return (
          <OrderSheet
            key={opened}
            {...common}
            title="Order sections"
            items={sections.map((s) => ({ id: s.id, name: s.name }))}
            onSave={(ids) => run('order_checklist', { ...t, p_section: null, p_ids: ids }, 'Order saved.')}
          />
        )
      case 'order-groups': {
        const sectionItems = itemsOf(editing.sectionId)
        return (
          <OrderSheet
            key={opened}
            {...common}
            title="Order groups"
            items={groupsOf(sectionItems).map((g) => ({ id: g.name, name: g.name, detail: `${g.items.length} items` }))}
            onSave={(names) =>
              run(
                'order_checklist',
                { ...t, p_section: editing.sectionId, p_ids: idsByGroups(sectionItems, names) },
                'Order saved.',
              )
            }
          />
        )
      }
      case 'order-items': {
        const sectionItems = itemsOf(editing.sectionId)
        const ordered = groupsOf(sectionItems).flatMap((g) => g.items)
        return (
          <OrderSheet
            key={opened}
            {...common}
            title="Order items"
            items={ordered.map((i) => ({ id: i.id, name: i.title, detail: i.group_name }))}
            onSave={(ids) => run('order_checklist', { ...t, p_section: editing.sectionId, p_ids: ids }, 'Order saved.')}
          />
        )
      }
    }
  })()

  const onRotations = rotations.map((r) => (r.is_group ? 'the group’s rotation' : r.name))

  return (
    <Screen>
      {header}
      <header className="flex flex-none items-start justify-between gap-3 px-screen pb-2 pt-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-26 font-bold leading-[1.2] tracking-[-0.02em] [overflow-wrap:anywhere]">
            {checklist.name}
          </h1>
          <span className="text-13 text-text-secondary">
            {[checklist.description, `${sections.length} sections · ${activeItems} items`].filter(Boolean).join(' · ')}
            {!checklist.active && ' · Off'}
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => open({ kind: 'details' })}
            className="-mr-2 flex min-h-tap flex-none items-center px-2 text-15 font-semibold text-brand"
          >
            Edit
          </button>
        )}
      </header>

      <ScreenBody className="gap-3 pb-6 pt-1">
        <ScheduleNote kind={used ? 'follows' : 'group'}>
          {used ? (
            <>
              <b>Walkthroughs that have had this checklist keep it as it was.</b> The first change here makes a new
              version
            </>
          ) : (
            <>
              <b>No walkthrough has had this version yet.</b> Changes go
            </>
          )}{' '}
          {onRotations.length
            ? `on the next month on ${listNames(onRotations)}.`
            : 'on any month that picks it. No rotation uses it yet.'}
        </ScheduleNote>

        {sections.map((s) => {
          const groups = groupsOf(itemsOf(s.id))
          return (
            <section key={s.id} className="flex flex-none flex-col gap-1.5 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">
                  {s.name}
                  {s.short_name && s.short_name !== s.name ? ` · ${s.short_name}` : ''}
                  {!s.active && ' · Off'}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Edit section ${s.name}`}
                    onClick={() => open({ kind: 'section', section: s })}
                    className="-mr-1 flex min-h-tap items-center px-1 text-14 font-semibold text-brand"
                  >
                    Edit
                  </button>
                )}
              </div>
              <ListCard>
                {groups.map((g) => (
                  <div key={g.name}>
                    <div className="flex min-h-11 items-center justify-between gap-2 border-t border-surface-muted bg-surface-hover pl-3.5 pr-2 first:border-t-0">
                      <span className="text-13 font-bold text-text-secondary">{g.name}</span>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Rename group ${g.name}`}
                          onClick={() => open({ kind: 'group', sectionId: s.id, name: g.name })}
                          className="flex min-h-tap items-center px-2 text-13 font-semibold text-brand"
                        >
                          Rename
                        </button>
                      )}
                    </div>
                    {g.items.map((i) =>
                      canEdit ? (
                        <ListRowButton
                          key={i.id}
                          onClick={() => open({ kind: 'item', item: i, sectionId: s.id })}
                          title={i.title}
                          subtitle={itemLine(i, i.category_id ? (categoryName.get(i.category_id) ?? null) : null)}
                          trailing={
                            <span className="flex items-center gap-2">
                              {!i.active && <RoleTag>Off</RoleTag>}
                              <IconChevronRight size={16} className="text-text-muted" />
                            </span>
                          }
                        />
                      ) : (
                        <div
                          key={i.id}
                          className="flex min-h-14 flex-col justify-center border-t border-surface-muted px-3.5 py-2"
                        >
                          <span className="text-15 font-semibold">
                            {i.title}
                            {!i.active && ' · Off'}
                          </span>
                          <span className="text-13 text-text-secondary">
                            {itemLine(i, i.category_id ? (categoryName.get(i.category_id) ?? null) : null)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="px-3.5 py-3 text-14 text-text-secondary">No items in this section yet.</p>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => open({ kind: 'item', item: null, sectionId: s.id })}
                    className="flex min-h-12 w-full items-center gap-2 border-t border-surface-muted px-3.5 text-14 font-semibold text-brand"
                  >
                    <IconPlus size={16} strokeWidth={2.4} />
                    Add item to {s.name}
                  </button>
                )}
              </ListCard>
              {canEdit && groups.length > 0 && (
                <div className="flex gap-4">
                  {groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => open({ kind: 'order-groups', sectionId: s.id })}
                      className="min-h-tap text-13 font-semibold text-brand"
                    >
                      Order groups
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => open({ kind: 'order-items', sectionId: s.id })}
                    className="min-h-tap text-13 font-semibold text-brand"
                  >
                    Order items
                  </button>
                </div>
              )}
            </section>
          )
        })}

        {canEdit && (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              icon={<IconPlus size={18} />}
              onClick={() => open({ kind: 'section', section: null })}
            >
              Add section
            </Button>
            {sections.length > 1 && (
              <Button variant="ghost" onClick={() => open({ kind: 'order-sections' })}>
                Order sections
              </Button>
            )}
          </div>
        )}
      </ScreenBody>
      {sheet}
    </Screen>
  )
}
