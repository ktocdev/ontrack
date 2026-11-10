import { useMemo, useState } from 'react'
import { AccentPicker } from '@app/components/AccentPicker'
import { Avatar } from '@app/components/Avatar'
import { Button, IconButton } from '@app/components/Button'
import {
  Card,
  CategoryTile,
  KeyValueRow,
  ListCard,
  ListRow,
  ListRowButton,
  ListRowLink,
  RowIcon,
  StackedRow,
} from '@app/components/Card'
import { OverflowMenu } from '@app/components/Menu'
import {
  CountBadge,
  RoleTag,
  StatusPill,
  TabAlert,
  UrgentTag,
  WalkthroughTag,
  type PillStatus,
} from '@app/components/Pill'
import { AllRestaurantsSquare, RestaurantName, RestaurantSquare } from '@app/components/RestaurantName'
import { RestaurantPicker } from '@app/components/RestaurantPicker'
import { ReorderList } from '@app/components/ReorderList'
import { useToast } from '@app/components/Toast'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconHelpCircle,
  IconPlus,
  IconQr,
  IconReopen,
  IconReport,
  IconSignOut,
} from '@app/components/icons'
import { isHex, normalizeHex, presetHex, PRESETS } from '@app/lib/colors'
import { Example, PageHeader, Props, Rules, Section } from '../chrome/Doc'

/* Sample restaurants: real names and colors are allowed in the seed; here they come from the tokens. */
export const SAMPLE_RESTAURANTS = [
  { id: 'a', name: 'Federale’s Logan Square', color: 'var(--restaurant-federales-logan)' },
  { id: 'b', name: 'Federale’s West Loop', color: 'var(--restaurant-federales-west-loop)' },
  { id: 'c', name: 'Ranalli’s Logan Square', color: 'var(--restaurant-ranallis-logan)' },
  { id: 'd', name: 'Porter', color: 'var(--restaurant-porter)' },
]

/* ---------------- Buttons ---------------- */

