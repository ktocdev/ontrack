// @card OpsTicketCard Tickets 500
import React, { useState } from 'react'
import { OpsTicketCard } from 'ontrack'
import { mount } from './_shared'

function Demo() {
  const [now] = useState(() => new Date().toISOString())
  return (
    <>
      <OpsTicketCard
        to="#"
        displayId="OT-1042"
        title="Walk-in cooler not holding temp"
        status="in_progress"
        urgent
        walkthrough
        meta="BOH · Refrigeration · 1h ago"
        worker="Bert Velilla"
      />
      <OpsTicketCard
        to="#"
        displayId="OT-0988"
        title="Door gasket torn"
        status="reopened"
        meta="BOH · Refrigeration · 2h ago"
      />
      <OpsTicketCard
        to="#"
        displayId="OT-1051"
        title="Ice machine leaking"
        status="open"
        meta="BOH · Refrigeration · just now"
        createdAt={now}
      />
      <OpsTicketCard
        to="#"
        displayId="OT-1042"
        title="Walk-in cooler not holding temp"
        status="in_progress"
        urgent
        restaurant={{ name: 'Federale’s Logan Square', color: 'var(--restaurant-federales-logan)' }}
        meta="BOH · Refrigeration · Bert Velilla"
      />
    </>
  )
}
mount(<Demo />)
