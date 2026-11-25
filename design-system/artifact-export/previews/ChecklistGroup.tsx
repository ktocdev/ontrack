// @card ChecklistGroup Walkthrough 930
import React from 'react'
import {
  CheckChoice,
  ChecklistEntries,
  ChecklistEntry,
  ChecklistGroup,
  ChecklistHelp,
  ChecklistItem,
  FlagChip,
  FlagChips,
  HowToVideo,
  InlineFix,
  TaskCard,
  TaskLabel,
} from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <ChecklistHelp />
    <ChecklistGroup
      name="Electrical"
      done={2}
      total={3}
      open
      onToggle={() => undefined}
      flags={<FlagChips tickets={1} fixes={1} />}
    >
      <ChecklistItem
        name="Light bulbs"
        choices={
          <>
            <CheckChoice tone="good" lit aria-pressed>
              Good
            </CheckChoice>
            <CheckChoice tone="inhouse" lit={false}>
              In-house
            </CheckChoice>
            <CheckChoice tone="ticket" lit={false}>
              Ticket
            </CheckChoice>
          </>
        }
      />
      <ChecklistItem
        name="Outlets"
        choices={
          <>
            <CheckChoice tone="inhouse" lit>
              In-house
            </CheckChoice>
            <CheckChoice tone="ticket" lit>
              Ticket
            </CheckChoice>
          </>
        }
      >
        <ChecklistEntries>
          <ChecklistEntry kind="fix" to="#">
            Replaced cracked cover plate by mop sink
          </ChecklistEntry>
          <ChecklistEntry kind="ticket" label="OT-1051" urgent to="#">
            Scorch marks on prep line outlet
          </ChecklistEntry>
        </ChecklistEntries>
      </ChecklistItem>
      <ChecklistItem
        name="Feature"
        choices={
          <CheckChoice tone="inhouse" lit={false}>
            In-house
          </CheckChoice>
        }
      >
        <ChecklistEntries>
          <InlineFix
            item="Feature"
            saving={false}
            autoFocus={false}
            onAdd={() => undefined}
            onCancel={() => undefined}
          />
        </ChecklistEntries>
      </ChecklistItem>
    </ChecklistGroup>
    <ChecklistGroup name="Plumbing" done={3} total={3} open={false} onToggle={() => undefined}>
      {null}
    </ChecklistGroup>
    <TaskCard
      title="Organize utility areas"
      status={<FlagChip tone="missed">To do</FlagChip>}
      open
      onToggle={() => undefined}
    >
      <TaskLabel>Directions</TaskLabel>
      <p className="text-14 leading-[1.55] text-text-body">Clear at least 3 feet in front of the electrical panel.</p>
      <HowToVideo url="https://example.com/how-to" task="Organize utility areas" />
    </TaskCard>
  </>,
)
