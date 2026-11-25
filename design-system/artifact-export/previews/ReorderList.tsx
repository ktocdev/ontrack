// @card ReorderList Restaurants 390
import React, { useState } from 'react'
import { ReorderList } from 'ontrack'
import { mount, R } from './_shared'

function Demo() {
  const [order, setOrder] = useState(R.map((r) => r.id))
  return (
    <>
      <ReorderList
        label="Restaurants in order"
        items={order.map((id) => R.find((r) => r.id === id)!)}
        onChange={setOrder}
      />
      <ReorderList
        label="Items in order"
        items={[
          { id: 'k1', name: 'Outlets', detail: 'Electrical' },
          { id: 'k2', name: 'Floor drains', detail: 'Plumbing' },
        ]}
        onChange={() => {}}
      />
    </>
  )
}
mount(<Demo />)
