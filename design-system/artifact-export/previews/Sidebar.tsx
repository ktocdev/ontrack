// @card Sidebar Navigation 390
import React from 'react'
import { SidebarBrand, SidebarLink, SidebarProfile, ROLE_TABS } from 'ontrack'
import { mount } from './_shared'

mount(
  <div className="flex w-[248px] flex-col gap-6 border-r border-border bg-surface py-4">
    <div className="px-3">
      <SidebarBrand group="Your restaurant group" />
    </div>
    <nav aria-label="Sidebar sample" className="flex flex-col gap-0.5 px-2">
      {ROLE_TABS.ops.items.map(({ to, label, icon }, i) => (
        <SidebarLink key={to} to="#" icon={icon} inert current={i === 0}>
          {label}
        </SidebarLink>
      ))}
    </nav>
    <div className="px-2">
      <SidebarProfile to="#" name="Rosa Delgado" role="ops" subtitle="Ops manager" />
    </div>
  </div>,
)
