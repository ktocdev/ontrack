// @card TaskRow Equipment 680
import React from 'react'
import { FixRow, TaskList, TaskListEmpty, TaskRow, WalkthroughTag, useToast } from 'ontrack'
import { mount, R } from './_shared'

function Demo() {
  const toast = useToast()
  return (
    <>
      <TaskList>
        <TaskRow
          title="Replace 2 bulbs over booths 4–6"
          meta="Oct walkthrough · FOH › Electrical › Light bulbs"
          tag={<WalkthroughTag />}
          done={false}
          onToggle={() => toast.show('Checked off.')}
          onDelete={() => toast.show('Deleted.')}
        />
        <TaskRow
          title="Replace the bulb over table 4"
          note="It’s the 2-pin kind, spares are in the office."
          meta="From Bert · Nov 18 · Pendant light, bar"
          from={{ label: 'Handed back from OT-1042', to: '#' }}
          done={false}
          onToggle={() => toast.show('Checked off.')}
          onDelete={() => toast.show('Deleted.')}
        />
        <TaskRow
          title="Re-glue trim on pass shelf"
          meta="Oct walkthrough · BOH › Feature · Completed"
          tag={<WalkthroughTag />}
          done
          onToggle={() => toast.show('Unchecked.')}
        />
      </TaskList>
      <TaskList>
        <FixRow
          title="Replace 2 bulbs over booths 4–6"
          where="FOH › Electrical › Light bulbs"
          meta="Added Oct 23 by Maya"
          state={{ kind: 'open' }}
          onConvert={() => toast.show('Convert to ticket.')}
        />
        <FixRow
          title="Tighten wobbly 2-top at table 14"
          where="FOH › Aesthetics › Surfaces and seating"
          meta="Converted by you · Added Oct 23 by Maya"
          restaurant={R[3]}
          state={{ kind: 'ticket', displayId: 'OT-1058', to: '#' }}
        />
      </TaskList>
      <TaskListEmpty>Nothing left to fix. Checked-off tasks are under Closed.</TaskListEmpty>
    </>
  )
}
mount(<Demo />)
