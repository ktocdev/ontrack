// @card RestaurantPicker Restaurants 380
import React, { useState } from 'react'
import { RestaurantPicker, RestaurantTitlePicker } from 'ontrack'
import { mount, R } from './_shared'

function Demo() {
  const [id, setId] = useState<string | null>(null)
  const [title, setTitle] = useState(R[0]!)
  return (
    <>
      <RestaurantPicker restaurants={R} selectedId={id} onSelect={setId} />
      <RestaurantPicker chip restaurants={R} selectedId={id} onSelect={setId} />
      <RestaurantTitlePicker
        restaurants={R}
        selected={title}
        onSelect={(id) => setTitle(R.find((r) => r.id === id) ?? R[0]!)}
      />
    </>
  )
}
mount(<Demo />)
