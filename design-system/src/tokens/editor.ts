import { formatColor, fromOklch, hueDelta, parseColor, toHex, toOklch, type Rgba } from './color'
import { FONTS, fontById, type FontRole } from './fonts'
import {
  FAMILIES,
  FONT_STACKS,
  TOKENS,
  TOKENS_SOURCE,
  TOKEN,
  defaultBase,
  findBlock,
  sourceIn,
  valueIn,
  type Family,
  type Theme,
  type Token,
} from './source'

/**
 * The token editor's model. Edits are stored, values are worked out from them:
 * with no edits, every token resolves to exactly what tokens.css says.
 *
 * Colors: each color follows one of five ramps (brand, neutral, danger, info, warning).
 * Moving a ramp's base color moves every token on it by the same hue turn and chroma
 * ratio, so the hand-picked relations in tokens.css survive (a tint stays a tint).
 * A token can instead be pinned to a step of its ramp, or set to any color.
 * Light and dark are edited separately; shape, space and fonts are shared.
 */

export type ColorEdit = { mode: 'step'; step: Step } | { mode: 'custom'; value: string }
export type ThemeEdits = {
  bases: Partial<Record<Family, string>>
  colors: Record<string, ColorEdit>
  shadowStrength: number // multiplies shadow opacity
  shadowSize: number // multiplies offsets, blur and spread
}
export type Edits = {
  v: 1
  light: ThemeEdits
  dark: ThemeEdits
  fonts: Partial<Record<FontRole, string>> // font ids from fonts.ts
  radiusScale: number
  radii: Record<string, number> // px, per token, before the scale
  spaceScale: number
}

const emptyTheme = (): ThemeEdits => ({ bases: {}, colors: {}, shadowStrength: 1, shadowSize: 1 })
export const emptyEdits = (): Edits => ({
  v: 1,
  light: emptyTheme(),
  dark: emptyTheme(),
  fonts: {},
  radiusScale: 1,
  radii: {},
  spaceScale: 1,
})

/* ---------- Ramps ---------- */

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
export type Step = (typeof STEPS)[number]
// OKLCH lightness for each step, light to dark.
const STEP_L = [0.975, 0.94, 0.885, 0.81, 0.72, 0.63, 0.54, 0.45, 0.37, 0.29, 0.21]

/** Eleven steps from one base color: its hue throughout, chroma strongest near the base's lightness. */
export function ramp(base: string): { step: Step; color: string }[] {
  const lch = toOklch(parseColor(base) ?? { r: 0, g: 0, b: 0, a: 1 })
  return STEPS.map((step, i) => {
    const l = STEP_L[i]!
    const falloff = Math.max(0.15, 1 - ((l - lch.l) / 0.7) ** 2)
    return { step, color: toHex(fromOklch({ l, c: lch.c * falloff, h: lch.h, a: 1 })) }
  })
}

/** The step nearest a color's lightness, to show where a token sits on its ramp. */
export function nearestStep(value: string): Step {
  const c = parseColor(value)
  if (!c) return 500
  const l = toOklch(c).l
  let best = 0
  STEP_L.forEach((s, i) => {
    if (Math.abs(s - l) < Math.abs(STEP_L[best]! - l)) best = i
  })
  return STEPS[best]!
}

export const baseOf = (edits: Edits, th: Theme, f: Family) => edits[th].bases[f] ?? defaultBase(f, th)

/**
 * Move one color as its ramp's base moved: same hue turn, same chroma ratio (a shift for
 * neutrals, whose base has almost none), and the base's lightness change, fading out
 * toward black and white so tints and near-blacks stay where they are.
 */
export function follow(value: string, from: string, to: string, f: Family): string {
  if (from.toLowerCase() === to.toLowerCase()) return value
  const c = parseColor(value)
  const a = parseColor(from)
  const b = parseColor(to)
  if (!c || !a || !b) return value
  const v = toOklch(c)
  const A = toOklch(a)
  const B = toOklch(b)
  const turn = A.c > 0.005 && B.c > 0.005 ? hueDelta(A.h, B.h) : 0
  // A gray base has no hue of its own: a neutral ramp moved to a tinted base takes that hue.
  const h = f === 'neutral' && A.c < 0.02 && B.c >= 0.005 ? B.h : v.h + turn
  const chroma = f === 'neutral' || A.c < 0.02 ? (v.c < 0.003 ? 0 : Math.max(0, v.c + (B.c - A.c))) : v.c * (B.c / A.c)
  const l = v.l + (B.l - A.l) * Math.max(0, 1 - Math.abs(v.l - A.l) / 0.6)
  return formatColor(fromOklch({ l, c: chroma, h, a: v.a }))
}

/* ---------- Resolving ---------- */

