import { useState, type FormEvent } from 'react'
import { AREAS, AREA_LABEL, type Area } from '../../app/areas'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { ListCard, ListRow, ListRowButton } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Screen, ScreenBody, ScreenEmpty, SectionLabel, TitleBar } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { ViewSettingFields, viewSummary, type ViewSetting } from '../../components/ViewSetting'
import { Switch, SwitchListRow } from '../../components/Switch'
import { IconChevronRight, IconWarning } from '../../components/icons'
import { useAllCategories, useMyPrefs, useSaveArea, useSaveCategory, type MyCategory } from './useMyCategories'
import { categoryView, hasOwn, isOn, switched, type Prefs } from './view'

/**
 * Profile · My categories (OT-118; no board draws it). Every role picks, per area and per
 * category, whether it shows on their lists and, for the Support Team, whether the shared
 * pool notifies them. Each area is an All row with its categories folded under it (OT-120).
 * Each row's switch turns it on or off at once (OT-119, from feedback); a category's text
 * opens a sheet with the two settings and Save, for the in-between choices. A category with nothing of its own follows its area, and a setting
 * saved the same as its area's goes back to following it. Notify shows only where the pool
 * reaches the person (the Ops role, OT-116): Reporters get it with 6b's tasks from the
 * Support Team. Under View as, the rows only show.
 */
type Editing = { area: Area; category?: MyCategory }

