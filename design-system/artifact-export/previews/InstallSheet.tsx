// @card InstallSheet Overlays 460
import React, { useState } from 'react'
import { Button, InstallSheet } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [state, setState] = useState<'available' | 'ios-manual' | null>(null)
  return (
    <>
      <Button variant="secondary" onClick={() => setState('available')}>
        Install sheet (Android)
      </Button>
      <Button variant="secondary" onClick={() => setState('ios-manual')}>
        Install sheet (iPhone)
      </Button>
      <InstallSheet
        open={state !== null}
        onOpenChange={(o) => !o && setState(null)}
        state={state ?? 'available'}
        onInstall={() => setState(null)}
      />
    </>
  )
}
mount(<Demo />)
