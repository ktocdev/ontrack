// @card StatusMenu Overlays 300
import React from 'react'
import { StatusMenu, useToast } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const toast = useToast()
  return (
    <StatusMenu
      value="in_progress"
      valueLabel="In progress"
      options={['open', 'in_progress', 'waiting_parts', 'scheduled']}
      onPick={() => toast.show('Status picked.')}
      actions={[
        { label: 'Take this over', onSelect: () => toast.show('Taken.') },
        { label: 'Close ticket', onSelect: () => toast.show('Closing.') },
      ]}
    />
  )
}
mount(<Demo />)
