import { useState } from 'react'
import { Button } from '@app/components/Button'
import { Card } from '@app/components/Card'
import { Chip, ChoiceChips, FilterButton, FilterChip } from '@app/components/Chip'
import { CodeInput, StepBars } from '@app/components/CodeInput'
import { EmptyState } from '@app/components/EmptyState'
import { CostCard } from '@app/components/Cost'
import { Input, PasswordField, PasswordRules, SearchField, Select, Textarea } from '@app/components/Field'
import { InstallSheet } from '@app/components/InstallSheet'
import { ErrorBanner, Notice } from '@app/components/Notice'
import { RadioCard } from '@app/components/RadioCard'
import {
  BackBar,
  BrandBackBar,
  CloseBar,
  ScreenHeader,
  SectionLabel,
  TitleBar,
  UnderlineTabs,
} from '@app/components/Screen'
import { Segmented } from '@app/components/Segmented'
import { Sheet } from '@app/components/Sheet'
import { StatusMenu } from '@app/components/StatusMenu'
import { Switch, SwitchRow } from '@app/components/Switch'
import { TabBar } from '@app/components/TabBar'
import { TabAlert } from '@app/components/Pill'
import { EquipmentMenu, TicketMenu } from '@app/components/TicketMenu'
import { useToast } from '@app/components/Toast'
import { UpdateBar } from '@app/components/UpdateBar'
import { IconPlus, IconSearchOff, IconUserPlus } from '@app/components/icons'
import { ROLE_TABS } from '@app/app/roles'
import type { AppRole } from '@app/lib/supabase'
import { Example, PageHeader, Props, Rules, Section } from '../chrome/Doc'

/* ---------------- Fields ---------------- */

export function FieldsPage() {
  const [password, setPassword] = useState('kitchen4')
  const [code, setCode] = useState('4829')
  const [query, setQuery] = useState('freezer')
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Fields"
        source={['components/Field.tsx', 'components/CodeInput.tsx', 'components/Cost.tsx']}
      >
        <p>
          Every field has a visible label above it and its text at 16px, so iOS never zooms. Hints sit under the field;
          an error replaces the hint and says how to fix it.
        </p>
      </PageHeader>
      <Section title="Text">
        <Example
          code={`<Input label="Your name" placeholder="First and last" />\n<Input label="Email" readOnly hint="Managed by your admin." />`}
        >
          <Input label="Your name" placeholder="First and last" />
          <Input
            label="Email"
            type="email"
            defaultValue="maya.reyes@example.com"
            readOnly
            hint="Managed by your admin."
          />
          <Textarea label="Description" placeholder="What is happening?" />
          <Select label="Contractor company" defaultValue="coldline">
            <option value="coldline">Coldline Refrigeration</option>
            <option value="northstar">Northstar HVAC</option>
          </Select>
        </Example>
      </Section>
      <Section
        title="Cost"
        intro="Log service and Edit service record: a field per amount on the right, the total under a divider. An amount that won't read is marked and the total shows a dash."
      >
        <Example code={`<CostCard rows={[{ label: 'Labor', value, onChange }, …]} total="$397.40" />`}>
          <CostCard
            rows={[
              { label: 'Labor', value: '$120.00', onChange: () => undefined },
              { label: 'Parts', value: '$212.40', onChange: () => undefined },
              { label: 'Trip / call-out fee', value: '$65.00', onChange: () => undefined },
            ]}
            total="$397.40"
          />
          <CostCard
            rows={[
              { label: 'Labor', value: '$120.00', onChange: () => undefined },
              { label: 'Parts', value: '12.345', onChange: () => undefined, invalid: true },
            ]}
            total={null}
          />
        </Example>
      </Section>
      <Section title="Search">
        <Example code={`<SearchField label="Search tickets" value={q} onChange={setQ} onClear={() => setQ('')} />`}>
          <SearchField label="Search equipment" placeholder="Name, brand or serial number" />
          <SearchField
            label="Search tickets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
          />
        </Example>
      </Section>
      <Section title="Passwords" intro="Show / Hide on every password field; the rules tick as you type.">
        <Example>
          <PasswordField
            label="Create password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordRules password={password} />
          <PasswordField label="Confirm password" error="At least 12 characters." />
        </Example>
      </Section>
      <Section title="Codes" intro="2-step verification and backup codes.">
        <Example>
          <StepBars step={2} />
          <CodeInput id="ds-code" label="Verification code" value={code} onChange={setCode} />
          <CodeInput
            id="ds-backup"
            label="Backup code"
            mode="backup"
            size={26}
            value=""
            onChange={() => undefined}
            error="That code isn't right, or it has been used."
          />
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Label every field; a placeholder is an example, not a label.',
            'Keep what someone typed when saving fails.',
          ]}
          donts={['Set a field below 16px.', 'Clear a form on an error.']}
        />
      </Section>
    </>
  )
}

/* ---------------- Choices ---------------- */

