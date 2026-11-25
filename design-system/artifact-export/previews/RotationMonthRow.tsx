// @card RotationMonthRow Walkthrough 910
import React from 'react'
import {
  AddMonthRow,
  Button,
  DashedAddButton,
  QuarterTaskRow,
  RotationMonthRow,
  RotationTag,
  ScheduleNote,
  YearPreview,
} from 'ontrack'
import { mount } from './_shared'

const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
mount(
  <>
    <ScheduleNote kind="group">
      <b>Group schedule.</b> Every restaurant uses this unless it has its own.
    </ScheduleNote>
    <ScheduleNote
      kind="own"
      action={
        <Button variant="small" className="self-start">
          Switch back to group schedule
        </Button>
      }
    >
      <b>Ranalli’s Logan Square has its own schedule.</b> Changes to the group schedule won’t affect it.
    </ScheduleNote>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <RotationMonthRow
        letter="A"
        tone={1}
        name="Kitchen + Exterior"
        detail="A closer look · 48 checks"
        onEdit={() => {}}
      />
      <RotationMonthRow
        letter="B"
        tone={2}
        name="Back of House + Front of House"
        detail="Full walkthrough · 48 checks"
        onEdit={() => {}}
      />
      <RotationMonthRow letter="C" tone={3} name="Exterior + Storage" detail="A closer look · 28 checks" />
      <AddMonthRow onAdd={() => {}} />
    </div>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <YearPreview
        year={2026}
        months={NAMES.map((name, i) => ({
          name,
          letter: i % 2 ? 'B' : 'A',
          tone: i % 2 ? 2 : 1,
          now: i === 10,
          label: `${name}: ${i % 2 ? 'BOH + FOH' : 'Kitchen + Exterior'}`,
        }))}
        legend={[
          { letter: 'A', tone: 1, name: 'Kitchen + Exterior' },
          { letter: 'B', tone: 2, name: 'BOH + FOH' },
        ]}
      />
    </div>
    <div className="flex flex-wrap gap-2">
      <RotationTag own={false}>Group</RotationTag>
      <RotationTag own>Ranalli’s · 3-month</RotationTag>
    </div>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <QuarterTaskRow
        name="Organize utility areas"
        meta="Directions · video"
        tag={{ kind: 'changed', label: 'Changed for Ranalli’s Logan Square' }}
        onEdit={() => {}}
        onRemove={() => {}}
      />
      <QuarterTaskRow name="Patio heater test" meta="Directions" action={{ label: 'Restore', onClick: () => {} }} />
    </div>
    <DashedAddButton onClick={() => {}}>Add Q4 task for all restaurants</DashedAddButton>
  </>,
)