export function ButtonsPage() {
  const [loading, setLoading] = useState(false)
  return (
    <>
      <PageHeader eyebrow="Components" title="Buttons" source="components/Button.tsx">
        <p>
          One primary action per screen, full width at the bottom on a phone. Heights follow the phone rules: primary
          52px, secondary 48px, and nothing you can tap under 44px.
        </p>
      </PageHeader>

      <Section title="Primary and secondary">
        <Example
          code={`<Button>Create ticket</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>`}
        >
          <Button>Create ticket</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete restaurant</Button>
        </Example>
      </Section>

      <Section title="Every variant" intro="Each one is drawn on a board; the name says which.">
        <Example width="full">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="tall" icon={<IconReopen size={20} />}>
              Reopen ticket
            </Button>
            <Button variant="secondary-danger" icon={<IconSignOut />}>
              Sign out
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="compact" icon={<IconPlus size={18} />}>
              Invite
            </Button>
            <Button variant="medium">Ask admin for a new invite</Button>
            <Button variant="done" disabled>
              Request sent
            </Button>
            <Button variant="small">Search equipment</Button>
            <Button variant="ghost">Report this problem</Button>
            <Button variant="ghost-danger">Remove</Button>
          </div>
        </Example>
      </Section>

      <Section title="States">
        <Example
          title="Loading and disabled"
          code={`<Button loading={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
<Button disabled>Save changes</Button>`}
        >
          <Button loading={loading} onClick={() => setLoading((v) => !v)}>
            {loading ? 'Saving…' : 'Tap to toggle loading'}
          </Button>
          <Button disabled>Disabled</Button>
        </Example>
      </Section>

      <Section
        title="Icon buttons and menus"
        intro="44px squares. An icon on its own always has a label for screen readers."
      >
        <Example
          code={`<IconButton label="Back"><IconChevronLeft /></IconButton>
<IconButton label="Scan QR code" framed><IconQr /></IconButton>
<OverflowMenu label="More options" items={[{ to: '/tickets/closed', label: 'View closed tickets' }]} />`}
        >
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
            <OverflowMenu
              label="More options"
              items={[
                { to: '#', label: 'View closed tickets' },
                { to: '#', label: 'Share link' },
              ]}
            />
          </div>
        </Example>
      </Section>

      <Section title="Props">
        <Props
          rows={[
            {
              name: 'variant',
              type: "'primary' | 'secondary' | 'danger' | …",
              default: "'primary'",
              children: 'Which board button. Full-width variants fill their row unless you pass a w- class.',
            },
            { name: 'icon', type: 'ReactNode', children: 'Before the label. Replaced by the spinner while loading.' },
            {
              name: 'loading',
              type: 'boolean',
              default: 'false',
              children: 'Shows the spinner, sets aria-busy and disables the button.',
            },
            {
              name: '…button props',
              type: 'ButtonHTMLAttributes',
              children: 'Passed through; type defaults to "button".',
            },
          ]}
        />
        <p className="ds-prose m-0 text-14">
          <code>ButtonLink</code> looks the same and navigates (a React Router <code>Link</code>).{' '}
          <code>IconButton</code> takes a required <code>label</code> and <code>framed</code>.
        </p>
      </Section>

      <Section title="Guidance">
        <Rules
          dos={[
            'Write the label as the action: Create ticket, Save changes, Close ticket.',
            'Say what is happening while it works: Saving…, Updating….',
            'Put a destructive action behind a sheet that says what happens.',
          ]}
          donts={[
            'Put two primary buttons on one screen.',
            'Shrink a button below 44px to fit a row.',
            'Use danger for anything you can undo.',
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Pills and tags ---------------- */

const STATUSES: PillStatus[] = ['open', 'in_progress', 'waiting_parts', 'scheduled', 'reopened', 'closed', 'fixed']

export function PillsPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Status, tags and badges" source="components/Pill.tsx">
        <p>
          A status is a pill with an icon, so it reads without color. Tags mark what a ticket is (urgent, from a
          walkthrough); badges count.
        </p>
      </PageHeader>
      <Section title="Status pill">
        <Example
          width="full"
          code={`<StatusPill status="in_progress" />\n<StatusPill status="scheduled" label="Scheduled Thu" />`}
        >
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
            <StatusPill status="scheduled" label="Scheduled Thu" />
          </div>
        </Example>
        <Props
          rows={[
            {
              name: 'status',
              type: 'PillStatus',
              children: 'open, in_progress, waiting_parts, scheduled, reopened, closed or fixed (in-house).',
            },
            { name: 'label', type: 'string', children: 'Replaces the status name, for a date on Scheduled.' },
          ]}
        />
      </Section>
      <Section title="Tags">
        <Example width="full" code={`<UrgentTag />\n<WalkthroughTag />\n<RoleTag>Ops Manager</RoleTag>`}>
          <div className="flex flex-wrap items-center gap-2">
            <UrgentTag />
            <WalkthroughTag />
            <RoleTag>Manager</RoleTag>
            <RoleTag>Ops Manager</RoleTag>
            <RoleTag>Leadership</RoleTag>
          </div>
        </Example>
      </Section>
      <Section title="Badges">
        <Example
          width="full"
          code={`<CountBadge count={5} active />\n<TabAlert count={1} label="1 reopened ticket" />`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <CountBadge count={5} />
            <CountBadge count={5} active />
            <TabAlert count={1} label="1 reopened ticket" />
          </div>
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Use the status pill wherever a status is shown, so its icon and color always agree.',
            'Give a TabAlert a label that says what the number counts.',
          ]}
          donts={[
            'Make a new pill color for a new state: add a status token pair first.',
            'Use UrgentTag for anything but an urgent ticket.',
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Restaurants ---------------- */

export function RestaurantsPage() {
  const toast = useToast()
  const accents = useMemo(() => PRESETS.map((p) => ({ value: presetHex(p.key), label: p.label })), [])
  const [accent, setAccent] = useState(() => presetHex(PRESETS[0]!.key))
  const [custom, setCustom] = useState('#4d7c0f')
  const [order, setOrder] = useState(SAMPLE_RESTAURANTS.map((r) => r.id))
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Restaurants"
        source={['components/RestaurantName.tsx', 'components/RestaurantPicker.tsx', 'components/AccentPicker.tsx']}
      >
        <p>
          A restaurant is always its name with its color square. The name stays <code>text-body</code>; only the square
          carries the accent. The group is data: names and colors come from the database, never from code.
        </p>
      </PageHeader>
      <Section title="Name and square">
        <Example
          code={`<RestaurantName name={r.name} color={r.color} />\n<RestaurantName name="Porter" color={r.color} variant="meta" />`}
        >
          {SAMPLE_RESTAURANTS.map((r) => (
            <RestaurantName key={r.id} name={r.name} color={r.color} />
          ))}
          <RestaurantName name="Porter" color="var(--restaurant-porter)" variant="meta" />
          <span className="flex items-center gap-1.5 text-14 font-semibold">
            <AllRestaurantsSquare colors={SAMPLE_RESTAURANTS.map((r) => r.color)} />
            All restaurants (4)
          </span>
          <span className="flex items-center gap-3 text-15 font-semibold">
            <RestaurantSquare color="var(--restaurant-federales-logan)" size={14} />
            14px square, as on the Restaurants list
          </span>
        </Example>
      </Section>
      <Section title="Picker" intro="Scopes every Ops screen to one restaurant or all of them.">
        <Example>
          <RestaurantPicker
            restaurants={SAMPLE_RESTAURANTS}
            selectedId={null}
            onSelect={() => toast.show('Restaurant picked.')}
          />
        </Example>
      </Section>
      <Section title="Accent picker" intro="On Add restaurant: the presets, then a hue wheel for a custom hex.">
        <Example>
          <AccentPicker
            label="Accent color"
            hint="Presets come from the --preset-* tokens."
            options={accents}
            value={accent}
            onChange={setAccent}
            custom={custom}
            onCustomChange={setCustom}
            warning={isHex(normalizeHex(custom)) ? undefined : 'Enter a 6-digit hex code, like #C2185B.'}
          />
        </Example>
      </Section>
      <Section title="Reorder" intro="Drag, or use the keyboard, to set the order restaurants show on the dashboard.">
        <Example>
          <ReorderList
            label="Restaurants in order"
            items={order.map((id) => SAMPLE_RESTAURANTS.find((r) => r.id === id)!)}
            onChange={setOrder}
          />
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Avatars ---------------- */

export function AvatarsPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Avatars" source="components/Avatar.tsx">
        <p>
          Initials on a color from the person&apos;s role, or from the invite&apos;s state on pending and expired rows.
          A profile photo replaces the initials when the group allows photos.
        </p>
      </PageHeader>
      <Section title="Roles and states">
        <Example
          width="full"
          code={`<Avatar name="Maya Reyes" role="manager" />\n<Avatar name="Sam Patel" role="pending" size={38} />`}
        >
          <div className="flex flex-wrap items-end gap-4">
            {(['manager', 'ops', 'leadership', 'you', 'pending', 'expired'] as const).map((role) => (
              <span key={role} className="flex flex-col items-center gap-1.5">
                <Avatar
                  name={role === 'pending' ? 'Sam Patel' : role === 'expired' ? 'Jordan Blake' : 'Maya Reyes'}
                  role={role}
                />
                <span className="font-mono text-11 text-text-muted">{role}</span>
              </span>
            ))}
          </div>
        </Example>
      </Section>
      <Section title="Sizes" intro="28 and 30 in threads, 38 and 40 in lists, 52 on a person's page, 88 on Profile.">
        <Example width="full">
          <div className="flex flex-wrap items-end gap-4">
            {([28, 30, 38, 40, 52, 88] as const).map((size) => (
              <span key={size} className="flex flex-col items-center gap-1.5">
                <Avatar name="Bert Velilla" role="ops" size={size} />
                <span className="font-mono text-11 text-text-muted">{size}</span>
              </span>
            ))}
          </div>
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Cards and rows ---------------- */

export function CardsPage() {
  const toast = useToast()
  return (
    <>
      <PageHeader eyebrow="Components" title="Cards and rows" source="components/Card.tsx">
        <p>
          A card is a white surface on the screen background with a 1px border and a 14px radius, no shadow. Lists are
          rows inside one card, divided by borders.
        </p>
      </PageHeader>
      <Section title="List card">
        <Example
          code={`<ListCard>
  <ListRowLink to={path} leading={<Avatar … />} title="Bert Velilla" subtitle="All restaurants" trailing={<RoleTag>Ops Manager</RoleTag>} />
</ListCard>`}
        >
          <ListCard>
            <ListRow
              leading={<Avatar name="Sam Patel" role="pending" />}
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
            <ListRowButton
              onClick={() => toast.show('Row pressed.')}
              leading={
                <RowIcon>
                  <IconReport />
                </RowIcon>
              }
              title="Report a problem"
              trailing={<IconChevronRight className="text-text-muted" />}
            />
          </ListCard>
        </Example>
      </Section>
      <Section title="Details">
        <Example code={`<Card className="px-3.5">\n  <KeyValueRow label="Brand">Kolpak</KeyValueRow>\n</Card>`}>
          <Card className="px-3.5">
            <KeyValueRow label="Brand">Kolpak</KeyValueRow>
            <KeyValueRow label="Serial number">
              <span className="font-mono">KP-7XW-220418</span>
            </KeyValueRow>
            <KeyValueRow label="Installed">Mar 2022</KeyValueRow>
            <StackedRow label="Location">Back of House · Walk-in</StackedRow>
          </Card>
        </Example>
      </Section>
      <Section title="Category tiles" intro="Two to a row on Create ticket and the equipment lists.">
        <Example>
          <div className="grid grid-cols-2 gap-2.5">
            <CategoryTile to="#" name="Refrigeration" count={9} />
            <CategoryTile to="#" name="Dishwashing" count={1} />
            <CategoryTile to="#" name="Plumbing" count={8} />
            <CategoryTile to="#" name="Electrical" count={4} />
          </div>
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={['Leave 12 to 16px between cards.', 'Make a whole row the tap target when it opens something.']}
          donts={[
            'Put a shadow on a card; elevation is for what floats over the screen.',
            'Nest a card inside a card.',
          ]}
        />
      </Section>
    </>
  )
}
