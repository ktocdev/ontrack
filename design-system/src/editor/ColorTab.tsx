import { useMemo } from 'react'
import { contrast, fromOklch, parseColor, toHex, toOklch, type Rgba } from '../tokens/color'
import { STEPS, baseOf, nearestStep, ramp, resolveColor, type ColorEdit, type Step } from '../tokens/editor'
import {
  FAMILIES,
  FAMILY_ANCHOR,
  FAMILY_LABEL,
  TOKENS,
  defaultBase,
  sourceIn,
  valueIn,
  type Family,
  type Theme,
  type Token,
} from '../tokens/source'
import { computedColor, useTokens } from '../tokens/store'
import { ColorInput, Disclosure, PanelSection, Slider, TextButton } from './controls'

const COLORS = TOKENS.filter((t) => t.kind === 'color')

export function ColorTab({ theme }: { theme: Theme }) {
  const byFamily = useMemo(() => {
    const out = new Map<string, Token[]>()
    for (const t of COLORS) {
      const s = sourceIn(t.name, theme)
      out.set(s, [...(out.get(s) ?? []), t])
    }
    return out
  }, [theme])

  return (
    <>
      <p className="px-5 pt-4 text-13 leading-[1.5] text-ds-muted">
        Each color follows a ramp. Move a ramp and every token on it turns with it, keeping its lightness. Pin a token
        to a step, or give it any color.
      </p>
      {FAMILIES.map((f) => (
        <FamilyEditor key={f} family={f} theme={theme} tokens={byFamily.get(f) ?? []} />
      ))}
      <PanelSection title="Built from other tokens">
        <p className="text-13 text-ds-muted">
          Written with <code className="font-ds-mono">var()</code> or <code className="font-ds-mono">color-mix()</code>{' '}
          in this theme, so they follow the tokens they name. You can still set one by hand.
        </p>
        <TokenList tokens={byFamily.get('derived') ?? []} theme={theme} family={null} />
      </PanelSection>
      <PanelSection title="Restaurant accents">
        <p className="text-13 text-ds-muted">
          Each restaurant&apos;s color is stored with the restaurant; these are the seed and the presets offered on Add
          restaurant. They follow no ramp.
        </p>
        <TokenList tokens={byFamily.get('accent') ?? []} theme={theme} family={null} />
      </PanelSection>
      <ContrastChecks />
    </>
  )
}

function FamilyEditor({ family, theme, tokens }: { family: Family; theme: Theme; tokens: Token[] }) {
  const { edits, update } = useTokens()
  const base = baseOf(edits, theme, family)
  const def = defaultBase(family, theme)
  const lch = toOklch(parseColor(base)!)
  const steps = ramp(base)
  const setBase = (hex: string) =>
    update((d) => {
      if (hex.toLowerCase() === def.toLowerCase()) delete d[theme].bases[family]
      else d[theme].bases[family] = hex
    })
  const setLch = (patch: Partial<typeof lch>) => setBase(toHex(fromOklch({ ...lch, ...patch })))
  const changed = base.toLowerCase() !== def.toLowerCase()

  return (
    <PanelSection
      title={FAMILY_LABEL[family]}
      action={changed && <TextButton onClick={() => setBase(def)}>Reset ramp</TextButton>}
    >
      <div className="flex items-center justify-between gap-3">
        <ColorInput label={`${FAMILY_LABEL[family]} base`} value={base} onChange={setBase} />
        <span className="text-12 text-ds-muted">
          base from <code className="font-ds-mono">--{FAMILY_ANCHOR[family]}</code>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(11,1fr)] overflow-hidden rounded-[8px] border border-ds-line">
        {steps.map((s) => (
          <span key={s.step} title={`${s.step} · ${s.color}`} className="h-8" style={{ background: s.color }} />
        ))}
      </div>
      <div className="-mt-1.5 grid grid-cols-[repeat(11,1fr)] text-center font-ds-mono text-[9px] text-ds-muted">
        {steps.map((s) => (
          <span key={s.step}>{s.step}</span>
        ))}
      </div>
      <Slider
        label="Hue"
        value={Math.round(lch.h)}
        min={0}
        max={360}
        step={1}
        format={(v) => `${v}°`}
        onChange={(h) => setLch({ h })}
      />
      <Slider
        label="Chroma"
        value={lch.c}
        min={0}
        max={0.3}
        step={0.002}
        format={(v) => v.toFixed(3)}
        onChange={(c) => setLch({ c })}
      />
      <Slider
        label="Lightness"
        value={lch.l}
        min={0.1}
        max={0.95}
        step={0.005}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(l) => setLch({ l })}
      />
      <Disclosure summary={`${tokens.length} tokens on this ramp`}>
        <TokenList tokens={tokens} theme={theme} family={family} />
      </Disclosure>
    </PanelSection>
  )
}

