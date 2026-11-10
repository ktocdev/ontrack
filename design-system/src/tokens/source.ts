import raw from '@app/styles/tokens.css?raw'
import { isColorLiteral, parseColor, toOklch, hueDelta } from './color'

/**
 * The app's tokens.css, read as text at build time and parsed, so these docs and the
 * editor always start from what the app ships. Nothing here keeps a copy of a value.
 */
export const TOKENS_SOURCE: string = raw

export type Theme = 'light' | 'dark'
export type TokenKind = 'color' | 'shadow' | 'radius' | 'size' | 'other'
export type Family = 'brand' | 'neutral' | 'danger' | 'info' | 'warning'
/** Where a color comes from: one of the ramps, a value built from other tokens, or data (restaurant accents). */
export type ColorSource = Family | 'derived' | 'accent'

export type Token = {
  name: string // without the leading --
  group: string
  kind: TokenKind
  light: string
  dark?: string
  note?: string
  darkNote?: string
}

export type Decl = { name: string; value: string; note?: string; group: string }

/** The text between `selector {` and its matching `}`, and where it sits in the source. */
export function findBlock(src: string, selector: string): { start: number; end: number; body: string } | null {
  const at = src.indexOf(`${selector} {`)
  if (at < 0) return null
  const open = src.indexOf('{', at)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return { start: open + 1, end: i, body: src.slice(open + 1, i) }
    }
  }
  return null
}

const DECL = /^\s*--([\w-]+):\s*(.+?);\s*(?:\/\*\s*(.*?)\s*\*\/)?\s*$/
const HEADING = /^\s*\/\*\s*(.+?)\s*\*\/\s*$/

export function parseDecls(body: string): Decl[] {
  const out: Decl[] = []
  let group = 'Other'
  let inComment = false
  for (const line of body.split('\n')) {
    if (inComment) {
      if (line.includes('*/')) inComment = false
      continue
    }
    const decl = DECL.exec(line)
    if (decl) {
      out.push({ name: decl[1]!, value: decl[2]!, note: decl[3] || undefined, group })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      group = heading[1]!.replace(/[:.]$/, '')
      continue
    }
    if (line.trim().startsWith('/*') && !line.includes('*/')) inComment = true
  }
  return out
}

function kindOf(name: string, value: string): TokenKind {
  if (name.startsWith('shadow-')) return 'shadow'
  if (name.startsWith('radius-')) return 'radius'
  if (/^-?\d+(\.\d+)?px$/.test(value)) return 'size'
  if (isColorLiteral(value) || /^color-mix\(|^var\(/.test(value)) return 'color'
  return 'other'
}

const root = findBlock(TOKENS_SOURCE, ':root')
const dark = findBlock(TOKENS_SOURCE, "[data-theme='dark']")
const theme = findBlock(TOKENS_SOURCE, '@theme inline')
if (!root || !dark || !theme) throw new Error('tokens.css changed shape: :root, dark or @theme block not found')

const darkDecls = new Map(parseDecls(dark.body).map((d) => [d.name, d]))

export const TOKENS: Token[] = parseDecls(root.body).map((d) => {
  const dk = darkDecls.get(d.name)
  return {
    name: d.name,
    group: d.group,
    kind: kindOf(d.name, d.value),
    light: d.value,
    dark: dk?.value,
    note: d.note,
    darkNote: dk?.note,
  }
})

export const TOKEN = new Map(TOKENS.map((t) => [t.name, t]))

/** A token's own value in a theme: dark falls back to light, as the cascade does. */
export const valueIn = (t: Token, th: Theme) => (th === 'dark' ? (t.dark ?? t.light) : t.light)

/** Fonts and the type scale live in the @theme block, not on :root. */
const themeDecls = parseDecls(theme.body)
export const FONT_STACKS = {
  display: themeDecls.find((d) => d.name === 'font-display')!.value,
  body: themeDecls.find((d) => d.name === 'font-body')!.value,
  mono: themeDecls.find((d) => d.name === 'font-mono')!.value,
}
export const TYPE_SCALE = themeDecls
  .filter((d) => /^text-\d+$/.test(d.name))
  .map((d) => ({ name: d.name, px: parseFloat(d.value) }))

/* ---------- Ramps ---------- */

export const FAMILIES: Family[] = ['brand', 'neutral', 'danger', 'info', 'warning']
export const FAMILY_LABEL: Record<Family, string> = {
  brand: 'Brand',
  neutral: 'Neutral',
  danger: 'Danger',
  info: 'Info',
  warning: 'Warning',
}
/** Each ramp starts at the token that names its color best; editing the ramp moves that base. */
export const FAMILY_ANCHOR: Record<Family, string> = {
  brand: 'brand',
  neutral: 'text-muted',
  danger: 'danger',
  info: 'info',
  warning: 'status-waiting-text',
}

const NEUTRAL_CHROMA = 0.035

/**
 * Which ramp a color follows, by name first: the neutrals here are green-grays, so a brand
 * tint and a border cannot be told apart by hue or chroma. Dark keeps the light family.
 */
const BY_NAME: [RegExp, ColorSource][] = [
  [/^(restaurant|preset)-/, 'accent'],
  [/^(brand|on-brand)|^toast-action$|^status-fixed-/, 'brand'],
  [/^(danger|urgent)|^status-open-/, 'danger'],
  [/^(info|banner-info)|^status-(progress|scheduled)-/, 'info'],
  [/^(alert-badge|reopened-banner-)|^status-(waiting|reopened)-/, 'warning'],
  [/^(bg|surface|border|text|scrim|square-outline|wt-tag-)|^status-closed-/, 'neutral'],
]

function classify(t: Token): ColorSource {
  const named = BY_NAME.find(([re]) => re.test(t.name))
  if (named) return named[1]
  const c = parseColor(t.light)
  if (!c) return 'derived'
  const lch = toOklch(c)
  if (lch.c < NEUTRAL_CHROMA) return 'neutral'
  let best: Family = 'brand'
  let bestD = Infinity
  for (const f of FAMILIES) {
    if (f === 'neutral') continue
    const anchor = toOklch(parseColor(TOKEN.get(FAMILY_ANCHOR[f])!.light)!)
    const d = Math.abs(hueDelta(anchor.h, lch.h))
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

export const SOURCE: Map<string, ColorSource> = new Map(
  TOKENS.filter((t) => t.kind === 'color').map((t) => [t.name, classify(t)]),
)

/** A color's source in one theme: a dark value written with var() or color-mix() follows other tokens. */
export function sourceIn(name: string, th: Theme): ColorSource {
  const t = TOKEN.get(name)!
  const s = SOURCE.get(name) ?? 'derived'
  if (s === 'accent') return s
  return parseColor(valueIn(t, th)) ? s : 'derived'
}

export const defaultBase = (f: Family, th: Theme) => valueIn(TOKEN.get(FAMILY_ANCHOR[f])!, th)
