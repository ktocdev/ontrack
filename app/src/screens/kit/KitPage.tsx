import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AccentPicker } from '../../components/AccentPicker'
import { Avatar } from '../../components/Avatar'
import { Button, ButtonLink, IconButton } from '../../components/Button'
import { Card, KeyValueRow, ListCard, ListRow, ListRowButton, ListRowLink, RowIcon } from '../../components/Card'
import { Chip } from '../../components/Chip'
import { EmptyState } from '../../components/EmptyState'
import { Input, PasswordField, PasswordRules, SearchField, Select, Textarea } from '../../components/Field'
import { Notice } from '../../components/Notice'
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
import { CloseBar, Screen, ScreenBody, ScreenHeader, SectionLabel, UnderlineTabs } from '../../components/Screen'
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
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconHelpCircle,
  IconPlus,
  IconQr,
  IconSignOut,
  IconUserPlus,
} from '../../components/icons'
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

const STATUSES: PillStatus[] = [
  'open',
  'unassigned',
  'in_progress',
  'waiting_parts',
  'scheduled',
  'reopened',
  'closed',
  'fixed',
]

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

export function KitPage() {
  const { theme } = useTheme()
  const toast = useToast()
  const [seg, setSeg] = useState<'all' | 'foh' | 'boh'>('all')
  const [sw, setSw] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [loading, setLoading] = useState(false)
  const accents = useMemo(() => PRESETS.map((p) => ({ value: presetHex(p.key), label: p.label })), [])
  const [accent, setAccent] = useState(() => presetHex(PRESETS[0]!.key))
  const [customAccent, setCustomAccent] = useState('#4d7c0f')
  const [chip, setChip] = useState(true)
  const [radio, setRadio] = useState(0)
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
              </div>
            </Section>

            <Section id="cards">
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-13 text-text-secondary">OT-1042</span>
                  <StatusPill status="in_progress" />
                </div>
                <span className="text-16 font-semibold">Walk-in cooler not holding temp</span>
                <span className="text-13 text-text-muted">Back of House · Refrigeration · Walk-in Cooler 1</span>
              </Card>
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
            </Section>

            <Section id="fields">
              <Input label="Your name" placeholder="First and last" />
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
