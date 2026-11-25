// @card UpdateBar Feedback 180
import React from 'react'
import { UpdateBar } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <UpdateBar fixed={false} updating={false} onUpdate={() => undefined} />
    <UpdateBar fixed={false} updating onUpdate={() => undefined} />
  </>,
)