export function resolveColor(t: Token, th: Theme, edits: Edits): string {
  const own = valueIn(t, th)
  const edit = edits[th].colors[t.name]
  const source = sourceIn(t.name, th)
  if (edit?.mode === 'custom') return edit.value
  if (source === 'accent' || source === 'derived') return own
  if (edit?.mode === 'step') return ramp(baseOf(edits, th, source)).find((s) => s.step === edit.step)!.color
  return follow(own, defaultBase(source, th), baseOf(edits, th, source), source)
}

/** Split a value on top-level commas (not the ones inside rgba()). */
function splitTop(value: string) {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const round = (n: number, step = 0.5) => Math.round(n / step) * step

export function resolveShadow(t: Token, th: Theme, edits: Edits): string {
  const own = valueIn(t, th)
  const { shadowStrength, shadowSize } = edits[th]
  const neutralFrom = defaultBase('neutral', th)
  const neutralTo = baseOf(edits, th, 'neutral')
  if (shadowStrength === 1 && shadowSize === 1 && neutralFrom === neutralTo) return own
  return splitTop(own)
    .map((layer) => {
      const color = /rgba?\([^)]*\)|#[0-9a-f]{3,8}/i.exec(layer)?.[0] ?? ''
      const lengths = layer
        .replace(color, '')
        .trim()
        .split(/\s+/)
        .map((len) => (len.endsWith('px') ? `${round(parseFloat(len) * shadowSize)}px` : len))
      let rgba: Rgba | null = parseColor(follow(color, neutralFrom, neutralTo, 'neutral'))
      if (rgba) rgba = { ...rgba, a: Math.min(1, Math.round(rgba.a * shadowStrength * 100) / 100) }
      return `${lengths.join(' ')} ${rgba ? formatColor(rgba) : color}`.trim()
    })
    .join(', ')
}

const isPill = (t: Token) => t.name === 'radius-pill'

export function resolveRadius(t: Token, edits: Edits): string {
  if (isPill(t)) return t.light
  const own = edits.radii[t.name] ?? parseFloat(t.light)
  const px = round(own * edits.radiusScale)
  return `${px}px`
}

/** Phone rules: tap targets and button heights never scale; only the screen's side padding does. */
export const SCALED_SPACE = ['screen-pad']
export const SPACING_UNIT_REM = 0.25 // Tailwind's --spacing: p-4 is 4 × 0.25rem

export function resolveValue(t: Token, th: Theme, edits: Edits): string {
  if (t.kind === 'color') return resolveColor(t, th, edits)
  if (t.kind === 'shadow') return resolveShadow(t, th, edits)
  if (t.kind === 'radius') return resolveRadius(t, edits)
  if (t.kind === 'size' && SCALED_SPACE.includes(t.name)) return `${round(parseFloat(t.light) * edits.spaceScale)}px`
  return valueIn(t, th)
}

/** Only the tokens whose value differs from tokens.css in this theme. */
export function changedVars(edits: Edits, th: Theme): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of TOKENS) {
    // Shape and space are the same in both themes; write them once, on :root.
    if (th === 'dark' && (t.kind === 'radius' || t.kind === 'size')) continue
    const v = resolveValue(t, th, edits)
    if (v !== valueIn(t, th)) out[t.name] = v
  }
  return out
}

export function fontStack(edits: Edits, role: FontRole): string {
  const id = edits.fonts[role]
  return id ? fontById(id)!.stack : FONT_STACKS[role]
}

const fontChanged = (edits: Edits, role: FontRole) => {
  const id = edits.fonts[role]
  return Boolean(id && fontById(id)!.stack !== FONT_STACKS[role])
}

/** The stylesheet the docs inject after tokens.css. Unlayered, so it beats Tailwind's theme layer. */
export function overrideCss(edits: Edits): string {
  const light = changedVars(edits, 'light')
  const dark = changedVars(edits, 'dark')
  // :root and [data-theme='dark'] weigh the same, and this sheet comes last; a light value
  // written on :root would beat tokens.css's dark one. So a light edit of a token that has
  // its own dark value applies only while the page is light. One with no dark value is
  // shared, as in tokens.css, and stays on :root.
  const lightOnly = Object.entries(light).filter(([k]) => TOKEN.get(k)?.dark !== undefined)
  const rootLines = Object.entries(light)
    .filter(([k]) => TOKEN.get(k)?.dark === undefined)
    .map(([k, v]) => `  --${k}: ${v};`)
  if (edits.spaceScale !== 1) rootLines.push(`  --spacing: ${round(SPACING_UNIT_REM * edits.spaceScale, 0.005)}rem;`)
  const utilities: string[] = []
  for (const role of ['display', 'body', 'mono'] as const) {
    if (!fontChanged(edits, role)) continue
    rootLines.push(`  --font-${role}: ${fontStack(edits, role)};`)
    // Tailwind inlines @theme inline values into its utilities, so they need their own rule.
    utilities.push(`.font-${role} { font-family: ${fontStack(edits, role)}; }`)
  }
  const out: string[] = []
  if (rootLines.length) out.push(`:root {\n${rootLines.join('\n')}\n}`)
  if (lightOnly.length)
    out.push(`:root:not([data-theme='dark']) {\n${lightOnly.map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`)
  const darkLines = Object.entries(dark).map(([k, v]) => `  --${k}: ${v};`)
  if (darkLines.length) out.push(`[data-theme='dark'] {\n${darkLines.join('\n')}\n}`)
  return [...out, ...utilities].join('\n')
}

