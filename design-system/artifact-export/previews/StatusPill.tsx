// @card StatusPill Status 120
import React from 'react'
import { StatusPill, UrgentTag, WalkthroughTag, RoleTag, CountBadge, TabAlert } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <div className="flex flex-wrap gap-2">
      {(['open', 'in_progress', 'waiting_parts', 'scheduled', 'reopened', 'closed', 'fixed'] as const).map((s) => (
        <StatusPill key={s} status={s} />
      ))}
      <StatusPill status="scheduled" label="Scheduled Thu" />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <UrgentTag />
      <WalkthroughTag />
      <RoleTag>Manager</RoleTag>
      <RoleTag>Ops Manager</RoleTag>
      <CountBadge count={5} />
      <CountBadge count={5} active />
      <TabAlert count={1} label="1 reopened ticket" />
    </div>
  </>,
  { width: 'full' },
)
