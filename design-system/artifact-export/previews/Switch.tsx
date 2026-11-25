// @card Switch Choices 260
import React, { useState } from 'react'
import { Card, ListCard, Switch, SwitchRow, SwitchListRow } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [on, setOn] = useState(true)
  return (
    <>
      <div className="flex items-center gap-3">
        <Switch checked={on} onCheckedChange={setOn} label="Example" />
        <Switch checked={!on} onCheckedChange={(v) => setOn(!v)} label="Example inverse" />
      </div>
      <Card className="px-3.5">
        <SwitchRow
          title="Preferred contractor"
          subtitle="Shows first in the directory"
          checked={on}
          onCheckedChange={setOn}
          label="Preferred contractor"
        />
      </Card>
      <ListCard>
        <SwitchListRow
          title="All"
          subtitle="Notify off · Hidden · 1 set on its own"
          expanded={!on}
          onOpen={() => setOn(!on)}
          checked={false}
          onCheckedChange={() => undefined}
          label="All of Back of House"
        />
        <SwitchListRow
          title="Refrigeration"
          subtitle={on ? 'Notify all · Shown' : 'Notify off · Hidden'}
          onOpen={() => undefined}
          checked={on}
          onCheckedChange={setOn}
          label="Refrigeration"
        />
      </ListCard>
    </>
  )
}
mount(<Demo />)
