// @card EmptyState Feedback 610
import React from 'react'
import { Button, EmptyState, IconPlus, IconSearchOff, IconUserPlus } from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <div className="flex rounded-card border border-border">
      <EmptyState
        icon={<IconUserPlus size={30} />}
        title="It's just you so far"
        body="Invite managers and Ops so they can create and work tickets."
      >
        <Button variant="medium" className="w-full" icon={<IconPlus size={18} />}>
          Invite people
        </Button>
      </EmptyState>
    </div>
    <div className="flex rounded-card border border-border">
      <EmptyState
        tone="neutral"
        titleSize={20}
        icon={<IconSearchOff size={30} />}
        title='No open tickets match "freezer"'
        body="Try a unit's name or a ticket number."
      >
        <Button variant="small" className="w-full">
          Clear search
        </Button>
      </EmptyState>
    </div>
  </>,
)
