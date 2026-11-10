/**
 * Fonts the editor offers. The three the app bundles (through @fontsource, static weights,
 * since WebKit on Windows ignores variable weight axes) load from the app's own CSS; any
 * other is fetched from Google Fonts while you try it. Exporting a new one means adding its
 * @fontsource package to the app, which the Export tab spells out.
 */
export type FontRole = 'display' | 'body' | 'mono'

export type Font = {
  id: string
  stack: string
  roles: FontRole[]
  weights: number[]
  fontsource: string
  bundled?: boolean
}

const sans = (name: string) => `'${name}', system-ui, sans-serif`
const mono = (name: string) => `'${name}', ui-monospace, monospace`
const pkg = (name: string) => `@fontsource/${name.toLowerCase().replace(/\s+/g, '-')}`
const UI: FontRole[] = ['display', 'body']
const W = [400, 500, 600, 700]

const ui = (id: string, roles: FontRole[] = UI, weights = W): Font => ({
  id,
  stack: sans(id),
  roles,
  weights,
  fontsource: pkg(id),
})
const code = (id: string): Font => ({ id, stack: mono(id), roles: ['mono'], weights: [400, 500], fontsource: pkg(id) })

export const FONTS: Font[] = [
  { ...ui('Archivo', UI, [500, 600, 700]), bundled: true },
  { ...ui('Public Sans'), bundled: true },
  { ...code('JetBrains Mono'), weights: [500], bundled: true },
  ui('Inter'),
  ui('IBM Plex Sans'),
  ui('DM Sans'),
  ui('Manrope'),
  ui('Work Sans'),
  ui('Source Sans 3'),
  ui('Figtree'),
  ui('Plus Jakarta Sans'),
  ui('Outfit'),
  ui('Barlow'),
  ui('Rubik'),
  ui('Space Grotesk', ['display']),
  ui('Sora', ['display']),
  ui('Bricolage Grotesque', ['display']),
  ui('Fraunces', ['display']),
  code('IBM Plex Mono'),
  code('DM Mono'),
  code('Fira Code'),
  code('Roboto Mono'),
  { ...code('Space Mono'), weights: [400, 700] },
]

export const fontById = (id: string) => FONTS.find((f) => f.id === id)

/** Load a font from Google Fonts once, unless the app already bundles it. */
export function ensureFontLoaded(font: Font) {
  if (font.bundled || typeof document === 'undefined') return
  const id = `gf-${font.fontsource}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.id).replace(/%20/g, '+')}:wght@${font.weights.join(';')}&display=swap`
  document.head.appendChild(link)
}
