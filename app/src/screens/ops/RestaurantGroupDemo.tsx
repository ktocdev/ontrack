import { useState } from 'react'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { RestaurantGroup } from '../../components/RestaurantGroup'

/**
 * The dashboard's restaurant rows for /kit and the design-system docs: the first starts
 * closed with its urgent ticket showing, the second open, and the third has nothing urgent.
 * Tapping a row opens or closes it, as on the dashboard.
 */
export function RestaurantGroupDemo({ restaurants }: { restaurants: { name: string; color: string }[] }) {
  const [open, setOpen] = useState<number[]>([1])
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))
  const card = (id: string, title: string, urgent = false, status: 'open' | 'in_progress' = 'open') => ({
    key: id,
    pinned: urgent,
    node: (
      <OpsTicketCard
        to="#"
        displayId={id}
        title={title}
        status={status}
        urgent={urgent}
        meta="BOH · Refrigeration · 2h ago"
      />
    ),
  })
  const groups = [
    [
      card('OT-1042', 'Walk-in cooler not holding temp', true, 'in_progress'),
      card('OT-1051', 'Ice machine leaking'),
      card('OT-1047', 'Hood light out'),
    ],
    [card('OT-1044', 'Dish machine not reaching rinse temp', true), card('OT-1049', 'Booth 12 upholstery torn')],
    [card('OT-1050', 'Patio heater won’t light')],
  ]
  return (
    <div className="flex flex-col gap-5">
      {groups.map((items, i) => {
        const r = restaurants[i % restaurants.length]!
        return (
          <RestaurantGroup
            key={i}
            name={r.name}
            color={r.color}
            open={open.includes(i)}
            onToggle={() => toggle(i)}
            openCount={items.length}
            urgentCount={items.filter((x) => x.pinned).length}
            items={items}
          />
        )
      })}
    </div>
  )
}
