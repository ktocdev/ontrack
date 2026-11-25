// @card TicketCard Tickets 620
import React, { useState } from 'react'
import { TicketCard } from 'ontrack'
import { mount, R } from './_shared'

function Demo() {
  const [now] = useState(() => new Date().toISOString())
  return (
    <>
      <TicketCard
        to="#"
        displayId="OT-1042"
        title="Walk-in cooler not holding temp"
        status="in_progress"
        walkthrough
        place="Back of House · Refrigeration · Walk-in Cooler 1"
        who="Bert Velilla is on it"
        when="Updated 1h ago"
      />
      <TicketCard
        displayId="OT-1031"
        title="Bar sink draining slowly"
        status="scheduled"
        statusLabel="Scheduled Thu"
        place="Front of House · Plumbing · Bar sink 2"
        restaurant={R[3]}
        who="Not picked up yet"
        when="Created 3h ago"
      />
      <TicketCard
        to="#"
        displayId="OT-1051"
        title="Ice machine leaking"
        status="open"
        place="Back of House · Refrigeration · Ice machine"
        who="Not picked up yet"
        when="Created just now"
        createdAt={now}
      />
      <TicketCard
        to="#"
        displayId="OT-1037"
        title="Patio string lights out, east side"
        status="waiting_parts"
        place="FOH · Lighting · $86.00 logged"
      />
    </>
  )
}
mount(<Demo />)
