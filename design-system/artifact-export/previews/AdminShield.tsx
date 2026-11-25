// @card AdminShield Navigation 80
import React from 'react'
import { AdminShield } from 'ontrack'
import { mount } from './_shared'

mount(
  <div className="flex items-center gap-3">
    <AdminShield to="#" active={false} />
    <AdminShield to="#" active />
  </div>,
)
