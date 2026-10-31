import { describe, expect, it } from 'vitest'
import { isHex, normalizeHex, presetHex, reservedColors } from './colors'

describe('restaurant colors', () => {
  it('accepts six-digit hex only', () => {
    expect(isHex('#A3336D')).toBe(true)
    expect(isHex('#a3336d')).toBe(true)
    for (const bad of ['A3336D', '#A333', '#GGGGGG', 'teal', '']) expect(isHex(bad), bad).toBe(false)
  })

  it('normalizes what people type into the hex field', () => {
    expect(normalizeHex(' A3336D ')).toBe('#a3336d')
    expect(normalizeHex('#C2185B')).toBe('#c2185b')
    expect(normalizeHex('#C21')).toBe('#C21')
  })

  it('reads presets and reserved colors from the tokens', () => {
    document.head.innerHTML =
      '<style>:root { --preset-ocean: #0E7490; --brand-fill: #12634f; --urgent: #b4400c }</style>'
    expect(presetHex('ocean')).toBe('#0e7490')
    expect(reservedColors()).toEqual(['#12634f', '#b4400c'])
  })
})