export function editCount(edits: Edits, th?: Theme): number {
  const themes: Theme[] = th ? [th] : ['light', 'dark']
  let n = 0
  for (const t of themes) n += Object.keys(changedVars(edits, t)).length
  if (!th || th === 'light') {
    n += edits.spaceScale !== 1 ? 1 : 0
    n += (['display', 'body', 'mono'] as const).filter((r) => fontChanged(edits, r)).length
  }
  return n
}

/* ---------- Export ---------- */

function replaceInBlock(src: string, selector: string, vars: Record<string, string>, added: string): string {
  const block = findBlock(src, selector)
  if (!block) return src
  let body = block.body
  const missing: string[] = []
  for (const [name, value] of Object.entries(vars)) {
    const re = new RegExp(`(\\n\\s*--${name}:\\s*)([^;]+)(;)`)
    if (re.test(body)) body = body.replace(re, (_m, a: string, _b: string, c: string) => `${a}${value}${c}`)
    else missing.push(`  --${name}: ${value};`)
  }
  if (missing.length) body = body.replace(/\s*$/, `\n\n  /* ${added} */\n${missing.join('\n')}\n`)
  return src.slice(0, block.start) + body + src.slice(block.end)
}

/** tokens.css with the edits written in place, ready to replace app/src/styles/tokens.css. */
export function exportTokensCss(edits: Edits): string {
  let src = TOKENS_SOURCE
  const rootVars = { ...changedVars(edits, 'light') }
  if (edits.spaceScale !== 1) rootVars['spacing'] = `${round(SPACING_UNIT_REM * edits.spaceScale, 0.005)}rem`
  src = replaceInBlock(src, ':root', rootVars, 'Added in the token editor')
  src = replaceInBlock(src, "[data-theme='dark']", changedVars(edits, 'dark'), 'Added in the token editor')
  const fontVars: Record<string, string> = {}
  for (const role of ['display', 'body', 'mono'] as const) {
    if (fontChanged(edits, role)) fontVars[`font-${role}`] = fontStack(edits, role)
  }
  src = replaceInBlock(src, '@theme inline', fontVars, 'Added in the token editor')
  return src
}

/** What else has to change in the app for the exported fonts: the @fontsource imports in index.css. */
export function fontInstructions(edits: Edits): string[] {
  const out: string[] = []
  for (const role of ['display', 'body', 'mono'] as const) {
    if (!fontChanged(edits, role)) continue
    const f = fontById(edits.fonts[role]!)!
    out.push(
      `${role}: npm i ${f.fontsource}, then in index.css import ${f.weights.map((w) => `'${f.fontsource}/${w}.css'`).join(', ')}`,
    )
  }
  return out
}

/* ---------- Storage ---------- */

/** Fill in anything a saved or pasted edit set is missing, and drop what no longer exists. */
export function normalizeEdits(input: unknown): Edits {
  const base = emptyEdits()
  if (!input || typeof input !== 'object') return base
  const e = input as Partial<Edits>
  const theme = (t: Partial<ThemeEdits> | undefined): ThemeEdits => ({
    bases: Object.fromEntries(
      Object.entries(t?.bases ?? {}).filter(([f, v]) => FAMILIES.includes(f as Family) && parseColor(String(v))),
    ),
    colors: Object.fromEntries(Object.entries(t?.colors ?? {}).filter(([name]) => TOKEN.get(name)?.kind === 'color')),
    shadowStrength: num(t?.shadowStrength, 1, 0, 3),
    shadowSize: num(t?.shadowSize, 1, 0, 3),
  })
  return {
    v: 1,
    light: theme(e.light),
    dark: theme(e.dark),
    fonts: Object.fromEntries(Object.entries(e.fonts ?? {}).filter(([, id]) => FONTS.some((f) => f.id === id))),
    radiusScale: num(e.radiusScale, 1, 0, 3),
    radii: Object.fromEntries(Object.entries(e.radii ?? {}).filter(([name]) => TOKEN.get(name)?.kind === 'radius')),
    spaceScale: num(e.spaceScale, 1, 0.5, 2),
  }
}

function num(v: unknown, fallback: number, min: number, max: number) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}
