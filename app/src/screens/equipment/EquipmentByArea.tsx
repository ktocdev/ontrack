import { useState, type ReactNode } from 'react'
import { AREA_LABEL } from '../../app/areas'
import { EquipmentGroup } from '../../components/Equipment'
import { GroupedListSkeleton } from '../../components/Skeleton'
import { groupByType, RETIRED_CARD, type Area, type Unit } from './equipment'

/**
 * Units browsed by area and then a card per type, every card closed to begin with and
 * then one open at a time (from feedback, Nov 5, 2026), retired units in a closed card at
 * the bottom. A Reporter's Equipment (OT-68) and leadership's restaurant (OT-144) share it;
 * each draws the area's Segmented where its board has room.
 */
export function useEquipmentByArea(units: Unit[], first: Area = 'foh') {
  const [area, setArea] = useState<Area>(first)
  const [openName, setOpenName] = useState<string | null>(null)
  const inArea = units.filter((u) => u.category?.area === area)
  return {
    area,
    pick: (a: Area) => {
      setArea(a)
      setOpenName(null)
    },
    groups: groupByType(inArea.filter((u) => !u.retired)),
    retired: inArea.filter((u) => u.retired).sort((a, b) => a.name.localeCompare(b.name)),
    isOpen: (name: string) => openName === name,
    toggle: (name: string) => setOpenName(openName === name ? null : name),
  }
}

export function EquipmentByArea({
  view,
  isPending,
  row,
}: {
  view: ReturnType<typeof useEquipmentByArea>
  isPending: boolean
  row: (unit: Unit) => ReactNode
}) {
  if (isPending) return <GroupedListSkeleton />
  return (
    <>
      {view.groups.length === 0 && (
        <p className="px-3 py-7 text-center text-14 leading-normal text-text-body">
          No {AREA_LABEL[view.area]} equipment yet.
        </p>
      )}
      {view.groups.map((g) => (
        <EquipmentGroup
          key={g.name}
          name={g.name}
          count={g.units.length}
          openCount={g.openCount}
          open={view.isOpen(g.name)}
          onToggle={() => view.toggle(g.name)}
        >
          {g.units.map(row)}
        </EquipmentGroup>
      ))}
      {view.retired.length > 0 && (
        <EquipmentGroup
          name="Retired"
          count={view.retired.length}
          openCount={0}
          open={view.isOpen(RETIRED_CARD)}
          onToggle={() => view.toggle(RETIRED_CARD)}
        >
          {view.retired.map(row)}
        </EquipmentGroup>
      )}
    </>
  )
}
