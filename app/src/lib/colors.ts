/**
 * Restaurant accent colors. Every restaurant has one, shown as the square
 * before its name. The database refuses an exact repeat
 * (restaurants_color_unique); two that only look alike are allowed.
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

export function isHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

/** "a3336d", " #A3336D " → "#a3336d"; anything else is returned trimmed, unchanged. */
export function normalizeHex(value: string) {
  const v = value.trim()
  const withHash = v.startsWith('#') ? v : `#${v}`
  return isHex(withHash) ? withHash.toLowerCase() : v
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
