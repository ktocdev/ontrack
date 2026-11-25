// @card RestaurantGroup Tickets 570
import React, { useState } from 'react'
import { OpsTicketCard, RestaurantGroup } from 'ontrack'
import { mount, R } from './_shared'

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
const GROUPS = [
  [
    card('OT-1042', 'Walk-in cooler not holding temp', true, 'in_progress'),
    card('OT-1051', 'Ice machine leaking'),
    card('OT-1047', 'Hood light out'),
  ],
  [card('OT-1044', 'Dish machine not reaching rinse temp', true), card('OT-1049', 'Booth 12 upholstery torn')],
  [card('OT-1050', 'Patio heater won’t light')],
]
function Demo() {
  const [open, setOpen] = useState<number[]>([1])
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))
  return (
    <>
      {GROUPS.map((items, i) => (
        <RestaurantGroup
          key={i}
          name={R[i]!.name}
          color={R[i]!.color}
          open={open.includes(i)}
          onToggle={() => toggle(i)}
          openCount={items.length}
          urgentCount={items.filter((x) => x.pinned).length}
          items={items}
        />
      ))}
    </>
  )
}
mount(<Demo />)
