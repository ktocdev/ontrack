// @card RadioCard Choices 160
import React, { useState } from 'react'
import { RadioCard } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [v, setV] = useState(0)
  return (
    <div role="radiogroup" aria-label="Role" className="flex flex-col gap-2">
      <RadioCard
        checked={v === 0}
        title="Restaurant manager"
        subtitle="Creates tickets for their restaurant(s)"
        onSelect={() => setV(0)}
      />
      <RadioCard
        checked={v === 1}
        title="Operations manager"
        subtitle="Works tickets, logs costs and contractors"
        onSelect={() => setV(1)}
      />
    </div>
  )
}
mount(<Demo />)
