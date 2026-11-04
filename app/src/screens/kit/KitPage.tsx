import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AccentPicker } from '../../components/AccentPicker'
import { Avatar } from '../../components/Avatar'
import { Button, ButtonLink, IconButton } from '../../components/Button'
import {
  Card,
  CategoryTile,
  KeyValueRow,
  ListCard,
  ListRow,
  ListRowButton,
  ListRowLink,
  RadioRow,
  RowIcon,
} from '../../components/Card'
import { Chip, ChoiceChips } from '../../components/Chip'
import { ClosedTicketRow, MonthHeading } from '../../components/ClosedTicketRow'
import { CodeInput, StepBars } from '../../components/CodeInput'
import { EmptyState } from '../../components/EmptyState'
import { AddPhotoButton, PhotoThumb, PhotoTray } from '../../components/Photo'
import { OverflowMenu } from '../../components/Menu'
import { OpsTicketCard } from '../../components/OpsTicketCard'
import { ReorderList } from '../../components/ReorderList'
import { RestaurantPicker } from '../../components/RestaurantPicker'
import { StatusMenu } from '../../components/StatusMenu'
import { TaskList, TaskRow } from '../../components/TaskRow'
import { TicketCard } from '../../components/TicketCard'
import { TicketMenu } from '../../components/TicketMenu'
import { VisibilityToggle, Composer, ThreadEvent, ThreadMessage } from '../../components/Thread'
import { Input, PasswordField, PasswordRules, SearchField, Select, Textarea } from '../../components/Field'
import { ErrorBanner, Notice } from '../../components/Notice'
import { RadioCard } from '../../components/RadioCard'
import {
  CountBadge,
  RoleTag,
  StatusPill,
  TabAlert,
  UrgentTag,
  WalkthroughTag,
  type PillStatus,
} from '../../components/Pill'
import { AllRestaurantsSquare, RestaurantName, RestaurantSquare } from '../../components/RestaurantName'
import {
  BrandBackBar,
  CloseBar,
  Screen,
  ScreenBody,
  ScreenHeader,
  SectionLabel,
  UnderlineTabs,
} from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { Sheet } from '../../components/Sheet'
import { Sidebar, SidebarAnchor } from '../../components/Sidebar'
import {
  ButtonSpinner,
  CardFeedSkeleton,
  DetailSkeleton,
  GroupedListSkeleton,
  MetricsSkeleton,
  PeopleListSkeleton,
  Spinner,
} from '../../components/Skeleton'
import { Switch, SwitchRow } from '../../components/Switch'
import { ThemeControl } from '../../components/ThemeControl'
import { TabBar } from '../../components/TabBar'
import { useToast } from '../../components/Toast'
import { UpdateBar } from '../../components/UpdateBar'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconHelpCircle,
  IconPlus,
  IconQr,
  IconReopen,
  IconSearchOff,
  IconSignOut,
  IconUserPlus,
} from '../../components/icons'
import { ViewAsBanner } from '../admin/ViewAsScreen'
import { SignedOutSheet } from '../auth/SignedOutSheet'
import { ROLE_TABS } from '../../app/roles'
import { MOCK_RESTAURANTS } from '../../auth/mock'
import { isHex, normalizeHex, presetHex, PRESETS } from '../../lib/colors'
import type { AppRole } from '../../lib/supabase'
import { useTheme } from '../../theme/useTheme'

/**
 * /kit: every shared component in both themes, plus links to the full-screen
 * loading and error boards. Check a new component here before a screen uses
 * it. Public, no sign-in needed.
 *
 * On a phone it is one scrolling column. From the lg breakpoint it is the
 * desktop base: a sidebar beside the screen, sections in two masonry columns,
 * the whole row capped at max-w-desktop (1440) and centered.
 */

const STATUSES: PillStatus[] = ['open', 'in_progress', 'waiting_parts', 'scheduled', 'reopened', 'closed', 'fixed']

