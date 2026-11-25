// @card ProgressBar Walkthrough 820
import React from 'react'
import {
  ProgressBar,
  ProgressRing,
  FlagChip,
  FlagChips,
  WalkthroughSectionRow,
  ProgressLine,
  StandingPill,
  HistorySquare,
  HistoryLegend,
  SectionProgressRow,
  FlaggedRow,
  CountTile,
  LeftRow,
  WalkthroughTicketRow,
} from 'ontrack'
import { mount } from './_shared'

mount(
  <>
    <ProgressBar good={16} inhouse={2} tickets={2} total={50} label="20 of 50 checks done" />
    <div className="overflow-hidden rounded-card border border-border bg-surface [&>*:last-child]:border-b-0">
      <WalkthroughSectionRow to="#" name="Back of House" done={16} total={24} tickets={2} fixes={1} />
      <WalkthroughSectionRow to="#" name="Front of House" done={4} total={24} tickets={0} fixes={0} />
    </div>
    <div className="flex items-center gap-3">
      <ProgressRing done={0} total={24} />
      <ProgressRing done={16} total={24} />
      <ProgressRing done={24} total={24} />
      <FlagChips tickets={2} fixes={1} />
      <FlagChip tone="good">All good</FlagChip>
    </div>
    <ProgressLine done={20} total={50} label="20 of 50 checks done" />
    <div className="flex flex-wrap items-center gap-1.5">
      <StandingPill standing="not_started" />
      <StandingPill standing="in_progress" progress="40%" />
      <StandingPill standing="on_time" submitted="Oct 18" />
      <StandingPill standing="missed" />
    </div>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <HistorySquare standing="on_time" label="On time" />
        <HistorySquare standing="late" label="Late" />
        <HistorySquare standing="missed" label="Missed" />
        <HistorySquare standing="in_progress" label="In progress" />
      </div>
      <HistoryLegend />
    </div>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <SectionProgressRow name="Back of House" done={16} total={24} />
      <FlaggedRow to="#" kind="ticket" title="Outlets" meta="OT-1051 · BOH › Electrical" status="in_progress" />
      <FlaggedRow kind="inhouse" title="Re-glue trim on pass shelf" meta="BOH › Electrical › Feature" status="fixed" />
    </div>
    <div className="grid grid-cols-3 gap-2">
      <CountTile tone="good" count={41} label="Good" />
      <CountTile tone="inhouse" count={4} label="In-house" to="#" ariaLabel="4 in-house fixes, view and manage all" />
      <CountTile tone="ticket" count={5} label="Tickets" to="#" ariaLabel="5 tickets, view and edit all" />
    </div>
    <div className="overflow-hidden rounded-control border border-border bg-surface">
      <LeftRow to="#" name="Back of House" left={8} />
    </div>
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <WalkthroughTicketRow
        to="#"
        displayId="OT-1051"
        urgent
        title="Scorch marks on prep line outlet"
        where="BOH › Electrical › Outlets"
        status="in_progress"
      />
    </div>
  </>,
)
