import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink } from '../../components/Button'
import { FilterButton, FilterChip } from '../../components/Chip'
import { EmptyState } from '../../components/EmptyState'
import { EquipmentGroup, EquipmentRow } from '../../components/Equipment'
import { SearchField } from '../../components/Field'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { IconPlus, IconWarning, IconWrench } from '../../components/icons'
import { useRestaurantOrder } from '../ops/useRestaurantOrder'
import { useRestaurantScope } from '../ops/useRestaurantScope'
import { money } from '../tickets/closed'
import { EquipmentFilterSheet } from './EquipmentFilterSheet'
import {
  filterCount,
  groupByType,
  matchesFilters,
  matchesSearch,
  NO_FILTERS,
  RETIRED_CARD,
  typeNames,
  type Filters,
} from './equipment'
import { useEquipmentList } from './useEquipmentList'

/**
 * Ops · Equipment list (from design/screens/Ops-Equipment-List). The units in service
 * at the picker's restaurants, a card per type, all closed on arriving and then one open
 * at a time (from feedback, Nov 5, 2026), each row with its restaurant, brand and
 * serial, this year's spend (only with see_costs) and its open tickets. Search finds a
 * name, brand or serial, and both a search and a type filter open every card they
 * leave. The filter sheet has area and type; the picker is the restaurant filter.
 * Retired units sit in a closed Retired card at the bottom, so one can be found and
 * restored (OT-71); search and the filters reach them too. Under View as, nothing leads
 * anywhere and Add equipment is gone.
 */
export function OpsEquipmentScreen() {
  const { restaurants, viewingAs } = useUser()
  const scope = useRestaurantScope()
  const { ordered } = useRestaurantOrder()
  const [year] = useState(() => new Date().getFullYear())
  const { data, isPending, isError, refetch } = useEquipmentList(scope.ids, year, true)
  const seeCosts = useRight('see_costs')
  const canAdd = useRight('edit_equipment') && !viewingAs

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtering, setFiltering] = useState(false)
  // One card open at a time, none to begin with (from feedback). A search or a type filter
  // opens every card it leaves, and each can still be closed.
  const [openName, setOpenName] = useState<string | null>(null)
  const [closed, setClosed] = useState<string[]>([])

  const expandAll = query.trim() !== '' || filters.types.length > 0
  const all = data ?? []
  const units = all.filter((u) => !u.retired)
  const matches = (u: (typeof all)[number]) => matchesFilters(u, filters) && matchesSearch(u, query)
  const shown = units.filter(matches)
  const retired = all.filter((u) => u.retired && matches(u))
  const groups = groupByType(shown)
  const restaurantOf = new Map(restaurants.map((r) => [r.id, r]))
  const isOpen = (name: string) => (expandAll ? !closed.includes(name) : openName === name)
  const toggle = (name: string) => {
    if (expandAll) setClosed((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]))
    else setOpenName(isOpen(name) ? null : name)
  }
  const search = (q: string) => {
    setQuery(q)
    setClosed([])
  }
  const filter = (f: Filters) => {
    setFilters(f)
    setClosed([])
  }
  const clearAll = () => {
    filter(NO_FILTERS)
    search('')
  }

  const where = scope.selected ? `at ${scope.selected.name}` : `across your ${restaurants.length} restaurants`
  const count = filterCount(filters)
  const chips = [
    ...(filters.area
      ? [
          {
            label: filters.area === 'foh' ? 'Front of House' : 'Back of House',
            remove: () => filter({ ...filters, area: null }),
          },
        ]
      : []),
    ...filters.types.map((t) => ({
      label: t,
      remove: () => filter({ ...filters, types: filters.types.filter((x) => x !== t) }),
    })),
  ]
  const empty = !isPending && !isError && all.length === 0
  const row = (u: (typeof all)[number]) => {
    const r = restaurantOf.get(u.restaurant_id)
    return (
      <EquipmentRow
        key={u.id}
        to={viewingAs ? undefined : `/ops/equipment/${u.id}`}
        name={u.name}
        restaurant={r && { name: r.name, color: r.color }}
        brand={u.brand}
        serial={u.serial}
        spend={seeCosts ? { amount: u.spendCents ? money(u.spendCents) : null, year } : undefined}
        openCount={u.openCount}
      />
    )
  }

  return (
    <Screen>
      <ScreenHeader
        title="Equipment"
        topLeft={
          <RestaurantPicker
            restaurants={ordered}
            selectedId={scope.selected?.id ?? null}
            onSelect={scope.select}
            heading="Show equipment for"
          />
        }
        topRight={<ProfileLink />}
        action={
          canAdd ? (
            <ButtonLink
              to="/ops/equipment/new"
              variant="compact"
              aria-label="Add equipment"
              icon={<IconPlus size={18} strokeWidth={2.4} />}
              className="gap-1.5 px-3.5 text-14"
            >
              Add
            </ButtonLink>
          ) : undefined
        }
      >
        {!empty && !isError && (
          <>
            <div className="flex gap-2">
              <SearchField
                label="Search equipment"
                placeholder="Name, brand or serial"
                value={query}
                onChange={(e) => search(e.target.value)}
                onClear={() => search('')}
                className="min-w-0 flex-1"
              />
              <FilterButton count={count} onClick={() => setFiltering(true)} />
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <FilterChip key={c.label} label={c.label} onRemove={c.remove} />
                ))}
              </div>
            )}
          </>
        )}
      </ScreenHeader>

      {isError ? (
        <EmptyState
          tone="neutral"
          titleSize={20}
          icon={<IconWarning size={30} />}
          title="We couldn't load equipment"
          body="Check your connection and try again."
        >
          <Button variant="small" className="w-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </EmptyState>
      ) : empty ? (
        <EmptyState
          titleSize={20}
          icon={<IconWrench size={30} />}
          title="No equipment yet"
          body={`Nothing has been added ${where}. Once it is, it shows up here, grouped by type.`}
        />
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {isPending ? (
            <GroupedListSkeleton />
          ) : groups.length + retired.length === 0 ? (
            <div className="px-3 py-7 text-center text-14 leading-normal text-text-body">
              {count ? 'No equipment matches these filters.' : `No equipment matches “${query.trim()}”.`}
              <br />
              <Button variant="ghost" className="mt-1.5" onClick={clearAll}>
                {count ? 'Clear filters' : 'Clear search'}
              </Button>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <EquipmentGroup
                  key={g.name}
                  name={g.name}
                  count={g.units.length}
                  openCount={g.openCount}
                  open={isOpen(g.name)}
                  onToggle={() => toggle(g.name)}
                >
                  {g.units.map(row)}
                </EquipmentGroup>
              ))}
              {retired.length > 0 && (
                <EquipmentGroup
                  name="Retired"
                  count={retired.length}
                  openCount={0}
                  open={isOpen(RETIRED_CARD)}
                  onToggle={() => toggle(RETIRED_CARD)}
                >
                  {[...retired].sort((a, b) => a.name.localeCompare(b.name)).map(row)}
                </EquipmentGroup>
              )}
            </>
          )}
        </ScreenBody>
      )}
      <EquipmentFilterSheet
        open={filtering}
        onOpenChange={setFiltering}
        filters={filters}
        onChange={filter}
        types={typeNames(units)}
        shown={shown.length}
      />
    </Screen>
  )
}
