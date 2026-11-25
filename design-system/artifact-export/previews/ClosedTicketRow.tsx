// @card ClosedTicketRow Tickets 220
import React from 'react'
import { Card, ClosedTicketRow, MonthHeading } from 'ontrack'
import { mount, R } from './_shared'

mount(
  <>
    <MonthHeading label="October · 9 closed" total="$2,418.60" />
    <Card className="overflow-hidden rounded-input">
      <ClosedTicketRow
        to="#"
        title="Ice machine scale buildup"
        displayId="OT-1036"
        restaurant={R[0]}
        date="Oct 17"
        cost="$310.00"
      />
      <ClosedTicketRow
        to="#"
        title="Booth 12 upholstery torn"
        displayId="OT-1028"
        restaurant={R[0]}
        date="Oct 15"
        cost="$420.00"
      />
    </Card>
  </>,
)
