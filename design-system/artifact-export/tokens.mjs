// tokens.json from app/src/styles/tokens.css, with usage notes and contrast checks.
import { readFileSync } from 'node:fs'

const USAGE = {
  bg: 'Screen background, under every card.',
  surface: 'Cards, inputs, sheets, the tab bar and sidebar.',
  'surface-sunken': 'Segmented control track, chips, count badges, skeleton bars.',
  'surface-muted': 'Read-only inputs, closed pills, role tags, pressed rows.',
  'surface-hover': 'Row and card hover.',
  border: 'Card and row borders, dividers between rows.',
  'border-strong': 'Input borders, secondary buttons, a hovered card.',
  'border-muted': 'Dashed outlines (Add a month, Add photo), the Walkthrough tag outline.',
  text: 'Titles and primary text, on `bg`, `surface` and every surface-* token.',
  'text-body': 'Body copy, labels and restaurant names, on `bg` and `surface`.',
  'text-secondary': 'Eyebrows, helper text and figure labels, on `bg` and `surface`.',
  'text-muted': 'Meta lines, ticket numbers, placeholders, on `bg` and `surface`.',
  'text-faint': 'Read-only input text, on `surface-muted`.',
  'status-open-bg': 'Open pill background, under `status-open-text`.',
  'status-open-text': 'Open pill text and its hollow-circle icon.',
  'status-progress-bg': 'In progress pill background.',
  'status-progress-text': 'In progress pill text and its pie icon.',
  'status-waiting-bg': 'Waiting on parts pill background.',
  'status-waiting-text': 'Waiting on parts pill text and its clock icon.',
  'status-scheduled-bg': 'Scheduled pill background.',
  'status-scheduled-text': 'Scheduled pill text and its calendar icon.',
  'status-reopened-bg': 'Reopened pill background.',
  'status-reopened-text': 'Reopened pill text and its circle-arrow icon.',
  'status-closed-bg': 'Closed pill background.',
  'status-closed-text': 'Closed pill text and its check icon.',
  'status-fixed-bg': 'Fixed (in-house) pill background.',
  'status-fixed-text': 'Fixed (in-house) pill text and its check icon.',
  'reopened-banner-bg': 'The Reopened banner on a ticket.',
  'reopened-banner-border': 'The Reopened banner border.',
  'reopened-banner-text': 'Text on `reopened-banner-bg`.',
  'wt-tag-border': 'The Walkthrough tag: an outline chip with a clipboard icon.',
  'wt-tag-text': 'Walkthrough tag text, on `surface`.',
  'progress-good': 'Walkthrough bar and ring: items marked Good.',
  'progress-inhouse': 'Walkthrough bar and ring: items with an in-house fix.',
  'progress-ticket': 'Walkthrough bar and ring: items with a ticket.',
  'standing-on-time': 'A month submitted on time, as a filled square in Last 6 months.',
  'standing-late': 'A month submitted late.',
  'standing-missed': 'A missed month: an empty outlined square.',
  'choice-good-bg': 'Checklist Good button once picked.',
  'choice-good-border': 'Its 1.5px border.',
  'choice-good-text': 'Its text, on `choice-good-bg`.',
  'choice-inhouse-bg': 'Checklist In-house button once picked.',
  'choice-inhouse-border': 'Its 1.5px border.',
  'choice-inhouse-text': 'Its text, on `choice-inhouse-bg`.',
  'choice-ticket-bg': 'Checklist Ticket button once picked.',
  'choice-ticket-border': 'Its 1.5px border.',
  'choice-ticket-text': 'Its text, on `choice-ticket-bg`.',
  'video-bg': "A quarterly task's how-to video card, under white text.",
  'rotation-1-bg': "A rotation's first month (A).",
  'rotation-1-text': 'Text on `rotation-1-bg`.',
  'rotation-2-bg': "A rotation's second month (B).",
  'rotation-2-text': 'Text on `rotation-2-bg`.',
  'rotation-3-bg': "A rotation's third month (C), then round again to A.",
  'rotation-3-text': 'Text on `rotation-3-bg`.',
  'rotation-own-text': 'The note on a restaurant that has its own schedule.',
  'alert-badge': 'The small alert badge on a tab ("1 reopened").',
  'toast-action': "The toast's action text (Undo).",
  'square-outline': "Inset outline on a restaurant's color square.",
  scrim: 'Behind sheets and dialogs.',
  'restaurant-federales-logan': 'Sample restaurant accent (seed data; real accents come from the database).',
  'restaurant-federales-west-loop': 'Sample restaurant accent (seed data).',
  'restaurant-ranallis-logan': 'Sample restaurant accent (seed data).',
  'restaurant-porter': 'Sample restaurant accent (seed data).',
  'preset-ocean': 'Accent preset offered on Add restaurant.',
  'preset-brick': 'Accent preset offered on Add restaurant.',
  'preset-walnut': 'Accent preset offered on Add restaurant.',
  'preset-olive': 'Accent preset offered on Add restaurant.',
  'preset-slate': 'Accent preset offered on Add restaurant.',
  'preset-plum': 'Accent preset offered on Add restaurant.',
  'preset-charcoal': 'Accent preset offered on Add restaurant.',
  'brand-fill-hover': 'Primary button hover.',
  'screen-pad': 'Screen padding on the sides (Tailwind `px-screen`).',
  'tap-min': 'Smallest tap target (`min-h-tap`).',
  'btn-primary-h': 'Primary button height.',
  'btn-secondary-h': 'Secondary button height.',
  'desktop-max': 'The frame stops growing at this width and centers.',
  'sidebar-w': 'Sidebar width from 768px.',
  'reading-max': "A one-column screen's reading width from 768px (`max-w-reading`).",
  'form-max': 'A form opened from a list, as a centered panel (`max-w-form`).',
  'list-pane': 'The list beside an open item from 1024px.',
}
const RADIUS = {
  'radius-card': 'Cards and list cards (`rounded-card`).',
  'radius-pill': 'Pills, avatars, the switch (`rounded-pill`).',
  'radius-tag': 'Role tags (`rounded-tag`).',
}
const SPACING = [
  'screen-pad',
  'tap-min',
  'btn-primary-h',
  'btn-secondary-h',
  'desktop-max',
  'sidebar-w',
  'reading-max',
  'form-max',
  'list-pane',
]
const SKIP = /^(safe-|swatch-custom|restaurant-panel-)/

