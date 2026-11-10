import { useId } from 'react'
import { fontStack, resolveRadius, resolveShadow } from '../tokens/editor'
import { FONTS, fontById, type FontRole } from '../tokens/fonts'
import { FONT_STACKS, TOKENS, valueIn, type Theme } from '../tokens/source'
import { useTokens } from '../tokens/store'
import { PanelSection, Slider, TextButton } from './controls'

const ROLE_LABEL: Record<FontRole, { title: string; sample: string; hint: string }> = {
  display: { title: 'Display', sample: 'Open tickets', hint: 'Titles, sheet titles, KPI numbers, initials' },
  body: { title: 'Body', sample: 'Walk-in cooler not holding temp', hint: 'Everything else, fields included' },
  mono: { title: 'Mono', sample: 'OT-1042 · $397.40', hint: 'Ticket ids, serial numbers, money' },
}

const bundledId = (role: FontRole) => FONTS.find((f) => f.bundled && f.stack === FONT_STACKS[role])?.id

export function TypeTab() {
  const { edits, update } = useTokens()
  return (
    <>
      {(['display', 'body', 'mono'] as const).map((role) => {
        const current = edits.fonts[role] ?? bundledId(role)
        const isDefault = !edits.fonts[role] || edits.fonts[role] === bundledId(role)
        return (
          <FontPicker
            key={role}
            role={role}
            value={current ?? ''}
            isDefault={isDefault}
            onChange={(id) =>
              update((d) => {
                if (id === bundledId(role)) delete d.fonts[role]
                else d.fonts[role] = id
              })
            }
          />
        )
      })}
      <p className="px-5 py-4 text-12 leading-[1.5] text-ds-muted">
        Fonts the app doesn&apos;t bundle load from Google Fonts while you try them. The app ships static weights
        through @fontsource; Export says which packages to add.
      </p>
    </>
  )
}

function FontPicker({
  role,
  value,
  isDefault,
  onChange,
}: {
  role: FontRole
  value: string
  isDefault: boolean
  onChange: (id: string) => void
}) {
  const { edits } = useTokens()
  const id = useId()
  const info = ROLE_LABEL[role]
  const options = FONTS.filter((f) => f.roles.includes(role))
  return (
    <PanelSection
      title={info.title}
      action={!isDefault && <TextButton onClick={() => onChange(bundledId(role)!)}>Reset</TextButton>}
    >
      <label htmlFor={id} className="sr-only">
        {info.title} font
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-control border border-ds-line-strong bg-ds-panel px-2.5 text-[16px] text-ds-ink sm:text-14"
      >
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {f.id}
            {f.bundled ? ' (bundled)' : ''}
          </option>
        ))}
      </select>
      <p
        className="m-0 truncate text-22 text-ds-ink"
        style={{ fontFamily: fontStack(edits, role), fontWeight: role === 'display' ? 700 : 500 }}
      >
        {info.sample}
      </p>
      <p className="m-0 text-12 text-ds-muted">
        {info.hint}. Weights {fontById(value)?.weights.join(', ')}.
      </p>
    </PanelSection>
  )
}

const RADII = TOKENS.filter((t) => t.kind === 'radius')

export function ShapeTab() {
  const { edits, update } = useTokens()
  return (
    <>
      <PanelSection title="Radius strength">
        <Slider
          label="Every corner"
          value={edits.radiusScale}
          defaultValue={1}
          min={0}
          max={2}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update((d) => void (d.radiusScale = v))}
        />
        <p className="m-0 text-12 text-ds-muted">0% is square, 200% twice as round. Pills stay pills.</p>
      </PanelSection>
      <PanelSection
        title="Each radius"
        action={
          Object.keys(edits.radii).length > 0 && (
            <TextButton onClick={() => update((d) => void (d.radii = {}))}>Reset all</TextButton>
          )
        }
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {RADII.map((t) => {
            const own = edits.radii[t.name] ?? parseFloat(t.light)
            const pill = t.name === 'radius-pill'
            return (
              <li key={t.name} className="flex items-center gap-3 border-t border-ds-line py-2 first:border-t-0">
                <span
                  aria-hidden
                  className="h-9 w-12 flex-none border-2 border-ds-accent bg-ds-accent-soft"
                  style={{ borderRadius: resolveRadius(t, edits) }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-ds-mono text-12 font-medium text-ds-ink">--{t.name}</span>
                  <span className="truncate text-11 text-ds-muted">{t.note ?? ' '}</span>
                </span>
                {pill ? (
                  <span className="font-ds-mono text-12 text-ds-muted">999px</span>
                ) : (
                  <label className="flex items-center gap-1 font-ds-mono text-12 text-ds-muted">
                    <span className="sr-only">--{t.name} in px</span>
                    <input
                      type="number"
                      min={0}
                      max={64}
                      value={own}
                      onChange={(e) =>
                        update((d) => {
                          const v = Number(e.target.value)
                          if (!Number.isFinite(v) || v === parseFloat(t.light)) delete d.radii[t.name]
                          else d.radii[t.name] = Math.max(0, Math.min(64, v))
                        })
                      }
                      className="h-8 w-16 rounded-segment border border-ds-line-strong bg-ds-panel px-2 text-right text-[16px] text-ds-ink sm:text-12"
                    />
                    px
                  </label>
                )}
              </li>
            )
          })}
        </ul>
        <p className="m-0 text-12 text-ds-muted">Values before the strength above; it multiplies every one.</p>
      </PanelSection>
    </>
  )
}

