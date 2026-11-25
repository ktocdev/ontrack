// @card Sheet Overlays 420
import React, { useState } from 'react'
import { Button, Sheet } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open sheet
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Save 2 changes?"
        description="Defaults change for everyone with these roles. People are notified."
      >
        <Button onClick={() => setOpen(false)}>Save changes</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </Sheet>
    </>
  )
}
mount(<Demo />)