function block(css, start) {
  const i = css.indexOf(start)
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
}
function decls(body) {
  const out = []
  for (const line of body.split('\n')) {
    const m = /^\s*--([a-z0-9-]+):\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/.exec(line)
    if (m) out.push({ name: m[1], value: m[2].trim(), comment: m[3] })
  }
  return out
}
const hex = (h) => {
  if (h.startsWith('rgba'))
    return h
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
  h = h.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
function lum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const cap = (s) => s[0].toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.')

export function makeTokens(cssPath) {
  const css = readFileSync(cssPath, 'utf8')
  const light = decls(block(css, ':root {'))
  const dark = decls(block(css, "[data-theme='dark'] {"))
  const L = Object.fromEntries(light.map((d) => [d.name, d.value]))
  const D = { ...L, ...Object.fromEntries(dark.map((d) => [d.name, d.value])) }
  const isColor = (v) => /^(#|rgba?\(|color-mix|var\()/.test(v)
  const resolve = (map, v) => {
    for (let k = 0; k < 20 && v.startsWith('var('); k++) v = map[/var\(--([a-z0-9-]+)\)/.exec(v)[1]]
    const mix = /^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/.exec(v)
    if (mix) {
      const a = hex(resolve(map, mix[1]))
      const b = hex(resolve(map, mix[3]))
      const p = +mix[2] / 100
      return toHex(a.map((c, i) => c * p + b[i] * (1 - p)))
    }
    return v
  }
  const val = (map, v) => {
    if (v.startsWith('var(')) return `{${/var\(--([a-z0-9-]+)\)/.exec(v)[1]}}`
    if (v.startsWith('color-mix')) return resolve(map, v)
    return v.startsWith('#') ? v.toLowerCase() : v
  }
  const notes = {}
  for (const d of [...light, ...dark]) if (d.comment && !notes[d.name]) notes[d.name] = d.comment
  const color = []
  const spacing = []
  const radius = []
  const shadow = []
  const flags = []
  const names = new Set()
  for (const d of light) {
    if (SKIP.test(d.name)) continue
    const darkV = D[d.name]
    const usage = USAGE[d.name] ?? (notes[d.name] ? cap(notes[d.name]) : undefined)
    if (d.name.startsWith('radius-'))
      radius.push({ name: d.name, value: d.value, usage: RADIUS[d.name] ?? cap(notes[d.name]) })
    else if (SPACING.includes(d.name)) spacing.push({ name: d.name, value: d.value, usage })
    else if (d.name.startsWith('shadow-')) shadow.push({ name: d.name, value: { light: d.value, dark: darkV }, usage })
    else if (isColor(d.value)) {
      const lv = val(L, d.value)
      const dv = val(D, darkV)
      color.push({ name: d.name, value: lv === dv ? { light: lv } : { light: lv, dark: dv }, usage })
    } else {
      flags.push(d.name)
      continue
    }
    names.add(d.name)
  }
  const PAIRS = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text-body', 'surface'],
    ['text-secondary', 'surface'],
    ['text-muted', 'surface'],
    ['text-muted', 'bg'],
    ['text-faint', 'surface-muted'],
    ['brand', 'surface'],
    ['brand', 'bg'],
    ['on-brand', 'brand-fill'],
    ['danger', 'surface'],
    ['info', 'surface'],
    ['on-brand', 'urgent'],
    ['on-brand', 'danger-fill'],
    ...['open', 'progress', 'waiting', 'scheduled', 'reopened', 'closed', 'fixed'].map((s) => [
      `status-${s}-text`,
      `status-${s}-bg`,
    ]),
    ['reopened-banner-text', 'reopened-banner-bg'],
    ['choice-good-text', 'choice-good-bg'],
    ['choice-inhouse-text', 'choice-inhouse-bg'],
    ['choice-ticket-text', 'choice-ticket-bg'],
    ['rotation-1-text', 'rotation-1-bg'],
    ['rotation-2-text', 'rotation-2-bg'],
    ['rotation-3-text', 'rotation-3-bg'],
    ['wt-tag-text', 'surface'],
  ]
  const report = []
  for (const [fg, bgName] of PAIRS) {
    for (const [theme, map] of [
      ['light', L],
      ['dark', D],
    ]) {
      const r = contrast(resolve(map, map[fg]), resolve(map, map[bgName]))
      report.push(`${theme} ${fg} on ${bgName}: ${r.toFixed(2)}`)
      if (r < 4.5) {
        const t = color.find((c) => c.name === fg)
        t.usage += ` ${theme === 'light' ? 'Light' : 'Dark'}: ${r.toFixed(1)}:1 on \`${bgName}\`, under 4.5:1; kept as the app has it.`
      }
    }
  }
  return {
    report,
    flags,
    names,
    tokens: {
      name: 'OnTrack',
      version: 1,
      meta: {
        source: 'github',
        repo: 'ktocdev/ontrack',
        package: 'app',
        paths: {
          tokens: ['app/src/styles/tokens.css'],
          fonts: ['@fontsource/archivo', '@fontsource/public-sans', '@fontsource/jetbrains-mono'],
          docs: ['design/tokens.md', 'design-system/src/pages'],
        },
        synced: new Date().toISOString().slice(0, 10),
      },
      color: {
        themes: [
          { id: 'light', name: 'Light' },
          { id: 'dark', name: 'Dark' },
        ],
        tokens: color,
      },
      type: TYPE,
      spacing: { note: 'Layout lengths. Everything else uses Tailwind’s 4px spacing scale.', tokens: spacing },
      radius: { tokens: radius },
      shadow: {
        note: 'The text color at low alpha in light; black and a little stronger in dark. Cards never take a shadow.',
        tokens: shadow,
      },
    },
  }
}

const TYPE = {
  fonts: [
    ...[500, 600, 700].map((w) => ({
      family: 'Archivo',
      file: `fonts/archivo-latin-${w}-normal.woff2`,
      weight: String(w),
      style: 'normal',
    })),
    ...[400, 500, 600, 700].map((w) => ({
      family: 'Public Sans',
      file: `fonts/public-sans-latin-${w}-normal.woff2`,
      weight: String(w),
      style: 'normal',
    })),
    { family: 'JetBrains Mono', file: 'fonts/jetbrains-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  families: {
    display: "'Archivo', system-ui, sans-serif",
    body: "'Public Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  groups: [
    {
      name: 'Display',
      family: 'display',
      styles: [
        {
          name: 'type-wordmark',
          fontSize: '40px',
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          sample: 'OnTrack',
          usage: 'The Sign in wordmark only.',
        },
        {
          name: 'type-h1',
          fontSize: '30px',
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          sample: 'Good morning, Maya',
          usage: 'A home screen greeting (`text-30`).',
        },
        {
          name: 'type-screen-title',
          fontSize: '24px',
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          sample: 'Open tickets',
          usage: 'ScreenHeader titles (`text-24`).',
        },
        {
          name: 'type-sheet-title',
          fontSize: '22px',
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          sample: 'Save 2 changes?',
          usage: 'Sheet and dialog titles (`text-22`).',
        },
        {
          name: 'type-bar-title',
          fontSize: '20px',
          lineHeight: 1.25,
          fontWeight: 700,
          sample: 'Closed tickets',
          usage: 'TitleBar and detail headings (`text-20`).',
        },
      ],
    },
    {
      name: 'Text',
      family: 'body',
      styles: [
        {
          name: 'type-body',
          fontSize: '16px',
          lineHeight: 1.4,
          fontWeight: 400,
          sample: 'Refrigeration tech booked for today 2–4 PM.',
          usage: 'Body copy and every field (16px so iOS never zooms).',
        },
        {
          name: 'type-card-title',
          fontSize: '16px',
          lineHeight: 1.3,
          fontWeight: 600,
          sample: 'Walk-in cooler not holding temp',
          usage: 'A ticket card title.',
        },
        {
          name: 'type-button',
          fontSize: '15px',
          lineHeight: 1.2,
          fontWeight: 700,
          sample: 'Create ticket',
          usage: 'Primary and secondary button labels (14 to 15px).',
        },
        {
          name: 'type-label',
          fontSize: '14px',
          lineHeight: 1.4,
          fontWeight: 600,
          sample: 'Your name',
          usage: 'Field labels, row titles, small buttons.',
        },
        {
          name: 'type-meta',
          fontSize: '13px',
          lineHeight: 1.35,
          fontWeight: 400,
          sample: 'Back of House · Refrigeration · Walk-in Cooler 1',
          usage: 'Meta lines under a title, in `text-muted`.',
        },
        {
          name: 'type-eyebrow',
          fontSize: '12px',
          lineHeight: 1.3,
          fontWeight: 700,
          letterSpacing: '0.06em',
          sample: 'THIS MONTH',
          usage: 'Eyebrows (the `eyebrow` utility): uppercase, `text-secondary`.',
        },
        {
          name: 'type-tag',
          fontSize: '11px',
          lineHeight: 1.2,
          fontWeight: 700,
          sample: 'URGENT',
          usage: 'URGENT and Walkthrough tags, count badges.',
        },
      ],
    },
    {
      name: 'Mono',
      family: 'mono',
      styles: [
        {
          name: 'type-id',
          fontSize: '12px',
          lineHeight: 1.3,
          fontWeight: 500,
          sample: 'OT-1042',
          usage: 'Ticket numbers on cards, in `text-muted`.',
        },
        {
          name: 'type-money',
          fontSize: '14px',
          lineHeight: 1.3,
          fontWeight: 500,
          sample: '$397.40 · KP-7XW-220418',
          usage: 'Money, serial numbers, ticket numbers in a header.',
        },
      ],
    },
  ],
}