const SHADOWS = TOKENS.filter((t) => t.kind === 'shadow')

export function ShadowTab({ theme }: { theme: Theme }) {
  const { edits, update } = useTokens()
  const te = edits[theme]
  return (
    <>
      <PanelSection title="Shadow strength">
        <Slider
          label="Opacity"
          value={te.shadowStrength}
          defaultValue={1}
          min={0}
          max={2.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update((d) => void (d[theme].shadowStrength = v))}
        />
        <Slider
          label="Size"
          value={te.shadowSize}
          defaultValue={1}
          min={0}
          max={2}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update((d) => void (d[theme].shadowSize = v))}
        />
        <p className="m-0 text-12 text-ds-muted">
          Size scales offsets, blur and spread. Shadow color follows the neutral ramp. The scrim behind sheets is a
          color: set it on the Color tab.
        </p>
      </PanelSection>
      <PanelSection title="Preview">
        <div className="ds-canvas grid grid-cols-2 gap-4 rounded-input p-4">
          {SHADOWS.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className="h-14 rounded-card bg-surface" style={{ boxShadow: `var(--${t.name})` }} />
              <span className="font-ds-mono text-11 text-ds-muted" title={resolveShadow(t, theme, edits)}>
                --{t.name}
              </span>
            </div>
          ))}
        </div>
        <p className="m-0 text-12 text-ds-muted">
          Was: <code className="font-ds-mono">{valueIn(SHADOWS[0]!, theme)}</code>
        </p>
      </PanelSection>
    </>
  )
}

const LOCKED = TOKENS.filter((t) => ['tap-min', 'btn-primary-h', 'btn-secondary-h'].includes(t.name))

export function SpaceTab() {
  const { edits, update } = useTokens()
  return (
    <>
      <PanelSection title="Spacing strength">
        <Slider
          label="Gaps and padding"
          value={edits.spaceScale}
          defaultValue={1}
          min={0.5}
          max={1.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update((d) => void (d.spaceScale = v))}
        />
        <p className="m-0 text-12 leading-[1.5] text-ds-muted">
          Scales Tailwind&apos;s spacing unit (every <code className="font-ds-mono">p-4</code>,{' '}
          <code className="font-ds-mono">gap-3</code>) and the screen&apos;s side padding,{' '}
          <code className="font-ds-mono">--screen-pad</code>, now {Math.round(20 * edits.spaceScale * 2) / 2}px. Sizes
          written in px on the boards stay put.
        </p>
      </PanelSection>
      <PanelSection title="Held by the phone rules">
        <ul className="m-0 flex list-none flex-col p-0">
          {LOCKED.map((t) => (
            <li
              key={t.name}
              className="flex items-center justify-between gap-3 border-t border-ds-line py-2 first:border-t-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-ds-mono text-12 font-medium text-ds-ink">--{t.name}</span>
                <span className="truncate text-11 text-ds-muted">{t.note ?? ''}</span>
              </span>
              <span className="font-ds-mono text-12 text-ds-muted">{t.light}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-12 text-ds-muted">
          Tap targets are at least 44px, primary buttons 52px and secondary 48px, whatever the spacing.
        </p>
      </PanelSection>
    </>
  )
}
