// @card Notice Feedback 360
import React from 'react'
import { Notice, ErrorBanner } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <Notice>Profile saved.</Notice>
    <Notice tone="info">Closed tickets also appear on each piece of equipment, with their costs.</Notice>
    <Notice tone="waiting">
      <b>Reopened and sent to Ops.</b> You&apos;ll get a notification when work starts.
    </Notice>
    <Notice tone="warn">
      <b>30 of 50 checks are still to do.</b> You can submit now, or go back and finish them first.
    </Notice>
    <ErrorBanner title="Couldn't save yet.">Everything you entered is still here.</ErrorBanner>
  </>,
)