function TokenList({ tokens, theme, family }: { tokens: Token[]; theme: Theme; family: Family | null }) {
  const { edits, update } = useTokens()
  if (tokens.length === 0) return <p className="text-13 text-ds-muted">None in this theme.</p>
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {tokens.map((t) => {
        const edit = edits[theme].colors[t.name]
        const value = resolveColor(t, theme, edits)
        const mode = edit?.mode === 'custom' ? 'custom' : edit?.mode === 'step' ? `step-${edit.step}` : 'follow'
        const set = (next: ColorEdit | null) =>
          update((d) => {
            if (next) d[theme].colors[t.name] = next
            else delete d[theme].colors[t.name]
          })
        const fallback = parseColor(value) ? toHex(parseColor(value)!) : '#808080'
        return (
          <li key={t.name} className="flex flex-col gap-2 border-t border-ds-line py-2.5 first:border-t-0">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-7 w-7 flex-none rounded-[6px] shadow-[inset_0_0_0_1px_var(--ds-line-strong)]"
                style={{ background: `var(--${t.name})` }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-ds-mono text-12 font-medium text-ds-ink">
                  --{t.name}
                  {edit && <span className="ml-1.5 text-ds-accent">●</span>}
                </span>
                <span className="truncate font-ds-mono text-11 text-ds-muted" title={value}>
                  {value}
                </span>
              </span>
              <select
                aria-label={`How --${t.name} is set`}
                value={mode}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'follow') set(null)
                  else if (v === 'custom') set({ mode: 'custom', value: fallback })
                  else set({ mode: 'step', step: Number(v.slice(5)) as Step })
                }}
                className="h-8 max-w-[132px] rounded-[8px] border border-ds-line-strong bg-ds-panel px-1.5 text-[16px] text-ds-ink sm:text-12"
              >
                <option value="follow">{family ? `Follows ramp (~${nearestStep(value)})` : 'As written'}</option>
                {family &&
                  STEPS.map((s) => (
                    <option key={s} value={`step-${s}`}>
                      Step {s}
                    </option>
                  ))}
                <option value="custom">Custom</option>
              </select>
            </div>
            {edit?.mode === 'custom' && (
              <ColorInput
                label={`--${t.name}`}
                value={edit.value}
                onChange={(hex) => set({ mode: 'custom', value: keepAlpha(valueIn(t, theme), hex) })}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** A custom color for a translucent token (the scrim, outlines) keeps the token's own alpha. */
function keepAlpha(original: string, hex: string) {
  const o = parseColor(original)
  const c = parseColor(hex)
  if (!o || !c || o.a >= 1) return hex
  const ch = (n: number) => Math.round(n * 255)
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${o.a})`
}

/* ---------- Contrast ---------- */

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 }

type Pair = { fg: string; bg: string; min: number; label: string }
const PAIRS: Pair[] = [
  { fg: 'text', bg: 'surface', min: 4.5, label: 'Text on a card' },
  { fg: 'text-body', bg: 'surface', min: 4.5, label: 'Body on a card' },
  { fg: 'text-secondary', bg: 'bg', min: 4.5, label: 'Eyebrow on the screen' },
  { fg: 'text-muted', bg: 'surface', min: 4.5, label: 'Meta on a card' },
  { fg: 'text-muted', bg: 'bg', min: 4.5, label: 'Meta on the screen' },
  { fg: 'brand', bg: 'surface', min: 4.5, label: 'Link on a card' },
  { fg: 'on-brand', bg: 'brand-fill', min: 4.5, label: 'Primary button' },
  { fg: 'on-brand', bg: 'danger-fill', min: 4.5, label: 'Delete button' },
  { fg: 'danger', bg: 'surface', min: 4.5, label: 'Destructive text' },
  { fg: 'border-strong', bg: 'surface', min: 1.5, label: 'Input border (non-text)' },
  { fg: 'status-open-text', bg: 'status-open-bg', min: 4.5, label: 'Open pill' },
  { fg: 'status-progress-text', bg: 'status-progress-bg', min: 4.5, label: 'In progress pill' },
  { fg: 'status-waiting-text', bg: 'status-waiting-bg', min: 4.5, label: 'Waiting pill' },
  { fg: 'status-closed-text', bg: 'status-closed-bg', min: 4.5, label: 'Closed pill' },
  { fg: 'status-fixed-text', bg: 'status-fixed-bg', min: 4.5, label: 'Fixed pill' },
  { fg: 'reopened-banner-text', bg: 'reopened-banner-bg', min: 4.5, label: 'Reopened banner' },
]

export function ContrastChecks() {
  const { revision } = useTokens()
  const rows = useMemo(() => {
    void revision
    const results = PAIRS.map((p) => {
      const fg = computedColor(p.fg)
      const bg = computedColor(p.bg)
      return { ...p, ratio: fg && bg ? contrast(fg, bg) : null }
    })
    const urgent = computedColor('urgent')
    results.push({
      fg: 'white',
      bg: 'urgent',
      min: 4.5,
      label: 'URGENT tag (white text)',
      ratio: urgent ? contrast(WHITE, urgent) : null,
    })
    return results
  }, [revision])
  const failing = rows.filter((r) => r.ratio !== null && r.ratio < r.min).length

  return (
    <PanelSection
      title="Contrast"
      action={
        <span className={`text-12 font-semibold ${failing ? 'text-ds-warn' : 'text-ds-ok'}`}>
          {failing ? `${failing} below AA` : 'All pass AA'}
        </span>
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => {
          const pass = r.ratio !== null && r.ratio >= r.min
          return (
            <li key={r.label} className="flex items-center gap-2.5 border-t border-ds-line py-2 first:border-t-0">
              <span
                aria-hidden
                className="flex h-7 w-10 flex-none items-center justify-center rounded-[6px] text-12 font-bold shadow-[inset_0_0_0_1px_var(--ds-line)]"
                style={{ background: `var(--${r.bg})`, color: r.fg === 'white' ? '#fff' : `var(--${r.fg})` }}
              >
                Aa
              </span>
              <span className="min-w-0 flex-1 text-13 text-ds-ink-soft">{r.label}</span>
              <span className="font-ds-mono text-12 text-ds-muted tabular-nums">
                {r.ratio ? r.ratio.toFixed(2) : '—'}
              </span>
              <span
                className={`w-11 rounded-[5px] py-0.5 text-center text-11 font-bold ${pass ? 'bg-ds-accent-soft text-ds-ok' : 'bg-ds-sunken text-ds-warn'}`}
              >
                {pass ? 'Pass' : 'Fail'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="text-12 text-ds-muted">
        WCAG 2 ratios, read from what the page paints now: 4.5 for text. The input border is held to the 1.5 the boards
        draw; WCAG asks 3 where a border alone shows the control.
      </p>
    </PanelSection>
  )
}
