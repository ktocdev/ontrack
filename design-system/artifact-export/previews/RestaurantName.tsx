// @card RestaurantName Restaurants 240
import React from 'react'
import { RestaurantName, RestaurantSquare, AllRestaurantsSquare } from 'ontrack'
import { mount, R } from './_shared'

mount(
  <>
    {R.map((r) => (
      <RestaurantName key={r.id} name={r.name} color={r.color} />
    ))}
    <RestaurantName name="Porter" color="var(--restaurant-porter)" variant="meta" />
    <span className="flex items-center gap-1.5 text-14 font-semibold">
      <AllRestaurantsSquare colors={R.map((r) => r.color)} />
      All restaurants (4)
    </span>
    <span className="flex items-center gap-3 text-15 font-semibold">
      <RestaurantSquare color="var(--restaurant-federales-logan)" size={14} />
      14px square, as on the Restaurants list
    </span>
  </>,
)