const SECTIONS = {
  type: 'Type',
  buttons: 'Buttons',
  pills: 'Pills, tags and badges',
  restaurants: 'Restaurant names',
  avatars: 'Avatars',
  cards: 'Cards and rows',
  controls: 'Segmented and tabs',
  choices: 'Chips, radio cards and empty',
  fields: 'Fields',
  switch: 'Switch',
  overlays: 'Sheet and toast',
  loading: 'Loading',
  errors: 'Error screens',
  tabbars: 'Tab bars',
} as const
type SectionId = keyof typeof SECTIONS

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="flex scroll-mt-4 flex-col gap-3 border-t border-border pt-4 lg:mb-10 lg:break-inside-avoid"
      aria-labelledby={`${id}-h`}
    >
      <h2 id={`${id}-h`} className="eyebrow">
        {SECTIONS[id]}
      </h2>
      {children}
    </section>
  )
}

const KIT_RESTAURANTS = [
  { id: 'a', name: 'Porter', color: 'var(--preset-ocean)' },
  { id: 'b', name: 'Corner Bistro', color: 'var(--preset-plum)' },
  { id: 'c', name: 'Northside Grill', color: 'var(--preset-olive)' },
]

export function KitPage() {
  const { theme } = useTheme()
  const toast = useToast()
  const [seg, setSeg] = useState<'all' | 'foh' | 'boh'>('all')
  const [sw, setSw] = useState(true)
  const [kitInternal, setKitInternal] = useState(false)
  // Opened as the kit loads, so the new-ticket ring shows for its 5 minutes.
  const [kitOpenedAt] = useState(() => new Date().toISOString())
  const [kitOrderIds, setKitOrderIds] = useState(['a', 'b', 'c'])
  const [sheet, setSheet] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(false)
  const accents = useMemo(() => PRESETS.map((p) => ({ value: presetHex(p.key), label: p.label })), [])
  const [accent, setAccent] = useState(() => presetHex(PRESETS[0]!.key))
  const [customAccent, setCustomAccent] = useState('#4d7c0f')
  const [chip, setChip] = useState(true)
  const [radio, setRadio] = useState(0)
  const [draft, setDraft] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'urgent'>('normal')
  const [password, setPassword] = useState('kitchen4')

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-desktop flex-1">
      <Sidebar
        label="Kit sections"
        header={
          <div className="flex flex-col gap-1">
            <span className="font-display text-22 font-bold tracking-[-0.01em]">OnTrack</span>
            <span className="text-13 text-text-muted">Component kit</span>
          </div>
        }
        footer={
          <Link to="/sign-in" className="text-14 font-semibold">
            Sign in
          </Link>
        }
      >
        {(Object.keys(SECTIONS) as SectionId[]).map((id) => (
          <SidebarAnchor key={id} href={`#${id}`}>
            {SECTIONS[id]}
          </SidebarAnchor>
        ))}
      </Sidebar>

      <Screen data-testid="kit">
        <ScreenHeader
          className="lg:px-10"
          title="Component kit"
          action={
            <span className="eyebrow" data-testid="kit-theme">
              {theme}
            </span>
          }
        >
          <ThemeControl className="lg:max-w-[360px]" />
        </ScreenHeader>

        <ScreenBody className="pb-10 lg:px-10 lg:pt-4">
          <div className="flex flex-col gap-5 lg:block lg:columns-2 lg:gap-x-10">
            <Section id="type">
              <h1 className="font-display text-30 font-bold tracking-[-0.02em]">Open tickets</h1>
              <span className="font-display text-22 font-bold tracking-[-0.01em]">Sheet title, 22</span>
              <p className="text-15 text-text-body">Body 15 on text-body. Inputs never go below 16px on a phone.</p>
              <p className="text-13 text-text-muted">Meta 13 on text-muted · OT-1042 in mono below</p>
              <span className="font-mono text-14 font-medium">OT-1042 · KP-7XW-220418 · $397.40</span>
              <span className="eyebrow">Eyebrow · 12 · 700 · 0.06em</span>
            </Section>

            <Section id="buttons">
              <Button>Primary · 52</Button>
              <Button variant="secondary">Secondary · 48</Button>
              <Button variant="danger">Delete · danger</Button>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="compact" icon={<IconPlus size={18} />}>
                  Invite
                </Button>
                <Button variant="small">Search equipment</Button>
                <Button variant="ghost">Report this problem</Button>
                <Button variant="ghost-danger">Remove</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="medium">Ask admin for a new invite</Button>
                <Button variant="done" disabled>
                  Request sent
                </Button>
              </div>
              <Button variant="secondary-danger" icon={<IconSignOut />}>
                Sign out
              </Button>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button loading={loading} onClick={() => setLoading((v) => !v)} className="w-auto">
                  {loading ? 'Saving…' : 'Toggle loading'}
                </Button>
                <Button disabled className="w-auto">
                  Disabled
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <OverflowMenu label="More options" items={[{ to: '/kit', label: 'A menu item' }]} />
                <TicketMenu id="kit" displayId="OT-1042" title="Walk-in cooler not holding temp" />
                <IconButton label="Back">
                  <IconChevronLeft />
                </IconButton>
                <IconButton label="Close">
                  <IconClose />
                </IconButton>
                <IconButton label="Scan QR code" framed>
                  <IconQr />
                </IconButton>
              </div>
            </Section>

            <Section id="pills">
              <div className="flex flex-wrap gap-2" data-testid="pills">
                {STATUSES.map((s) => (
                  <StatusPill key={s} status={s} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <UrgentTag />
                <WalkthroughTag />
                <RoleTag>Manager</RoleTag>
                <RoleTag>Ops Manager</RoleTag>
                <CountBadge count={5} />
                <CountBadge count={5} active />
                <TabAlert count={1} label="1 reopened ticket" />
              </div>
            </Section>

            <Section id="restaurants">
              <div className="flex flex-col gap-2">
                {MOCK_RESTAURANTS.map((r) => (
                  <RestaurantName key={r.id} name={r.name} color={r.color} />
                ))}
                <RestaurantName name="Porter" color="#9A6A00" variant="meta" />
                <span className="flex items-center gap-1.5 text-14 font-semibold">
                  <AllRestaurantsSquare colors={MOCK_RESTAURANTS.map((r) => r.color)} />
                  All restaurants (4)
                </span>
                <span className="flex items-center gap-3 text-15 font-semibold">
                  <RestaurantSquare color={MOCK_RESTAURANTS[0]!.color} size={14} />
                  14px square, as on the Restaurants list
                </span>
              </div>
              <AccentPicker
                label="Accent color"
                hint="Presets come from the --preset-* tokens; the hue wheel opens a custom color."
                options={accents}
                value={accent}
                onChange={setAccent}
                custom={customAccent}
                onCustomChange={setCustomAccent}
                warning={isHex(normalizeHex(customAccent)) ? undefined : 'Enter a 6-digit hex code, like #C2185B.'}
              />
              <div className="overflow-hidden rounded-card border border-border">
                <CloseBar to="/kit" title="Add restaurant" />
              </div>
              <div className="overflow-hidden rounded-card border border-border">
                <BrandBackBar to="/kit" label="Back" />
              </div>
              <div className="overflow-hidden rounded-card border border-border">
                <ViewAsBanner name="Maya Reyes" first="Maya" exitTo="/kit" />
              </div>
            </Section>

            <Section id="avatars">
              <div className="flex items-end gap-3">
                <Avatar name="Maya Reyes" role="manager" size={28} />
                <Avatar name="Maya Reyes" role="manager" />
                <Avatar name="Bert Velilla" role="ops" />
                <Avatar name="Lee Chen" role="leadership" />
                <Avatar name="Bert Velilla" role="you" size={28} />
                <Avatar name="Bert Velilla" role="ops" size={88} />
              </div>
              <div className="flex items-end gap-3">
                <Avatar name="Sam Patel" role="pending" size={38} />
                <Avatar name="Jordan Blake" role="expired" size={38} />
                <Avatar name="Maya Reyes" role="manager" size={38} />
                <Avatar name="Bert Velilla" role="ops" size={38} />
                <Avatar name="Lee Chen" role="leadership" size={38} />
                <Avatar name="Maya Reyes" role="manager" size={52} />
              </div>
            </Section>

            <Section id="cards">
              <div className="grid grid-cols-2 gap-2.5">
                <CategoryTile to="#" name="Refrigeration" count={9} />
                <CategoryTile to="#" name="Dishwashing" count={1} />
              </div>
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
              <ChoiceChips
                label="Urgency"
                value={urgency}
                onChange={setUrgency}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
              <ErrorBanner title="Couldn't save yet.">Everything you entered is still here.</ErrorBanner>
              <Notice tone="waiting">
                <b>Reopened and sent to Ops.</b> It&apos;s back on the Ops list. You&apos;ll get a notification when
                work starts.
              </Notice>
              <Button variant="tall" icon={<IconReopen size={20} />}>
                Reopen ticket
              </Button>
              <AddPhotoButton variant="dashed" onFiles={() => undefined} />
              <div className="flex flex-col rounded-card border border-border px-3 py-1">
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
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PhotoThumb alt="A photo on a message" />
                <PhotoThumb alt="A photo on your own message" tinted />
                <PhotoThumb alt="A photo on the ticket" size="ticket" />
                <PhotoTray photos={[]} reading onRemove={() => undefined} />
                <AddPhotoButton onFiles={() => undefined} />
              </div>
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
                restaurant={{ name: 'Porter', color: 'var(--preset-ocean)' }}
                who="Not picked up yet"
                when="Created 3h ago"
              />
              <RestaurantPicker
                restaurants={[
                  { id: 'a', name: 'Porter', color: 'var(--preset-ocean)' },
                  { id: 'b', name: 'Corner Bistro', color: 'var(--preset-plum)' },
                ]}
                selectedId={null}
                onSelect={() => toast.show('Restaurant picked.')}
              />
              <VisibilityToggle internal={kitInternal} onChange={setKitInternal} />
              <ThreadMessage
                internal
                mine
                who="You"
                when="50m ago"
                avatar={<Avatar name="Bert Velilla" role="ops" size={30} />}
              >
                Coldline quoted $185 for the diagnostic.
              </ThreadMessage>
              <StatusMenu
                value="in_progress"
                valueLabel="In progress"
                options={['open', 'in_progress', 'waiting_parts', 'scheduled']}
                onPick={() => toast.show('Status picked.')}
                actions={[
                  { label: 'Take this over', onSelect: () => toast.show('Taken.') },
                  { label: 'Close ticket', onSelect: () => toast.show('Closing.') },
                ]}
              />
              <ReorderList
                label="Restaurants in order"
                items={kitOrderIds.map((id) => KIT_RESTAURANTS.find((r) => r.id === id)!)}
                onChange={setKitOrderIds}
              />
              <MonthHeading label="October · 9 closed" total="$2,418.60" />
              <Card className="overflow-hidden rounded-input">
                <ClosedTicketRow
                  to="#"
                  title="Ice machine scale buildup"
                  displayId="OT-1036"
                  restaurant={KIT_RESTAURANTS[0]}
                  date="Oct 17"
                  cost="$310.00"
                />
                <ClosedTicketRow
                  to="#"
                  title="Booth 12 upholstery torn"
                  displayId="OT-1028"
                  restaurant={KIT_RESTAURANTS[0]}
                  date="Oct 15"
                  cost="$420.00"
                />
              </Card>
              <OpsTicketCard
                to="#"
                displayId="OT-0988"
                title="Door gasket torn"
                status="reopened"
                meta="BOH · Refrigeration · 2h ago"
              />
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
                displayId="OT-1051"
                title="Ice machine leaking"
                status="open"
                meta="BOH · Refrigeration · just now"
                createdAt={kitOpenedAt}
              />
              <TicketCard
                to="#"
                displayId="OT-1051"
                title="Ice machine leaking"
                status="open"
                place="Back of House · Refrigeration · Ice machine"
                who="Not picked up yet"
                when="Created just now"
                createdAt={kitOpenedAt}
              />
              <TaskList>
                <TaskRow
                  title="Replace 2 bulbs over booths 4–6"
                  meta="Oct walkthrough · FOH › Electrical › Light bulbs"
                  done={false}
                  onToggle={() => toast.show('Row checked.')}
                  onDelete={() => toast.show('Row deleted.')}
                />
                <TaskRow
                  title="Clear boxes from utility closet"
                  meta="Q4 task · Organize utility areas"
                  restaurant={{ name: 'Porter', color: 'var(--preset-ocean)' }}
                  done={false}
                  onToggle={() => toast.show('Row checked.')}
                  onDelete={() => toast.show('Row deleted.')}
                />
                <TaskRow
                  title="Re-glue trim on pass shelf"
                  meta="Oct walkthrough · BOH › Electrical › Feature · Completed"
                  done
                  onToggle={() => toast.show('Row unchecked.')}
                />
              </TaskList>
              <ListCard>
                <ListRow
                  leading={<Avatar name="Sam Patel" role="manager" />}
                  title="Sam Patel"
                  subtitle="Invite pending · sent 2 days ago"
                  trailing={<RoleTag>Manager</RoleTag>}
                />
                <ListRowLink
                  to="#"
                  leading={<Avatar name="Bert Velilla" role="ops" />}
                  title="Bert Velilla"
                  subtitle="All restaurants"
                  trailing={<RoleTag>Ops Manager</RoleTag>}
                />
                <ListRowButton
                  onClick={() => toast.show('Row pressed.')}
                  leading={
                    <RowIcon>
                      <IconHelpCircle />
                    </RowIcon>
                  }
                  title="Help center"
                  subtitle="Common questions and ways to reach support"
                  trailing={<IconChevronRight className="text-text-muted" />}
                />
              </ListCard>
              <Notice>Profile saved.</Notice>
              <Card className="px-3.5">
                <KeyValueRow label="Brand">Kolpak</KeyValueRow>
                <KeyValueRow label="Serial number">
                  <span className="font-mono">KP-7XW-220418</span>
                </KeyValueRow>
                <KeyValueRow label="Installed">Mar 2022</KeyValueRow>
              </Card>
            </Section>

            <Section id="controls">
              <Segmented
                label="Area"
                value={seg}
                onChange={setSeg}
                size="sm"
                options={[
                  { value: 'all', label: 'All · 5' },
                  { value: 'foh', label: 'Front · 2' },
                  { value: 'boh', label: 'Back · 3' },
                ]}
              />
              <UnderlineTabs
                label="Example tabs"
                items={[
                  { to: '/kit', label: <>Open · 14</>, end: true },
                  {
                    to: '/kit#controls',
                    label: (
                      <>
                        Closed <TabAlert count={1} label="1 reopened" />
                      </>
                    ),
                  },
                ]}
              />
            </Section>

            <Section id="choices">
              <div className="flex flex-wrap gap-2">
                <Chip selected={chip} onClick={() => setChip(true)}>
                  All · 42
                </Chip>
                <Chip selected={!chip} onClick={() => setChip(false)}>
                  Pending · 3
                </Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip tone="pick" selected={chip} onClick={() => setChip(true)}>
                  Federale’s West Loop
                </Chip>
                <Chip tone="pick" selected={!chip} onClick={() => setChip(false)}>
                  Porter
                </Chip>
                <Chip tone="pick" selected={false} disabled>
                  Disabled
                </Chip>
              </div>
              <div role="radiogroup" aria-label="Example role" className="flex flex-col gap-2">
                <RadioCard
                  checked={radio === 0}
                  title="Restaurant manager"
                  subtitle="Creates tickets for their restaurant(s)"
                  onSelect={() => setRadio(0)}
                />
                <RadioCard
                  checked={radio === 1}
                  title="Operations manager"
                  subtitle="Works tickets, logs costs and contractors"
                  onSelect={() => setRadio(1)}
                />
              </div>
              <div className="flex rounded-card border border-border">
                <EmptyState
                  icon={<IconUserPlus size={30} />}
                  title="It's just you so far"
                  body="An empty list says what belongs here and how to add it."
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
                  body="A neutral disc when the list is empty because of a search."
                >
                  <Button variant="small" className="w-full">
                    Clear search
                  </Button>
                </EmptyState>
              </div>
            </Section>

            <Section id="fields">
              <Input label="Your name" placeholder="First and last" />
              <StepBars step={2} />
              <CodeInput id="kit-code" label="Verification code" value="4829" onChange={() => undefined} />
              <CodeInput
                id="kit-backup"
                label="Backup code"
                mode="backup"
                size={26}
                value=""
                onChange={() => undefined}
                error="That code isn't right, or it has been used."
              />
              <div className="flex flex-col gap-2.5">
                <PasswordField
                  label="Create password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordRules password={password} />
              </div>
              <Input
                label="Email"
                type="email"
                defaultValue="maya.reyes@example.com"
                readOnly
                hint="Managed by your admin."
              />
              <Input label="Create password" type="password" error="At least 12 characters." />
              <Textarea label="Description" placeholder="What is happening?" />
              <Select label="Contractor company" defaultValue="coldline">
                <option value="coldline">Coldline Refrigeration</option>
                <option value="northstar">Northstar HVAC</option>
              </Select>
              <SearchField label="Search equipment" placeholder="Name, brand or serial number" />
              <SearchField
                label="Search tickets"
                value="freezer"
                onChange={() => undefined}
                onClear={() => undefined}
              />
            </Section>

            <Section id="switch">
              <div className="flex items-center gap-3">
                <Switch checked={sw} onCheckedChange={setSw} label="Example" />
                <Switch checked={!sw} onCheckedChange={(v) => setSw(!v)} label="Example inverse" />
              </div>
              <Card className="px-3.5">
                <SwitchRow
                  title="Preferred contractor"
                  subtitle="Shows first in the directory"
                  checked={sw}
                  onCheckedChange={setSw}
                  label="Preferred contractor"
                />
              </Card>
            </Section>

            <Section id="overlays">
              <div className="flex flex-wrap gap-2.5">
                <Button variant="secondary" className="w-auto" onClick={() => setSheet(true)}>
                  Open sheet
                </Button>
                <Button
                  variant="secondary"
                  className="w-auto"
                  onClick={() => toast.show('Defaults updated. 3 people were notified.')}
                >
                  Show toast
                </Button>
                <Button
                  variant="secondary"
                  className="w-auto"
                  onClick={() =>
                    toast.show('In-house task deleted.', { label: 'Undo', onClick: () => toast.show('Restored.') })
                  }
                >
                  Toast with action
                </Button>
                <Button variant="secondary" className="w-auto" onClick={() => setSignedOut(true)}>
                  Signed out sheet
                </Button>
              </div>
              <SignedOutSheet
                open={signedOut}
                email="maya.reyes@example.com"
                name="Maya Reyes"
                onSignIn={async () => {
                  setSignedOut(false)
                  return null
                }}
                onNotMe={() => setSignedOut(false)}
              />
              <Sheet
                open={sheet}
                onOpenChange={setSheet}
                title="Save 2 changes?"
                description="Defaults change for everyone with these roles. People are notified."
              >
                <Button onClick={() => setSheet(false)}>Save changes</Button>
                <Button variant="secondary" onClick={() => setSheet(false)}>
                  Cancel
                </Button>
              </Sheet>
            </Section>

            <Section id="loading">
              <div className="flex items-center gap-4">
                <Spinner />
                <span className="inline-flex items-center gap-2 rounded-input bg-brand-fill px-4 py-3 text-15 font-bold text-on-brand">
                  <ButtonSpinner /> Saving…
                </span>
              </div>
              <UpdateBar fixed={false} updating={false} onUpdate={() => toast.show('Updating.')} />
              <UpdateBar fixed={false} updating onUpdate={() => undefined} />
              <CardFeedSkeleton count={2} />
              <GroupedListSkeleton rows={2} groups={2} />
              <PeopleListSkeleton count={3} />
              <MetricsSkeleton />
              <DetailSkeleton keys={['Name', 'Brand', 'Model']} />
              <SectionLabel>Full screens</SectionLabel>
              <div className="flex flex-wrap gap-2.5">
                <ButtonLink to="/kit/loading/spinner" variant="small">
                  Centered spinner
                </ButtonLink>
                <ButtonLink to="/kit/loading/scan" variant="small">
                  QR lookup
                </ButtonLink>
              </div>
            </Section>

            <Section id="errors">
              <div className="flex flex-wrap gap-2.5">
                <ButtonLink to="/kit/errors/invite-expired" variant="small">
                  Invite expired
                </ButtonLink>
                <ButtonLink to="/kit/errors/reset-expired" variant="small">
                  Reset expired
                </ButtonLink>
                <ButtonLink to="/kit/errors/404" variant="small">
                  404
                </ButtonLink>
                <ButtonLink to="/kit/errors/403" variant="small">
                  403
                </ButtonLink>
                <ButtonLink to="/kit/errors/500" variant="small">
                  500
                </ButtonLink>
              </div>
            </Section>

            <Section id="tabbars">
              <div className="flex flex-col gap-3">
                {(Object.keys(ROLE_TABS) as AppRole[]).map((role) => (
                  <div key={role} className="overflow-hidden rounded-card border border-border">
                    <TabBar label={ROLE_TABS[role].label} items={ROLE_TABS[role].items} inset={false} />
                  </div>
                ))}
              </div>
              <p className="text-13 text-text-muted">
                Tabs link to the real routes; <Link to="/sign-in">sign in</Link> first to use them.
              </p>
            </Section>
          </div>
        </ScreenBody>
      </Screen>
    </div>
  )
}
