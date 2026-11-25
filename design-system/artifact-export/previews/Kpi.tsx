// @card Kpi Figures 370
import React from 'react'
import { Kpi } from 'ontrack'
import { mount } from './_shared'

mount(
  <div className="grid grid-cols-2 gap-2">
    <Kpi size="large" value="14" label="Open tickets" to="#" />
    <Kpi size="large" value="3" label="Urgent" tone="urgent" />
    <Kpi size="large" value="$2,418.60" label="Spend · October" />
    <Kpi size="large" value="No data" label="Avg. time to close" tone="muted" />
    <Kpi wide value="$4,812.00" label="Spend · 2026" />
    <Kpi value="11" label="Visits · 2026" />
    <Kpi size="small" value="Oct 19, 2026" label="Last visit" />
  </div>,
)
