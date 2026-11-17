import { useState, type FormEvent } from 'react'
import { AREAS, AREA_LABEL, type Area } from '../../app/areas'
import { useUser } from '../../auth/context'
import { Button } from '../../components/Button'
import { ListCard, ListRow } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Screen, ScreenBody, ScreenEmpty, SectionLabel, TitleBar } from '../../components/Screen'
import { Sheet } from '../../components/Sheet'
import { CardFeedSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { ViewSettingFields, viewSummary, type ViewSetting } from '../../components/ViewSetting'
import { Switch, SwitchListRow } from '../../components/Switch'
import { IconWarning } from '../../components/icons'
import { useAllCategories, useMyPrefs, useSaveArea, useSaveCategory, type MyCategory } from './useMyCategories'
import { categoryView, hasOwn, isOn, switched, type Prefs } from './view'

/**
 * Profile · My categories (OT-118; no board draws it). Every role picks, per area and per
 * category, whether it shows on their lists and, for the Support Team, whether the shared
 * pool notifies them. A row per area, then its categories. Each row's switch turns it on or
 * off at once (OT-119, from feedback); its text opens a sheet with the two settings and
 * Save, for the in-between choices. A category with nothing of its own follows its area, and a setting
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
            AREAS.map((area) => {
              const inArea = categories.data.filter((c) => c.area === area && (c.active || hasOwn(prefs.data, c.id)))
              const areaView = prefs.data.areas[area]
              return (
                <section key={area} aria-label={AREA_LABEL[area]} className="flex flex-none flex-col gap-2">
                  <SectionLabel className="-mb-0.5">{AREA_LABEL[area]}</SectionLabel>
                  <ListCard>
                    <Row
                      title={`All of ${AREA_LABEL[area]}`}
                      subtitle={viewSummary(areaView, withNotify)}
                      on={isOn(areaView, withNotify)}
                      onOpen={viewingAs ? undefined : () => setEditing({ area })}
                      onSwitch={(on) =>
                        saveArea.mutate({ area, view: switched(areaView, on, withNotify) }, { onError: failedToSave })
                      }
                    />
                    {inArea.map((c) => {
                      const view = categoryView(prefs.data, c.id, area)
                      return (
                        <Row
                          key={c.id}
                          title={c.active ? c.name : `${c.name} (turned off)`}
                          subtitle={
                            hasOwn(prefs.data, c.id) ? viewSummary(view, withNotify) : `Same as ${AREA_LABEL[area]}`
                          }
                          on={isOn(view, withNotify)}
                          onOpen={viewingAs ? undefined : () => setEditing({ area, category: c })}
                          onSwitch={(on) =>
                            saveCategory.mutate(
                              { prefs: prefs.data, category: c, view: switched(view, on, withNotify) },
                              { onError: failedToSave },
                            )
                          }
                        />
                      )
                    })}
                  </ListCard>
                </section>
              )
            })
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
 * The text opens the sheet and the switch saves at once (OT-119). Under View as there is
 * nothing to tap, and the switch only shows where the person stands.
 */
function Row({
  title,
  subtitle,
  on,
  onOpen,
  onSwitch,
}: {
  title: string
  subtitle: string
  on: boolean
  onOpen?: () => void
  onSwitch: (on: boolean) => void
}) {
  return onOpen ? (
    <SwitchListRow
      title={title}
      subtitle={subtitle}
      onOpen={onOpen}
      label={title}
      checked={on}
      onCheckedChange={onSwitch}
    />
  ) : (
    <ListRow
      title={title}
      subtitle={subtitle}
      trailing={<Switch label={title} checked={on} disabled onCheckedChange={() => {}} />}
    />
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
