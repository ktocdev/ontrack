import { useState } from 'react'
import { ContractorCard } from '@app/components/ContractorCard'
import { Avatar } from '@app/components/Avatar'
import { Card, DisclosureList, ListRow, RadioRow } from '@app/components/Card'
import {
  CheckChoice,
  ChecklistEntries,
  ChecklistEntry,
  ChecklistGroup,
  ChecklistHelp,
  ChecklistItem,
  HowToVideo,
  InlineFix,
  TaskCard,
  TaskLabel,
} from '@app/components/Checklist'
import { ClosedTicketRow, MonthHeading } from '@app/components/ClosedTicketRow'
import { EquipmentGroup, EquipmentRow, OpenBadge, OpenNote } from '@app/components/Equipment'
import { OpsTicketCard } from '@app/components/OpsTicketCard'
import { AddPhotoButton, PhotoThumb, PhotoTray } from '@app/components/Photo'
import { WalkthroughTag } from '@app/components/Pill'
import {
  ButtonSpinner,
  CardFeedSkeleton,
  DetailSkeleton,
  GroupedListSkeleton,
  MetricsSkeleton,
  PeopleListSkeleton,
  Spinner,
} from '@app/components/Skeleton'
import { TaskList, TaskListEmpty, TaskRow } from '@app/components/TaskRow'
import { Composer, ThreadEvent, ThreadMessage, VisibilityToggle } from '@app/components/Thread'
import { TicketCard } from '@app/components/TicketCard'
import { useToast } from '@app/components/Toast'
import {
  CountTile,
  FlagChip,
  FlagChips,
  LeftRow,
  ProgressBar,
  ProgressRing,
  WalkthroughCardSkeleton,
  WalkthroughSectionRow,
  WalkthroughTicketRow,
} from '@app/components/Walkthrough'
import { Notice } from '@app/components/Notice'
import { Example, PageHeader, Rules, Section } from '../chrome/Doc'
import { SAMPLE_RESTAURANTS } from './components-basics'

const LOGAN = SAMPLE_RESTAURANTS[0]!
const PORTER = SAMPLE_RESTAURANTS[3]!

/* ---------------- Tickets ---------------- */

