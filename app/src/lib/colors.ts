/**
 * Restaurant accent colors. Every restaurant has one, shown as the square
 * before its name, so no two may look alike. The database refuses an exact
 * repeat (restaurants_color_unique); this module catches near ones, which is
 * what the Add restaurant form warns about.
 *
 * The presets live in tokens.css (--preset-*), so they are read from the page
 * rather than copied here. Brand green and urgent orange are reserved: a
 * restaurant square in those colors would read as a status.
 */

export type Preset = { key: string; label: string }

/** Order matters: the first one free is picked for a new restaurant. */
export const PRESETS: Preset[] = [
  { key: 'ocean', label: 'Ocean' },
  { key: 'brick', label: 'Brick' },
  { key: 'walnut', label: 'Walnut' },
  { key: 'olive', label: 'Olive' },
  { key: 'slate', label: 'Slate' },
  { key: 'plum', label: 'Plum' },
  { key: 'charcoal', label: 'Charcoal' },
]

/** Tokens no restaurant may imitate. */
const RESERVED_TOKENS = ['--brand-fill', '--urgent']

/** Below this RGB distance two squares are hard to tell apart at 10px. */
export const TOO_CLOSE = 60

export function isHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

/** "a3336d", " #A3336D " → "#a3336d"; anything else is returned trimmed, unchanged. */
export function normalizeHex(value: string) {
  const v = value.trim()
  const withHash = v.startsWith('#') ? v : `#${v}`
  return isHex(withHash) ? withHash.toLowerCase() : v
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function distance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

/** True when `hex` is within TOO_CLOSE of any color in `taken`. */
export function tooClose(hex: string, taken: string[]) {
  return taken.some((t) => isHex(t) && distance(hex, t) < TOO_CLOSE)
}

/** Read a token's value from the page (theme-independent tokens only). */
export function readToken(name: string, root: Element = document.documentElement) {
  return getComputedStyle(root).getPropertyValue(name).trim().toLowerCase()
}

export function presetHex(key: string, root?: Element) {
  return readToken(`--preset-${key}`, root)
}

export function reservedColors(root?: Element) {
  return RESERVED_TOKENS.map((t) => readToken(t, root)).filter(isHex)
}
