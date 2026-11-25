// @card CostCard Forms 440
import React from 'react'
import { CostCard } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <CostCard
      rows={[
        { label: 'Labor', value: '$120.00', onChange: () => undefined },
        { label: 'Parts', value: '$212.40', onChange: () => undefined },
        { label: 'Trip / call-out fee', value: '$65.00', onChange: () => undefined },
      ]}
      total="$397.40"
    />
    <CostCard
      rows={[
        { label: 'Labor', value: '$120.00', onChange: () => undefined },
        { label: 'Parts', value: '12.345', onChange: () => undefined, invalid: true },
      ]}
      total={null}
    />
  </>,
)