export function TicketsPage() {
  const [openedAt] = useState(() => new Date().toISOString())
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Tickets"
        source={['components/TicketCard.tsx', 'components/OpsTicketCard.tsx', 'components/ClosedTicketRow.tsx']}
      >
        <p>
          A manager&apos;s card says where the problem is and who is on it. An Ops card is denser, grouped under each
          restaurant. A ticket made in the last five minutes carries a ring.
        </p>
      </PageHeader>
      <Section title="Manager's card">
        <Example
          code={`<TicketCard to={path} displayId="OT-1042" title="Walk-in cooler not holding temp" status="in_progress"
  place="Back of House · Refrigeration · Walk-in Cooler 1" who="Bert Velilla is on it" when="Updated 1h ago" />`}
        >
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
            restaurant={PORTER}
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
            createdAt={openedAt}
          />
        </Example>
      </Section>
      <Section title="Ops card">
        <Example>
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
            createdAt={openedAt}
          />
        </Example>
      </Section>
      <Section title="Closed tickets" intro="Grouped by month with the month's total, which shows only with see_costs.">
        <Example>
          <MonthHeading label="October · 9 closed" total="$2,418.60" />
          <Card className="overflow-hidden rounded-input">
            <ClosedTicketRow
              to="#"
              title="Ice machine scale buildup"
              displayId="OT-1036"
              restaurant={LOGAN}
              date="Oct 17"
              cost="$310.00"
            />
            <ClosedTicketRow
              to="#"
              title="Booth 12 upholstery torn"
              displayId="OT-1028"
              restaurant={LOGAN}
              date="Oct 15"
              cost="$420.00"
            />
          </Card>
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Lead with the ticket number in mono; people read it out and type it.',
            'Name who is on a ticket rather than "assigned".',
          ]}
          donts={[
            'Show a cost to someone without see_costs: the database returns none, so the UI shows none.',
            'Add a separate reopened screen; a reopened ticket is an ordinary card with its pill.',
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Thread and photos ---------------- */

export function ThreadPage() {
  const [draft, setDraft] = useState('')
  const [internal, setInternal] = useState(false)
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Thread and photos"
        source={['components/Thread.tsx', 'components/Photo.tsx']}
      >
        <p>
          A ticket&apos;s thread mixes system events and messages. Your own messages sit in a brand tint; Ops can mark a
          note internal, which managers never see, photos included.
        </p>
      </PageHeader>
      <Section title="Thread">
        <Example>
          <div className="flex flex-col rounded-card border border-border bg-surface px-3 py-1">
            <ThreadEvent text="Bert Velilla took this · status In progress" when="9:40 AM" />
            <ThreadMessage
              who="Bert Velilla, Ops"
              when="1h ago"
              avatar={<Avatar name="Bert Velilla" role="ops" size={30} />}
            >
              Refrigeration tech booked for today 2–4 PM.
            </ThreadMessage>
            <ThreadMessage who="You" when="45m ago" mine avatar={<Avatar name="Maya Reyes" size={30} />}>
              Thanks. Lunch rush ends at 2, so that window works.
            </ThreadMessage>
            <ThreadMessage
              internal
              mine
              who="You"
              when="50m ago"
              avatar={<Avatar name="Bert Velilla" role="ops" size={30} />}
            >
              Coldline quoted $185 for the diagnostic.
            </ThreadMessage>
          </div>
        </Example>
      </Section>
      <Section title="Composer">
        <Example>
          <VisibilityToggle internal={internal} onChange={setInternal} />
          <div className="overflow-hidden rounded-card border border-border">
            <Composer
              leading={<AddPhotoButton variant="icon" onFiles={() => undefined} />}
              label="Write an update"
              placeholder="Write an update…"
              value={draft}
              onChange={setDraft}
              onSend={() => setDraft('')}
            />
          </div>
        </Example>
      </Section>
      <Section title="Photos" intro="Resized to 1600px before upload. A ticket asks before it is sent without one.">
        <Example>
          <div className="flex flex-wrap items-center gap-2">
            <PhotoThumb alt="A photo on a message" />
            <PhotoThumb alt="A photo on your own message" tinted />
            <PhotoThumb alt="A photo on the ticket" size="ticket" />
            <PhotoTray photos={[]} reading onRemove={() => undefined} />
            <AddPhotoButton onFiles={() => undefined} />
          </div>
          <AddPhotoButton variant="dashed" onFiles={() => undefined} />
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Equipment and tasks ---------------- */

export function EquipmentPage() {
  const toast = useToast()
  const [group, setGroup] = useState<string | null>('Refrigeration')
  const [radio, setRadio] = useState(0)
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Equipment and tasks"
        source={['components/Equipment.tsx', 'components/TaskRow.tsx']}
      >
        <p>
          Equipment lists fold by category, with open tickets badged on the group and the row. In-house tasks check off
          in place and can be deleted only while open.
        </p>
      </PageHeader>
      <Section title="Equipment list">
        <Example>
          <EquipmentGroup
            name="Refrigeration"
            count={3}
            openCount={1}
            open={group === 'Refrigeration'}
            onToggle={() => setGroup((g) => (g === 'Refrigeration' ? null : 'Refrigeration'))}
          >
            <EquipmentRow
              to="#"
              name="Walk-in Cooler 1"
              restaurant={LOGAN}
              brand="Kolpak"
              serial="KP-7XW-220418"
              spend={{ amount: '$860.90', year: 2026 }}
              openCount={1}
            />
            <EquipmentRow
              to="#"
              name="Reach-in Freezer"
              restaurant={PORTER}
              brand="True"
              serial="TR-23F-118204"
              spend={{ amount: null, year: 2026 }}
            />
            <EquipmentRow to="#" name="Walk-in Freezer" brand="Kolpak" serial="KP-9FZ-190233" />
          </EquipmentGroup>
          <EquipmentGroup
            name="Plumbing"
            count={8}
            openCount={0}
            open={group === 'Plumbing'}
            onToggle={() => setGroup((g) => (g === 'Plumbing' ? null : 'Plumbing'))}
          >
            <EquipmentRow name="Floor Drain Pump" brand="Zoeller" serial="ZL-M53-70188" />
          </EquipmentGroup>
          <div className="flex flex-wrap items-center gap-2">
            <OpenBadge count={1} />
            <OpenBadge count={1} compact />
            <OpenNote count={1} />
          </div>
        </Example>
      </Section>
      <Section title="Picking a unit" intro="On the ticket form.">
        <Example>
          <div
            role="radiogroup"
            aria-label="Equipment"
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            <RadioRow
              checked={radio === 0}
              title="Walk-in Cooler 1"
              subtitle="SN KP-7XW-220418"
              onSelect={() => setRadio(0)}
            />
            <RadioRow checked={radio === 1} title="Walk-in Freezer" onSelect={() => setRadio(1)} />
          </div>
        </Example>
      </Section>
      <Section title="In-house tasks">
        <Example>
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
              title="Clean the grease under the prep table"
              meta="Added by Maya · Nov 6"
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
        </Example>
        <Example title="With nothing to list">
          <TaskListEmpty>Nothing left to fix. Checked-off tasks are under Closed.</TaskListEmpty>
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Loading ---------------- */

export function ContractorsPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Contractors" source={['components/ContractorCard.tsx']}>
        <p>
          A contractor in the directory: this year's spend for the restaurants picked, a tag for each of their trades, a
          Preferred star, an insurance warning within 30 days of running out, and a call button when there is a phone.
        </p>
      </PageHeader>
      <Section
        title="Directory card"
        intro="Spend and visits show only with see_costs; under View as the card opens nothing."
      >
        <Example
          code={`<ContractorCard name="Coldline Refrigeration" trades={['Refrigeration', 'HVAC']} preferred spend="$4,812" phone="…" to="/c/…" />`}
        >
          <ContractorCard
            name="Coldline Refrigeration"
            trades={['Refrigeration', 'HVAC']}
            preferred
            contact="Rosa Alvarez"
            visits="11 visits · last Oct 19, 2026"
            spend="$4,812"
            phone="(312) 555-0187"
            to="#"
          />
          <ContractorCard
            name="Brightway Electric"
            trades={['Electrical']}
            warning="Insurance expires Nov 1"
            contact="Tina Nguyen"
            visits="6 visits · last Oct 8, 2026"
            spend="$2,140"
            phone="(773) 555-0133"
          />
        </Example>
      </Section>
    </>
  )
}

export function WalkthroughPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Walkthrough" source={['components/Walkthrough.tsx']}>
        <p>
          A month's walkthrough at a glance: a bar for the whole checklist split by how each done item ended (Good,
          in-house, ticket), a ring for each section, and chips for what was flagged.
        </p>
      </PageHeader>
      <Section
        title="Progress bar"
        intro="Each done item counts once: a ticket first, then an in-house fix, then Good."
      >
        <Example code={`<ProgressBar good={16} inhouse={2} tickets={2} total={50} label="20 of 50 checks done" />`}>
          <div className="flex flex-col gap-3">
            <ProgressBar good={16} inhouse={2} tickets={2} total={50} label="20 of 50 checks done" />
            <ProgressBar good={44} inhouse={3} tickets={3} total={50} label="50 of 50 checks done" />
          </div>
        </Example>
      </Section>
      <Section
        title="Section rows"
        intro="A row opens the section's checklist; with no `to` (View as) it opens nothing."
      >
        <Example
          code={`<WalkthroughSectionRow to={path} name="Back of House" done={16} total={24} tickets={2} fixes={1} />`}
        >
          <div className="overflow-hidden rounded-card border border-border bg-surface [&>*:last-child]:border-b-0">
            <WalkthroughSectionRow to="#" name="Back of House" done={16} total={24} tickets={2} fixes={1} />
            <WalkthroughSectionRow to="#" name="Front of House" done={4} total={24} tickets={0} fixes={0} />
            <WalkthroughSectionRow name="Q4 location tasks" done={2} total={2} tickets={1} fixes={1} />
          </div>
        </Example>
      </Section>
      <Section title="Rings and chips">
        <Example
          code={`<ProgressRing done={16} total={24} />
<FlagChips tickets={2} fixes={1} />`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ProgressRing done={0} total={24} />
              <ProgressRing done={16} total={24} />
              <ProgressRing done={24} total={24} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FlagChips tickets={2} fixes={1} />
              <FlagChip tone="good">All good</FlagChip>
              <FlagChip tone="missed">Not done</FlagChip>
            </div>
          </div>
        </Example>
      </Section>
      <Section title="Past walkthroughs" intro="The chevron variant of DisclosureList.">
        <Example
          code={`<DisclosureList label="Past walkthroughs" heading="Past walkthroughs" variant="chevron">…</DisclosureList>`}
        >
          <DisclosureList label="Past walkthroughs" heading="Past walkthroughs" variant="chevron" defaultOpen>
            <ListRow
              title="Sep"
              subtitle="Kitchen + Exterior"
              trailing={<FlagChip tone="ticket">5 tickets</FlagChip>}
            />
          </DisclosureList>
        </Example>
      </Section>
      <Section
        title="Checklist"
        intro="A group's card opens and closes; each item has Good, In-house and Ticket, lit once picked. Good is left out while the item has a fix or ticket still open. What was made from an item is listed under it, and In-house opens a field there."
      >
        <Example
          code={`<ChecklistGroup name="Electrical" done={2} total={3} open onToggle={toggle}>
  <ChecklistItem name="Outlets" choices={…}>…</ChecklistItem>
</ChecklistGroup>`}
        >
          <div className="flex flex-col gap-2.5">
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
                  <ChecklistEntry kind="fix" done>
                    Re-glue trim on pass shelf
                  </ChecklistEntry>
                </ChecklistEntries>
              </ChecklistItem>
              <ChecklistItem
                name="Feature"
                choices={
                  <>
                    <CheckChoice tone="good" lit={false}>
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
              <p className="text-14 leading-[1.55] text-text-body">
                Clear at least 3 feet in front of the electrical panel.
              </p>
              <HowToVideo url="https://example.com/how-to" task="Organize utility areas" />
            </TaskCard>
          </div>
        </Example>
      </Section>
      <Section
        title="Review"
        intro="Review & submit's counts, the warning while checks are still to do, the parts left, and the walkthrough's tickets: compact on Review, full on the tickets list."
      >
        <Example
          code={`<CountTile tone="inhouse" count={4} label="In-house" to={path} />
<LeftRow to={path} name="Back of House" left={8} />
<WalkthroughTicketRow displayId="OT-1051" title="…" where="…" status="open" />`}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <CountTile tone="good" count={41} label="Good" />
              <CountTile
                tone="inhouse"
                count={4}
                label="In-house"
                to="/kit"
                ariaLabel="4 in-house fixes, view and manage all"
              />
              <CountTile tone="ticket" count={5} label="Tickets" to="/kit" ariaLabel="5 tickets, view and edit all" />
            </div>
            <Notice tone="warn">
              <b>30 of 50 checks are still to do.</b> You can submit now, or go back and finish them first.
            </Notice>
            <div className="overflow-hidden rounded-control border border-border bg-surface">
              <LeftRow to="/kit" name="Back of House" left={8} />
              <LeftRow to="/kit" name="Q4 location tasks" left={2} />
            </div>
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <WalkthroughTicketRow
                compact
                to="/kit"
                displayId="OT-1051"
                title="Outlets"
                where="BOH › Electrical"
                status="in_progress"
              />
              <WalkthroughTicketRow
                to="/kit"
                displayId="OT-1051"
                urgent
                title="Scorch marks on prep line outlet"
                where="BOH › Electrical › Outlets"
                status="in_progress"
              />
            </div>
          </div>
        </Example>
      </Section>
      <Section title="Loading">
        <Example code={`<WalkthroughCardSkeleton />`}>
          <WalkthroughCardSkeleton />
        </Example>
      </Section>
    </>
  )
}

export function LoadingPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Loading" source="components/Skeleton.tsx">
        <p>
          A skeleton in the shape of what is coming, so nothing jumps when it arrives. A spinner only where there is no
          shape to draw, and inside a button while it works. Shimmer stops for reduced motion.
        </p>
      </PageHeader>
      <Section title="Spinners">
        <Example>
          <div className="flex items-center gap-4">
            <Spinner />
            <span className="inline-flex items-center gap-2 rounded-input bg-brand-fill px-4 py-3 text-15 font-bold text-on-brand">
              <ButtonSpinner /> Saving…
            </span>
          </div>
        </Example>
      </Section>
      <Section title="Skeletons">
        <Example title="Card feed">
          <CardFeedSkeleton count={2} />
        </Example>
        <Example title="Grouped list">
          <GroupedListSkeleton rows={2} groups={2} />
        </Example>
        <Example title="People">
          <PeopleListSkeleton count={3} />
        </Example>
        <Example title="Metrics and detail">
          <MetricsSkeleton />
          <DetailSkeleton keys={['Name', 'Brand', 'Model']} />
        </Example>
      </Section>
    </>
  )
}
