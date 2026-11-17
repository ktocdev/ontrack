import { useState } from 'react'
import { AREAS, AREA_LABEL } from '../../app/areas'
import { Button } from '../../components/Button'
import { ListCard, ListRow, ListRowButton } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { RoleTag } from '../../components/Pill'
import { BackBar, Screen, ScreenBody, SectionLabel } from '../../components/Screen'
import { PeopleListSkeleton } from '../../components/Skeleton'
import { viewSummary } from '../../components/ViewSetting'
import { IconChevronRight, IconPlus, IconWarning } from '../../components/icons'
import { AddJobTitleSheet, JobTitleSheet } from './JobTitleSheets'
import { useCanEditJobTitles, useManagedJobTitles, type ManagedJobTitle, type StartingView } from './useJobTitles'

/** "Starts with everything on", or each area that starts otherwise. */
export function startingViewLine(view: StartingView) {
  const changed = AREAS.filter((a) => view[a].notify !== 'all' || !view[a].shown)
  if (changed.length === 0) return 'Starts with everything on'
  return changed.map((a) => `${AREA_LABEL[a]}: ${viewSummary(view[a])}`).join(' · ')
}

/**
 * Admin · Job titles (OT-117; no board draws it, so it follows Trades). The group's list of
 * what people are called, opened from Users. The titles on, in the list's order, then the
 * turned-off ones under their own label. A row opens a sheet to edit its name and starting
 * view, turn it off or on, or delete one nobody has. Under View as it is the list only.
 */
export function JobTitlesScreen() {
  const canEdit = useCanEditJobTitles()
  const { data, isPending, isError, refetch } = useManagedJobTitles()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<ManagedJobTitle | null>(null)

  const on = (data ?? []).filter((t) => t.active)
  const off = (data ?? []).filter((t) => !t.active)
  const row = (t: ManagedJobTitle) => {
    const subtitle = startingViewLine(t.view)
    const trailing = !t.active && <RoleTag>Off</RoleTag>
    return canEdit ? (
      <ListRowButton
        key={t.id}
        onClick={() => setSelected(t)}
        title={t.name}
        subtitle={subtitle}
        trailing={
          <span className="flex items-center gap-2">
            {trailing}
            <IconChevronRight className="text-text-muted" />
          </span>
        }
      />
    ) : (
      <ListRow key={t.id} title={t.name} subtitle={subtitle} trailing={trailing || undefined} />
    )
  }

  return (
    <Screen>
      <BackBar to="/admin/users" label="Back to users">
        Users
      </BackBar>
      <ScreenBody className="gap-3.5 pb-6 pt-1">
        <div className="flex flex-none items-center justify-between gap-3">
          <h1 className="font-display text-30 font-bold tracking-[-0.02em]">Job titles</h1>
          {canEdit && (
            <Button
              variant="compact"
              aria-label="Add job title"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
              onClick={() => setAdding(true)}
            >
              Add
            </Button>
          )}
        </div>
        <p className="flex-none text-14 leading-normal text-text-secondary">
          What people are called, shown beside their name. A title grants nothing; each starts people on a view of the
          categories, which they can change.
        </p>
        {isError ? (
          <EmptyState
            tone="neutral"
            titleSize={20}
            icon={<IconWarning size={30} />}
            title="We couldn't load job titles"
            body="Check your connection and try again."
          >
            <Button variant="small" className="w-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </EmptyState>
        ) : isPending ? (
          <PeopleListSkeleton count={4} />
        ) : (
          <>
            {on.length > 0 ? (
              <ListCard>{on.map(row)}</ListCard>
            ) : (
              <p className="px-3 py-7 text-center text-14 text-text-body">No job titles turned on.</p>
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
      <AddJobTitleSheet open={adding} onOpenChange={setAdding} />
      {selected && <JobTitleSheet title={selected} onClose={() => setSelected(null)} />}
    </Screen>
  )
}
