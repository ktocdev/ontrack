// @card OverflowMenu Overlays 220
import React from 'react'
import { OverflowMenu, TicketMenu, EquipmentMenu } from 'ontrack'
import { mount } from './_shared'

mount(
  <div className="flex items-center gap-2">
    <OverflowMenu
      label="More options"
      items={[
        { to: '#', label: 'View closed tickets' },
        { to: '#', label: 'Share link' },
      ]}
    />
    <TicketMenu displayId="OT-1042" title="Walk-in cooler not holding temp" />
    <EquipmentMenu id="pv" name="Walk-in Cooler 1" />
  </div>,
)
