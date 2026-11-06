import { useState } from 'react'
import { ProfileLink } from '../../app/ProfileLink'
import { useUser } from '../../auth/context'
import { useRight } from '../../auth/rights'
import { Button, ButtonLink } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { EquipmentGroup, EquipmentRow } from '../../components/Equipment'
import { AllRestaurantsSquare, RestaurantName } from '../../components/RestaurantName'
import { Screen, ScreenBody, ScreenHeader } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { IconPlus, IconWarning, IconWrench } from '../../components/icons'
import { groupByType, RETIRED_CARD, type Area } from './equipment'
import { useEquipmentList } from './useEquipmentList'

/**
 * Manager · Equipment (design/screens/Equipment-List, Empty-Manager-Equipment). The
 * units at the person's restaurants, browsed by Front / Back and then a card per type,
 * all closed on arriving and then one open at a time (from feedback, Nov 5, 2026). There is no search (from feedback, OT-68): a manager finds a
 * unit by browsing to it, so the board's search field and its no-results board are
 * left off. The board's scan button waits for QR labels (OT-74). It opens on Front of
 * House, as Create ticket does. Add equipment, which no manager board draws, is there
 * only with Add / edit equipment. A manager with more than one restaurant sees which
 * one each unit is at. With Add / edit equipment, the area's retired units sit in a closed
 * Retired card at the bottom, so one can be found and restored (OT-71). Under View as,
 * nothing leads anywhere.
 */
export function EquipmentScreen() {
  const { restaurants, viewingAs } = useUser()
  const editsEquipment = useRight('edit_equipment') === true
  const { data, isPending, isError, refetch } = useEquipmentList(
    restaurants.map((r) => r.id),
    null,
    editsEquipment,
  )
  const canAdd = editsEquipment && !viewingAs

  const [area, setArea] = useState<Area>('foh')
  // One card open at a time, none to begin with (from feedback, Nov 5, 2026).
  const [openName, setOpenName] = useState<string | null>(null)

  const only = restaurants.length === 1 ? restaurants[0] : undefined
  const restaurantOf = new Map(restaurants.map((r) => [r.id, r]))
  const all = data ?? []
  const inArea = all.filter((u) => u.category?.area === area)
  const groups = groupByType(inArea.filter((u) => !u.retired))
  const retired = inArea.filter((u) => u.retired).sort((a, b) => a.name.localeCompare(b.name))
  const isOpen = (name: string) => openName === name
  const toggle = (name: string) => setOpenName(isOpen(name) ? null : name)
  const pick = (a: Area) => {
    setArea(a)
    setOpenName(null)
  }
  const empty = !isPending && !isError && all.length === 0
  const row = (u: (typeof all)[number]) => {
    const r = only ? undefined : restaurantOf.get(u.restaurant_id)
    return (
      <EquipmentRow
        key={u.id}
        to={viewingAs ? undefined : `/equipment/${u.id}`}
        name={u.name}
        restaurant={r && { name: r.name, color: r.color }}
        brand={u.brand}
        serial={u.serial}
        openCount={u.openCount}
      />
    )
  }

  return (
    <Screen>
      <ScreenHeader
        title="Equipment"
        topLeft={
          only ? (
            <RestaurantName name={only.name} color={only.color} />
          ) : (
            <span className="flex items-center gap-1.5 text-14 font-semibold">
              <AllRestaurantsSquare colors={restaurants.map((r) => r.color)} />
              {restaurants.length} restaurants
            </span>
          )
        }
        topRight={<ProfileLink />}
        action={
          canAdd ? (
            <ButtonLink
              to="/equipment/new"
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
          <Segmented<Area>
            label="Area"
            value={area}
            onChange={pick}
            options={[
              { value: 'foh', label: 'Front of House' },
              { value: 'boh', label: 'Back of House' },
            ]}
          />
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
          body={
            <>
              Your operations team adds equipment. Once they do, it shows up here, grouped by area.
              <span className="mt-2.5 block text-13">You can still report a problem by area in the meantime.</span>
            </>
          }
        >
          {!viewingAs && (
            <ButtonLink to="/tickets/new" variant="small" icon={<IconPlus size={18} />} className="w-full">
              Create ticket by area
            </ButtonLink>
          )}
        </EmptyState>
      ) : (
        <ScreenBody className="gap-2.5 pb-4 pt-1">
          {isPending ? (
            <GroupedListSkeleton />
          ) : (
            <>
              {groups.length === 0 && (
                <p className="px-3 py-7 text-center text-14 leading-normal text-text-body">
                  No {area === 'foh' ? 'Front of House' : 'Back of House'} equipment yet.
                </p>
              )}
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
                  {retired.map(row)}
                </EquipmentGroup>
              )}
            </>
          )}
        </ScreenBody>
      )}
    </Screen>
  )
}
