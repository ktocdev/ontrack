// @card Toast Feedback 280
import React from 'react'
import { Button, useToast } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const toast = useToast()
  return (
    <>
      <Button variant="secondary" onClick={() => toast.show('Defaults updated. 3 people were notified.')}>
        Show toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.show('In-house task deleted.', { label: 'Undo', onClick: () => toast.show('Restored.') })}
      >
        Toast with an action
      </Button>
    </>
  )
}
mount(<Demo />)
