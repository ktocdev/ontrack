import { useState } from 'react'
import { Button } from '../../components/Button'
import { ListCard, ListRow, ListRowButton } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RoleTag } from '../../components/Pill'
import { BackBar, Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { IconChevronRight, IconPlus, IconWarning } from '../../components/icons'
import { AddCategorySheet, CategorySheet } from './CategorySheets'
import { useCanEditCategories, useManagedCategories, type Area, type ManagedCategory } from './useCategoryAdmin'

/**
 * Categories (OT-86; no board draws it). The group's, shared by every restaurant, and
 * looked after by Ops with Add / edit equipment and by admins (decided Nov 6, 2026):
 * Ops opens it from the menu on Equipment, an admin from Restaurants. Front and Back
 * of House each list theirs in order, turned-off ones under their own label. A row
 * opens a sheet to rename it, turn it off or on, or delete one nothing has used.
 * Anyone else, and View as, sees the list only.
 */
export function OpsCategoriesScreen() {
  return <Categories back="/ops/equipment" backLabel="Back to equipment" crumb="Equipment" />
}

export function AdminCategoriesScreen() {
  return <Categories back="/admin/restaurants" backLabel="Back to restaurants" crumb="Restaurants" />
}

function Categories({ back, backLabel, crumb }: { back: string; backLabel: string; crumb: string }) {
  const canEdit = useCanEditCategories()
  const { data, isPending, isError, refetch } = useManagedCategories()
  const [area, setArea] = useState<Area>('foh')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<ManagedCategory | null>(null)

  const inArea = (data ?? []).filter((c) => c.area === area)
  const on = inArea.filter((c) => c.active)
  const off = inArea.filter((c) => !c.active)
  const row = (c: ManagedCategory) => {
    const subtitle = c.inUse ? undefined : 'Not used yet'
    const trailing = !c.active && <RoleTag>Off</RoleTag>
    return canEdit ? (
      <ListRowButton
        key={c.id}
        onClick={() => setSelected(c)}
        title={c.name}
        subtitle={subtitle}
        trailing={
          <span className="flex items-center gap-2">
            {trailing}
            <IconChevronRight className="text-text-muted" />
          </span>
        }
      />
    ) : (
      <ListRow key={c.id} title={c.name} subtitle={subtitle} trailing={trailing || undefined} />
    )
  }

  return (
    <Screen>
      <BackBar to={back} label={backLabel}>
        {crumb}
      </BackBar>
      <ScreenBody className="gap-3.5 pb-6 pt-1">
        <div className="flex flex-none items-center justify-between gap-3">
          <h1 className="font-display text-30 font-bold tracking-[-0.02em]">Categories</h1>
          {canEdit && (
            <Button
              variant="compact"
              aria-label="Add category"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => setAdding(true)}
            >
              Add
            </Button>
          )}
        </div>
        <p className="flex-none text-14 leading-normal text-text-secondary">
          Shared by every restaurant, in Create ticket and on the equipment form. Turning one off takes it out of both;
          tickets and equipment that use it keep it.
        </p>
        <Segmented<Area>
          label="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: 'foh', label: 'Front of House' },
            { value: 'boh', label: 'Back of House' },
          ]}
        />
        {isError ? (
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load categories"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        ) : isPending ? (
          <PeopleListSkeleton count={6} />
        ) : (
          <>
            {on.length > 0 ? (
              <ListCard>{on.map(row)}</ListCard>
            ) : (
              <p className="px-3 py-7 text-center text-14 text-text-body">No categories here yet.</p>
            )}
            {off.length > 0 && (
              <>
                <SectionLabel className="-mb-1.5">Turned off</SectionLabel>
                <ListCard>{off.map(row)}</ListCard>
              </>
            )}
          </>
        )}
      </ScreenBody>
      {/* Keyed by area, so it opens on the one being looked at. */}
      <AddCategorySheet key={area} open={adding} area={area} onOpenChange={setAdding} />
      {selected && <CategorySheet category={selected} onClose={() => setSelected(null)} />}
    </Screen>
  )
}
