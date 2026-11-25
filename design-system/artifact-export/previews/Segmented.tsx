// @card Segmented Choices 140
import React, { useState } from 'react'
import { Segmented } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [v, setV] = useState<'all' | 'foh' | 'boh'>('all')
  return (
    <>
      <Segmented
        label="Area"
        value={v}
        onChange={setV}
        options={[
          { value: 'all', label: 'All · 5' },
          { value: 'foh', label: 'Front · 2' },
          { value: 'boh', label: 'Back · 3' },
        ]}
      />
      <Segmented
        label="Area, small"
        size="sm"
        value={v}
        onChange={setV}
        options={[
          { value: 'all', label: 'All' },
          { value: 'foh', label: 'Front' },
          { value: 'boh', label: 'Back' },
        ]}
      />
    </>
  )
}
mount(<Demo />)
