// @card TabBar Navigation 320
import React from 'react'
import { TabBar, SectionLabel, ROLE_TABS } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    {(['manager', 'ops', 'leadership'] as const).map((role) => (
      <div key={role} className="border-b border-border">
        <SectionLabel>{ROLE_TABS[role].label}</SectionLabel>
        <TabBar label={ROLE_TABS[role].label} items={ROLE_TABS[role].items} inset={false} />
      </div>
    ))}
  </>,
  { pad: false },
)
