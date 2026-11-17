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
import { IconChevronRight, IconWarning } from '../../components/icons'
import { useAllCategories, useMyPrefs, useSaveArea, useSaveCategory, type MyCategory } from './useMyCategories'
import { categoryView, hasOwn, type Prefs } from './view'

/**
 * Profile · My categories (OT-118; no board draws it). Every role picks, per area and per
 * category, whether it shows on their lists and, for the Support Team, whether the shared
 * pool notifies them. A row per area, then its categories; each opens a sheet with the two
 * settings and Save. A category with nothing of its own follows its area, and a setting
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
              return (
                <section key={area} aria-label={AREA_LABEL[area]} className="flex flex-none flex-col gap-2">
                  <SectionLabel className="-mb-0.5">{AREA_LABEL[area]}</SectionLabel>
                  <ListCard>
                    <Row
                      title={`All of ${AREA_LABEL[area]}`}
                      subtitle={viewSummary(prefs.data.areas[area], withNotify)}
                      onOpen={viewingAs ? undefined : () => setEditing({ area })}
                    />
                    {inArea.map((c) => (
                      <Row
                        key={c.id}
                        title={c.active ? c.name : `${c.name} (turned off)`}
                        subtitle={
                          hasOwn(prefs.data, c.id)
                            ? viewSummary(categoryView(prefs.data, c.id, area), withNotify)
                            : `Same as ${AREA_LABEL[area]}`
                        }
                        onOpen={viewingAs ? undefined : () => setEditing({ area, category: c })}
                      />
                    ))}
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

function Row({ title, subtitle, onOpen }: { title: string; subtitle: string; onOpen?: () => void }) {
  return onOpen ? (
    <ListRowButton
      title={title}
      subtitle={subtitle}
      onClick={onOpen}
      trailing={<IconChevronRight className="text-text-muted" />}
    />
  ) : (
    <ListRow title={title} subtitle={subtitle} />
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
