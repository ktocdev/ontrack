/**
 * Color math for the token editor: parse what tokens.css and getComputedStyle write,
 * convert sRGB to OKLCH and back, keep a color inside sRGB, and measure WCAG contrast.
 * OKLCH is used because moving its hue or chroma keeps the lightness people see.
 */

export type Rgba = { r: number; g: number; b: number; a: number } // r, g, b in 0..1
export type Oklch = { l: number; c: number; h: number; a: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces, color(srgb r g b / a). */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)
  if (hex) {
    let h = hex[1]!
    if (h.length === 3) h = [...h].map((ch) => ch + ch).join('')
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 }
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(s)
  if (rgb) {
    const parts = rgb[1]!.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const ch = (p: string) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / 255)
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    return { r: ch(parts[0]!), g: ch(parts[1]!), b: ch(parts[2]!), a }
  }
  const srgb = /^color\(srgb\s+([^)]+)\)$/.exec(s)
  if (srgb) {
    const parts = srgb[1]!
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(parseFloat)
    if (parts.length < 3 || parts.some(Number.isNaN)) return null
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 }
  }
  return null
}

export const isColorLiteral = (s: string) => parseColor(s) !== null

const toHex2 = (n: number) =>
  Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, '0')

/** Opaque colors as #rrggbb, translucent ones as rgba(), the way tokens.css writes them. */
export function formatColor({ r, g, b, a }: Rgba): string {
  if (a >= 0.999) return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
  const c = (n: number) => Math.round(clamp01(n) * 255)
  return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.round(a * 100) / 100})`
}

export const toHex = (c: Rgba) => `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}`

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function toOklch({ r, g, b, a }: Rgba): Oklch {
  const lr = lin(r)
  const lg = lin(g)
  const lb = lin(b)
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const c = Math.hypot(A, B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h, a }
}

/** Unclamped: channels can fall outside 0..1 when the color is outside sRGB. */
function oklchToRgbRaw({ l, c, h, a }: Oklch): Rgba {
  const hr = (h * Math.PI) / 180
  const A = c * Math.cos(hr)
  const B = c * Math.sin(hr)
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3
  return {
    r: gam(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: gam(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: gam(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    a,
  }
}

const inGamut = ({ r, g, b }: Rgba) => [r, g, b].every((v) => v >= -0.0005 && v <= 1.0005)

/** Into sRGB by lowering chroma only, so lightness and hue stay what was asked for. */
export function fromOklch(color: Oklch): Rgba {
  const lch = { ...color, l: clamp01(color.l), c: Math.max(0, color.c) }
  let rgb = oklchToRgbRaw(lch)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = lch.c
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToRgbRaw({ ...lch, c: mid }))) lo = mid
      else hi = mid
    }
    rgb = oklchToRgbRaw({ ...lch, c: lo })
  }
  return { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b), a: rgb.a }
}

function luminance({ r, g, b }: Rgba) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Paint a translucent color over an opaque one. */
export function over(top: Rgba, under: Rgba): Rgba {
  const a = top.a
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 }
}

/** WCAG 2 contrast ratio, 1 to 21. A translucent foreground is painted on the background first. */
export function contrast(fg: Rgba, bg: Rgba): number {
  const f = luminance(fg.a < 1 ? over(fg, bg) : fg)
  const b = luminance(bg)
  const [hi, lo] = f > b ? [f, b] : [b, f]
  return (hi + 0.05) / (lo + 0.05)
}

/** Shortest signed distance between two hues, in degrees. */
export function hueDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}
