// @card Chip Choices 210
import React, { useState } from 'react'
import { Chip, ChoiceChips, FilterButton, FilterChip } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [u, setU] = useState<'low' | 'normal' | 'urgent'>('normal')
  const [all, setAll] = useState(true)
  return (
    <>
      <ChoiceChips
        label="Urgency"
        value={u}
        onChange={setU}
        options={[
          { value: 'low', label: 'Low' },
          { value: 'normal', label: 'Normal' },
          { value: 'urgent', label: 'Urgent' },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Chip selected={all} onClick={() => setAll(true)}>
          All · 42
        </Chip>
        <Chip selected={!all} onClick={() => setAll(false)}>
          Pending · 3
        </Chip>
        <Chip tone="pick" selected={all} onClick={() => setAll(true)}>
          Porter
        </Chip>
        <Chip tone="pick" selected={false} disabled>
          Disabled
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton count={0} />
        <FilterButton count={2} />
        <FilterChip label="Back of House" onRemove={() => undefined} />
      </div>
    </>
  )
}
mount(<Demo />, { width: 'full' })
