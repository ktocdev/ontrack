// Generates the PWA icon set from the OnTrack mark (rounded square, brand green, white check).
// Run once with `npm run icons`; the PNGs are committed so CI does not need sharp.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const BRAND = '#12634F'
const out = new URL('../public/', import.meta.url)

/** The mark at 28×28 as drawn in the design header; `pad` adds a margin for maskable icons. */
function mark(size, { radius = 8 / 28, pad = 0, transparentBg = false } = {}) {
  const inner = size * (1 - pad * 2)
  const offset = size * pad
  const rx = inner * radius
  const bg = transparentBg ? '' : `<rect width="${size}" height="${size}" fill="${BRAND}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <rect x="${offset}" y="${offset}" width="${inner}" height="${inner}" rx="${rx}" fill="${BRAND}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 28})">
    <path d="M8 15l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

await mkdir(out, { recursive: true })
await writeFile(new URL('favicon.svg', out), mark(28, { transparentBg: true }))

const jobs = [
  ['pwa-192.png', mark(192, { transparentBg: true })],
  ['pwa-512.png', mark(512, { transparentBg: true })],
  ['maskable-512.png', mark(512, { pad: 0.1, radius: 0 })],
  ['apple-touch-icon.png', mark(180, { radius: 0 })],
]
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg))
    .png()
    .toFile(new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  console.log('wrote', name)
}
