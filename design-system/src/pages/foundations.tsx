import { useMemo } from 'react'
import * as Icons from '@app/components/icons'
import { StatusPill, type PillStatus } from '@app/components/Pill'
import { Code, Example, PageHeader, Rules, Section, TokenRef } from '../chrome/Doc'
import { baseOf, nearestStep, ramp, resolveColor, resolveValue } from '../tokens/editor'
import { FAMILIES, FAMILY_LABEL, TOKENS, TYPE_SCALE, sourceIn, type Theme, type Token } from '../tokens/source'
import { useTokens } from '../tokens/store'
import { useTheme } from '@app/theme/useTheme'
import { fontStack } from '../tokens/editor'

/* ---------------- Color ---------------- */

const COLOR_TOKENS = TOKENS.filter((t) => t.kind === 'color' || t.name === 'swatch-custom')
const GROUPS = [...new Set(COLOR_TOKENS.map((t) => t.group))]

function Swatch({ token, theme }: { token: Token; theme: Theme }) {
  const { edits } = useTokens()
  const value =
    token.kind === 'color'
      ? resolveColor(token, theme, edits)
      : ((theme === 'dark' ? token.dark : undefined) ?? token.light)
  const swatch = (
    <span
      className="block h-9 w-full rounded-[8px] shadow-[inset_0_0_0_1px_var(--ds-line)]"
      style={{ background: theme === 'dark' ? `var(--${token.name})` : value }}
    />
  )
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {/* Dark values are on [data-theme='dark'], which any element can carry; so a dark swatch shows on a light page. */}
      {theme === 'dark' ? <div data-theme="dark">{swatch}</div> : swatch}
      <span className="truncate font-ds-mono text-11 text-ds-muted" title={value}>
        {theme === 'dark' && !token.dark ? 'same as light' : value}
      </span>
    </div>
  )
}

