// @card ViewSettingFields Choices 260
import React, { useState } from 'react'
import { Card, ViewSettingFields, viewSummary } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [view, setView] = useState<{ notify: 'all' | 'urgent' | 'off'; shown: boolean }>({
    notify: 'urgent',
    shown: false,
  })
  return (
    <Card className="flex flex-col gap-1.5 px-3.5 py-3">
      <span className="text-14 font-semibold">Front of House</span>
      <span className="text-12 text-text-muted">{viewSummary(view)}</span>
      <ViewSettingFields label="Front of House" value={view} onChange={setView} />
    </Card>
  )
}
mount(<Demo />)