export function ChoicesPage() {
  const [seg, setSeg] = useState<'all' | 'foh' | 'boh'>('all')
  const [chip, setChip] = useState(true)
  const [radio, setRadio] = useState(0)
  const [sw, setSw] = useState(true)
  const [urgency, setUrgency] = useState<'low' | 'normal' | 'urgent'>('normal')
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Choices and toggles"
        source={[
          'components/Segmented.tsx',
          'components/Chip.tsx',
          'components/RadioCard.tsx',
          'components/Switch.tsx',
        ]}
      >
        <p>
          Segmented controls switch a view, chips pick and filter, radio cards choose one with an explanation, and
          switches turn a setting on or off at once.
        </p>
      </PageHeader>
      <Section title="Segmented">
        <Example
          code={`<Segmented label="Area" value={area} onChange={setArea} size="sm"
  options={[{ value: 'all', label: 'All · 5' }, { value: 'foh', label: 'Front · 2' }, { value: 'boh', label: 'Back · 3' }]} />`}
        >
          <Segmented
            label="Area"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'all', label: 'All · 5' },
              { value: 'foh', label: 'Front · 2' },
              { value: 'boh', label: 'Back · 3' },
            ]}
          />
          <Segmented
            label="Area, small"
            size="sm"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'all', label: 'All' },
              { value: 'foh', label: 'Front' },
              { value: 'boh', label: 'Back' },
            ]}
          />
        </Example>
        <Props
          rows={[
            { name: 'value / onChange', type: 'T / (v: T) => void', children: 'The selected option.' },
            { name: 'options', type: '{ value: T; label: ReactNode }[]', children: 'Two to four.' },
            { name: 'label', type: 'string', children: 'Names the radiogroup for screen readers.' },
            { name: 'size', type: "'md' | 'sm'", default: "'md'", children: '40 or 36px track.' },
            {
              name: 'fit',
              type: 'boolean',
              default: 'false',
              children: 'Size to the labels instead of filling the row.',
            },
          ]}
        />
      </Section>
      <Section title="Chips">
        <Example width="full">
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
          <div className="flex flex-wrap gap-2">
            <Chip selected={chip} onClick={() => setChip(true)}>
              All · 42
            </Chip>
            <Chip selected={!chip} onClick={() => setChip(false)}>
              Pending · 3
            </Chip>
            <Chip tone="pick" selected={chip} onClick={() => setChip(true)}>
              Porter
            </Chip>
            <Chip tone="pick" selected={false} disabled>
              Disabled
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton count={0} />
            <FilterButton count={2} />
            <FilterChip label="Back of House" onRemove={() => undefined} />
            <FilterChip label="Refrigeration" onRemove={() => undefined} />
          </div>
        </Example>
      </Section>
      <Section title="Radio cards">
        <Example>
          <div role="radiogroup" aria-label="Role" className="flex flex-col gap-2">
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
        </Example>
      </Section>
      <Section title="Switch">
        <Example
          code={`<SwitchRow title="Preferred contractor" subtitle="Shows first in the directory" checked={on} onCheckedChange={setOn} label="Preferred contractor" />`}
        >
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
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Use a switch only when the change applies at once.',
            'Show a count in a segment when it helps choose.',
          ]}
          donts={[
            'Use a segmented control for more than four options.',
            'Use a switch inside a form that has a Save button.',
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Navigation ---------------- */

export function NavigationPage() {
  return (
    <>
      <PageHeader eyebrow="Components" title="Navigation" source={['components/Screen.tsx', 'components/TabBar.tsx']}>
        <p>
          Home screens sit in the tab bar shell; detail screens get a back bar instead. Every screen is built from{' '}
          <code>Screen</code>, <code>ScreenHeader</code> and <code>ScreenBody</code>.
        </p>
      </PageHeader>
      <Section title="Screen header">
        <Example bare code={`<ScreenHeader title="Open tickets" action={<OverflowMenu … />} />`}>
          <ScreenHeader title="Open tickets" />
        </Example>
      </Section>
      <Section title="Bars" intro="Back, close and title bars for detail screens; the brand bar over a cover.">
        <Example width="full" bare>
          <BackBar to="#" label="Equipment" />
          <TitleBar to="#" label="Back" title="Closed tickets" />
          <CloseBar to="#" title="Add restaurant" />
          <CloseBar to="#" title="Log service" subtitle="OT-1042 · Walk-in Cooler 1" bordered={false} />
          <BrandBackBar to="#" label="Back" />
        </Example>
      </Section>
      <Section title="Underline tabs">
        <Example
          code={`<UnderlineTabs label="Ticket lists" items={[{ to: '/tickets', label: 'Open · 14', end: true }, { to: '/tickets/closed', label: 'Closed' }]} />`}
        >
          <UnderlineTabs
            label="Example tabs"
            items={[
              { to: '/', label: <>Open · 14</>, end: true },
              {
                to: '/closed',
                label: (
                  <>
                    Closed <TabAlert count={1} label="1 reopened" />
                  </>
                ),
              },
            ]}
          />
        </Example>
      </Section>
      <Section
        title="Tab bars"
        intro="One per role, from app/roles.ts. Its bottom padding is the home-bar inset, at least 8px."
      >
        <Example width="full" bare>
          {(Object.keys(ROLE_TABS) as AppRole[]).map((role) => (
            <div key={role} className="border-b border-border last:border-b-0">
              <SectionLabel>{ROLE_TABS[role].label}</SectionLabel>
              <TabBar label={ROLE_TABS[role].label} items={ROLE_TABS[role].items} inset={false} />
            </div>
          ))}
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Feedback ---------------- */

export function FeedbackPage() {
  const toast = useToast()
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Feedback"
        source={[
          'components/Notice.tsx',
          'components/Toast.tsx',
          'components/EmptyState.tsx',
          'components/UpdateBar.tsx',
        ]}
      >
        <p>Notices stay on a screen, toasts confirm and leave, empty states say what belongs here and how to add it.</p>
      </PageHeader>
      <Section title="Notices">
        <Example
          code={`<Notice tone="info">Closed tickets also appear on each piece of equipment.</Notice>\n<ErrorBanner title="Couldn't save yet.">Everything you entered is still here.</ErrorBanner>`}
        >
          <Notice>Profile saved.</Notice>
          <Notice tone="info">Closed tickets also appear on each piece of equipment, with their costs.</Notice>
          <Notice tone="waiting">
            <b>Reopened and sent to Ops.</b> You&apos;ll get a notification when work starts.
          </Notice>
          <ErrorBanner title="Couldn't save yet.">Everything you entered is still here.</ErrorBanner>
        </Example>
      </Section>
      <Section title="Toast">
        <Example code={`toast.show('In-house task deleted.', { label: 'Undo', onClick: restore })`}>
          <Button variant="secondary" onClick={() => toast.show('Defaults updated. 3 people were notified.')}>
            Show toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show('In-house task deleted.', { label: 'Undo', onClick: () => toast.show('Restored.') })
            }
          >
            Toast with an action
          </Button>
        </Example>
      </Section>
      <Section title="Empty states">
        <Example width="full">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </Example>
      </Section>
      <Section title="Update bar">
        <Example>
          <UpdateBar fixed={false} updating={false} onUpdate={() => toast.show('Updating.')} />
          <UpdateBar fixed={false} updating onUpdate={() => undefined} />
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Say what happened and what happens next.',
            'Offer Undo on a toast rather than asking first, where undo is possible.',
          ]}
          donts={[
            'Blame the person: say "Couldn\'t save yet", not "You entered an invalid value".',
            'Use a toast for something they must act on.',
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Sheets and menus ---------------- */

export function SheetsPage() {
  const toast = useToast()
  const [sheet, setSheet] = useState(false)
  const [install, setInstall] = useState<'available' | 'ios-manual' | null>(null)
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Sheets and menus"
        source={['components/Sheet.tsx', 'components/Menu.tsx', 'components/StatusMenu.tsx']}
      >
        <p>
          A sheet rises from the bottom for a decision or a short form; on a computer it becomes a centered dialog.
          Swipe down closes it from the top of its scroll. Menus hold the less common actions behind an ellipsis.
        </p>
      </PageHeader>
      <Section title="Sheet">
        <Example
          code={`<Sheet open={open} onOpenChange={setOpen} title="Save 2 changes?" description="…">\n  <Button>Save changes</Button>\n  <Button variant="secondary">Cancel</Button>\n</Sheet>`}
        >
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
          <Button variant="secondary" onClick={() => setInstall('available')}>
            Install sheet (Android)
          </Button>
          <Button variant="secondary" onClick={() => setInstall('ios-manual')}>
            Install sheet (iPhone)
          </Button>
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
          <InstallSheet
            open={install !== null}
            onOpenChange={(open) => !open && setInstall(null)}
            state={install ?? 'available'}
            onInstall={() => {
              setInstall(null)
              toast.show('The install prompt would open.')
            }}
          />
        </Example>
        <Props
          rows={[
            { name: 'open / onOpenChange', type: 'boolean / (open) => void', children: 'Controlled.' },
            { name: 'title', type: 'string', children: 'Always set; hideTitle keeps it for screen readers only.' },
            { name: 'description', type: 'ReactNode', children: 'Under the title: what happens if you go ahead.' },
            {
              name: 'modal',
              type: 'boolean',
              default: 'false',
              children: 'Ignores Escape, outside taps and swipes; only an action closes it.',
            },
            {
              name: 'surface',
              type: 'boolean',
              default: 'false',
              children: 'White panel instead of the screen background.',
            },
            {
              name: 'icon / action',
              type: 'ReactNode',
              children: 'A badge above the title; a link beside it (Clear all).',
            },
          ]}
        />
      </Section>
      <Section title="Menus">
        <Example>
          <div className="flex items-center gap-2">
            <TicketMenu displayId="OT-1042" title="Walk-in cooler not holding temp" />
            <EquipmentMenu id="ds" name="Walk-in Cooler 1" />
          </div>
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
        </Example>
      </Section>
      <Section title="Guidance">
        <Rules
          dos={[
            'Put the primary action first in a sheet, Cancel second.',
            'Say in the description what the action does to other people.',
          ]}
          donts={['Stack a sheet on a sheet.', 'Let the Signed out sheet close by a swipe; it is modal.']}
        />
      </Section>
    </>
  )
}