export function ColorPage() {
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Color" source="styles/tokens.css">
        <p>
          Every color is a token, named for its job, not its hue. Light values are what the boards show; dark values are
          the proposed set from <code>tokens.md</code> plus derived ones, marked in the file. Use them through Tailwind
          (<code>bg-surface</code>, <code>text-text-muted</code>, <code>border-border-strong</code>) or{' '}
          <code>var(--surface)</code>.
        </p>
      </PageHeader>

      <Rules
        dos={[
          <>
            Pick the token for the job: <code>text-muted</code> for a meta line, <code>danger</code> for destructive
            text.
          </>,
          <>
            Add a token to <code>tokens.css</code> when no job fits, with its dark value beside it.
          </>,
          <>
            Check a new color in both themes on <code>/kit</code> before a screen uses it.
          </>,
        ]}
        donts={[
          <>Copy a hex out of a screen file into app code.</>,
          <>
            Color a restaurant&apos;s name: the name is always <code>text-body</code>; the square carries the color.
          </>,
          <>Use a status color for anything but its status.</>,
        ]}
      />

      <Section title="Ramps" id="ramps" intro={<RampsIntro />}>
        <Ramps />
      </Section>

      {GROUPS.map((g) => (
        <Section key={g} title={g}>
          <div className="overflow-hidden rounded-[14px] border border-ds-line bg-ds-panel">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 border-b border-ds-line bg-ds-sunken px-4 py-2 text-12 font-semibold text-ds-muted sm:grid">
              <span>Token</span>
              <span>Light</span>
              <span>Dark</span>
              <span>Used for</span>
            </div>
            {COLOR_TOKENS.filter((t) => t.group === g).map((t) => (
              <div
                key={t.name}
                className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-ds-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center"
              >
                <span className="col-span-2 flex min-w-0 flex-col sm:col-span-1">
                  <span className="truncate font-ds-mono text-13 font-medium text-ds-ink">--{t.name}</span>
                  {t.kind === 'color' && (
                    <span className="font-ds-mono text-11 text-ds-muted">{utilityFor(t.name)}</span>
                  )}
                </span>
                <Swatch token={t} theme="light" />
                <Swatch token={t} theme="dark" />
                <span className="col-span-2 text-13 text-ds-ink-soft sm:col-span-1">
                  {t.note ?? ''}
                  {t.darkNote && t.darkNote !== t.note && (
                    <span className="block text-12 text-ds-muted">Dark: {t.darkNote}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section
        title="Status pills"
        id="status-pills"
        intro="Each status pairs a background and a text token and always has its icon, so it never relies on color alone."
      >
        <Example width="full">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>
          <div data-theme="dark" className="flex flex-wrap gap-2 rounded-card bg-bg p-3">
            {STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>
        </Example>
      </Section>
    </>
  )
}

const STATUSES: PillStatus[] = ['open', 'in_progress', 'waiting_parts', 'scheduled', 'reopened', 'closed', 'fixed']

function utilityFor(name: string) {
  if (name.startsWith('text')) return `text-${name}`
  if (/^(border|wt-tag-border|reopened-banner-border|square-outline)/.test(name)) return `border-${name}`
  if (/-text$|^on-brand|^brand$|^danger$|^info$|^toast-action$/.test(name)) return `text-${name}`
  return `bg-${name}`
}

function RampsIntro() {
  const { theme } = useTheme()
  return (
    <p>
      The editor groups colors into five ramps. Each ramp starts from one token, and every other color on it is measured
      against that base, so moving the base moves them all. These are the {theme} theme&apos;s ramps, with each token
      placed at its nearest step.
    </p>
  )
}

function Ramps() {
  const { edits } = useTokens()
  const { theme } = useTheme()
  const tokens = useMemo(() => TOKENS.filter((t) => t.kind === 'color'), [])
  return (
    <div className="flex flex-col gap-6">
      {FAMILIES.map((f) => {
        const steps = ramp(baseOf(edits, theme, f))
        const on = tokens.filter((t) => sourceIn(t.name, theme) === f)
        return (
          <div key={f} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-ds-display text-16 font-bold text-ds-ink">{FAMILY_LABEL[f]}</h3>
              <span className="font-ds-mono text-12 text-ds-muted">{baseOf(edits, theme, f)}</span>
            </div>
            <div className="grid grid-cols-[repeat(11,minmax(0,1fr))] gap-1">
              {steps.map((s) => {
                const here = on.filter((t) => nearestStep(resolveColor(t, theme, edits)) === s.step)
                return (
                  <div key={s.step} className="flex min-w-0 flex-col gap-1">
                    <span className="h-12 rounded-[6px]" style={{ background: s.color }} title={s.color} />
                    <span className="text-center font-ds-mono text-[10px] text-ds-muted">{s.step}</span>
                    <span className="hidden flex-col gap-0.5 md:flex">
                      {here.map((t) => (
                        <span
                          key={t.name}
                          className="truncate text-center font-ds-mono text-[9px] text-ds-ink-soft"
                          title={`--${t.name}`}
                        >
                          {t.name}
                        </span>
                      ))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Typography ---------------- */

const ROLES = [
  {
    label: 'H1 · screen title',
    cls: 'font-display text-30 font-bold tracking-[-0.02em]',
    text: 'Open tickets',
    spec: 'Archivo 30 / 700 / −0.02em',
  },
  {
    label: 'Detail title',
    cls: 'font-display text-24 font-bold tracking-[-0.01em]',
    text: 'Walk-in Cooler 1',
    spec: 'Archivo 24 / 700',
  },
  {
    label: 'Sheet title',
    cls: 'font-display text-22 font-bold tracking-[-0.01em]',
    text: 'Save 2 changes?',
    spec: 'Archivo 22 / 700',
  },
  {
    label: 'Card title',
    cls: 'text-16 font-bold',
    text: 'Walk-in cooler not holding temp',
    spec: 'Public Sans 16 / 700',
  },
  {
    label: 'Body',
    cls: 'text-15 text-text-body',
    text: 'Refrigeration tech booked for today 2–4 PM.',
    spec: 'Public Sans 15 / 400',
  },
  { label: 'Button label', cls: 'text-15 font-bold', text: 'Create ticket', spec: 'Public Sans 15 / 700' },
  {
    label: 'Meta',
    cls: 'text-13 text-text-muted',
    text: 'Back of House · Refrigeration · 1h ago',
    spec: 'Public Sans 13 / 400, text-muted',
  },
  { label: 'Eyebrow', cls: 'eyebrow', text: 'Equipment', spec: '12 / 700 / 0.06em, uppercase' },
  {
    label: 'Mono',
    cls: 'font-mono text-14 font-medium',
    text: 'OT-1042 · KP-7XW-220418 · $397.40',
    spec: 'JetBrains Mono 14 / 500',
  },
]

export function TypographyPage() {
  const { edits } = useTokens()
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Typography" source={['styles/tokens.css', 'index.css']}>
        <p>
          Three families. Archivo for titles and numbers, Public Sans for everything else, JetBrains Mono for ids,
          serial numbers and money. The app bundles static weights, because WebKit on Windows ignores variable weight
          axes.
        </p>
      </PageHeader>
      <Section title="Families">
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['display', 'font-display', 'Titles, sheet titles, KPI numbers, initials', '500 · 600 · 700'],
              ['body', 'font-body', 'Everything else; fields included', '400 · 500 · 600 · 700'],
              ['mono', 'font-mono', 'Ticket ids, serials, money', '500'],
            ] as const
          ).map(([role, util, use, weights]) => (
            <div key={role} className="flex flex-col gap-2 rounded-[14px] border border-ds-line bg-ds-panel p-5">
              <span className="font-ds-mono text-12 text-ds-muted">{util}</span>
              <span className={`ds-canvas bg-transparent! text-40 leading-none font-bold text-ds-ink! ${util}`}>
                Aa
              </span>
              <span className="truncate text-14 font-semibold text-ds-ink">
                {fontStack(edits, role).split(',')[0]?.replace(/'/g, '')}
              </span>
              <span className="text-13 text-ds-muted">{use}</span>
              <span className="font-ds-mono text-11 text-ds-muted">{weights}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Roles" intro="What the boards use each size for. Use these pairs rather than inventing a size.">
        <Example width="full" surface>
          {ROLES.map((r) => (
            <div
              key={r.label}
              className="grid gap-1 border-b border-border pb-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-4"
            >
              <span className="flex flex-col">
                <span className="text-13 font-semibold text-text-body">{r.label}</span>
                <span className="font-mono text-11 text-text-muted">{r.spec}</span>
              </span>
              <span className={r.cls}>{r.text}</span>
            </div>
          ))}
        </Example>
      </Section>
      <Section title="Scale">
        <div className="overflow-hidden rounded-[14px] border border-ds-line bg-ds-panel">
          {TYPE_SCALE.map((s) => (
            <div key={s.name} className="flex items-baseline gap-4 border-b border-ds-line px-4 py-2.5 last:border-b-0">
              <span className="w-20 flex-none font-ds-mono text-12 text-ds-muted">{s.name}</span>
              <span className="w-12 flex-none font-ds-mono text-12 text-ds-muted">{s.px}px</span>
              <span
                className="truncate text-ds-ink"
                style={{
                  fontSize: s.px,
                  fontFamily: fontStack(edits, s.px >= 20 ? 'display' : 'body'),
                  fontWeight: s.px >= 20 ? 700 : 400,
                }}
              >
                Walk-in cooler not holding temp
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="On a phone">
        <Rules
          dos={[
            <>Keep inputs, selects and textareas at 16px. The base stylesheet sets it.</>,
            <>Follow the design for button labels: 14 to 15px.</>,
          ]}
          donts={[
            <>
              Put a text-size utility below <code>text-16</code> on a field: iOS zooms the page on focus.
            </>,
          ]}
        />
      </Section>
    </>
  )
}

/* ---------------- Shape ---------------- */

export function ShapePage() {
  const { edits } = useTokens()
  const radii = TOKENS.filter((t) => t.kind === 'radius')
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Shape" source="styles/tokens.css">
        <p>
          Corner radius tells pieces apart: cards are 14, inputs and buttons 12, small controls 10, tags 6. Sheets round
          only their top corners.
        </p>
      </PageHeader>
      <Section title="Radii">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {radii.map((t) => (
            <div key={t.name} className="flex flex-col gap-2 rounded-[14px] border border-ds-line bg-ds-panel p-4">
              <div className="ds-canvas flex h-24 items-center justify-center rounded-[10px]">
                <span
                  className="h-16 w-24 border border-border-strong bg-surface"
                  style={{ borderRadius: `var(--${t.name})` }}
                />
              </div>
              <span className="font-ds-mono text-12 font-medium text-ds-ink">
                rounded-{t.name.replace('radius-', '')}
              </span>
              <span className="font-ds-mono text-11 text-ds-muted">{resolveValue(t, 'light', edits)}</span>
              <span className="text-12 text-ds-muted">{t.note ?? ''}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

/* ---------------- Elevation ---------------- */

export function ElevationPage() {
  const shadows = TOKENS.filter((t) => t.kind === 'shadow')
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Elevation" source="styles/tokens.css">
        <p>
          OnTrack is mostly flat: cards sit on the screen with a 1px border, not a shadow. Shadows are for what floats
          over the screen (a toast, a dialog) and for the small lifts inside controls. The shadow color is the text
          color at low alpha; in dark it turns black and a little stronger.
        </p>
      </PageHeader>
      <Section title="Shadows">
        <Example width="full">
          <div className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-3">
            {shadows.map((t) => (
              <div key={t.name} className="flex flex-col gap-3">
                <div className="h-20 rounded-card bg-surface" style={{ boxShadow: `var(--${t.name})` }} />
                <span className="font-mono text-12 font-medium">shadow-{t.name.replace('shadow-', '')}</span>
                <span className="text-12 text-text-muted">{t.note}</span>
              </div>
            ))}
          </div>
        </Example>
      </Section>
      <Section
        title="Scrim"
        intro={
          <>
            Behind sheets and dialogs: <TokenRef name="scrim" swatch />.
          </>
        }
      >
        <Example width="full" bare>
          <div className="relative h-56 overflow-hidden">
            <div className="flex flex-col gap-2 p-5">
              <div className="h-16 rounded-card border border-border bg-surface" />
              <div className="h-16 rounded-card border border-border bg-surface" />
            </div>
            <div className="absolute inset-0 bg-scrim" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-sheet bg-surface p-5 shadow-raised">
              <span className="mx-auto mb-2 h-1 w-9 rounded-pill bg-border-strong" />
              <span className="font-display text-22 font-bold">Save 2 changes?</span>
              <span className="text-14 text-text-muted">A sheet rises over the scrim.</span>
            </div>
          </div>
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Spacing ---------------- */

export function SpacingPage() {
  const { edits } = useTokens()
  const layout = TOKENS.filter((t) => t.group === 'Layout' || t.group.startsWith('Desktop'))
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Spacing and layout" source="styles/tokens.css">
        <p>
          Phone first: 20px at the sides of every screen, 12 to 16px between cards, and every tap target at least 44px.
          Spacing inside components uses Tailwind&apos;s 4px unit (<code>gap-3</code> is 12px).
        </p>
      </PageHeader>
      <Section title="Phone rules">
        <Rules
          dos={[
            <>
              Pad screens with <code>px-screen</code> (20px).
            </>,
            <>
              Make tap targets at least <code>min-h-tap</code> (44px); primary buttons 52px, secondary 48px.
            </>,
            <>
              Pad fixed chrome with the safe-area insets: <code>pt-safe</code>, <code>pb-safe</code>.
            </>,
            <>
              Use <code>100dvh</code> for full-height layouts.
            </>,
          ]}
          donts={[
            <>
              Use <code>100vh</code>: it hides content under the browser bar on a phone.
            </>,
            <>Add the board&apos;s 20px home-bar allowance on top of the real inset; it is replaced, not added to.</>,
          ]}
        />
      </Section>
      <Section title="Layout tokens">
        <div className="overflow-hidden rounded-[14px] border border-ds-line bg-ds-panel">
          {layout.map((t) => (
            <div key={t.name} className="flex items-center gap-4 border-b border-ds-line px-4 py-2.5 last:border-b-0">
              <span className="w-40 flex-none font-ds-mono text-12 font-medium text-ds-ink">--{t.name}</span>
              <span className="w-44 flex-none truncate font-ds-mono text-12 text-ds-muted">
                {resolveValue(t, 'light', edits)}
              </span>
              <span className="text-13 text-ds-ink-soft">{t.note ?? ''}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Spacing unit" intro="Tailwind steps of 4px. The editor's spacing strength scales this unit.">
        <Example width="full">
          {[1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <span className="w-16 font-mono text-12 text-text-muted">{n}</span>
              <span className="h-3 rounded-[2px] bg-brand" style={{ width: `calc(var(--spacing) * ${n})` }} />
              <span className="font-mono text-11 text-text-muted">{n * 4 * edits.spaceScale}px</span>
            </div>
          ))}
        </Example>
      </Section>
    </>
  )
}

/* ---------------- Icons ---------------- */

const ICONS = Object.entries(Icons).filter(([name]) => name.startsWith('Icon')) as [
  string,
  (p: { size?: number }) => React.ReactNode,
][]

export function IconsPage() {
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Icons" source="components/icons.tsx">
        <p>
          {ICONS.length} line icons drawn at 24px, 2px stroke, in the current text color. Pass <code>size</code> for the
          boards&apos; 18, 20 or 22. An icon beside text is decorative; an icon on its own needs a label on its button.
        </p>
      </PageHeader>
      <Section title="Set">
        <Example width="full" surface>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {ICONS.map(([name, Icon]) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-input px-1 py-3 text-text hover:bg-surface-hover"
              >
                <Icon size={24} />
                <span className="w-full truncate text-center font-mono text-[10px] text-text-muted" title={name}>
                  {name.replace('Icon', '')}
                </span>
              </div>
            ))}
          </div>
        </Example>
        <Code>{`import { IconWrench } from '../components/icons'

<IconWrench size={20} className="text-text-muted" />`}</Code>
      </Section>
    </>
  )
}