export function MyCategoriesScreen() {
  const { user, viewingAs } = useUser()
  const prefs = useMyPrefs()
  const categories = useAllCategories()
  const [editing, setEditing] = useState<Editing | null>(null)
  const withNotify = user.role === 'ops'
  const saveArea = useSaveArea()
  const saveCategory = useSaveCategory()
  const toast = useToast()
  const failedToSave = () => toast.show('Couldn’t save that. Check your connection and try again.')

  const failed = prefs.isError || categories.isError
  const ready = prefs.data && categories.data

  return (
    <Screen>
      <TitleBar to="/profile" label="Back to profile" title="My categories" />

      {failed ? (
        <ScreenEmpty>
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load your categories"
            body="Check your connection and try again."
          >
            <Button
              variant="small"
              className="w-full"
              onClick={() => void Promise.all([prefs.refetch(), categories.refetch()])}
            >
              Try again
            </Button>
          </EmptyState>
        </ScreenEmpty>
      ) : (
        <ScreenBody className="gap-3 pb-5 pt-4">
          <p className="text-14 leading-[1.5] text-text-secondary">
            {withNotify
              ? 'Choose which tickets notify you and which show on your lists. '
              : 'Choose which tickets show on your lists. '}
            {withNotify
              ? 'A ticket you filed or are working on always reaches you and always shows.'
              : 'A ticket you filed or are working on always shows.'}
          </p>
          {!ready ? (
            <CardFeedSkeleton label="Loading your categories" />
          ) : (
            AREAS.map((area) => (
              <AreaGroup
                key={area}
                area={area}
                prefs={prefs.data}
                categories={categories.data.filter((c) => c.area === area && (c.active || hasOwn(prefs.data, c.id)))}
                withNotify={withNotify}
                readOnly={viewingAs === true}
                onEdit={setEditing}
                onSwitchArea={(view) => saveArea.mutate({ area, view }, { onError: failedToSave })}
                onSwitchCategory={(category, view) =>
                  saveCategory.mutate({ prefs: prefs.data, category, view }, { onError: failedToSave })
                }
              />
            ))
          )}
        </ScreenBody>
      )}

      {editing && prefs.data && (
        <SettingSheet
          key={editing.category?.id ?? editing.area}
          editing={editing}
          prefs={prefs.data}
          withNotify={withNotify}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  )
}

/**
 * One area: its All row, whose switch turns the whole area on or off and whose text opens
 * and closes its categories, closed to begin with (OT-120, from feedback). While closed, the
 * subtitle says how many categories are set on their own, so none is lost behind the fold.
 * Open, each category's text opens its sheet and its switch saves at once (OT-119). The
 * area's in-between choices are a last row for the Support Team; anyone else has only Show,
 * which the switch already is. Under View as, the groups still open and nothing changes.
 */
function AreaGroup({
  area,
  prefs,
  categories,
  withNotify,
  readOnly,
  onEdit,
  onSwitchArea,
  onSwitchCategory,
}: {
  area: Area
  prefs: Prefs
  categories: MyCategory[]
  withNotify: boolean
  readOnly: boolean
  onEdit: (editing: Editing) => void
  onSwitchArea: (view: ViewSetting) => void
  onSwitchCategory: (category: MyCategory, view: ViewSetting) => void
}) {
  const [open, setOpen] = useState(false)
  const areaView = prefs.areas[area]
  const own = categories.filter((c) => hasOwn(prefs, c.id)).length
  const ownLine = own === 0 ? '' : ` · ${own} set on ${own === 1 ? 'its' : 'their'} own`

  return (
    <section aria-label={AREA_LABEL[area]} className="flex flex-none flex-col gap-2">
      <SectionLabel className="-mb-0.5">{AREA_LABEL[area]}</SectionLabel>
      <ListCard>
        <SwitchListRow
          title="All"
          subtitle={`${viewSummary(areaView, withNotify)}${ownLine}`}
          expanded={open}
          onOpen={() => setOpen(!open)}
          label={`All of ${AREA_LABEL[area]}`}
          checked={isOn(areaView, withNotify)}
          disabled={readOnly}
          onCheckedChange={(on) => onSwitchArea(switched(areaView, on, withNotify))}
        />
        {open &&
          categories.map((c) => {
            const view = categoryView(prefs, c.id, area)
            const title = c.active ? c.name : `${c.name} (turned off)`
            const subtitle = hasOwn(prefs, c.id) ? viewSummary(view, withNotify) : `Same as ${AREA_LABEL[area]}`
            return readOnly ? (
              <ListRow
                key={c.id}
                title={title}
                subtitle={subtitle}
                trailing={<Switch label={title} checked={isOn(view, withNotify)} disabled onCheckedChange={() => {}} />}
              />
            ) : (
              <SwitchListRow
                key={c.id}
                title={title}
                subtitle={subtitle}
                onOpen={() => onEdit({ area, category: c })}
                label={title}
                checked={isOn(view, withNotify)}
                onCheckedChange={(on) => onSwitchCategory(c, switched(view, on, withNotify))}
              />
            )
          })}
        {open && withNotify && !readOnly && (
          <ListRowButton
            title={`More settings for all of ${AREA_LABEL[area]}`}
            subtitle="Urgent only, or shown without notifying"
            onClick={() => onEdit({ area })}
            trailing={<IconChevronRight size={16} className="text-text-muted" />}
          />
        )}
      </ListCard>
    </section>
  )
}

/** An area's or a category's two settings, saved together. */
function SettingSheet({
  editing: { area, category },
  prefs,
  withNotify,
  onClose,
}: {
  editing: Editing
  prefs: Prefs
  withNotify: boolean
  onClose: () => void
}) {
  const saveArea = useSaveArea()
  const saveCategory = useSaveCategory()
  const toast = useToast()
  const [view, setView] = useState<ViewSetting>(category ? categoryView(prefs, category.id, area) : prefs.areas[area])
  const name = category?.name ?? AREA_LABEL[area]
  const own = category ? hasOwn(prefs, category.id) : false
  const failed = saveArea.isError || saveCategory.isError
  const saved = () => {
    toast.show(`${name} saved.`)
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (category) saveCategory.mutate({ prefs, category, view }, { onSuccess: saved })
    else saveArea.mutate({ area, view }, { onSuccess: saved })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={name}
      description={
        category
          ? `In ${AREA_LABEL[area]}. A setting left the same as ${AREA_LABEL[area]}’s follows it when that changes.`
          : `Every ${AREA_LABEL[area]} category follows this, apart from any you set on its own.`
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <ViewSettingFields label={name} value={view} onChange={setView} withNotify={withNotify} />
        {failed && (
          <span role="alert" className="text-13 font-semibold text-danger">
            Couldn&apos;t save that. Check your connection and try again.
          </span>
        )}
        <Button
          type="submit"
          loading={saveArea.isPending || (saveCategory.isPending && saveCategory.variables?.view !== null)}
        >
          Save
        </Button>
        {category && own && (
          <Button
            type="button"
            variant="secondary"
            loading={saveCategory.isPending && saveCategory.variables?.view === null}
            onClick={() => saveCategory.mutate({ prefs, category, view: null }, { onSuccess: saved })}
          >
            Same as {AREA_LABEL[area]}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </form>
    </Sheet>
  )
}
